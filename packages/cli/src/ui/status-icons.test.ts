import { describe, it, expect } from 'vitest';
import {
  getStatusIcon,
  getStatusColor,
  getStatusAnsiColor,
  colorizeWithStatus,
  formatStatus,
  getAllStatusConfigs,
  isValidTaskStatus,
  STATUS_CONFIG,
  ANSI_COLORS,
} from './status-icons';

describe('getStatusIcon', () => {
  it('should return correct icon for running status', () => {
    expect(getStatusIcon('running')).toBe('🔄');
    expect(getStatusIcon('RUNNING')).toBe('🔄');
  });

  it('should return correct icon for stopped status', () => {
    expect(getStatusIcon('stopped')).toBe('⏸️');
    expect(getStatusIcon('STOPPED')).toBe('⏸️');
  });

  it('should return correct icon for completed status', () => {
    expect(getStatusIcon('completed')).toBe('✅');
    expect(getStatusIcon('COMPLETED')).toBe('✅');
  });

  it('should return correct icon for failed status', () => {
    expect(getStatusIcon('failed')).toBe('❌');
    expect(getStatusIcon('FAILED')).toBe('❌');
  });

  it('should return correct icon for pending status', () => {
    expect(getStatusIcon('pending')).toBe('⏳');
    expect(getStatusIcon('PENDING')).toBe('⏳');
  });

  it('should return correct icon for initializing status', () => {
    expect(getStatusIcon('initializing')).toBe('🔧');
    expect(getStatusIcon('INITIALIZING')).toBe('🔧');
  });

  it('should return default icon for unknown status', () => {
    expect(getStatusIcon('unknown')).toBe('⚫');
    expect(getStatusIcon('')).toBe('⚫');
  });
});

describe('getStatusColor', () => {
  it('should return correct color for running status', () => {
    expect(getStatusColor('running')).toBe('cyan');
    expect(getStatusColor('RUNNING')).toBe('cyan');
  });

  it('should return correct color for stopped status', () => {
    expect(getStatusColor('stopped')).toBe('gray');
    expect(getStatusColor('STOPPED')).toBe('gray');
  });

  it('should return correct color for completed status', () => {
    expect(getStatusColor('completed')).toBe('green');
    expect(getStatusColor('COMPLETED')).toBe('green');
  });

  it('should return correct color for failed status', () => {
    expect(getStatusColor('failed')).toBe('red');
    expect(getStatusColor('FAILED')).toBe('red');
  });

  it('should return correct color for pending status', () => {
    expect(getStatusColor('pending')).toBe('yellow');
    expect(getStatusColor('PENDING')).toBe('yellow');
  });

  it('should return correct color for initializing status', () => {
    expect(getStatusColor('initializing')).toBe('blue');
    expect(getStatusColor('INITIALIZING')).toBe('blue');
  });

  it('should return white color for unknown status', () => {
    expect(getStatusColor('unknown')).toBe('white');
  });
});

describe('getStatusAnsiColor', () => {
  it('should return correct ANSI code for running status', () => {
    expect(getStatusAnsiColor('running')).toBe('\x1b[36m');
  });

  it('should return correct ANSI code for stopped status', () => {
    expect(getStatusAnsiColor('stopped')).toBe('\x1b[90m');
  });

  it('should return correct ANSI code for completed status', () => {
    expect(getStatusAnsiColor('completed')).toBe('\x1b[32m');
  });

  it('should return correct ANSI code for failed status', () => {
    expect(getStatusAnsiColor('failed')).toBe('\x1b[31m');
  });

  it('should return correct ANSI code for pending status', () => {
    expect(getStatusAnsiColor('pending')).toBe('\x1b[33m');
  });

  it('should return correct ANSI code for initializing status', () => {
    expect(getStatusAnsiColor('initializing')).toBe('\x1b[34m');
  });

  it('should return white ANSI code for unknown status', () => {
    expect(getStatusAnsiColor('unknown')).toBe('\x1b[37m');
  });
});

describe('colorizeWithStatus', () => {
  it('should colorize text with running status color', () => {
    const result = colorizeWithStatus('Running', 'running');
    expect(result).toBe('\x1b[36mRunning\x1b[0m');
  });

  it('should colorize text with completed status color', () => {
    const result = colorizeWithStatus('Done', 'completed');
    expect(result).toBe('\x1b[32mDone\x1b[0m');
  });

  it('should colorize text with failed status color', () => {
    const result = colorizeWithStatus('Error', 'failed');
    expect(result).toBe('\x1b[31mError\x1b[0m');
  });

  it('should include ANSI reset code', () => {
    const result = colorizeWithStatus('Test', 'running');
    expect(result).toContain('\x1b[0m');
  });
});

describe('formatStatus', () => {
  it('should format status with icon by default', () => {
    const result = formatStatus('running');
    expect(result).toBe('🔄 \x1b[36mrunning\x1b[0m');
  });

  it('should format completed status with icon', () => {
    const result = formatStatus('completed');
    expect(result).toBe('✅ \x1b[32mcompleted\x1b[0m');
  });

  it('should format failed status with icon', () => {
    const result = formatStatus('failed');
    expect(result).toBe('❌ \x1b[31mfailed\x1b[0m');
  });

  it('should format status without icon when showIcon is false', () => {
    const result = formatStatus('running', false);
    expect(result).toBe('\x1b[36mrunning\x1b[0m');
    expect(result).not.toContain('🔄');
  });

  it('should handle uppercase status', () => {
    const result = formatStatus('RUNNING');
    expect(result).toContain('🔄');
    expect(result).toContain('\x1b[36m');
  });
});

