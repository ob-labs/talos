import { describe, it, expect } from 'vitest';
import { renderProgressBar, getProgressBarColor } from './progress-bar';

describe('renderProgressBar', () => {
  describe('edge cases', () => {
    it('should return "N/A" when total is 0', () => {
      expect(renderProgressBar(0, 0, 10)).toBe('N/A');
      expect(renderProgressBar(5, 0, 10)).toBe('N/A');
    });
  });

  describe('progress calculation', () => {
    it('should display empty progress bar for 0%', () => {
      expect(renderProgressBar(0, 10, 10)).toBe('[░░░░░░░░░░] 0/10');
    });

    it('should display half progress bar for 50%', () => {
      expect(renderProgressBar(5, 10, 10)).toBe('[█████░░░░░] 5/10');
    });

    it('should display full progress bar for 100%', () => {
      expect(renderProgressBar(10, 10, 10)).toBe('[██████████] 10/10');
    });

    it('should display partial progress correctly (60%)', () => {
      expect(renderProgressBar(6, 10, 10)).toBe('[██████░░░░] 6/10');
    });

    it('should handle rounding up (6/10 rounds to 6 blocks, 95/100 rounds to 10 blocks)', () => {
      // 6/10 = 60% -> 6 blocks
      expect(renderProgressBar(6, 10, 10)).toBe('[██████░░░░] 6/10');
      // 95/100 = 95% -> rounds to 10 blocks
      expect(renderProgressBar(95, 100, 10)).toBe('[██████████] 95/100');
    });

    it('should handle rounding down (4/10 rounds to 4 blocks)', () => {
      expect(renderProgressBar(4, 10, 10)).toBe('[████░░░░░░] 4/10');
    });
  });

  describe('different widths', () => {
    it('should support custom width', () => {
      expect(renderProgressBar(5, 10, 20)).toBe('[██████████░░░░░░░░░░] 5/10');
    });

    it('should use default width of 10', () => {
      expect(renderProgressBar(5, 10)).toBe('[█████░░░░░] 5/10');
    });
  });

  describe('different totals', () => {
    it('should handle small totals', () => {
      expect(renderProgressBar(1, 2, 10)).toBe('[█████░░░░░] 1/2');
      expect(renderProgressBar(0, 1, 10)).toBe('[░░░░░░░░░░] 0/1');
    });

    it('should handle large totals', () => {
      expect(renderProgressBar(50, 100, 10)).toBe('[█████░░░░░] 50/100');
      expect(renderProgressBar(33, 100, 10)).toBe('[███░░░░░░░] 33/100');
    });

    it('should handle odd numbers', () => {
      expect(renderProgressBar(3, 7, 10)).toBe('[████░░░░░░] 3/7');
      expect(renderProgressBar(5, 7, 10)).toBe('[███████░░░] 5/7');
    });
  });

  describe('all or nothing scenarios', () => {
    it('should show all passing', () => {
      expect(renderProgressBar(3, 3, 10)).toBe('[██████████] 3/3');
      expect(renderProgressBar(100, 100, 10)).toBe('[██████████] 100/100');
    });

    it('should show none passing', () => {
      expect(renderProgressBar(0, 5, 10)).toBe('[░░░░░░░░░░] 0/5');
      expect(renderProgressBar(0, 100, 10)).toBe('[░░░░░░░░░░] 0/100');
    });
  });
});

describe('getProgressBarColor', () => {
  describe('completion status', () => {
    it('should return green when all items are complete', () => {
      expect(getProgressBarColor(10, 10)).toBe('green');
      expect(getProgressBarColor(100, 100)).toBe('green');
      expect(getProgressBarColor(1, 1)).toBe('green');
    });

    it('should return gray when items are incomplete', () => {
      expect(getProgressBarColor(0, 10)).toBe('gray');
      expect(getProgressBarColor(5, 10)).toBe('gray');
      expect(getProgressBarColor(9, 10)).toBe('gray');
    });
  });

  describe('edge cases', () => {
    it('should return gray when total is 0', () => {
      expect(getProgressBarColor(0, 0)).toBe('gray');
      expect(getProgressBarColor(5, 0)).toBe('gray');
    });

    it('should handle zero current with non-zero total', () => {
      expect(getProgressBarColor(0, 10)).toBe('gray');
      expect(getProgressBarColor(0, 100)).toBe('gray');
    });
  });
});
