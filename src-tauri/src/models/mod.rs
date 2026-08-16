//! Data models shared across commands and services.
pub mod completion;
pub mod custom_model;
pub mod editor;
pub mod git;
pub mod session;
pub use completion::{OmpCommand, OmpPathSuggestion};
pub use custom_model::{
    ConnectionReport, CustomModel, CustomModelApi, CustomModelCost, CustomModelDraft,
};
pub use editor::InstalledEditor;
pub use git::{GitChangesSnapshot, GitFileChange};
pub use session::OmpSession;
