import { expect, test } from "bun:test";

import { animateTerminalToBottom, shouldShowScrollToBottom } from "./terminal-scroll.ts";

test("shows the bottom control only after three hundred lines of scrollback", () => {
  expect(shouldShowScrollToBottom(701, 1000)).toBe(false);
  expect(shouldShowScrollToBottom(700, 1000)).toBe(true);
});

test("animates terminal scrolling before landing at the bottom", () => {
  const frames = [];
  const lines = [];
  let bottomCalls = 0;
  const terminal = {
    buffer: { active: { viewportY: 10, baseY: 20 } },
    scrollToLine: (line) => lines.push(line),
    scrollToBottom: () => {
      bottomCalls += 1;
    },
  };

  animateTerminalToBottom(terminal, (callback) => {
    frames.push(callback);
    return frames.length;
  });

  frames.shift()(0);
  frames.shift()(90);
  frames.shift()(180);

  expect(lines).toEqual([10, 19, 20]);
  expect(bottomCalls).toBe(1);
});
