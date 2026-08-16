export const SCROLL_TO_BOTTOM_THRESHOLD_LINES = 300;
export const SCROLL_TO_BOTTOM_WHEEL_THRESHOLD_PX = 120;

type AnimationFrameScheduler = (callback: (now: number) => void) => number;

export interface ScrollableTerminal {
  buffer: {
    active: {
      baseY: number;
      viewportY: number;
    };
  };
  scrollToBottom(): void;
  scrollToLine(line: number): void;
}

export function shouldShowScrollToBottom(viewportY: number, baseY: number): boolean {
  return baseY - viewportY >= SCROLL_TO_BOTTOM_THRESHOLD_LINES;
}

export function animateTerminalToBottom(
  terminal: ScrollableTerminal,
  scheduleFrame: AnimationFrameScheduler = requestAnimationFrame
): () => void {
  const start = terminal.buffer.active.viewportY;
  const target = terminal.buffer.active.baseY;
  const distance = target - start;

  if (distance <= 0) {
    terminal.scrollToBottom();
    return () => {};
  }

  const durationMs = 180;
  let startedAt: number | null = null;
  let cancelled = false;

  const step = (now: number) => {
    if (cancelled) return;

    startedAt ??= now;
    const progress = Math.min((now - startedAt) / durationMs, 1);
    const eased = 1 - (1 - progress) ** 3;
    terminal.scrollToLine(Math.round(start + distance * eased));

    if (progress < 1) {
      scheduleFrame(step);
    } else {
      terminal.scrollToBottom();
    }
  };

  scheduleFrame(step);
  return () => {
    cancelled = true;
  };
}
