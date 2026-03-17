import type {
  IPRD,
  IPRDRepository,
  PRDFilter
} from "@talos/types";
import { LocalStorageEngine } from "../storage/storage";
import * as path from "path";
import { homedir } from "os";

/**
 * PRDRepository - Repository implementation for PRD entities
 *
 * Implements rich domain model repository pattern.
 * Only accepts complete entities (no partial updates).
 * Reuses PRDManager file operation logic with atomic writes.
 *
 * Storage: ralph/{prdId}/prd.json (folder name = PRD ID)
 *
 * @example
 * ```typescript
 * const repo = new PRDRepository('/path/to/project');
 * await repo.save(prd);
 * const found = await repo.findById('prd-001');
 * ```
 */
export class PRDRepository implements IPRDRepository {
  private storage: LocalStorageEngine;
  private baseDir: string;

  /**
   * Create PRDRepository
   *
   * @param baseDir - Base directory for PRD storage (project path or home dir)
   */
  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.storage = new LocalStorageEngine(baseDir);
  }

  /**
   * Get PRD file path
   * @private
   */
  private getPRDPath(prdId: string): string {
    return path.join("ralph", prdId, "prd.json");
  }

  /**
   * Save a complete PRD entity
   * Creates new or updates existing PRD
   *
   * @param prd - Complete PRD entity to save
   * @throws Error if PRD is invalid or save fails
   */
  async save(prd: IPRD): Promise<void> {
    if (!prd.id) {
      throw new Error("PRD must have an id");
    }

    const prdPath = this.getPRDPath(prd.id);
    const prdToSave = {
      ...prd,
      updatedAt: Date.now()
    };

    await this.storage.writeJSON(prdPath, prdToSave);
  }

  /**
   * Find PRD by ID
   *
   * Note: PRD files don't contain the `id` field.
   * The ID is set from the folder name (folder structure: ralph/{prdId}/prd.json).
   *
   * @param prdId - PRD identifier
   * @returns PRD entity or null if not found
   */
  async findById(prdId: string): Promise<IPRD | null> {
    const prdPath = this.getPRDPath(prdId);
    const prd = await this.storage.readJSON<IPRD>(prdPath);
    if (prd) {
      prd.id = prdId;  // Set ID from folder name
    }
    return prd;
  }

  /**
   * Find all PRDs
   * Optionally filter by status
   *
   * Note: PRD files don't contain the `id` field.
   * The ID is set from the folder name for each PRD.
   *
   * @param filter - Optional filter criteria
   * @returns Array of PRD entities
   */
  async findAll(filter?: PRDFilter): Promise<IPRD[]> {
    // List all PRD directories (folder name = PRD ID)
    const ralphDir = path.join(this.baseDir, "ralph");
    let prdDirs: string[] = [];

    try {
      const { readdir } = await import("fs/promises");
      const entries = await readdir(ralphDir, { withFileTypes: true });
      prdDirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error) {
      // Directory doesn't exist yet
      return [];
    }

    // Load all PRDs
    const prds: IPRD[] = [];
    for (const prdId of prdDirs) {
      const prdPath = path.join("ralph", prdId, "prd.json");
      const prd = await this.storage.readJSON<IPRD>(prdPath);
      if (prd) {
        prd.id = prdId;  // Set ID from folder name
        prds.push(prd);
      }
    }

    // Apply filter if provided
    if (filter) {
      return prds.filter(prd => {
        if (filter.status && prd.status !== filter.status) {
          return false;
        }
        if (filter.project && prd.project !== filter.project) {
          return false;
        }
        if (filter.branchName && prd.branchName !== filter.branchName) {
          return false;
        }
        return true;
      });
    }

    return prds;
  }

  /**
   * Delete a PRD by ID
   *
   * @param prdId - PRD identifier
   * @throws Error if PRD not found or delete fails
   */
  async delete(prdId: string): Promise<void> {
    const prdPath = this.getPRDPath(prdId);
    const exists = this.storage.fileExists(prdPath);

    if (!exists) {
      throw new Error(`PRD not found: ${prdId}`);
    }

    await this.storage.deleteFile(prdPath);
  }

  /**
   * Check if PRD exists
   *
   * @param prdId - PRD identifier
   * @returns true if PRD exists, false otherwise
   */
  async exists(prdId: string): Promise<boolean> {
    const prdPath = this.getPRDPath(prdId);
    return this.storage.fileExists(prdPath);
  }

  /**
   * Find PRD by branch name
   *
   * @param branchName - Git branch name
   * @returns PRD entity or null if not found
   */
  async findByBranch(branchName: string): Promise<IPRD | null> {
    const allPRDs = await this.findAll();
    return allPRDs.find(prd => prd.branchName === branchName) || null;
  }

  /**
   * Find active PRD (status = 'active')
   *
   * @returns Active PRD or null if none active
   */
  async findActive(): Promise<IPRD | null> {
    const activePRDs = await this.findAll({ status: "active" });
    return activePRDs[0] || null;
  }
}
