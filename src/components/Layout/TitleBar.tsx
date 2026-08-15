/** Global window chrome shared by the sidebar and terminal. */
import { getCurrentWindow } from "@tauri-apps/api/window";
import { FileDiff, Loader2, PanelLeft, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { useNewSession } from "@/hooks/useNewSession";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/sessions";
import { useUiStore } from "@/store/ui";

export default function TitleBar() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const activeSession = useSessionStore((state) => state.activeSession);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const gitReviewOpen = useUiStore((state) => state.gitReviewOpen);
  const toggleGitReview = useUiStore((state) => state.toggleGitReview);
  const { startNewSession, isStarting } = useNewSession();

  useEffect(() => {
    let appWindow: ReturnType<typeof getCurrentWindow>;
    try {
      appWindow = getCurrentWindow();
    } catch {
      return;
    }

    const syncFullscreen = () => {
      void appWindow
        .isFullscreen()
        .then(setIsFullscreen)
        .catch(() => setIsFullscreen(false));
    };

    syncFullscreen();
    const unlisten = appWindow.onResized(syncFullscreen).catch(() => undefined);
    return () => {
      void unlisten.then((stop) => stop?.());
    };
  }, []);

  return (
    <header
      className="app-titlebar relative flex shrink-0 items-center border-b border-[var(--color-border)]
        bg-[var(--color-titlebar)]"
      data-fullscreen={isFullscreen || undefined}
      data-tauri-drag-region
    >
      <div
        className="titlebar-leading flex min-w-0 items-center gap-1"
        data-tauri-drag-region
      >
        <button
          type="button"
          onClick={toggleSidebar}
          title="Toggle sidebar (⌘B)"
          aria-label="Toggle sidebar"
          className="titlebar-button"
        >
          <PanelLeft size={18} strokeWidth={1.7} />
        </button>
        <span className="app-wordmark truncate text-[13px] font-medium text-[var(--color-ink-1)]">
          Oh My Pi
        </span>
      </div>

      {activeSession?.title && (
        <div
          className="pointer-events-none absolute left-1/2 max-w-[42%] -translate-x-1/2 truncate
            text-center text-[13px] font-medium text-[var(--color-ink-1)]"
          title={activeSession.title}
        >
          {activeSession.title}
        </div>
      )}

      <div className="ml-auto flex items-center gap-0.5 pr-2" data-tauri-drag-region>
        <button
          type="button"
          onClick={toggleGitReview}
          disabled={!activeSession}
          title="Review Git changes"
          aria-label="Review Git changes"
          aria-pressed={gitReviewOpen}
          className={cn(
            "titlebar-button",
            gitReviewOpen && "bg-[var(--color-bg-hi)] text-[var(--color-ink-0)]"
          )}
        >
          <FileDiff size={17} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={startNewSession}
          disabled={isStarting}
          title="New session"
          aria-label="New omp session"
          className="titlebar-button"
        >
          {isStarting ? (
            <Loader2 size={17} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <Plus size={18} strokeWidth={1.8} />
          )}
        </button>
      </div>
    </header>
  );
}
