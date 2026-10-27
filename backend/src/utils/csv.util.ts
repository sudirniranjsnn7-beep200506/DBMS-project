// ==============================================================================
// AssetVault: CSV Parser & Exporter Utility
// Course: BCSE307L Database Systems (Fall 2026-27)
// Provides streaming/string CSV parsing and serialization with quote handling
// ==============================================================================

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parses raw CSV text into an array of key-value row objects.
 */
export function parseCsv(text: string): CsvParseResult {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((field) => field.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = lines[0];
  if (!rawHeaders) {
    return { headers: [], rows: [] };
  }
  const headers = rawHeaders.map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowValues = lines[i];
    if (!rowValues) continue;
    const rowObj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const headerKey = headers[j];
      if (headerKey !== undefined) {
        rowObj[headerKey] = rowValues[j] !== undefined ? rowValues[j]! : '';
      }
    }
    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Serializes an array of objects to CSV format.
 */
export function toCsv<T extends Record<string, any>>(records: T[], columns: (keyof T | string)[]): string {
  const headerLine = columns.map((col) => `"${String(col).replace(/"/g, '""')}"`).join(',');
  const rowLines = records.map((record) => {
    return columns
      .map((col) => {
        const val = record[col as keyof T];
        if (val === null || val === undefined) {
          return '""';
        }
        const serialized = typeof val === 'object' ? JSON.stringify(val) : String(val);
        // Quoting protects CSV structure; prefixing formula-like text protects spreadsheet users.
        // Restrict this to strings so legitimate negative numeric values remain numeric.
        const safeValue =
          typeof val === 'string' && /^[\t\r\n ]*[=+@-]/.test(serialized)
            ? `'${serialized}`
            : serialized;
        return `"${safeValue.replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  return [headerLine, ...rowLines].join('\r\n');
}
