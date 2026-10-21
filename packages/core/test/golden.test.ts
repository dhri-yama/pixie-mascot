import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildInputs, entry } from "../../../scripts/golden";

const golden = JSON.parse(readFileSync(new URL("../../../spec/golden.json", import.meta.url), "utf8")) as {
  version: number;
  count: number;
  entries: Array<ReturnType<typeof entry>>;
};

describe("golden file (spec/golden.json)", () => {
  it("covers the expected inputs", () => {
    expect(golden.version).toBe(1);
    expect(golden.entries.map((e) => e.input)).toEqual(buildInputs());
    expect(golden.count).toBe(golden.entries.length);
  });

  it("is reproduced exactly by the generator", () => {
    // A failure here means output changed. Revert, or (only while v1 is a draft) run `pnpm golden:update`.
    for (const e of golden.entries) expect(entry(e.input), JSON.stringify(e.input)).toEqual(e);
  });
});
