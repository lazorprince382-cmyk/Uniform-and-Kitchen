import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { api } from '../api';
import { formatDate } from '../utils/format';

function StatusBadge({ status, label }) {
  const styles = {
    full: 'bg-green-100 text-green-800 border-green-200',
    partial: 'bg-amber-100 text-amber-800 border-amber-200',
    none: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  const icons = {
    full: CheckCircle2,
    partial: AlertCircle,
    none: Circle,
  };
  const Icon = icons[status] || Circle;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

export default function UniformHistory() {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.uniformHistory.list().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-school-red border-t-transparent rounded-full" />
      </div>
    );
  }

  const filtered = data.students.filter((s) => filter === 'all' || s.uniform_status === filter);

  return (
    <div>
      <PageHeader
        title="Uniform History"
        subtitle="Full uniform = shirt & shorts (boys) or shirt & skirt/dress (girls), plus Sports Wear, Track Suits, Sweaters, and Socks"
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <button
          type="button"
          onClick={() => setFilter('full')}
          className={`card p-4 text-left ${filter === 'full' ? 'ring-2 ring-green-500' : ''}`}
        >
          <p className="text-2xl font-bold text-green-700">{data.summary.full}</p>
          <p className="text-sm text-gray-500">Full uniform</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('partial')}
          className={`card p-4 text-left ${filter === 'partial' ? 'ring-2 ring-amber-500' : ''}`}
        >
          <p className="text-2xl font-bold text-amber-700">{data.summary.partial}</p>
          <p className="text-sm text-gray-500">Partial only</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('none')}
          className={`card p-4 text-left ${filter === 'none' ? 'ring-2 ring-gray-400' : ''}`}
        >
          <p className="text-2xl font-bold text-gray-600">{data.summary.none}</p>
          <p className="text-sm text-gray-500">Not issued yet</p>
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {['all', 'full', 'partial', 'none'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`filter-pill capitalize ${filter === f ? 'filter-pill-active' : ''}`}
          >
            {f === 'all' ? 'All students' : f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((student) => (
          <div key={student.id} className="card overflow-hidden">
            <button
              type="button"
              className="w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-gray-50"
              onClick={() => setExpanded(expanded === student.id ? null : student.id)}
            >
              <div>
                <p className="font-semibold text-gray-900">{student.full_name}</p>
                <p className="text-sm text-gray-500">
                  {student.class_grade}
                  {student.section ? ` · Section ${student.section}` : ''} · Parent: {student.parent_name}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {student.items_received.length} item type(s) · {student.issuances.length} issuance(s)
                </span>
                <StatusBadge status={student.uniform_status} label={student.uniform_label} />
              </div>
            </button>

            {expanded === student.id && (
              <div className="border-t px-4 pb-4 pt-3 bg-gray-50/50 space-y-4">
                {student.uniform_status === 'partial' && student.missing_core_items?.length > 0 && (
                  <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
                    Still needed: {student.missing_core_items.join(', ')}
                  </p>
                )}

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Items received (total)</p>
                  <div className="flex flex-wrap gap-2">
                    {student.items_received.length === 0 ? (
                      <span className="text-sm text-gray-400">None yet</span>
                    ) : (
                      student.items_received.map((item) => (
                        <span
                          key={item.product_id || item.product_name}
                          className="text-xs bg-white border rounded-full px-3 py-1"
                        >
                          {item.product_name} ×{item.total_quantity}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Issuance history</p>
                  {student.issuances.length === 0 ? (
                    <p className="text-sm text-gray-400">No issuances</p>
                  ) : (
                    <div className="space-y-2">
                      {student.issuances.map((iss) => (
                        <div key={iss.id} className="bg-white border rounded-lg p-3 text-sm">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium">#{iss.order_number}</span>
                            <span className="text-gray-500">{formatDate(iss.created_at)}</span>
                          </div>
                          <ul className="text-xs text-gray-600 space-y-0.5 mt-1">
                            {iss.items.map((it, i) => (
                              <li key={i}>
                                {it.product_name} ({it.category_name}) ×{it.quantity}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
