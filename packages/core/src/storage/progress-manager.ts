import type { StoryProgressEntry } from "@talos/types";
import { LocalStorageEngine } from "./storage";

const PROGRESS_FILE = "progress.txt";

/**
 * Represents a single progress log entry
 */
export interface ProgressEntry {
  timestamp: string;
  storyId: string;
  status: "success" | "failure" | "partial";
  changes: string[];
  learnings?: string[];
}

/**
 * Represents parsed progress log with patterns section
 */
export interface ParsedProgressLog {
  codebasePatterns: string[];
  executionHistory: ProgressEntry[];
}

/**
 * Context for PRD execution including patterns and recent entries
 */
export interface ProgressContext {
  patterns: string[];
  recentEntries: ProgressEntry[];
}

/**
 * Error class for progress log operations
 */
export class ProgressLogError extends Error {
  constructor(message: string) {
    super(`ProgressLogError: ${message}`);
    this.name = "ProgressLogError";
  }
}

/**
 * ProgressManager manages progress.txt file for pattern learning
 * Maintains codebase patterns at the top and execution history below
 *
 * @example
 * ```typescript
 * const progressManager = new ProgressManager();
 * await progressManager.appendEntry("US-001", ["Created feature"], ["Learning 1"]);
 * ```
 */
export class ProgressManager {
  private storage: LocalStorageEngine;

  constructor(storage?: LocalStorageEngine) {
    this.storage = storage || new LocalStorageEngine();
  }

  /**
   * Parse the progress.txt file into structured data
   */
  async parse(): Promise<ParsedProgressLog> {
    const content = await this.storage.readMarkdown(PROGRESS_FILE);

    if (!content) {
      return { codebasePatterns: [], executionHistory: [] };
    }

    const lines = content.split("\n");
    const codebasePatterns: string[] = [];
    const executionHistory: ProgressEntry[] = [];

    let inPatternsSection = false;
    let inHistorySection = false;
    let currentEntry: Partial<ProgressEntry> | null = null;
    let currentLearnings: string[] | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect patterns section
      if (line.startsWith("## Codebase Patterns")) {
        inPatternsSection = true;
        inHistorySection = false;
        continue;
      }

      // Detect execution history section header (not entry headers)
      if (line.startsWith("## Execution History")) {
        inPatternsSection = false;
        inHistorySection = true;
        currentEntry = null;
        currentLearnings = null;
        continue;
      }

      // Parse patterns
      if (inPatternsSection) {
        const trimmed = line.trim();
        if (trimmed.startsWith("- Pattern:") || trimmed.startsWith("- Gotcha:") || trimmed.startsWith("- Example:")) {
          codebasePatterns.push(trimmed.substring(2).trim());
        }
        continue;
      }

      // Parse execution history entries
      if (inHistorySection) {
        // Entry header: ## YYYY-MM-DD - US-XXX
        const entryMatch = line.match(/^## (\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?)\s+-\s+(US-\d+)/);
        if (entryMatch) {
          // Save previous entry if exists
          if (currentEntry && currentEntry.timestamp && currentEntry.storyId) {
            executionHistory.push({
              timestamp: currentEntry.timestamp,
              storyId: currentEntry.storyId,
              status: currentEntry.status || "success",
              changes: currentEntry.changes || [],
              learnings: currentEntry.learnings,
            });
          }

          // Start new entry
          currentEntry = {
            timestamp: entryMatch[1],
            storyId: entryMatch[2],
            changes: [],
          };
          currentLearnings = null;
          continue;
        }

        // Parse changes (bulleted items)
        if (line.trim().startsWith("- ")) {
          const text = line.trim().substring(2);

          // Add to learnings if in learnings section
          if (currentLearnings !== null) {
            currentLearnings.push(text);
            if (currentEntry) {
              currentEntry.learnings = currentLearnings;
            }
            continue;
          }

          // Add to changes
          if (currentEntry) {
            if (!currentEntry.changes) {
              currentEntry.changes = [];
            }
            currentEntry.changes.push(text);
          }
        }

        // Detect learnings section header (doesn't start with "- ")
        if (line.includes("**Learnings for future iterations:**")) {
          currentLearnings = [];
          continue;
        }
      }
    }

    // Don't forget the last entry
    if (currentEntry && currentEntry.timestamp && currentEntry.storyId) {
      executionHistory.push({
        timestamp: currentEntry.timestamp,
        storyId: currentEntry.storyId,
        status: currentEntry.status || "success",
        changes: currentEntry.changes || [],
        learnings: currentEntry.learnings,
      });
    }

    return { codebasePatterns, executionHistory };
  }

