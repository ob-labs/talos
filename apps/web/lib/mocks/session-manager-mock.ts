/**
 * Mock of TerminalSessionManager for client-side bundling
 *
 * TerminalSessionManager uses node-pty which is a Node.js-only module.
 * This mock prevents build errors when session-manager is accidentally included in client code.
 *
 * If you see this error in production, it means TerminalSessionManager is being used in client code,
 * which is not supported. Terminal sessions should only be managed in server-side code (API routes, WebSocket servers).
 */

export class TerminalSessionManager {
  constructor() {
    throw new Error(
      'TerminalSessionManager is a Node.js-only module and cannot be used in the browser. ' +
      'Please use WebSocket API to communicate with the terminal session manager running on the server.'
    );
  }

  static getInstance() {
    throw new Error('TerminalSessionManager cannot be used in browser');
  }

  getOrCreateSession() {
    throw new Error('TerminalSessionManager cannot be used in browser');
  }

  attachSocket() {
    throw new Error('TerminalSessionManager cannot be used in browser');
  }

  killSession() {
    throw new Error('TerminalSessionManager cannot be used in browser');
  }

  getSessions() {
    throw new Error('TerminalSessionManager cannot be used in browser');
  }
}

export type PTYSession = any;
