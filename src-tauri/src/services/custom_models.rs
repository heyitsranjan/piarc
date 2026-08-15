use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    time::Duration,
};

use anyhow::{bail, Context, Result};
use reqwest::{Client, StatusCode, Url};
use serde::{Deserialize, Serialize};
use serde_json::json;
use serde_yaml::Value;
use uuid::Uuid;

use crate::models::{ConnectionReport, CustomModel, CustomModelApi, CustomModelDraft};

const PROVIDER_PREFIX: &str = "ompx-";
const KEYCHAIN_ACCOUNT: &str = "ompx";
const KEYCHAIN_SERVICE_PREFIX: &str = "com.heyitsranjan.ompx.provider.";
const MODEL_ROLES: [&str; 11] = [
    "default", "smol", "slow", "vision", "plan", "designer", "commit", "tiny", "task", "advisor",
    "fallback",
];

#[cfg(target_os = "macos")]
mod keychain_acl {
    use std::{
        ffi::{c_char, c_void, CString},
        os::unix::ffi::OsStrExt,
        ptr,
    };

    use anyhow::{bail, Context, Result};
    use core_foundation::{
        array::CFArray,
        base::{CFTypeID, TCFType},
        declare_TCFType, impl_TCFType,
        string::{CFString, CFStringRef},
    };
    use security_framework::{
        os::macos::access::SecAccess,
        passwords::{set_generic_password_options, PasswordOptions},
    };
    use security_framework_sys::base::SecAccessRef;

    type SecTrustedApplicationRef = *mut c_void;

    declare_TCFType! {
        SecTrustedApplication, SecTrustedApplicationRef
    }
    impl_TCFType!(
        SecTrustedApplication,
        SecTrustedApplicationRef,
        SecTrustedApplicationGetTypeID
    );

    unsafe impl Send for SecTrustedApplication {}
    unsafe impl Sync for SecTrustedApplication {}

    #[allow(non_upper_case_globals)]
    #[link(name = "Security", kind = "framework")]
    extern "C" {
        static kSecAttrAccess: CFStringRef;
        fn SecTrustedApplicationGetTypeID() -> CFTypeID;
        fn SecTrustedApplicationCreateFromPath(
            path: *const c_char,
            application: *mut SecTrustedApplicationRef,
        ) -> i32;
        fn SecAccessCreate(
            descriptor: CFStringRef,
            trusted_list: core_foundation::array::CFArrayRef,
            access: *mut SecAccessRef,
        ) -> i32;
    }

    pub fn set_password(service: &str, account: &str, secret: &[u8]) -> Result<()> {
        let access = create_access()?;
        let mut options = PasswordOptions::new_generic_password(service, account);
        #[allow(deprecated)]
        options.query.push((
            unsafe { CFString::wrap_under_get_rule(kSecAttrAccess) },
            access.into_CFType(),
        ));
        set_generic_password_options(secret, options)
            .context("failed to store API key in macOS Keychain")
    }

    fn create_access() -> Result<SecAccess> {
        let executable = std::env::current_exe().context("failed to locate OMPX executable")?;
        let executable_path = CString::new(executable.as_os_str().as_bytes())
            .context("invalid OMPX executable path")?;
        let current = trusted_application(Some(&executable_path))?;
        let security_path = CString::new("/usr/bin/security").unwrap();
        let security = trusted_application(Some(&security_path))?;
        let trusted = CFArray::from_CFTypes(&[current, security]);
        let descriptor = CFString::new("OMPX custom model credential");
        let mut access_ref = ptr::null_mut();
        status(unsafe {
            SecAccessCreate(
                descriptor.as_concrete_TypeRef(),
                trusted.as_concrete_TypeRef(),
                &mut access_ref,
            )
        })
        .context("failed to create Keychain access policy")?;
        Ok(unsafe { SecAccess::wrap_under_create_rule(access_ref) })
    }

    fn trusted_application(path: Option<&CString>) -> Result<SecTrustedApplication> {
        let mut application = ptr::null_mut();
        status(unsafe {
            SecTrustedApplicationCreateFromPath(
                path.map_or(ptr::null(), |value| value.as_ptr()),
                &mut application,
            )
        })
        .context("failed to create trusted Keychain application")?;
        Ok(unsafe { SecTrustedApplication::wrap_under_create_rule(application) })
    }

    fn status(value: i32) -> Result<()> {
        if value == 0 {
            Ok(())
        } else {
            bail!("macOS Security error {value}")
        }
    }
}

