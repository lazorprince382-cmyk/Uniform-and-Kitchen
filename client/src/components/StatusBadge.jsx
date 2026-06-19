export default function StatusBadge({ status }) {
  const map = {
    completed: 'badge-completed',
    processing: 'badge-processing',
    pending: 'badge-pending',
    cancelled: 'bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-xs font-medium',
    approved: 'badge-completed',
    rejected: 'bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-medium',
  };
  return (
    <span className={map[status] || map.pending}>
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
}
