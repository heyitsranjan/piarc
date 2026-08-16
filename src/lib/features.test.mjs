import { expect, test } from "bun:test";

import { FEATURE_RICH_INPUT } from "./features.ts";

test("keeps the rich input disabled without an explicit build opt-in", () => {
  expect(FEATURE_RICH_INPUT).toBe(false);
});