pub async fn test(draft: &CustomModelDraft) -> Result<ConnectionReport> {
    validate_draft(draft, false)?;
    let mut effective = draft.clone();
    if effective.api_key.trim().is_empty() {
        let provider_id = provider_id(&effective.provider_name)?;
        effective.api_key = String::from_utf8(get_secret(&keychain_service(&provider_id))?)
            .context("stored API key is not valid UTF-8")?;
    }
    if effective.api_key.trim().is_empty() {
        bail!("API key is required");
    }
    let url = endpoint(&effective)?;
    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .context("failed to create HTTP client")?;

    let request =
        match effective.api {
            CustomModelApi::OpenaiCompletions => client
                .post(url)
                .bearer_auth(&effective.api_key)
                .json(&json!({
                    "model": effective.model_id.trim(),
                    "messages": [{"role": "user", "content": "Reply OK"}],
                    "max_tokens": 1,
                    "stream": false
                })),
            CustomModelApi::OpenaiResponses => client
                .post(url)
                .bearer_auth(&effective.api_key)
                .json(&json!({
                    "model": effective.model_id.trim(),
                    "input": "Reply OK",
                    "max_output_tokens": 16,
                    "stream": false
                })),
            CustomModelApi::AnthropicMessages => client
                .post(url)
                .header("x-api-key", effective.api_key.trim())
                .header("anthropic-version", "2023-06-01")
                .json(&json!({
                    "model": effective.model_id.trim(),
                    "messages": [{"role": "user", "content": "Reply OK"}],
                    "max_tokens": 1,
                    "stream": false
                })),
        };

    let response = request.send().await.context("connection failed")?;
    let status = response.status();
    if !status.is_success() {
        bail!(status_message(status));
    }

    Ok(ConnectionReport {
        success: true,
        message: "Endpoint, credentials, and model accepted the test request.".into(),
    })
}

pub fn save(draft: &CustomModelDraft) -> Result<CustomModel> {
    validate(draft)?;
    let provider_id = provider_id(&draft.provider_name)?;
    let service = keychain_service(&provider_id);
    let previous_key = get_secret(&service).ok();
    set_secret(&service, draft.api_key.trim().as_bytes())?;

    let result = save_config(draft, &provider_id, None);
    if result.is_err() {
        if let Some(secret) = previous_key {
            let _ = set_secret(&service, &secret);
        } else {
            let _ = delete_secret(&service);
        }
    }
    result
}

pub fn list() -> Result<Vec<CustomModel>> {
    let path = models_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    reject_symlink(&path)?;
    let config: ModelsConfig = serde_yaml::from_str(
        &fs::read_to_string(&path).with_context(|| format!("failed to read {}", path.display()))?,
    )
    .with_context(|| format!("invalid OMP model configuration at {}", path.display()))?;

    let mut models = Vec::new();
    for (provider_id, provider) in config.providers {
        if !provider_id.starts_with(PROVIDER_PREFIX) {
            continue;
        }
        let Some(base_url) = provider.base_url else {
            continue;
        };
        for model in provider.models {
            let (Some(model_id), Some(name), Some(api)) = (model.id, model.name, model.api) else {
                continue;
            };
            let Some(api) = parse_api(&api) else {
                continue;
            };
            let image_input = model
                .input
                .as_ref()
                .is_some_and(|input| input.iter().any(|kind| kind == "image"));
            models.push(CustomModel {
                provider_name: provider_id
                    .trim_start_matches(PROVIDER_PREFIX)
                    .replace('-', " "),
                provider_id: provider_id.clone(),
                name,
                model_id,
                base_url: base_url.clone(),
                api,
                reasoning: model.reasoning.unwrap_or(false),
                image_input,
                context_window: model.context_window.unwrap_or(128_000),
                max_tokens: model.max_tokens.unwrap_or(8_192),
            });
        }
    }
    Ok(models)
}

