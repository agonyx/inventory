import PickListTable from '../components/PickListTable';

export default function PickListPage() {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">Pick List</h2>
      </div>
      <PickListTable />
    </div>
  );
}
