import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { api } from '../api';
import { formatDate } from '../utils/format';

export default function Orders() {
  const [orders, setOrders] = useState([]);

  const load = () => api.orders.list().then(setOrders);
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    await api.orders.updateStatus(id, status);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Uniform Issuances"
        subtitle="Uniforms issued to children — track collection status"
      />
      <div className="card">
        <DataTable
          columns={[
            { key: 'order_number', label: 'Issuance #', render: (r) => <span className="font-medium">#{r.order_number}</span> },
            { key: 'created_at', label: 'Date', render: (r) => formatDate(r.created_at) },
            {
              key: 'student_name',
              label: 'Child',
              render: (r) => (
                <div>
                  <p className="font-medium">{r.student_name || '—'}</p>
                  {r.class_grade && <p className="text-xs text-gray-400">{r.class_grade}{r.section ? ` · ${r.section}` : ''}</p>}
                </div>
              ),
            },
            {
              key: 'parent_name',
              label: 'Collected by',
              render: (r) => (
                <div>
                  <p>{r.parent_name || '—'}</p>
                  {r.parent_phone && <p className="text-xs text-gray-400">{r.parent_phone}</p>}
                </div>
              ),
            },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]}
          data={orders}
          actions={(row) => (
            <select
              className="text-xs border rounded px-2 py-1"
              value={row.status}
              onChange={(e) => updateStatus(row.id, e.target.value)}
            >
              <option value="pending">Pending pickup</option>
              <option value="processing">Processing</option>
              <option value="completed">Collected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          )}
        />
      </div>
    </div>
  );
}