pub fn update(
    original_provider_id: &str,
    original_model_id: &str,
    draft: &CustomModelDraft,
) -> Result<CustomModel> {
    validate_draft(draft, false)?;
    let original_selector = format!("{original_provider_id}/{original_model_id}");
    if !list()?.iter().any(|model| {
        model.provider_id == original_provider_id && model.model_id == original_model_id
    }) {
        bail!("Custom model no longer exists");
    }

    let new_provider_id = provider_id(&draft.provider_name)?;
    let old_service = keychain_service(original_provider_id);
    let new_service = keychain_service(&new_provider_id);
    let old_secret = get_secret(&old_service)?;
    let new_secret = if draft.api_key.trim().is_empty() {
        old_secret.clone()
    } else {
        draft.api_key.trim().as_bytes().to_vec()
    };
    let previous_new_secret = get_secret(&new_service).ok();
    set_secret(&new_service, &new_secret)?;

    let result = save_config(
        draft,
        &new_provider_id,
        Some((original_provider_id, original_model_id)),
    );
    let model = match result {
        Ok(model) => model,
        Err(error) => {
            if let Some(secret) = previous_new_secret {
                let _ = set_secret(&new_service, &secret);
            } else {
                let _ = delete_secret(&new_service);
            }
            return Err(error);
        }
    };

    let new_selector = format!("{}/{}", model.provider_id, model.model_id);
    replace_role_selector(&original_selector, Some(&new_selector))?;
    if original_provider_id != new_provider_id
        && !list()?
            .iter()
            .any(|saved| saved.provider_id == original_provider_id)
    {
        delete_secret(&old_service)?;
    }
    Ok(model)
}

pub fn delete(provider_id: &str, model_id: &str) -> Result<()> {
    if !provider_id.starts_with(PROVIDER_PREFIX) {
        bail!("Only OMPX custom models can be deleted");
    }
    let path = models_path()?;
    reject_symlink(&path)?;
    let mut config: ModelsConfig = serde_yaml::from_str(
        &fs::read_to_string(&path).with_context(|| format!("failed to read {}", path.display()))?,
    )
    .with_context(|| format!("invalid OMP model configuration at {}", path.display()))?;
    let provider = config
        .providers
        .get_mut(provider_id)
        .context("Custom model no longer exists")?;
    let before = provider.models.len();
    provider
        .models
        .retain(|model| model.id.as_deref() != Some(model_id));
    if provider.models.len() == before {
        bail!("Custom model no longer exists");
    }
    let remove_provider = provider.models.is_empty();
    if remove_provider {
        config.providers.remove(provider_id);
    }
    let serialized = serde_yaml::to_string(&config).context("failed to serialize OMP models")?;
    atomic_write(&path, &serialized)?;

    let selector = format!("{provider_id}/{model_id}");
    replace_role_selector(&selector, None)?;
    if remove_provider {
        delete_secret(&keychain_service(provider_id))?;
    }
    Ok(())
}

fn replace_role_selector(previous: &str, replacement: Option<&str>) -> Result<()> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(());
    }
    reject_symlink(&path)?;
    let mut config: OmpConfig = serde_yaml::from_str(
        &fs::read_to_string(&path).with_context(|| format!("failed to read {}", path.display()))?,
    )
    .with_context(|| format!("invalid OMP configuration at {}", path.display()))?;
    let mut changed = false;
    for selector in config.model_roles.values_mut() {
        if selector == previous {
            if let Some(replacement) = replacement {
                *selector = replacement.into();
            } else {
                selector.clear();
            }
            changed = true;
        }
    }
    config
        .model_roles
        .retain(|_, selector| !selector.is_empty());
    if changed {
        let serialized =
            serde_yaml::to_string(&config).context("failed to serialize OMP configuration")?;
        atomic_write(&path, &serialized)?;
    }
    Ok(())
}

pub fn list_roles() -> Result<BTreeMap<String, String>> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(BTreeMap::new());
    }
    reject_symlink(&path)?;
    let config: OmpConfig = serde_yaml::from_str(
        &fs::read_to_string(&path).with_context(|| format!("failed to read {}", path.display()))?,
    )
    .with_context(|| format!("invalid OMP configuration at {}", path.display()))?;
    Ok(config.model_roles)
}

pub fn set_role(role: &str, selector: Option<&str>) -> Result<BTreeMap<String, String>> {
    let models = list()?;
    set_role_at(&config_path()?, role, selector, &models)
}

