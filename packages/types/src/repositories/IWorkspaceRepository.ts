/**
 * IWorkspaceRepository - Workspace Repository Interface
 *
 * Repository pattern for Workspace entities.
 * Provides CRUD operations for Workspace persistence.
 *
 * DESIGN PRINCIPLES:
 * - Only accepts complete entities (no partial updates)
 * - Returns entities or null (not undefined)
 * - Encapsulates storage implementation details
 *
 * @example
 * ```typescript
 * const workspace: IWorkspace = { ... };
 * await workspaceRepository.save(workspace);              // Save complete workspace
 * const found = await workspaceRepository.findById('ws-123');
 * const all = await workspaceRepository.findAll();
 * await workspaceRepository.delete('ws-123');
 * ```
 */
export interface IWorkspaceRepository {
  /**
   * Save a complete workspace entity
   * Creates new or updates existing workspace
   *
   * @param workspace - Complete workspace entity to save
   * @throws Error if workspace is invalid or save fails
   */
  save(workspace: IWorkspace): Promise<void>;

  /**
   * Find workspace by ID
   *
   * @param workspaceId - Workspace identifier
   * @returns Workspace entity or null if not found
   */
  findById(workspaceId: string): Promise<IWorkspace | null>;

  /**
   * Find all workspaces
   * Optionally filter by criteria
   *
   * @param filter - Optional filter criteria
   * @returns Array of workspace entities
   */
  findAll(filter?: WorkspaceFilter): Promise<IWorkspace[]>;

  /**
   * Delete a workspace by ID
   *
   * @param workspaceId - Workspace identifier
   * @throws Error if workspace not found or delete fails
   */
  delete(workspaceId: string): Promise<void>;

  /**
   * Check if workspace exists
   *
   * @param workspaceId - Workspace identifier
   * @returns true if workspace exists, false otherwise
   */
  exists(workspaceId: string): Promise<boolean>;

  /**
   * Find workspace by path
   *
   * @param path - Absolute file system path
   * @returns Workspace entity or null if not found
   */
  findByPath(path: string): Promise<IWorkspace | null>;

  /**
   * Find workspace by name
   *
   * @param name - Workspace name
   * @returns Workspace entity or null if not found
   */
  findByName(name: string): Promise<IWorkspace | null>;

  /**
   * Count workspaces matching filter
   *
   * @param filter - Optional filter criteria
   * @returns Number of matching workspaces
   */
  count(filter?: WorkspaceFilter): Promise<number>;
}

/**
 * Workspace filter criteria
 */
export interface WorkspaceFilter {
  /**
   * Filter by branch name
   */
  branch?: string;

  /**
   * Filter by name pattern (partial match)
   */
  name?: string;

  /**
   * Filter by path pattern
   */
  path?: string;
}

/**
 * Import IWorkspace entity interface
 */
import type { IWorkspace } from "../entities/IWorkspace";
