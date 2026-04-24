import { useState, useEffect, useCallback } from 'react';
import { Search, RotateCcw } from 'lucide-react';

export interface FilterConfig {
  key: string;
  label: string;
  type: 'search' | 'select' | 'date-range';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset: () => void;
}

export default function FilterBar({
  filters,
  values,
  onChange,
  onReset,
}: FilterBarProps) {
  // Local debounce state for search inputs
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [debounceTimers, setDebounceTimers] = useState<Record<string, ReturnType<typeof setTimeout>>>({});

  // Sync local state when external values change (e.g. on reset)
  useEffect(() => {
    const searchKeys = filters
      .filter((f) => f.type === 'search')
      .map((f) => f.key);
    const newLocal: Record<string, string> = {};
    for (const key of searchKeys) {
      newLocal[key] = values[key] || '';
    }
    setLocalValues((prev) => {
      const changed = searchKeys.some((k) => prev[k] !== newLocal[k]);
      return changed ? newLocal : prev;
    });
    // Only run when values reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = Object.values(debounceTimers);
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [debounceTimers]);

  const handleSearchChange = useCallback(
    (key: string, value: string) => {
      setLocalValues((prev) => ({ ...prev, [key]: value }));

      // Clear existing timer
      if (debounceTimers[key]) {
        clearTimeout(debounceTimers[key]);
      }

      const timer = setTimeout(() => {
        onChange(key, value);
      }, 300);

      setDebounceTimers((prev) => ({ ...prev, [key]: timer }));
    },
    [debounceTimers, onChange],
  );

  const hasActiveFilters = filters.some((f) => {
    if (f.type === 'search') return !!values[f.key];
    if (f.type === 'select') return !!values[f.key];
    if (f.type === 'date-range') return !!values[`${f.key}_from`] || !!values[`${f.key}_to`];
    return false;
  });

  return (
    <div className="flex flex-wrap items-end gap-3">
      {filters.map((filter) => {
        if (filter.type === 'search') {
          return (
            <div key={filter.key} className="min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                {filter.label}
              </label>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={localValues[filter.key] || ''}
                  onChange={(e) => handleSearchChange(filter.key, e.target.value)}
                  placeholder={filter.placeholder || `Search ${filter.label.toLowerCase()}...`}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          );
        }

        if (filter.type === 'select') {
          return (
            <div key={filter.key} className="min-w-[150px]">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                {filter.label}
              </label>
              <select
                value={values[filter.key] || ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All</option>
                {filter.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (filter.type === 'date-range') {
          return (
            <div key={filter.key}>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                {filter.label}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={values[`${filter.key}_from`] || ''}
                  onChange={(e) => onChange(`${filter.key}_from`, e.target.value)}
                  className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="From"
                />
                <span className="text-gray-400 text-xs">&ndash;</span>
                <input
                  type="date"
                  value={values[`${filter.key}_to`] || ''}
                  onChange={(e) => onChange(`${filter.key}_to`, e.target.value)}
                  className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="To"
                />
              </div>
            </div>
          );
        }

        return null;
      })}

      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      )}
    </div>
  );
}
