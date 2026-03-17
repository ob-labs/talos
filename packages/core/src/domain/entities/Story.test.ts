/**
 * Story Entity Unit Tests
 * 用户故事实体单元测试
 */

import { describe, it, expect } from "vitest";
import { Story, type StoryDTO } from "./Story";

describe("Story Entity", () => {
  describe("Creation", () => {
    it("should create story with required properties", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
      });

      expect(story.id).toBe("US-001");
      expect(story.title).toBe("Implement feature X");
      expect(story.description).toBe("As a user, I want feature X");
      expect(story.acceptanceCriteria).toEqual(["Criterion 1"]);
      expect(story.priority).toBe(1);
      expect(story.passes).toBe(false);
      expect(story.notes).toBe("");
      expect(story.dependsOn).toEqual([]);
      expect(story.status).toBe("pending");
      expect(story.createdAt).toBeDefined();
    });

    it("should create story with all properties", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1", "Criterion 2"],
        priority: 1,
        passes: true,
        notes: "Some notes",
        dependsOn: ["US-000"],
        status: "completed",
        createdAt: 1234567890,
        startedAt: 1234567900,
        completedAt: 1234568000,
      });

      expect(story.passes).toBe(true);
      expect(story.notes).toBe("Some notes");
      expect(story.dependsOn).toEqual(["US-000"]);
      expect(story.status).toBe("completed");
      expect(story.createdAt).toBe(1234567890);
      expect(story.startedAt).toBe(1234567900);
      expect(story.completedAt).toBe(1234568000);
    });

    it("should create story from DTO", () => {
      const dto: StoryDTO = {
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        passes: true,
        notes: "Some notes",
        dependsOn: ["US-000"],
        status: "completed",
        createdAt: 1234567890,
        startedAt: 1234567900,
        completedAt: 1234568000,
      };

      const story = Story.fromDTO(dto);

      expect(story.id).toBe(dto.id);
      expect(story.title).toBe(dto.title);
      expect(story.status).toBe(dto.status);
      expect(story.passes).toBe(dto.passes);
    });
  });

  describe("State Transitions", () => {
    it("should start story from pending state", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        status: "pending",
      });

      story.start();

      expect(story.status).toBe("in_progress");
      expect(story.startedAt).toBeDefined();
    });

    it("should start story from ready state", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        status: "ready",
      });

      story.start();

      expect(story.status).toBe("in_progress");
      expect(story.startedAt).toBeDefined();
    });

    it("should not start story from invalid state", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        status: "in_progress",
      });

      expect(() => story.start()).toThrow(
        "Cannot start story from status 'in_progress'"
      );
    });

    it("should mark story as passing", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        status: "in_progress",
      });

      story.markAsPassing();

      expect(story.passes).toBe(true);
      expect(story.status).toBe("completed");
      expect(story.completedAt).toBeDefined();
    });

    it("should not mark story as passing from invalid state", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        status: "pending",
      });

      expect(() => story.markAsPassing()).toThrow(
        "Cannot mark story as passing from status 'pending'"
      );
    });

    it("should mark story as failing from any state", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        status: "in_progress",
      });

      story.markAsFailing("Test failed");

      expect(story.passes).toBe(false);
      expect(story.status).toBe("failed");
      expect(story.completedAt).toBeDefined();
      expect(story.notes).toContain("Test failed");
    });

    it("should append failure reason to existing notes", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        status: "in_progress",
        notes: "Previous notes",
      });

      story.markAsFailing("Test failed");

      expect(story.notes).toContain("Previous notes");
      expect(story.notes).toContain("Test failed");
    });
  });

  describe("Dependency Management", () => {
    it("should check if dependencies are satisfied with no dependencies", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
      });

      const completedStories = new Set<string>();

      expect(story.areDependenciesSatisfied(completedStories)).toBe(true);
    });

    it("should check if dependencies are satisfied with completed dependencies", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        dependsOn: ["US-000"],
      });

      const completedStories = new Set<string>(["US-000"]);

      expect(story.areDependenciesSatisfied(completedStories)).toBe(true);
    });

    it("should check if dependencies are satisfied with incomplete dependencies", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        dependsOn: ["US-000", "US-000-2"],
      });

      const completedStories = new Set<string>(["US-000"]);

      expect(story.areDependenciesSatisfied(completedStories)).toBe(false);
    });

    it("should check if story can start", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        dependsOn: ["US-000"],
        status: "pending",
      });

      const completedStories = new Set<string>(["US-000"]);

      expect(story.canStart(completedStories)).toBe(true);
    });

    it("should not start story with incomplete dependencies", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        dependsOn: ["US-000"],
        status: "pending",
      });

      const completedStories = new Set<string>();

      expect(story.canStart(completedStories)).toBe(false);
    });

    it("should not start story from invalid state", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        dependsOn: ["US-000"],
        status: "completed",
      });

      const completedStories = new Set<string>(["US-000"]);

      expect(story.canStart(completedStories)).toBe(false);
    });
  });

  describe("Business Methods", () => {
    it("should add note to empty notes", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
      });

      story.addNote("New note");

      expect(story.notes).toBe("New note");
    });

    it("should append note to existing notes", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        notes: "Existing note",
      });

      story.addNote("Additional note");

      expect(story.notes).toContain("Existing note");
      expect(story.notes).toContain("Additional note");
    });

    it("should get duration for completed story", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        startedAt: 1000,
        completedAt: 5000,
        status: "completed",
      });

      const duration = story.getDuration();

      expect(duration).toBe(4); // (5000 - 1000) / 1000 = 4 seconds
    });

    it("should get duration using createdAt if startedAt is missing", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        createdAt: 1000,
        completedAt: 5000,
        status: "completed",
      });

      const duration = story.getDuration();

      expect(duration).toBe(4);
    });

    it("should return undefined for incomplete story duration", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        status: "in_progress",
      });

      const duration = story.getDuration();

      expect(duration).toBeUndefined();
    });
  });

  describe("Serialization", () => {
    it("should convert story to DTO", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1", "Criterion 2"],
        priority: 1,
        passes: true,
        notes: "Some notes",
        dependsOn: ["US-000"],
        status: "completed",
      });

      const dto = story.toDTO();

      expect(dto.id).toBe(story.id);
      expect(dto.title).toBe(story.title);
      expect(dto.description).toBe(story.description);
      expect(dto.acceptanceCriteria).toEqual(["Criterion 1", "Criterion 2"]);
      expect(dto.priority).toBe(story.priority);
      expect(dto.passes).toBe(true);
      expect(dto.notes).toBe("Some notes");
      expect(dto.dependsOn).toEqual(["US-000"]);
      expect(dto.status).toBe("completed");
    });

    it("should create round-trip DTO conversion", () => {
      const original = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        passes: true,
        notes: "Some notes",
        dependsOn: ["US-000"],
        status: "completed",
      });

      const dto = original.toDTO();
      const restored = Story.fromDTO(dto);

      expect(restored.id).toBe(original.id);
      expect(restored.title).toBe(original.title);
      expect(restored.description).toBe(original.description);
      expect(restored.acceptanceCriteria).toEqual(original.acceptanceCriteria);
      expect(restored.priority).toBe(original.priority);
      expect(restored.passes).toBe(original.passes);
      expect(restored.notes).toBe(original.notes);
      expect(restored.dependsOn).toEqual(original.dependsOn);
      expect(restored.status).toBe(original.status);
    });

    it("should clone arrays in DTO to prevent mutation", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        dependsOn: ["US-000"],
      });

      const dto = story.toDTO();

      // Modify DTO arrays
      dto.acceptanceCriteria.push("Criterion 2");
      dto.dependsOn.push("US-001");

      // Original story should be unchanged
      expect(story.acceptanceCriteria).toEqual(["Criterion 1"]);
      expect(story.dependsOn).toEqual(["US-000"]);
    });

    it("should convert story to result", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        status: "completed",
        startedAt: 1000,
        completedAt: 5000,
      });

      const result = story.toResult();

      expect(result.storyId).toBe("US-001");
      expect(result.storyTitle).toBe("Implement feature X");
      expect(result.status).toBe("completed");
      expect(result.duration).toBe(4);
      expect(result.error).toBeUndefined();
    });

    it("should include error in result for failed story", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        status: "failed",
        notes: "Failure: Test failed",
      });

      const result = story.toResult();

      expect(result.status).toBe("failed");
      expect(result.error).toBe("Failure: Test failed");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty acceptance criteria", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: [],
        priority: 1,
      });

      expect(story.acceptanceCriteria).toEqual([]);
    });

    it("should handle multiple dependencies", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 1,
        dependsOn: ["US-000", "US-000-2", "US-000-3"],
      });

      const completedStories = new Set<string>(["US-000", "US-000-2"]);

      expect(story.areDependenciesSatisfied(completedStories)).toBe(false);
    });

    it("should handle zero priority", () => {
      const story = Story.create({
        id: "US-001",
        title: "Implement feature X",
        description: "As a user, I want feature X",
        acceptanceCriteria: ["Criterion 1"],
        priority: 0,
      });

      expect(story.priority).toBe(0);
    });
  });
});
