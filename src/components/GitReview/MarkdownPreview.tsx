import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownPreview({ content }: { content: string }) {
  return (
    <article className="markdown-preview mx-auto max-w-4xl px-7 py-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href, title }) => (
            <a aria-disabled="true" title={href ? `Link disabled: ${href}` : title}>
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
