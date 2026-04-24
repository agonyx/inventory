export function exportToCsv(headers: string[], rows: Record<string, any>[]): string {
  const escape = (val: any): string => {
    const s = val === null || val === undefined ? '' : String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

export function getCsvFilename(entity: string): string {
  return `${entity}-${new Date().toISOString().split('T')[0]}.csv`;
}
