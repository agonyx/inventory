import PickListTable from '../components/PickListTable';
import { Download } from 'lucide-react';
import { openAuthenticatedUrl } from '../api/client';

export default function PickListPage() {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">Pick List</h2>
        <button
          onClick={() => openAuthenticatedUrl('/pick-list/pdf', { download: true })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <Download size={14} />
          Download PDF
        </button>
      </div>
      <PickListTable />
    </div>
  );
}