describe('getAllStatusConfigs', () => {
  it('should return all status configurations', () => {
    const configs = getAllStatusConfigs();

    expect(configs).toHaveProperty('running');
    expect(configs).toHaveProperty('stopped');
    expect(configs).toHaveProperty('completed');
    expect(configs).toHaveProperty('failed');
    expect(configs).toHaveProperty('pending');
    expect(configs).toHaveProperty('initializing');
  });

  it('should return a copy of STATUS_CONFIG (not the same object)', () => {
    const configs1 = getAllStatusConfigs();
    const configs2 = getAllStatusConfigs();

    expect(configs1).toEqual(configs2);
    expect(configs1).not.toBe(STATUS_CONFIG);
  });

  it('should have icon and color for each status', () => {
    const configs = getAllStatusConfigs();

    Object.values(configs).forEach(config => {
      expect(config).toHaveProperty('icon');
      expect(config).toHaveProperty('color');
      expect(config).toHaveProperty('ansiColor');
      expect(typeof config.icon).toBe('string');
      expect(typeof config.color).toBe('string');
      expect(typeof config.ansiColor).toBe('string');
    });
  });
});

describe('isValidTaskStatus', () => {
  it('should return true for valid task statuses', () => {
    expect(isValidTaskStatus('running')).toBe(true);
    expect(isValidTaskStatus('RUNNING')).toBe(true);
    expect(isValidTaskStatus('stopped')).toBe(true);
    expect(isValidTaskStatus('completed')).toBe(true);
    expect(isValidTaskStatus('failed')).toBe(true);
    expect(isValidTaskStatus('pending')).toBe(true);
    expect(isValidTaskStatus('initializing')).toBe(true);
  });

  it('should return false for invalid task statuses', () => {
    expect(isValidTaskStatus('unknown')).toBe(false);
    expect(isValidTaskStatus('')).toBe(false);
    expect(isValidTaskStatus('invalid')).toBe(false);
    expect(isValidTaskStatus('test')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isValidTaskStatus('RUNNING')).toBe(true);
    expect(isValidTaskStatus('Running')).toBe(true);
    expect(isValidTaskStatus('running')).toBe(true);
  });
});

describe('STATUS_CONFIG', () => {
  it('should have all required statuses', () => {
    expect(STATUS_CONFIG).toHaveProperty('running');
    expect(STATUS_CONFIG).toHaveProperty('stopped');
    expect(STATUS_CONFIG).toHaveProperty('completed');
    expect(STATUS_CONFIG).toHaveProperty('failed');
    expect(STATUS_CONFIG).toHaveProperty('pending');
    expect(STATUS_CONFIG).toHaveProperty('initializing');
  });

  it('should have correct icons for each status', () => {
    expect(STATUS_CONFIG.running.icon).toBe('🔄');
    expect(STATUS_CONFIG.stopped.icon).toBe('⏸️');
    expect(STATUS_CONFIG.completed.icon).toBe('✅');
    expect(STATUS_CONFIG.failed.icon).toBe('❌');
    expect(STATUS_CONFIG.pending.icon).toBe('⏳');
    expect(STATUS_CONFIG.initializing.icon).toBe('🔧');
  });

  it('should have correct colors for each status', () => {
    expect(STATUS_CONFIG.running.color).toBe('cyan');
    expect(STATUS_CONFIG.stopped.color).toBe('gray');
    expect(STATUS_CONFIG.completed.color).toBe('green');
    expect(STATUS_CONFIG.failed.color).toBe('red');
    expect(STATUS_CONFIG.pending.color).toBe('yellow');
    expect(STATUS_CONFIG.initializing.color).toBe('blue');
  });

  it('should have valid ANSI color codes for each status', () => {
    Object.values(STATUS_CONFIG).forEach(config => {
      expect(config.ansiColor).toMatch(/^\x1b\[\d+m$/);
    });
  });
});

describe('ANSI_COLORS', () => {
  it('should have all required ANSI colors', () => {
    expect(ANSI_COLORS).toHaveProperty('reset');
    expect(ANSI_COLORS).toHaveProperty('bold');
    expect(ANSI_COLORS).toHaveProperty('red');
    expect(ANSI_COLORS).toHaveProperty('green');
    expect(ANSI_COLORS).toHaveProperty('yellow');
    expect(ANSI_COLORS).toHaveProperty('blue');
    expect(ANSI_COLORS).toHaveProperty('cyan');
    expect(ANSI_COLORS).toHaveProperty('white');
    expect(ANSI_COLORS).toHaveProperty('gray');
  });

  it('should have valid ANSI escape codes', () => {
    Object.values(ANSI_COLORS).forEach(color => {
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^\x1b\[/);
    });
  });

  it('should have reset code', () => {
    expect(ANSI_COLORS.reset).toBe('\x1b[0m');
  });

  it('should have bold code', () => {
    expect(ANSI_COLORS.bold).toBe('\x1b[1m');
  });
});

describe('edge cases', () => {
  it('should handle empty string in getStatusIcon', () => {
    expect(getStatusIcon('')).toBe('⚫');
  });

  it('should handle empty string in getStatusColor', () => {
    expect(getStatusColor('')).toBe('white');
  });

  it('should handle empty string in getStatusAnsiColor', () => {
    expect(getStatusAnsiColor('')).toBe('\x1b[37m');
  });

  it('should handle empty string in colorizeWithStatus', () => {
    const result = colorizeWithStatus('', 'running');
    expect(result).toBe('\x1b[36m\x1b[0m');
  });

  it('should handle empty string in formatStatus', () => {
    const result = formatStatus('', true);
    expect(result).toContain('⚫');
  });

  it('should handle null/undefined gracefully in formatStatus', () => {
    const result = formatStatus('unknown' as any, true);
    expect(result).toContain('⚫');
  });
});
