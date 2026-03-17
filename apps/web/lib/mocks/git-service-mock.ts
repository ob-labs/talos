/**
 * Mock of GitService for client-side bundling
 *
 * GitService uses Node.js-only modules (child_process, util)
 * This mock prevents build errors when GitService is accidentally imported in client code.
 *
 * If you see this error in production, it means GitService is being used in client code,
 * which is not supported. Git operations should only be performed in API routes.
 */

export class GitService {
  constructor() {
    throw new Error(
      'GitService is a Node.js-only module and cannot be used in the browser. ' +
      'Please move Git operations to API routes or server actions.'
    );
  }

  async createWorktree() {
    throw new Error('GitService cannot be used in browser');
  }

  async removeWorktree() {
    throw new Error('GitService cannot be used in browser');
  }

  async listWorktrees() {
    throw new Error('GitService cannot be used in browser');
  }

  // Add other methods as needed
}

// Re-export types from the main @talos/git package
export type { WorktreeListItem } from '@talos/git';
