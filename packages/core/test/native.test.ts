import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OUTPUTS } from "../../../scripts/gen-native";

describe("generated native data", () => {
  it.each(OUTPUTS)("%s is up to date with spec/ (run `pnpm gen:native`)", (path, gen) => {
    const onDisk = readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
    expect(onDisk).toBe(gen());
  });
});