fn set_role_at(
    path: &Path,
    role: &str,
    selector: Option<&str>,
    models: &[CustomModel],
) -> Result<BTreeMap<String, String>> {
    if !MODEL_ROLES.contains(&role) {
        bail!("Unsupported OMP model use case");
    }
    if let Some(selector) = selector {
        let configured = models
            .iter()
            .any(|model| format!("{}/{}", model.provider_id, model.model_id) == selector);
        if !configured {
            bail!("Model is not configured in OMPX");
        }
    }

    let mut config = if path.exists() {
        reject_symlink(path)?;
        serde_yaml::from_str::<OmpConfig>(
            &fs::read_to_string(path)
                .with_context(|| format!("failed to read {}", path.display()))?,
        )
        .with_context(|| format!("invalid OMP configuration at {}", path.display()))?
    } else {
        OmpConfig::default()
    };
    if let Some(selector) = selector {
        config.model_roles.insert(role.into(), selector.into());
    } else {
        config.model_roles.remove(role);
    }
    let serialized =
        serde_yaml::to_string(&config).context("failed to serialize OMP configuration")?;
    atomic_write(path, &serialized)?;
    Ok(config.model_roles)
}

fn save_config(
    draft: &CustomModelDraft,
    provider_id: &str,
    original: Option<(&str, &str)>,
) -> Result<CustomModel> {
    let path = models_path()?;
    let parent = path.parent().context("OMP models path has no parent")?;
    fs::create_dir_all(parent).with_context(|| format!("failed to create {}", parent.display()))?;
    reject_symlink(&path)?;

    let mut config = if path.exists() {
        serde_yaml::from_str::<ModelsConfig>(
            &fs::read_to_string(&path)
                .with_context(|| format!("failed to read {}", path.display()))?,
        )
        .with_context(|| format!("invalid OMP model configuration at {}", path.display()))?
    } else {
        ModelsConfig::default()
    };

    if let Some((original_provider_id, original_model_id)) = original {
        if let Some(provider) = config.providers.get_mut(original_provider_id) {
            provider
                .models
                .retain(|model| model.id.as_deref() != Some(original_model_id));
            if provider.models.is_empty() {
                config.providers.remove(original_provider_id);
            }
        }
    }

    let provider = config.providers.entry(provider_id.into()).or_default();
    provider.base_url = Some(draft.base_url.trim_end_matches('/').into());
    provider.api_key = Some(format!(
        "!/usr/bin/security find-generic-password -a {KEYCHAIN_ACCOUNT} -s {} -w",
        keychain_service(provider_id)
    ));
    provider.api = Some(draft.api.as_str().into());
    provider.auth_header = Some(!matches!(draft.api, CustomModelApi::AnthropicMessages));
    provider
        .models
        .retain(|model| model.id.as_deref() != Some(draft.model_id.trim()));
    provider.models.push(ModelConfig {
        id: Some(draft.model_id.trim().into()),
        name: Some(draft.name.trim().into()),
        api: Some(draft.api.as_str().into()),
        reasoning: Some(draft.reasoning),
        input: Some(if draft.image_input {
            vec!["text".into(), "image".into()]
        } else {
            vec!["text".into()]
        }),
        context_window: Some(draft.context_window),
        max_tokens: Some(draft.max_tokens),
        extra: BTreeMap::new(),
    });

    let serialized = serde_yaml::to_string(&config).context("failed to serialize OMP models")?;
    atomic_write(&path, &serialized)?;

    Ok(CustomModel {
        provider_id: provider_id.into(),
        provider_name: draft.provider_name.trim().into(),
        name: draft.name.trim().into(),
        model_id: draft.model_id.trim().into(),
        base_url: draft.base_url.trim_end_matches('/').into(),
        api: draft.api.clone(),
        reasoning: draft.reasoning,
        image_input: draft.image_input,
        context_window: draft.context_window,
        max_tokens: draft.max_tokens,
    })
}

fn validate(draft: &CustomModelDraft) -> Result<()> {
    validate_draft(draft, true)
}

fn validate_draft(draft: &CustomModelDraft, require_api_key: bool) -> Result<()> {
    for (label, value) in [
        ("Display name", draft.name.trim()),
        ("Provider name", draft.provider_name.trim()),
        ("Base URL", draft.base_url.trim()),
        ("Model ID", draft.model_id.trim()),
    ] {
        if value.is_empty() {
            bail!("{label} is required");
        }
    }
    if require_api_key && draft.api_key.trim().is_empty() {
        bail!("API key is required");
    }
    if draft.name.len() > 100 || draft.provider_name.len() > 100 || draft.model_id.len() > 256 {
        bail!("Model identity is too long");
    }
    if draft.context_window == 0 || draft.max_tokens == 0 {
        bail!("Token limits must be positive");
    }
    if draft.max_tokens > draft.context_window {
        bail!("Maximum output tokens cannot exceed the context window");
    }

    let url = Url::parse(draft.base_url.trim()).context("Base URL is invalid")?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1"));
    if url.scheme() != "https" && !(url.scheme() == "http" && local) {
        bail!("Base URL must use HTTPS unless it is localhost");
    }
    Ok(())
}

