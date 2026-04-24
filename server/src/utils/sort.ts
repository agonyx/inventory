export interface SortOptions { sortBy: string; sortDir: 'ASC' | 'DESC'; }

export function parseSort(query: Record<string, any>, allowedColumns: string[]): SortOptions {
  let sortBy = query.sortBy || 'createdAt';
  let sortDir = (query.sortDir || 'desc').toUpperCase() as 'ASC' | 'DESC';
  if (sortDir !== 'ASC' && sortDir !== 'DESC') sortDir = 'DESC';
  if (!allowedColumns.includes(sortBy)) sortBy = allowedColumns[0] || 'createdAt';
  return { sortBy, sortDir };
}
