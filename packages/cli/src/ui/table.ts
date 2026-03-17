/**
 * Table - Generic CLI table component
 *
 * Provides a simple table rendering utility for command-line interfaces.
 * Supports column configuration, data row rendering, and colored text output.
 */

export interface ColumnConfig {
  /** Column title / 列标题 */
  title: string;
  /** Column width in characters (default: auto) / 列宽度（字符数，默认：自动） */
  width?: number;
  /** Text alignment: 'left', 'center', or 'right' (default: 'left') / 文本对齐方式 */
  alignment?: 'left' | 'center' | 'right';
  /** Color function for styling values (optional) / 值的样式着色函数（可选） */
  colorFn?: (value: string) => string;
}

export type TableRow = Record<string, string | number>;

export interface TableOptions {
  /** Column configuration / 列配置 */
  columns: ColumnConfig[];
  /** Data rows to display / 要显示的数据行 */
  rows: TableRow[];
  /** Show header row (default: true) / 显示表头行（默认：true） */
  showHeader?: boolean;
  /** Show borders (default: true) / 显示边框（默认：true） */
  showBorders?: boolean;
  /** Header color function (default: bold) / 表头样式函数（默认：粗体） */
  headerColorFn?: (text: string) => string;
}

/**
 * Simple color utility functions
 */
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

/**
 * Apply color to text
 */
export function colorize(text: string, colorCode: string): string {
  return `${colorCode}${text}${colors.reset}`;
}

/**
 * Calculate column widths based on content
 */
function calculateColumnWidths(
  columns: ColumnConfig[],
  rows: TableRow[]
): number[] {
  return columns.map((col, colIndex) => {
    const key = Object.keys(rows[0] || {})[colIndex];
    if (!key) return col.title.length;

    // Start with title width
    let maxWidth = col.title.length;

    // Check all row values
    rows.forEach(row => {
      const value = String(row[key] || '');
      maxWidth = Math.max(maxWidth, value.length);
    });

    // Use explicit width if provided and larger
    if (col.width && col.width > maxWidth) {
      return col.width;
    }

    return maxWidth;
  });
}

/**
 * Pad text to specified width with alignment
 */
function padText(text: string, width: number, alignment: 'left' | 'center' | 'right' = 'left'): string {
  const str = String(text);
  if (str.length >= width) {
    return str.substring(0, width);
  }

  const padding = width - str.length;

  switch (alignment) {
    case 'center':
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
    case 'right':
      return ' '.repeat(padding) + str;
    case 'left':
    default:
      return str + ' '.repeat(padding);
  }
}

/**
 * Render a table as a string
 *
 * @param options - Table configuration options
 * @returns Rendered table string
 *
 * @example
 * ```ts
 * const table = new Table({
 *   columns: [
 *     { title: 'Name', width: 20 },
 *     { title: 'Status', alignment: 'center' },
 *   ],
 *   rows: [
 *     { name: 'Task 1', status: 'Running' },
 *     { name: 'Task 2', status: 'Done' },
 *   ],
 * });
 * console.log(table.render());
 * ```
 */
export class Table {
  private options: TableOptions;
  private columnWidths: number[];

  constructor(options: TableOptions) {
    this.options = {
      showHeader: true,
      showBorders: true,
      headerColorFn: (text) => colorize(text, colors.bold),
      ...options,
    };
    this.columnWidths = calculateColumnWidths(this.options.columns, this.options.rows);
  }

  /**
   * Render the table as a string
   */
  render(): string {
    const lines: string[] = [];
    const { columns, rows, showHeader, showBorders, headerColorFn } = this.options;

    // Get keys from first row (use column index if no rows)
    const keys = rows.length > 0 ? Object.keys(rows[0]) : columns.map((_, i) => String(i));

    // Render header
    if (showHeader) {
      const headerCells = columns.map((col, i) => {
        const title = col.title;
        const padded = padText(title, this.columnWidths[i], 'left');
        return headerColorFn!(padded);
      });
      lines.push(headerCells.join(showBorders ? ' | ' : '  '));

      // Render separator
      if (showBorders) {
        const separator = columns.map((_, i) => '─'.repeat(this.columnWidths[i])).join('─┼─');
        lines.push(separator);
      }
    }

    // Render rows
    rows.forEach((row, rowIndex) => {
      const cells = columns.map((col, colIndex) => {
        const key = keys[colIndex];
        const value = String(row[key] || '');

        const padded = padText(value, this.columnWidths[colIndex], col.alignment || 'left');

        // Apply color function if provided
        if (col.colorFn) {
          return col.colorFn(padded);
        }

        return padded;
      });

      lines.push(cells.join(showBorders ? ' | ' : '  '));
    });

    return lines.join('\n');
  }

  /**
   * Print the table to console
   */
  print(): void {
    console.log(this.render());
  }
}

/**
 * Helper function to create and render a table in one call
 */
export function renderTable(options: TableOptions): string {
  const table = new Table(options);
  return table.render();
}
