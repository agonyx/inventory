export interface PaginationOptions { page: number; limit: number; }
export interface PaginationResult { page: number; limit: number; total: number; totalPages: number; }

export function parsePagination(query: Record<string, any>): PaginationOptions {
  let page = parseInt(query.page, 10) || 1;
  let limit = parseInt(query.limit, 10) || 25;
  limit = Math.min(Math.max(limit, 1), 100);
  page = Math.max(page, 1);
  return { page, limit };
}

export function buildPaginationResponse(page: number, limit: number, total: number): PaginationResult {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}