  /**
   * Append a new entry to the progress log
   */
  async appendEntry(
    storyId: string,
    changes: string[],
    learnings: string[],
    _status: "success" | "failure" | "partial" = "success"
  ): Promise<void> {
    const now = new Date();
    const timestamp = now.toISOString().split("T")[0] + " " + now.toTimeString().split(" ")[0];

    // Read existing content
    const content = await this.storage.readMarkdown(PROGRESS_FILE);
    const newEntry = this.formatEntry(timestamp, storyId, changes, learnings);

    // Append to existing content or create new
    const updatedContent = content ? content + "\n" + newEntry : newEntry;

    await this.storage.writeMarkdown(PROGRESS_FILE, updatedContent);
  }

  /**
   * Extract codebase patterns from parsed log
   */
  getCodebasePatterns(parsed: ParsedProgressLog): string[] {
    return parsed.codebasePatterns;
  }

  /**
   * Get relevant context for PRD execution
   * Returns codebase patterns + last N entries
   */
  async getContext(lastEntries: number = 5): Promise<ProgressContext> {
    const parsed = await this.parse();

    // Get last N entries
    const recentEntries = parsed.executionHistory.slice(-lastEntries);

    return {
      patterns: parsed.codebasePatterns,
      recentEntries,
    };
  }

  /**
   * Format a single log entry
   */
  private formatEntry(
    timestamp: string,
    storyId: string,
    changes: string[],
    learnings: string[]
  ): string {
    const parts = [
      `## ${timestamp} - ${storyId}`,
      ...changes.map((change) => `- ${change}`),
    ];

    if (learnings.length > 0) {
      parts.push("");
      parts.push("**Learnings for future iterations:**");
      learnings.forEach((learning) => {
        learning.split("\n").forEach((line) => {
          parts.push(`- ${line}`);
        });
      });
    }

    parts.push("---");

    return parts.join("\n");
  }

  /**
   * Add a pattern to the codebase patterns section
   * This requires rewriting the entire file
   */
  async addPattern(pattern: string): Promise<void> {
    const content = await this.storage.readMarkdown(PROGRESS_FILE);

    if (!content) {
      // Create new file with patterns section
      const newContent = `## Codebase Patterns\n- ${pattern}\n\n## Execution History\n`;
      await this.storage.writeMarkdown(PROGRESS_FILE, newContent);
      return;
    }

    // Check if patterns section exists
    const patternsMatch = content.match(/^## Codebase Patterns$/m);

    if (!patternsMatch) {
      // Add patterns section at the beginning
      const newContent = `## Codebase Patterns\n- ${pattern}\n\n${content}`;
      await this.storage.writeMarkdown(PROGRESS_FILE, newContent);
      return;
    }

    // Insert pattern after existing patterns
    const lines = content.split("\n");
    let insertIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === "## Codebase Patterns") {
        // Found the header, check if there's a next line
        if (i + 1 >= lines.length) {
          // Header is at the end of file, insert here
          insertIndex = i + 1;
        } else {
          // Check if next line is another section header
          if (lines[i + 1].startsWith("##")) {
            throw new ProgressLogError("Cannot insert pattern: another section immediately follows Codebase Patterns header");
          }
          // Find the end of the patterns section
          insertIndex = i + 1;
          // Skip existing pattern items
          while (insertIndex < lines.length && lines[insertIndex].trim().startsWith("-")) {
            insertIndex++;
          }
        }
        break;
      }
    }

    if (insertIndex === -1) {
      throw new ProgressLogError("Could not find Codebase Patterns section");
    }

    // Insert the pattern
    lines.splice(insertIndex, 0, `- ${pattern}`);

