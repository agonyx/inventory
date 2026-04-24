import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface UseUrlFiltersReturn {
  filters: Record<string, string>;
  sort: { sortBy: string; sortDir: string };
  page: number;
  limit: number;
  setFilter: (key: string, value: string) => void;
  removeFilter: (key: string) => void;
  setSort: (column: string) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  resetFilters: () => void;
}

export default function useUrlFilters(): UseUrlFiltersReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL — everything that's not sort, sortDir, page, limit
  const filters = useMemo(() => {
    const result: Record<string, string> = {};
    const reserved = new Set(['sortBy', 'sortDir', 'page', 'limit']);
    for (const [key, value] of searchParams.entries()) {
      if (!reserved.has(key) && value) {
        result[key] = value;
      }
    }
    return result;
  }, [searchParams]);

  const sort = useMemo(
    () => ({
      sortBy: searchParams.get('sortBy') || '',
      sortDir: searchParams.get('sortDir') || 'ASC',
    }),
    [searchParams],
  );

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Number(searchParams.get('limit')) || 25;

  const setFilter = useCallback(
    (key: string, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
          // Reset to page 1 when filters change
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const removeFilter = useCallback(
    (key: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(key);
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSort = useCallback(
    (column: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const currentSort = prev.get('sortBy');
          const currentDir = prev.get('sortDir') || 'ASC';

          if (currentSort === column) {
            // Toggle direction
            next.set('sortDir', currentDir === 'ASC' ? 'DESC' : 'ASC');
          } else {
            next.set('sortBy', column);
            next.set('sortDir', 'ASC');
          }
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (newPage: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newPage <= 1) {
            next.delete('page');
          } else {
            next.set('page', String(newPage));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setLimit = useCallback(
    (newLimit: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('limit', String(newLimit));
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return {
    filters,
    sort,
    page,
    limit,
    setFilter,
    removeFilter,
    setSort,
    setPage,
    setLimit,
    resetFilters,
  };
}
