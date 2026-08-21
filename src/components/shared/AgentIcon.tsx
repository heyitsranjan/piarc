/**
 * @module components/shared/AgentIcon
 * Brand icons for each AI agent type.
 *
 * All icons use `fill="currentColor"` — color them via a CSS `text-*` utility
 * on the parent or via the `className` prop.
 *
 * Sources:
 * - `claude`  — Anthropic "A" mark, simple-icons (viewBox 0 0 24 24)
 * - `codex`   — OpenAI spiral, simple-icons (viewBox 0 0 24 24)
 * - `omp`     — oh-my-pi π letterform, extracted from `tray-icon.svg` (viewBox 0 0 64 64)
 */
import type { AgentType } from "@/store/terminal";

// ─── SVG path constants ──────────────────────────────────────────────────────

/** Anthropic "A" mark path data (viewBox 0 0 24 24). */
const CLAUDE_PATH =
  "M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z";

/** OpenAI spiral path data (viewBox 0 0 24 24). */
const CODEX_PATH =
  "M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zm-9.022 12.61a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5z";

/** oh-my-pi π letterform path data (viewBox 0 0 64 64). */
const OMP_PATH = "M14 10h36v9H40v39h-9V19h-5v29h-9V19h-3z";

// ─── Component ───────────────────────────────────────────────────────────────

interface AgentIconProps {
  /** Agent whose brand icon to render. */
  agent: AgentType;
  /** Icon size in pixels. Defaults to `13`. */
  size?: number;
  /** Additional CSS classes — typically a `text-*` color utility. */
  className?: string;
}

/**
 * Renders the brand icon for a given AI agent.
 * Color is inherited via `currentColor` — set it with a `text-*` utility.
 *
 * @example
 * <AgentIcon agent="omp" size={13} className="text-[var(--color-ink-7)]" />
 * <AgentIcon agent="claude" size={16} className="text-[var(--color-accent)]" />
 */
export function AgentIcon({ agent, size = 13, className }: AgentIconProps) {
  const props = {
    width: size,
    height: size,
    fill: "currentColor",
    "aria-hidden": true as const,
    xmlns: "http://www.w3.org/2000/svg",
    className,
  };

  if (agent === "claude") {
    return (
      <svg {...props} viewBox="0 0 24 24">
        <path d={CLAUDE_PATH} />
      </svg>
    );
  }

  if (agent === "codex") {
    return (
      <svg {...props} viewBox="0 0 24 24">
        <path d={CODEX_PATH} />
      </svg>
    );
  }

  // agent === "omp"
  return (
    <svg {...props} viewBox="0 0 64 64">
      <path d={OMP_PATH} />
    </svg>
  );
}
