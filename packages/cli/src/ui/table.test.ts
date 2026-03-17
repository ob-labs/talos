import { describe, it, expect } from 'vitest';
import { Table, renderTable, colorize } from './table';

describe('Table', () => {
  describe('basic rendering', () => {
    it('should render a simple table with headers and rows', () => {
      const table = new Table({
        columns: [
          { title: 'Name' },
          { title: 'Status' },
        ],
        rows: [
          { name: 'Task 1', status: 'Running' },
          { name: 'Task 2', status: 'Done' },
        ],
      });

      const result = table.render();
      expect(result).toContain('Name');
      expect(result).toContain('Status');
      expect(result).toContain('Task 1');
      expect(result).toContain('Running');
      expect(result).toContain('Task 2');
      expect(result).toContain('Done');
    });

    it('should render table with borders by default', () => {
      const table = new Table({
        columns: [
          { title: 'Name' },
          { title: 'Status' },
        ],
        rows: [
          { name: 'Test', status: 'OK' },
        ],
      });

      const result = table.render();
      expect(result).toContain(' | ');
      expect(result).toContain('─');
    });

    it('should render table without borders when showBorders is false', () => {
      const table = new Table({
        columns: [
          { title: 'Name' },
          { title: 'Status' },
        ],
        rows: [
          { name: 'Test', status: 'OK' },
        ],
        showBorders: false,
      });

      const result = table.render();
      expect(result).not.toContain(' | ');
      expect(result).not.toContain('─');
    });
  });

  describe('column configuration', () => {
    it('should support custom column width', () => {
      const table = new Table({
        columns: [
          { title: 'Name', width: 30 },
          { title: 'Status' },
        ],
        rows: [
          { name: 'Short', status: 'OK' },
        ],
      });

      const result = table.render();
      const lines = result.split('\n');
      expect(lines[0].length).toBeGreaterThan(20);
    });

    it('should support left alignment (default)', () => {
      const table = new Table({
        columns: [
          { title: 'Name' },
          { title: 'Status', alignment: 'left' },
        ],
        rows: [{ name: 'Test', status: 'OK' }],
      });

      const result = table.render();
      expect(result).toContain('Test');
      expect(result).toContain('OK');
    });
  });

  describe('coloring', () => {
    it('should apply color function to column values', () => {
      const table = new Table({
        columns: [
          { title: 'Name' },
          { title: 'Status', colorFn: (value) => colorize(value, '\x1b[32m') },
        ],
        rows: [
          { name: 'Task 1', status: 'Done' },
        ],
      });

      const result = table.render();
      expect(result).toContain('\x1b[32m');
      expect(result).toContain('\x1b[0m');
    });
  });

  describe('utility functions', () => {
    it('should render table using helper function', () => {
      const result = renderTable({
        columns: [{ title: 'Name' }],
        rows: [{ name: 'Test' }],
      });

      expect(result).toContain('Name');
      expect(result).toContain('Test');
    });

    it('should colorize text', () => {
      const result = colorize('Test', '\x1b[31m');
      expect(result).toBe('\x1b[31mTest\x1b[0m');
    });
  });
});
