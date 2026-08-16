import { describe, expect, test } from "bun:test";

import { isShiftedEnter, shiftedEnterSequence } from "./terminal-keys";

const keydown = {
  type: "keydown",
  key: "Enter",
  shiftKey: true,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
};

describe("terminal modified keys", () => {
  test("encodes Shift+Enter for OMP multiline input", () => {
    expect(shiftedEnterSequence(keydown)).toBe("\x1b[27;2;13~");
  });

  test("leaves every other Enter chord to xterm", () => {
    expect(isShiftedEnter({ ...keydown, shiftKey: false })).toBe(false);
    expect(isShiftedEnter({ ...keydown, ctrlKey: true })).toBe(false);
    expect(isShiftedEnter({ ...keydown, metaKey: true })).toBe(false);
  });

  test("recognizes and blocks the matching keypress phase", () => {
    expect(isShiftedEnter({ ...keydown, type: "keypress" })).toBe(true);
    expect(shiftedEnterSequence({ ...keydown, type: "keypress" })).toBeNull();
  });
});
