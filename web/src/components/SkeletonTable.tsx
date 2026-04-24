interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export default function SkeletonTable({
  rows = 5,
  columns = 5,
}: SkeletonTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-100">
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx}>
                {Array.from({ length: columns }).map((_, colIdx) => (
                  <td key={colIdx} className="px-4 py-3">
                    <div
                      className="h-4 bg-gray-100 rounded animate-pulse"
                      style={{
                        width: `${60 + ((rowIdx + colIdx) % 3) * 20}%`,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
        <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-8 bg-gray-100 rounded-md animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