fn endpoint(draft: &CustomModelDraft) -> Result<Url> {
    let suffix = match draft.api {
        CustomModelApi::OpenaiCompletions => "chat/completions",
        CustomModelApi::OpenaiResponses => "responses",
        CustomModelApi::AnthropicMessages => "messages",
    };
    Url::parse(&format!(
        "{}/{suffix}",
        draft.base_url.trim().trim_end_matches('/')
    ))
    .context("Base URL is invalid")
}

fn provider_id(name: &str) -> Result<String> {
    let slug = name
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if slug.is_empty() {
        bail!("Provider name must contain a letter or number");
    }
    Ok(format!("{PROVIDER_PREFIX}{slug}"))
}

fn status_message(status: StatusCode) -> String {
    match status {
        StatusCode::UNAUTHORIZED => "Authentication failed (HTTP 401). Check the API key.".into(),
        StatusCode::FORBIDDEN => {
            "Provider denied access (HTTP 403). Check the key and model permissions.".into()
        }
        StatusCode::NOT_FOUND => "Provider endpoint or model was not found (HTTP 404).".into(),
        _ => format!(
            "Provider rejected the test request (HTTP {}).",
            status.as_u16()
        ),
    }
}

fn parse_api(value: &str) -> Option<CustomModelApi> {
    match value {
        "openai-completions" => Some(CustomModelApi::OpenaiCompletions),
        "openai-responses" => Some(CustomModelApi::OpenaiResponses),
        "anthropic-messages" => Some(CustomModelApi::AnthropicMessages),
        _ => None,
    }
}

fn models_path() -> Result<PathBuf> {
    Ok(dirs::home_dir()
        .context("home directory is unavailable")?
        .join(".omp/agent/models.yml"))
}

fn config_path() -> Result<PathBuf> {
    Ok(dirs::home_dir()
        .context("home directory is unavailable")?
        .join(".omp/agent/config.yml"))
}

fn atomic_write(path: &Path, contents: &str) -> Result<()> {
    let parent = path
        .parent()
        .context("OMP configuration path has no parent")?;
    fs::create_dir_all(parent).with_context(|| format!("failed to create {}", parent.display()))?;
    reject_symlink(path)?;
    if path.exists() {
        fs::copy(path, path.with_extension("yml.bak"))
            .with_context(|| format!("failed to back up {}", path.display()))?;
    }

    let temporary = parent.join(format!(".config-{}.tmp", Uuid::new_v4()));
    let write_result = (|| -> Result<()> {
        let mut file = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)
            .with_context(|| format!("failed to create {}", temporary.display()))?;
        file.write_all(contents.as_bytes())?;
        file.sync_all()?;
        fs::rename(&temporary, path)
            .with_context(|| format!("failed to replace {}", path.display()))
    })();
    if write_result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    write_result
}

fn reject_symlink(path: &std::path::Path) -> Result<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            bail!("OMP models configuration cannot be a symbolic link")
        }
        Ok(metadata) if !metadata.is_file() => bail!("OMP models path is not a regular file"),
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error).with_context(|| format!("failed to inspect {}", path.display())),
    }
}

fn keychain_service(provider_id: &str) -> String {
    format!("{KEYCHAIN_SERVICE_PREFIX}{provider_id}")
}

#[cfg(target_os = "macos")]
fn set_secret(service: &str, secret: &[u8]) -> Result<()> {
    match security_framework::passwords::delete_generic_password(service, KEYCHAIN_ACCOUNT) {
        Ok(()) => {}
        Err(error) if error.code() == security_framework_sys::base::errSecItemNotFound => {}
        Err(error) => return Err(error).context("failed to replace API key in macOS Keychain"),
    }
    keychain_acl::set_password(service, KEYCHAIN_ACCOUNT, secret)
}

#[cfg(target_os = "macos")]
fn get_secret(service: &str) -> Result<Vec<u8>> {
    security_framework::passwords::get_generic_password(service, KEYCHAIN_ACCOUNT)
        .context("failed to read API key from macOS Keychain")
}

