import { open } from "@tauri-apps/plugin-shell";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownPreview({ content }: { content: string }) {
  return (
    <article className="markdown-preview mx-auto max-w-4xl px-7 py-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href, title }) => (
            <a
              href={href}
              title={title}
              onClick={(e) => {
                if (href) {
                  e.preventDefault();
                  open(href).catch(() => {});
                }
              }}
            >
              {children}
            </a>
          ),
          img: ({ alt }) => <span>[Image: {alt || "no description"}]</span>,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
