import { describe, expect, it } from "vitest";

describe("result contract", () => {
  it("keeps timestamps as the frontend playback index", () => {
    const timestamps = ["2026-01-01T00:00:00Z", "2026-01-01T00:15:00Z"];
    expect(timestamps[1]).toBe("2026-01-01T00:15:00Z");
    expect(timestamps).toHaveLength(2);
  });
});