#[cfg(target_os = "macos")]
fn delete_secret(service: &str) -> Result<()> {
    security_framework::passwords::delete_generic_password(service, KEYCHAIN_ACCOUNT)
        .context("failed to delete API key from macOS Keychain")
}

#[cfg(not(target_os = "macos"))]
fn set_secret(_service: &str, _secret: &[u8]) -> Result<()> {
    Err(anyhow::anyhow!(
        "custom model credentials require macOS Keychain"
    ))
}

#[cfg(not(target_os = "macos"))]
fn get_secret(_service: &str) -> Result<Vec<u8>> {
    Err(anyhow::anyhow!(
        "custom model credentials require macOS Keychain"
    ))
}

#[cfg(not(target_os = "macos"))]
fn delete_secret(_service: &str) -> Result<()> {
    Err(anyhow::anyhow!(
        "custom model credentials require macOS Keychain"
    ))
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OmpConfig {
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    model_roles: BTreeMap<String, String>,
    #[serde(flatten)]
    extra: BTreeMap<String, Value>,
}

#[derive(Default, Deserialize, Serialize)]
struct ModelsConfig {
    #[serde(default)]
    providers: BTreeMap<String, ProviderConfig>,
    #[serde(flatten)]
    extra: BTreeMap<String, Value>,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    base_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    api_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    api: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    auth_header: Option<bool>,
    #[serde(default)]
    models: Vec<ModelConfig>,
    #[serde(flatten)]
    extra: BTreeMap<String, Value>,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    api: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    reasoning: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    input: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    context_window: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u64>,
    #[serde(flatten)]
    extra: BTreeMap<String, Value>,
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        io::{Read, Write},
        net::TcpListener,
        thread,
    };

    use super::{provider_id, set_role_at, test, validate};
    use crate::models::{CustomModel, CustomModelApi, CustomModelDraft};

    fn draft() -> CustomModelDraft {
        CustomModelDraft {
            name: "Work Claude".into(),
            provider_name: "Company Portkey".into(),
            base_url: "https://api.portkey.ai/v1".into(),
            api_key: "secret".into(),
            model_id: "@anthropic/claude".into(),
            api: CustomModelApi::OpenaiCompletions,
            reasoning: true,
            image_input: false,
            context_window: 128_000,
            max_tokens: 8_192,
        }
    }

    #[test]
    fn provider_names_become_isolated_ids() {
        assert_eq!(
            provider_id(" Company Portkey ").unwrap(),
            "ompx-company-portkey"
        );
    }

    #[test]
    fn rejects_non_local_plain_http() {
        let mut value = draft();
        value.base_url = "http://api.example.com/v1".into();
        assert!(validate(&value).is_err());
        value.base_url = "http://127.0.0.1:11434/v1".into();
        assert!(validate(&value).is_ok());
    }

    #[test]
    fn connection_test_authenticates_and_targets_the_model() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0; 4096];
            let length = stream.read(&mut request).unwrap();
            let request = String::from_utf8_lossy(&request[..length]);
            assert!(request.starts_with("POST /v1/chat/completions "));
            assert!(request
                .to_ascii_lowercase()
                .contains("authorization: bearer secret"));
            assert!(request.contains("@anthropic/claude"));
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}")
                .unwrap();
        });

        let mut value = draft();
        value.base_url = format!("http://{address}/v1");
        let report = tauri::async_runtime::block_on(test(&value)).unwrap();
        assert!(report.success);
        server.join().unwrap();
    }

    #[test]
    fn role_assignment_preserves_unrelated_config() {
        let root = std::env::temp_dir().join(format!("ompx-role-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("config.yml");
        fs::write(&path, "theme: dark\nmodelRoles:\n  slow: built-in/model\n").unwrap();
        let model = CustomModel {
            provider_id: "ompx-work".into(),
            provider_name: "Work".into(),
            name: "Claude".into(),
            model_id: "claude".into(),
            base_url: "https://example.com/v1".into(),
            api: CustomModelApi::OpenaiCompletions,
            reasoning: false,
            image_input: false,
            context_window: 128_000,
            max_tokens: 8_192,
        };

        let roles = set_role_at(&path, "task", Some("ompx-work/claude"), &[model]).unwrap();
        let saved = fs::read_to_string(&path).unwrap();
        assert_eq!(roles.get("slow").unwrap(), "built-in/model");
        assert_eq!(roles.get("task").unwrap(), "ompx-work/claude");
        assert!(saved.contains("theme: dark"));
        assert!(set_role_at(&path, "unknown", None, &[]).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
