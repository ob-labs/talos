/**
 * UI State Storage
 *
 * Provides storage for UI process state and configuration.
 * Previously part of global-config.ts, now separated as a dedicated module.
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { LocalStorageEngine } from "./storage";
import type { UIProcessState, UIConfig } from "@talos/types";

/**
 * TALOS_DIR constant
 */
export const TALOS_DIR = path.join(os.homedir(), ".talos");

/**
 * UI state file path
 */
const UI_STATE_FILE = "ui-state.json";

/**
 * UIStateStorage - Storage for UI process state and configuration
 *
 * Stores:
 * - UI process state (PID, port, start time)
 * - UI configuration
 *
 * File: ~/.talos/ui-state.json
 */
export class UIStateStorage {
  private storage: LocalStorageEngine;

  /**
   * Create UIStateStorage
   *
   * Uses ~/.talos as base directory for UI state storage
   */
  constructor() {
    this.storage = new LocalStorageEngine(TALOS_DIR);
  }

  /**
   * Get UI state from storage
   * @returns UI state or null if not set
   */
  async getUIState(): Promise<{
    ui?: UIProcessState;
    uiConfig?: UIConfig;
  } | null> {
    try {
      return await this.storage.readJSON(UI_STATE_FILE);
    } catch {
      return null;
    }
  }

  /**
   * Save UI state to storage
   * @param state - UI state to save
   */
  async saveUIState(state: {
    ui?: UIProcessState;
    uiConfig?: UIConfig;
  }): Promise<void> {
    await this.storage.writeJSON(UI_STATE_FILE, state);
  }

  /**
   * Get the UI process state
   * @returns UIProcessState object or null if not set
   */
  async getUIProcessState(): Promise<UIProcessState | null> {
    const state = await this.getUIState();
    return state?.ui || null;
  }

  /**
   * Set the UI process state
   * @param uiState - UIProcessState object to save
   */
  async setUIProcessState(uiState: UIProcessState): Promise<void> {
    const state = await this.getUIState() || {};
    state.ui = uiState;
    await this.saveUIState(state);
  }

  /**
   * Clear the UI process state
   */
  async clearUIProcessState(): Promise<void> {
    const state = await this.getUIState();
    if (state) {
      state.ui = undefined;
      await this.saveUIState(state);
    }
  }

  /**
   * Get the UI configuration
   * @returns UIConfig object or null if not set
   */
  async getUIConfig(): Promise<UIConfig | null> {
    const state = await this.getUIState();
    return state?.uiConfig || null;
  }

  /**
   * Set the UI configuration
   * @param uiConfig - UIConfig object to save
   */
  async setUIConfig(uiConfig: UIConfig): Promise<void> {
    const state = await this.getUIState() || {};
    state.uiConfig = uiConfig;
    await this.saveUIState(state);
  }
}

/**
 * Default singleton instance
 */
export const uiStateStorage = new UIStateStorage();
