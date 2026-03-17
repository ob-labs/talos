/**
 * Unit tests for ToolExecutorFactory
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolExecutorFactory } from './ToolExecutorFactory';
import { ClaudeExecutor } from './executors/ClaudeExecutor';
import { CursorExecutor } from './executors/CursorExecutor';
import type { IToolExecutor } from '@talos/types';

describe('ToolExecutorFactory', () => {
  let factory: ToolExecutorFactory;

  beforeEach(() => {
    factory = new ToolExecutorFactory();
  });

  describe('IToolExecutorFactory interface compliance', () => {
    it('should have create method', () => {
      expect(factory.create).toBeDefined();
      expect(typeof factory.create).toBe('function');
    });

    it('should have register method', () => {
      expect(factory.register).toBeDefined();
      expect(typeof factory.register).toBe('function');
    });

    it('should have listAvailable method', () => {
      expect(factory.listAvailable).toBeDefined();
      expect(typeof factory.listAvailable).toBe('function');
    });
  });

  describe('constructor', () => {
    it('should register built-in tools', () => {
      const available = factory.listAvailable();
      expect(available).toContain('claude');
      expect(available).toContain('cursor');
    });
  });

  describe('create', () => {
    it('should create ClaudeExecutor for "claude"', () => {
      const executor = factory.create('claude');
      expect(executor).toBeInstanceOf(ClaudeExecutor);
      expect(executor.name).toBe('claude');
    });

    it('should create CursorExecutor for "cursor"', () => {
      const executor = factory.create('cursor');
      expect(executor).toBeInstanceOf(CursorExecutor);
      expect(executor.name).toBe('cursor');
    });

    it('should throw error for unknown tool', () => {
      expect(() => factory.create('unknown-tool')).toThrow(
        'Unknown tool: unknown-tool'
      );
    });

    it('should create new instance on each call', () => {
      const executor1 = factory.create('claude');
      const executor2 = factory.create('claude');
      expect(executor1).not.toBe(executor2);
    });
  });

  describe('register', () => {
    it('should register custom tool', () => {
      const mockExecutor: IToolExecutor = {
        name: 'custom-tool',
        execute: async () => ({
          success: true,
          output: 'test',
        }),
        isAvailable: async () => true,
        stop: async () => {},
        getConfig: () => ({
          name: 'custom-tool',
          supportsDebugMode: false,
          supportedModels: [],
        }),
      };

      factory.register('custom-tool', () => mockExecutor);

      const available = factory.listAvailable();
      expect(available).toContain('custom-tool');
    });

    it('should create registered custom tool', () => {
      const mockExecutor: IToolExecutor = {
        name: 'custom-tool',
        execute: async () => ({
          success: true,
          output: 'test',
        }),
        isAvailable: async () => true,
        stop: async () => {},
        getConfig: () => ({
          name: 'custom-tool',
          supportsDebugMode: false,
          supportedModels: [],
        }),
      };

      factory.register('custom-tool', () => mockExecutor);
      const executor = factory.create('custom-tool');
      expect(executor).toBe(mockExecutor);
    });

    it('should allow overriding already registered tools', () => {
      const mockExecutor: IToolExecutor = {
        name: 'claude',
        execute: async () => ({
          success: true,
          output: 'overridden',
        }),
        isAvailable: async () => true,
        stop: async () => {},
        getConfig: () => ({
          name: 'claude',
          supportsDebugMode: false,
          supportedModels: [],
        }),
      };

      factory.register('claude', () => mockExecutor);
      const executor = factory.create('claude');
      expect(executor).toBe(mockExecutor);
      expect(executor).not.toBeInstanceOf(ClaudeExecutor);
    });

    it('should call factory function on each create', () => {
      let callCount = 0;
      const mockExecutorFactory = () => {
        callCount++;
        return {
          name: 'custom-tool',
          execute: async () => ({ success: true, output: 'test' }),
          isAvailable: async () => true,
          stop: async () => {},
          getConfig: () => ({
            name: 'custom-tool',
            supportsDebugMode: false,
            supportedModels: [],
          }),
        };
      };

      factory.register('custom-tool', mockExecutorFactory);
      factory.create('custom-tool');
      factory.create('custom-tool');

      expect(callCount).toBe(2);
    });
  });

  describe('listAvailable', () => {
    it('should return array of tool names', () => {
      const available = factory.listAvailable();
      expect(Array.isArray(available)).toBe(true);
      expect(available.length).toBeGreaterThan(0);
    });

    it('should include built-in tools', () => {
      const available = factory.listAvailable();
      expect(available).toContain('claude');
      expect(available).toContain('cursor');
    });

    it('should include custom registered tools', () => {
      const mockExecutor: IToolExecutor = {
        name: 'custom-tool',
        execute: async () => ({ success: true, output: 'test' }),
        isAvailable: async () => true,
        stop: async () => {},
        getConfig: () => ({
          name: 'custom-tool',
          supportsDebugMode: false,
          supportedModels: [],
        }),
      };

      factory.register('custom-tool', () => mockExecutor);
      const available = factory.listAvailable();
      expect(available).toContain('custom-tool');
    });

    it('should return correct list after overriding', () => {
      const mockExecutor: IToolExecutor = {
        name: 'claude',
        execute: async () => ({ success: true, output: 'overridden' }),
        isAvailable: async () => true,
        stop: async () => {},
        getConfig: () => ({
          name: 'claude',
          supportsDebugMode: false,
          supportedModels: [],
        }),
      };

      factory.register('claude', () => mockExecutor);
      const available = factory.listAvailable();
      expect(available).toContain('claude');
      // Should still only have 'claude' once, not duplicated
      expect(available.filter((n) => n === 'claude').length).toBe(1);
    });
  });
});