    await this.storage.writeMarkdown(PROGRESS_FILE, lines.join("\n"));
  }

  /**
   * Get all entries for a specific story ID
   */
  async getStoryEntries(storyId: string): Promise<ProgressEntry[]> {
    const parsed = await this.parse();
    return parsed.executionHistory.filter((entry) => entry.storyId === storyId);
  }

  /**
   * Add a commit hash to the most recent entry for a story
   * @param storyId Story identifier (e.g., "US-001")
   * @param commitHash Full commit hash (will be truncated to 7 characters)
   * @throws ProgressLogError if no entry found for the story
   */
  async addCommit(storyId: string, commitHash: string): Promise<void> {
    const content = await this.storage.readMarkdown(PROGRESS_FILE);

    if (!content) {
      throw new ProgressLogError(`No progress log found`);
    }

    // Truncate commit hash to 7 characters (short hash)
    const shortHash = commitHash.substring(0, 7);
    const commitLine = `- **commit**: ${shortHash}`;

    // Find the most recent entry for this storyId
    const lines = content.split("\n");
    let lastEntryStartIndex = -1;
    let lastEntryEndIndex = -1;

    // Escape special regex characters in storyId
    const escapedStoryId = storyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const trimmedLine = line.trim();
      // Match entry header: ## YYYY-MM-DD - US-XXX or ## YYYY-MM-DD HH:MM:SS - US-XXX
      const entryMatch = trimmedLine.match(new RegExp(`^## (\\d{4}-\\d{2}-\\d{2}(?: \\d{2}:\\d{2}:\\d{2})?)\\s+-\\s+(${escapedStoryId})$`));
      if (entryMatch) {
        lastEntryStartIndex = i;
        break;
      }
    }

    if (lastEntryStartIndex === -1) {
      throw new ProgressLogError(`No entry found for story ${storyId}`);
    }

    // Find the end of the entry (before the next '---' or end of file)
    for (let i = lastEntryStartIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        lastEntryEndIndex = i;
        break;
      }
    }

    if (lastEntryEndIndex === -1) {
      // Entry doesn't have a proper ending, append to end
      lastEntryEndIndex = lines.length;
      lines.push("---");
    }

    // Find where to insert the commit (before learnings section or before ---)
    let insertIndex = lastEntryEndIndex;
    for (let i = lastEntryStartIndex + 1; i < lastEntryEndIndex; i++) {
      if (lines[i].includes("**Learnings for future iterations:**")) {
        insertIndex = i;
        break;
      }
    }

    // Insert the commit line
    lines.splice(insertIndex, 0, commitLine);

    // Write back to file
    await this.storage.writeMarkdown(PROGRESS_FILE, lines.join("\n"));
  }

  /**
   * Get the most recent entry
   */
  async getLatestEntry(): Promise<ProgressEntry | null> {
    const parsed = await this.parse();
    return parsed.executionHistory.length > 0
      ? parsed.executionHistory[parsed.executionHistory.length - 1]
      : null;
  }

  /**
   * Search entries by keyword in changes or learnings
   */
  async searchEntries(keyword: string): Promise<ProgressEntry[]> {
    const parsed = await this.parse();
    const lowerKeyword = keyword.toLowerCase();

    return parsed.executionHistory.filter(
      (entry) =>
        entry.changes.some((change) => change.toLowerCase().includes(lowerKeyword)) ||
        entry.learnings?.some((learning) => learning.toLowerCase().includes(lowerKeyword))
    );
  }

  /**
   * Get commits grouped by story
   * @param storyId Optional story ID to filter by
   * @returns Array of { storyId, commits } objects
   */
  async getCommitsByStory(storyId?: string): Promise<Array<{ storyId: string; commits: string[] }>> {
    const parsed = await this.parse();
    const commitMap = new Map<string, string[]>();

    // Filter entries by storyId if provided
    let entries = parsed.executionHistory;
    if (storyId) {
      entries = entries.filter((entry) => entry.storyId === storyId);
    }

    // Extract commits from each entry
    // Commit format in parsed changes: **commit**: {hash} (the "- " prefix is removed during parsing)
    // Match 7-character hash (Git short hash format) or any word-like string
    const commitRegex = /^\*\*commit\*\*:\s*([a-zA-Z0-9]{7,})/i;

    for (const entry of entries) {
      const commits: string[] = [];

      for (const change of entry.changes) {
        const match = change.match(commitRegex);
        if (match) {
          commits.push(match[1]);
        }
      }

      // Only add entries that have commits
      if (commits.length > 0) {
        // If we already have commits for this story, merge them
        const existing = commitMap.get(entry.storyId) || [];
        commitMap.set(entry.storyId, [...existing, ...commits]);
      }
    }

    // Convert map to array format
    const result: Array<{ storyId: string; commits: string[] }> = [];
    Array.from(commitMap.entries()).forEach(([storyId, commits]) => {
      result.push({ storyId, commits });
    });

    return result;
  }

  /**
   * Get progress entry for a specific story from progress.txt
   * Returns the most recent entry for the given storyId
   * @param prdId PRD identifier (not used in parsing but kept for API consistency)
   * @param storyId Story identifier (e.g., "US-001")
   * @returns StoryProgressEntry or null if not found
   */
  async getStoryProgressEntry(prdId: string, storyId: string): Promise<StoryProgressEntry | null> {
    const entries = await this.getStoryEntries(storyId);

    if (entries.length === 0) {
      return null;
    }

    // Get the most recent entry (last one in the array)
    const mostRecentEntry = entries[entries.length - 1];

    // Parse changes into implemented and filesChanged
    const { implemented, filesChanged, hasManualVerification } = this.parseChanges(mostRecentEntry.changes);

    // Check for manual verification in learnings or changes
    const manualVerification =
      hasManualVerification ||
      (mostRecentEntry.learnings?.some(
        (learning) => learning.toLowerCase().includes("manual verification") || learning.toLowerCase().includes("verified in browser")
      ) ?? false);

    return {
      implemented,
      filesChanged,
      learnings: mostRecentEntry.learnings || [],
      manualVerification,
    };
  }

  /**
   * Parse changes array into implemented and filesChanged
   * Uses heuristics to categorize changes
   */
  private parseChanges(changes: string[]): {
    implemented: string[];
    filesChanged: string[];
    hasManualVerification: boolean;
  } {
    const implemented: string[] = [];
    const filesChanged: string[] = [];
    let hasManualVerification = false;

    for (const change of changes) {
      const trimmed = change.trim();

      // Check if it looks like a file path (contains slashes and file extension)
      // Examples: "apps/web/lib/memory/progress-log.ts", "packages/types/src/index.ts"
      // Match: path (with dots allowed in dir names) + dot + extension
      // IMPORTANT: Put longer extensions first (tsx before ts) to avoid partial matches
      const filePathPattern = /^[\w\-./]+\.(?:tsx|jsx|json|css|html|ts|js|md)$/i;
      if (filePathPattern.test(trimmed)) {
        // File paths should NOT be added to implemented
        filesChanged.push(trimmed);
        continue;
      }

      // Check for file change indicators (these have both a note AND a file path)
      // Match patterns like "Modified: file.ts", "- Added: file.tsx", "Created file: path/file.ts"
      const fileChangeIndicatorMatch =
        trimmed.match(/^-?\s*(Files changed|Changed files|Modified|Added|Created|Deleted|(?:-\s*)?File|(?:-\s*)?Modified file|(?:-\s*)?Created file):\s*(.*)$/i);

      if (fileChangeIndicatorMatch) {
        const [, _indicator, rest] = fileChangeIndicatorMatch;

        // Add the full text to implemented (to preserve the note)
        implemented.push(trimmed);

        // Extract file path from the rest of the line
        // Look for file patterns in the rest of the string
        // Match paths like "apps/web/lib/auth.ts" or "lib/auth.ts"
        // IMPORTANT: Put longer extensions first (tsx before ts) to avoid partial matches
        const fileMatch = rest.match(/([\w\-./]+\.(?:tsx|jsx|json|css|html|ts|js|md))/i);
        if (fileMatch) {
          filesChanged.push(fileMatch[1]);
        }
        continue;
      }

      // Check for manual verification indicator
      if (
        trimmed.toLowerCase().includes("manual verification") ||
        trimmed.toLowerCase().includes("verified in browser") ||
        trimmed.toLowerCase().includes("browser testing")
      ) {
        // This goes to implemented as a note, not filesChanged
        implemented.push(trimmed);
        hasManualVerification = true;
        continue;
      }

      // Default: treat as implementation note
      implemented.push(trimmed);
    }

    return { implemented, filesChanged, hasManualVerification };
  }
}

// Default instance for convenience
export const progressManager = new ProgressManager();
