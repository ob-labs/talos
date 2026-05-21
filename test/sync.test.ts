import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { injectClaudeMdSection } from "../src/sync.js";

const MARKER_START = "<!-- talos-memo-start -->";
const MARKER_END = "<!-- talos-memo-end -->";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "talos-test-"));
}

describe("injectClaudeMdSection", () => {
  let tmp: string;

  afterEach(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it("creates CLAUDE.md when it doesn't exist", () => {
    tmp = makeTempDir();
    injectClaudeMdSection(tmp);

    const path = join(tmp, "CLAUDE.md");
    expect(existsSync(path)).toBe(true);

    const content = readFileSync(path, "utf-8");
    expect(content).toContain(MARKER_START);
    expect(content).toContain(MARKER_END);
    expect(content).toContain("~/.talos/profile.md");
    expect(content).toContain("wiki/hot.md");
  });

  it("appends to existing CLAUDE.md without markers", () => {
    tmp = makeTempDir();
    const existing = "# My Project\n\nSome existing content.";
    writeFileSync(join(tmp, "CLAUDE.md"), existing, "utf-8");

    injectClaudeMdSection(tmp);

    const content = readFileSync(join(tmp, "CLAUDE.md"), "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("Some existing content.");
    expect(content).toContain(MARKER_START);
    expect(content).toContain(MARKER_END);
  });

  it("overwrites existing talos section without duplicating", () => {
    tmp = makeTempDir();
    const existing = `# My Project

<!-- talos-memo-start -->
## Old Talos Memory
Old content that should be replaced.
<!-- talos-memo-end -->

Some trailing content.`;
    writeFileSync(join(tmp, "CLAUDE.md"), existing, "utf-8");

    injectClaudeMdSection(tmp);

    const content = readFileSync(join(tmp, "CLAUDE.md"), "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("Some trailing content.");
    expect(content).not.toContain("Old Talos Memory");
    expect(content).not.toContain("Old content that should be replaced.");
    expect(content).toContain("三层记忆系统");

    // Only one pair of markers
    const starts = content.split(MARKER_START).length - 1;
    const ends = content.split(MARKER_END).length - 1;
    expect(starts).toBe(1);
    expect(ends).toBe(1);
  });

  it("is idempotent across multiple calls", () => {
    tmp = makeTempDir();
    writeFileSync(join(tmp, "CLAUDE.md"), "# Project\n", "utf-8");

    injectClaudeMdSection(tmp);
    const first = readFileSync(join(tmp, "CLAUDE.md"), "utf-8");

    injectClaudeMdSection(tmp);
    const second = readFileSync(join(tmp, "CLAUDE.md"), "utf-8");

    expect(first).toBe(second);
  });

  it("handles CLAUDE.md ending without newline", () => {
    tmp = makeTempDir();
    writeFileSync(join(tmp, "CLAUDE.md"), "# No trailing newline", "utf-8");

    injectClaudeMdSection(tmp);

    const content = readFileSync(join(tmp, "CLAUDE.md"), "utf-8");
    expect(content).toContain("# No trailing newline");
    expect(content).toContain(MARKER_START);
  });
});
