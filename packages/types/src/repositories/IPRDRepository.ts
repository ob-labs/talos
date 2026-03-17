/**
 * IPRDRepository - PRD Repository Interface
 *
 * Repository pattern for PRD entities.
 * Provides CRUD operations for PRD persistence.
 *
 * DESIGN PRINCIPLES:
 * - Only accepts complete entities (no partial updates)
 * - Returns entities or null (not undefined)
 * - Encapsulates storage implementation details
 *
 * @example
 * ```typescript
 * const prd: IPRD = { ... };
 * await prdRepository.save(prd);              // Save complete PRD
 * const found = await prdRepository.findById('prd-001');
 * const all = await prdRepository.findAll();
 * await prdRepository.delete('prd-001');
 * ```
 */
export interface IPRDRepository {
  /**
   * Save a complete PRD entity
   * Creates new or updates existing PRD
   *
   * @param prd - Complete PRD entity to save
   * @throws Error if PRD is invalid or save fails
   */
  save(prd: IPRD): Promise<void>;

  /**
   * Find PRD by ID
   *
   * @param prdId - PRD identifier
   * @returns PRD entity or null if not found
   */
  findById(prdId: string): Promise<IPRD | null>;

  /**
   * Find all PRDs
   * Optionally filter by status
   *
   * @param filter - Optional filter criteria
   * @returns Array of PRD entities
   */
  findAll(filter?: PRDFilter): Promise<IPRD[]>;

  /**
   * Delete a PRD by ID
   *
   * @param prdId - PRD identifier
   * @throws Error if PRD not found or delete fails
   */
  delete(prdId: string): Promise<void>;

  /**
   * Check if PRD exists
   *
   * @param prdId - PRD identifier
   * @returns true if PRD exists, false otherwise
   */
  exists(prdId: string): Promise<boolean>;

  /**
   * Find PRD by branch name
   *
   * @param branchName - Git branch name
   * @returns PRD entity or null if not found
   */
  findByBranch(branchName: string): Promise<IPRD | null>;

  /**
   * Find active PRD (status = 'active')
   *
   * @returns Active PRD or null if none active
   */
  findActive(): Promise<IPRD | null>;
}

/**
 * PRD filter criteria
 */
export interface PRDFilter {
  /**
   * Filter by PRD status
   */
  status?: string;

  /**
   * Filter by project name
   */
  project?: string;

  /**
   * Filter by branch name
   */
  branchName?: string;
}

/**
 * Import IPRD entity interface
 */
import type { IPRD } from "../entities/IPRD";
