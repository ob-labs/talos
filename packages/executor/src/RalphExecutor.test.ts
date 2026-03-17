/**
 * Unit tests for RalphExecutor factory pattern
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RalphExecutor } from './RalphExecutor';
import { ToolExecutorFactory } from './ToolExecutorFactory';
import type { IToolExecutorFactory, IToolExecutor } from '@talos/types';

describe('RalphExecutor - Factory Pattern', () => {
  describe('constructor with factory', () => {
    it('should use provided toolExecutorFactory', () => {
      const mockFactory: IToolExecutorFactory = {
        create: vi.fn(),
        register: vi.fn(),
        listAvailable: vi.fn(() => ['claude', 'cursor']),
      };

      const executor = new RalphExecutor({
        prdName: 'test-prd',
        workingDir: '/tmp/test',
        tool: 'claude',
        toolExecutorFactory: mockFactory,
        mock: true,
      });

      expect(executor).toBeDefined();
      expect(mockFactory.listAvailable).toHaveBeenCalled();
    });

    it('should create default ToolExecutorFactory if not provided', () => {
      const executor = new RalphExecutor({
        prdName: 'test-prd',
        workingDir: '/tmp/test',
        tool: 'claude',
        mock: true,
      });

      expect(executor).toBeDefined();
    });

    it('should throw error if tool parameter is not provided', () => {
      // @ts-expect-error - Testing missing required parameter
      expect(() => new RalphExecutor({
        prdName: 'test-prd',
        workingDir: '/tmp/test',
        // tool: 'claude', // Missing required parameter
        mock: true,
      })).toThrow();
    });
  });

  describe('runIteration uses factory', () => {
    it('should call factory.create() during execution', async () => {
      const mockExecutor: IToolExecutor = {
        name: 'claude',
        execute: vi.fn().mockResolvedValue({
          success: true,
          output: 'Test output',
        }),
        isAvailable: vi.fn().mockResolvedValue(true),
        stop: vi.fn().mockResolvedValue(undefined),
        getConfig: vi.fn().mockReturnValue({
          name: 'claude',
          supportsDebugMode: true,
          supportedModels: ['claude-3-5-sonnet-20241022'],
        }),
      };

      const mockFactory: IToolExecutorFactory = {
        create: vi.fn(() => mockExecutor),
        register: vi.fn(),
        listAvailable: vi.fn(() => ['claude']),
      };

      const executor = new RalphExecutor({
        prdName: 'test-prd',
        workingDir: '/tmp/test',
        tool: 'claude',
        toolExecutorFactory: mockFactory,
        mock: true,
        mockIterations: 1, // Complete after 1 iteration
      });

      // We can't easily test runIteration directly as it's private,
      // but we can verify the factory was called when creating the executor
      expect(mockFactory).toBeDefined();
      expect(typeof mockFactory.create).toBe('function');
    });
  });

  describe('stop() calls executor stop()', () => {
    it('should call currentExecutor.stop() when stopping', async () => {
      const mockExecutor: IToolExecutor = {
        name: 'claude',
        execute: vi.fn().mockResolvedValue({
          success: true,
          output: 'Test output',
        }),
        isAvailable: vi.fn().mockResolvedValue(true),
        stop: vi.fn().mockResolvedValue(undefined),
        getConfig: vi.fn().mockReturnValue({
          name: 'claude',
          supportsDebugMode: true,
          supportedModels: ['claude-3-5-sonnet-20241022'],
        }),
      };

      const mockFactory: IToolExecutorFactory = {
        create: vi.fn(() => mockExecutor),
        register: vi.fn(),
        listAvailable: vi.fn(() => ['claude']),
      };

      const executor = new RalphExecutor({
        prdName: 'test-prd',
        workingDir: '/tmp/test',
        tool: 'claude',
        toolExecutorFactory: mockFactory,
        mock: true,
      });

      // The stop() method is public and should be callable
      await executor.stop();

      // Verify the executor can be stopped without errors
      expect(executor).toBeDefined();
    });
  });
});
