import { Suspense, lazy, useEffect, useMemo, useState } from "react";

import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("css", css);
hljs.registerLanguage("go", go);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);

hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

const MarkdownPreview = lazy(() => import("./MarkdownPreview"));

interface FileViewerProps {
  file: string | null;
  content: string;
  loading: boolean;
  error: string | null;
  onBack: () => void;
}

type MarkdownView = "preview" | "raw";

const LANGUAGES: Record<string, string> = {
  bash: "bash",
  c: "c",
  cc: "cpp",
  cpp: "cpp",
  css: "css",
  go: "go",
  h: "c",
  html: "xml",
  ini: "ini",
  java: "java",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  md: "markdown",
  py: "python",
  rs: "rust",
  sh: "bash",
  sql: "sql",
  toml: "ini",
  ts: "typescript",
  tsx: "typescript",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
};
export default function FileViewer({
  file,
  content,
  loading,
  error,
  onBack,
}: FileViewerProps) {
  const [markdownView, setMarkdownView] = useState<MarkdownView>("preview");
  const language = file ? languageFor(file) : null;
  const highlighted = useMemo(
    () => (language ? hljs.highlight(content, { language }).value : null),
    [content, language]
  );
  const isMarkdown = language === "markdown";

  useEffect(() => setMarkdownView("preview"), [file]);

  if (!file) return <Empty message="Select a file to inspect its contents" />;

  return (
    <div className="flex h-full min-w-0 flex-col bg-[var(--color-code-bg)]">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-elev)] px-2">
        <button
          type="button"
          onClick={onBack}
          className="git-review-back hidden h-6 items-center rounded-[var(--radius-sm)] px-1.5 text-[11px]
            text-[var(--color-ink-5)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-1)]"
        >
          Files
        </button>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--color-ink-1)]">
          {file}
        </span>
        {isMarkdown && (
          <div
            aria-label="Markdown view"
            className="flex shrink-0 items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] p-px"
          >
            {(["preview", "raw"] as const).map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={markdownView === view}
                onClick={() => setMarkdownView(view)}
                className={cn(
                  "h-5 rounded-[3px] px-2 text-[10px] capitalize text-[var(--color-ink-7)]",
                  "hover:text-[var(--color-ink-1)]",
                  markdownView === view &&
                    "bg-[var(--color-bg-hi)] text-[var(--color-ink-0)]"
                )}
              >
                {view}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-full min-h-32 items-center justify-center gap-2 text-[11px] text-[var(--color-ink-7)]">
            <Loader2 size={13} className="animate-spin" />
            Loading file…
          </div>
        ) : error ? (
          <Empty message={error} danger />
        ) : content.length === 0 ? (
          <Empty message="File is empty" />
        ) : isMarkdown && markdownView === "preview" ? (
          <Suspense fallback={<Empty message="Rendering preview…" />}>
            <MarkdownPreview content={content} />
          </Suspense>
        ) : (
          <pre className="source-viewer min-w-max p-3 font-mono text-[11px] leading-[1.55] text-[var(--color-ink-3)]">
            {highlighted && language ? (
              <code
                className={`language-${language}`}
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            ) : (
              <code>{content}</code>
            )}
          </pre>
        )}
      </div>
    </div>
  );
}

function Empty({ message, danger = false }: { message: string; danger?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-full min-h-32 items-center justify-center px-6 text-center text-[11px]",
        danger ? "text-[var(--color-danger)]" : "text-[var(--color-ink-7)]"
      )}
    >
      {message}
    </div>
  );
}

function languageFor(path: string) {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  if (name === "dockerfile") return "bash";
  if (name === ".env" || name.startsWith(".env.")) return "ini";
  return LANGUAGES[name.split(".").pop() ?? ""] ?? null;
}
