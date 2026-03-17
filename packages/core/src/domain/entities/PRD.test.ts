/**
 * PRD Entity Unit Tests
 * PRD 实体单元测试
 */

import { describe, it, expect } from "vitest";
import { PRD, type PRDDTO } from "./PRD";
import { Story } from "./Story";
import type { IStory } from "@talos/types";

describe("PRD Entity", () => {
  describe("Creation", () => {
    it("should create PRD with required properties", () => {
      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
      });

      expect(prd.id).toBe("prd-001");
      expect(prd.project).toBe("Talos");
      expect(prd.description).toBe("Complete system refactor");
      expect(prd.userStories).toEqual([]);
      expect(prd.status).toBe("draft");
      expect(prd.createdAt).toBeDefined();
    });

    it("should create PRD with all properties", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        branchName: "feature/refactor",
        userStories: [story1],
        status: "active",
        createdAt: 1234567890,
        updatedAt: 1234567900,
      });

      expect(prd.branchName).toBe("feature/refactor");
      expect(prd.userStories).toHaveLength(1);
      expect(prd.status).toBe("active");
      expect(prd.createdAt).toBe(1234567890);
      expect(prd.updatedAt).toBe(1234567900);
    });

    it("should create PRD from DTO", () => {
      const dto: PRDDTO = {
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        branchName: "feature/refactor",
        userStories: [],
        status: "active",
        createdAt: 1234567890,
        updatedAt: 1234567900,
      };

      const prd = PRD.fromDTO(dto);

      expect(prd.id).toBe(dto.id);
      expect(prd.project).toBe(dto.project);
      expect(prd.status).toBe(dto.status);
      expect(prd.createdAt).toBe(dto.createdAt);
    });
  });

  describe("Story Management", () => {
    it("should get completed stories", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        passes: true,
      });

      const story2 = Story.create({
        id: "US-002",
        title: "Story 2",
        description: "Description 2",
        acceptanceCriteria: ["Criterion 1"],
        priority: 2,
        passes: false,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story1, story2],
      });

      const completedStories = prd.getCompletedStories();

      expect(completedStories).toHaveLength(1);
      expect(completedStories[0].id).toBe("US-001");
    });

    it("should get pending stories", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        passes: true,
      });

      const story2 = Story.create({
        id: "US-002",
        title: "Story 2",
        description: "Description 2",
        acceptanceCriteria: ["Criterion 1"],
        priority: 2,
        passes: false,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story1, story2],
      });

      const pendingStories = prd.getPendingStories();

      expect(pendingStories).toHaveLength(1);
      expect(pendingStories[0].id).toBe("US-002");
    });

    it("should get story by ID", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story1],
      });

      const foundStory = prd.getStory("US-001");

      expect(foundStory).toBeDefined();
      expect(foundStory?.id).toBe("US-001");
    });

    it("should return undefined for non-existent story", () => {
      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
      });

      const foundStory = prd.getStory("US-999");

      expect(foundStory).toBeUndefined();
    });

    it("should get stories sorted by priority", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 3,
      });

      const story2 = Story.create({
        id: "US-002",
        title: "Story 2",
        description: "Description 2",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
      });

      const story3 = Story.create({
        id: "US-003",
        title: "Story 3",
        description: "Description 3",
        acceptanceCriteria: ["Criterion 1"],
        priority: 2,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story1, story2, story3],
      });

      const sortedStories = prd.getStoriesByPriority();

      expect(sortedStories[0].id).toBe("US-002");
      expect(sortedStories[1].id).toBe("US-003");
      expect(sortedStories[2].id).toBe("US-001");
    });

    it("should get next story to work on", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        passes: true,
      });

      const story2 = Story.create({
        id: "US-002",
        title: "Story 2",
        description: "Description 2",
        acceptanceCriteria: ["Criterion 1"],
        priority: 2,
        dependsOn: ["US-001"],
      });

      const story3 = Story.create({
        id: "US-003",
        title: "Story 3",
        description: "Description 3",
        acceptanceCriteria: ["Criterion 1"],
        priority: 3,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story1, story2, story3],
      });

      const completedStories = new Set<string>(["US-001"]);
      const nextStory = prd.getNextStory(completedStories);

      expect(nextStory).toBeDefined();
      expect(nextStory?.id).toBe("US-002");
    });

    it("should return undefined when no eligible story", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        dependsOn: ["US-000"],
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story1],
      });

      const completedStories = new Set<string>();
      const nextStory = prd.getNextStory(completedStories);

      expect(nextStory).toBeUndefined();
    });

    it("should add story to PRD", () => {
      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
      });

      const story = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
      });

      prd.addStory(story);

      expect(prd.userStories).toHaveLength(1);
      expect(prd.userStories[0].id).toBe("US-001");
      expect(prd.updatedAt).toBeDefined();
    });

    it("should not add duplicate story", () => {
      const story = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story],
      });

      expect(() => prd.addStory(story)).toThrow(
        "Story with ID 'US-001' already exists"
      );
    });

    it("should update story", () => {
      const story = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story],
      });

      prd.updateStory("US-001", { title: "Updated Story 1" });

      expect(prd.getStory("US-001")?.title).toBe("Updated Story 1");
      expect(prd.updatedAt).toBeDefined();
    });

    it("should throw error when updating non-existent story", () => {
      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
      });

      expect(() =>
        prd.updateStory("US-999", { title: "Updated" })
      ).toThrow("Story with ID 'US-999' not found");
    });
  });

  describe("Progress Tracking", () => {
    it("should calculate completion percentage", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        passes: true,
      });

      const story2 = Story.create({
        id: "US-002",
        title: "Story 2",
        description: "Description 2",
        acceptanceCriteria: ["Criterion 1"],
        priority: 2,
        passes: true,
      });

      const story3 = Story.create({
        id: "US-003",
        title: "Story 3",
        description: "Description 3",
        acceptanceCriteria: ["Criterion 1"],
        priority: 3,
        passes: false,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story1, story2, story3],
      });

      const percentage = prd.getCompletionPercentage();

      expect(percentage).toBe(67); // 2 out of 3 = 66.67% rounded to 67
    });

    it("should return 0% for empty PRD", () => {
      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
      });

      expect(prd.getCompletionPercentage()).toBe(0);
    });

    it("should return 100% for all completed stories", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        passes: true,
      });

      const story2 = Story.create({
        id: "US-002",
        title: "Story 2",
        description: "Description 2",
        acceptanceCriteria: ["Criterion 1"],
        priority: 2,
        passes: true,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story1, story2],
      });

      expect(prd.getCompletionPercentage()).toBe(100);
    });

    it("should check if PRD is complete", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        passes: true,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story1],
      });

      expect(prd.isComplete()).toBe(true);
    });

    it("should check if PRD is incomplete", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        passes: false,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story1],
      });

      expect(prd.isComplete()).toBe(false);
    });

    it("should get progress summary", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        passes: true,
      });

      const story2 = Story.create({
        id: "US-002",
        title: "Story 2",
        description: "Description 2",
        acceptanceCriteria: ["Criterion 1"],
        priority: 2,
        passes: false,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story1, story2],
      });

      const progress = prd.getProgress();

      expect(progress.total).toBe(2);
      expect(progress.passing).toBe(1);
      expect(progress.incomplete).toBe(1);
      expect(progress.percentage).toBe(50);
    });
  });

  describe("Status Management", () => {
    it("should mark PRD as completed", () => {
      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        status: "active",
      });

      prd.markAsCompleted();

      expect(prd.status).toBe("completed");
      expect(prd.updatedAt).toBeDefined();
    });

    it("should mark PRD as started", () => {
      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        status: "draft",
      });

      prd.markAsStarted();

      expect(prd.status).toBe("active");
      expect(prd.updatedAt).toBeDefined();
    });
  });

  describe("Serialization", () => {
    it("should convert PRD to DTO", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        branchName: "feature/refactor",
        userStories: [story1],
        status: "active",
      });

      const dto = prd.toDTO();

      expect(dto.id).toBe(prd.id);
      expect(dto.project).toBe(prd.project);
      expect(dto.description).toBe(prd.description);
      expect(dto.branchName).toBe("feature/refactor");
      expect(dto.userStories).toHaveLength(1);
      expect(dto.status).toBe("active");
      expect(dto.createdAt).toBeDefined();
    });

    it("should create round-trip DTO conversion", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
      });

      const original = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        branchName: "feature/refactor",
        userStories: [story1],
        status: "active",
      });

      const dto = original.toDTO();
      const restored = PRD.fromDTO(dto);

      expect(restored.id).toBe(original.id);
      expect(restored.project).toBe(original.project);
      expect(restored.description).toBe(original.description);
      expect(restored.branchName).toBe(original.branchName);
      expect(restored.status).toBe(original.status);
      expect(restored.userStories).toHaveLength(original.userStories.length);
    });

    it("should clone arrays in DTO to prevent mutation", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story1],
      });

      const dto = prd.toDTO();

      // Modify DTO arrays
      dto.userStories.push({} as IStory);

      // Original PRD should be unchanged
      expect(prd.userStories).toHaveLength(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty user stories array", () => {
      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
      });

      expect(prd.getCompletedStories()).toEqual([]);
      expect(prd.getPendingStories()).toEqual([]);
      expect(prd.getStoriesByPriority()).toEqual([]);
      expect(prd.isComplete()).toBe(false);
    });

    it("should handle PRD without branch name", () => {
      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
      });

      expect(prd.branchName).toBeUndefined();
    });

    it("should handle next story with all completed stories", () => {
      const story1 = Story.create({
        id: "US-001",
        title: "Story 1",
        description: "Description 1",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        passes: true,
      });

      const prd = PRD.create({
        id: "prd-001",
        project: "Talos",
        description: "Complete system refactor",
        userStories: [story1],
      });

      const completedStories = new Set<string>(["US-001"]);
      const nextStory = prd.getNextStory(completedStories);

      expect(nextStory).toBeUndefined();
    });
  });
});
