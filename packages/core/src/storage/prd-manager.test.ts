import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { PRDManager } from "./prd-manager";
import type { PRD } from "@talos/types";

describe("PRDManager", () => {
  const mockPRD: PRD = {
    project: "Test Project",
    description: "A test PRD for testing",
    userStories: [
      {
        id: "US-001",
        title: "First Story",
        description: "First user story",
        acceptanceCriteria: ["criterion 1"],
        priority: 1,
        passes: false,
        notes: "",
      },
      {
        id: "US-002",
        title: "Second Story",
        description: "Second user story",
        acceptanceCriteria: ["criterion 1", "criterion 2"],
        priority: 2,
        passes: true,
        notes: "Already completed",
      },
    ],
    branchName: "main",
  };

  describe("Constructor and Path Resolution", () => {
    let tempDir: string;
    let prdManager: PRDManager;

    beforeEach(async () => {
      // Create a temporary directory for testing
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prd-manager-"));
    });

    afterEach(async () => {
      // Clean up temporary directory
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should construct with workingDir and prdId", () => {
      prdManager = new PRDManager(tempDir, "test-prd");
      expect(prdManager).toBeInstanceOf(PRDManager);
    });

    it("should resolve PRD path correctly", async () => {
      const expectedPath = path.join(tempDir, "ralph", "test-prd", "prd.json");

      // Create the PRD file
      await fs.mkdir(path.dirname(expectedPath), { recursive: true });
      await fs.writeFile(expectedPath, JSON.stringify(mockPRD, null, 2));

      // Use PRDManager to read it
      prdManager = new PRDManager(tempDir, "test-prd");
      const prd = await prdManager.getPRD();

      expect(prd).not.toBeNull();
      expect(prd?.project).toBe("Test Project");
    });
  });

  describe("getPRD", () => {
    let tempDir: string;
    let prdManager: PRDManager;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prd-manager-"));
      const prdPath = path.join(tempDir, "ralph", "test-prd", "prd.json");

      // Create PRD file
      await fs.mkdir(path.dirname(prdPath), { recursive: true });
      await fs.writeFile(prdPath, JSON.stringify(mockPRD, null, 2));

      prdManager = new PRDManager(tempDir, "test-prd");
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should get PRD", async () => {
      const prd = await prdManager.getPRD();

      expect(prd).not.toBeNull();
      expect(prd?.project).toBe("Test Project");
      expect(prd?.userStories).toHaveLength(2);
    });

    it("should return null if PRD file does not exist", async () => {
      const nonExistentManager = new PRDManager(tempDir, "non-existent");
      const prd = await nonExistentManager.getPRD();

      expect(prd).toBeNull();
    });
  });

  describe("getStats", () => {
    let tempDir: string;
    let prdManager: PRDManager;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prd-manager-"));
      const prdPath = path.join(tempDir, "ralph", "test-prd", "prd.json");

      // Create PRD file
      await fs.mkdir(path.dirname(prdPath), { recursive: true });
      await fs.writeFile(prdPath, JSON.stringify(mockPRD, null, 2));

      prdManager = new PRDManager(tempDir, "test-prd");
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should get PRD file stats", async () => {
      const stats = await prdManager.getStats();

      expect(stats).not.toBeNull();
      expect(stats?.size).toBeGreaterThan(0);
      expect(stats?.createdAt).toBeDefined();
      expect(stats?.modifiedAt).toBeDefined();
    });

    it("should return null if PRD file does not exist", async () => {
      const nonExistentManager = new PRDManager(tempDir, "non-existent");
      const stats = await nonExistentManager.getStats();

      expect(stats).toBeNull();
    });
  });
});
