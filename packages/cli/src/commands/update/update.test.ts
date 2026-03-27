import { describe, it, expect } from "vitest";
import { compareVersions } from "./update/update.js";

describe("update command", () => {
  describe("compareVersions", () => {
    it("should correctly compare equal versions", () => {
      expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
      expect(compareVersions("0.0.9", "0.0.9")).toBe(0);
    });

    it("should correctly compare different versions", () => {
      expect(compareVersions("1.0.1", "1.0.0")).toBe(1);
      expect(compareVersions("1.1.0", "1.0.9")).toBe(1);
      expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
    });

    it("should correctly identify older versions", () => {
      expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
      expect(compareVersions("1.0.9", "1.1.0")).toBe(-1);
      expect(compareVersions("1.9.9", "2.0.0")).toBe(-1);
    });

    it("should correctly handle different length version numbers", () => {
      expect(compareVersions("1.0", "1.0.0")).toBe(0);
      expect(compareVersions("1.0.0", "1.0")).toBe(0);
      expect(compareVersions("1.0.1", "1.0")).toBe(1);
      expect(compareVersions("1.0", "1.0.1")).toBe(-1);
    });
  });
});
