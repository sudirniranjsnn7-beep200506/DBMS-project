import { describe, expect, it } from 'vitest';
import { toCsv, parseCsv } from '../utils/csv.util';

describe('CSV export safety', () => {
  it('neutralizes spreadsheet formula-like string cells', () => {
    const csv = toCsv(
      [
        { value: '=1+1' },
        { value: '+SUM(A1:A2)' },
        { value: '  @SUM(A1:A2)' },
        { value: '-cmd|/C calc' },
      ],
      ['value']
    );

    expect(csv).toContain("\"'=1+1\"");
    expect(csv).toContain("\"'+SUM(A1:A2)\"");
    expect(csv).toContain("\"'  @SUM(A1:A2)\"");
    expect(csv).toContain("\"'-cmd|/C calc\"");
  });

  it('preserves negative numeric values and escapes ordinary CSV content', () => {
    const csv = toCsv(
      [
        { amount: -42, label: 'contains, comma' },
        { amount: 12, label: 'contains "quotes"' },
      ],
      ['amount', 'label']
    );

    expect(csv).toContain('-42');
    expect(csv).toContain('"contains, comma"');
    expect(csv).toContain('"contains ""quotes"""');
  });

  it('round-trips ordinary quoted CSV values', () => {
    const original = [{ name: 'Acme, Inc.', description: 'A "quoted" value' }];
    const parsed = parseCsv(toCsv(original, ['name', 'description']));

    expect(parsed.headers).toEqual(['name', 'description']);
    expect(parsed.rows).toEqual([
      { name: 'Acme, Inc.', description: 'A "quoted" value' },
    ]);
  });
});
