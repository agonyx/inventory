import { ChevronUp, ChevronDown } from 'lucide-react';

interface SortableHeaderProps {
  label: string;
  column: string;
  currentSortBy?: string;
  currentSortDir?: 'ASC' | 'DESC';
  onSort: (column: string) => void;
}

export default function SortableHeader({
  label,
  column,
  currentSortBy,
  currentSortDir,
  onSort,
}: SortableHeaderProps) {
  const isActive = currentSortBy === column;

  return (
    <th
      onClick={() => onSort(column)}
      className={`px-4 py-3 select-none transition ${
        isActive
          ? 'text-blue-700 cursor-pointer'
          : 'text-gray-500 hover:text-gray-700 cursor-pointer'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          currentSortDir === 'ASC' ? (
            <ChevronUp size={14} className="text-blue-600" />
          ) : (
            <ChevronDown size={14} className="text-blue-600" />
          )
        ) : (
          <ChevronUp size={14} className="text-gray-300" />
        )}
      </span>
    </th>
  );
}
