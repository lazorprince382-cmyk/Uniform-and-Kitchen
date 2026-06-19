import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SizeInput, { DEFAULT_SIZES } from '../components/SizeInput';
import { api } from '../api';
import { formatDate, formatNumber } from '../utils/format';

function IssuancesReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({ size: '', quantity: 1 });
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.reports
      .collections()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (row) => {
    setEditRow(row);
    setEditForm({ size: row.size || '', quantity: row.quantity || 1 });
  };

  const saveEdit = async () => {
    if (!editRow?.item_id) return;
    setSaving(true);
    try {
      await api.orders.updateItem(editRow.item_id, {
        size: editForm.size,
        quantity: +editForm.quantity,
      });
      setEditRow(null);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (row) => {
    if (!row.item_id) return;
    if (!confirm(`Remove this item from ${row.student_name}'s issuance? Stock will be restored.`)) return;
    try {
      await api.orders.deleteItem(row.item_id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-school-red border-t-transparent rounded-full" />
      </div>
    );
  }

  const summary = data?.summary || {};
  const lines = data?.lines || [];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? lines.filter(
        (r) =>
          r.student_name?.toLowerCase().includes(q) ||
          r.product_name?.toLowerCase().includes(q) ||
          r.order_number?.toLowerCase().includes(q) ||
          r.size?.toLowerCase().includes(q) ||
          r.class_grade?.toLowerCase().includes(q)
      )
    : lines;

  const displayTotalItems = summary.total_items || lines.reduce((s, r) => s + (r.quantity || 0), 0);
  const displayChildren = summary.students_served || new Set(lines.map((r) => r.student_name).filter(Boolean)).size;

  const downloadIssuances = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await api.reports.downloadExcel('issuances', { days: summary.days || 90 });
      const match = filename.match(/filename="?([^"]+)"?/i);
      const name = match?.[1] || `issuances-report-${Date.now()}.xls`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Issuances Report"
        subtitle="Uniforms issued to children — view, search, and correct size or quantity"
        action={
          <button className="btn-primary flex items-center gap-2" onClick={downloadIssuances} disabled={downloading}>
            <Download className="w-4 h-4" />
            {downloading ? 'Downloading…' : 'Download Excel'}
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total issued to children</p>
          <p className="text-2xl font-bold">{formatNumber(displayTotalItems)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {formatNumber(summary.total_issuances || 0)} issuance slips · last {summary.days || 90} days
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Children served</p>
          <p className="text-2xl font-bold">{formatNumber(displayChildren)}</p>
          <p className="text-xs text-gray-400 mt-1">Received at least one uniform item</p>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="search"
          className="input-field max-w-md"
          placeholder="Search child, class, product, size, or issuance #…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-gray-500 text-sm">
            {lines.length === 0
              ? 'No items issued to children yet. Use Issue Uniform — each line will appear here.'
              : 'No results match your search.'}
          </p>
        ) : (
          <DataTable
            columns={[
              { key: 'created_at', label: 'Date', render: (r) => formatDate(r.created_at) },
              {
                key: 'order_number',
                label: 'Issuance #',
                render: (r) => <span className="font-mono text-xs">{r.order_number}</span>,
              },
              {
                key: 'student_name',
                label: 'Child',
                render: (r) => (
                  <div>
                    <p className="font-medium">{r.student_name || '—'}</p>
                    {r.class_grade && (
                      <p className="text-xs text-gray-400">
                        {r.class_grade}
                        {r.section ? ` · ${r.section}` : ''}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                key: 'product_name',
                label: 'Item',
                render: (r) => (
                  <div>
                    <p className="font-medium">{r.product_name}</p>
                    <p className="text-xs text-gray-400">{r.category_name}</p>
                  </div>
                ),
              },
              {
                key: 'size',
                label: 'Size',
                render: (r) => <span className="font-semibold text-school-red">{r.size || '—'}</span>,
              },
              { key: 'quantity', label: 'Qty', render: (r) => formatNumber(r.quantity) },
            ]}
            data={filtered}
            actions={(row) =>
              row.item_id ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="p-1.5 hover:bg-gray-100 rounded"
                    title="Edit size or quantity"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLine(row)}
                    className="p-1.5 hover:bg-red-50 text-red-600 rounded"
                    title="Remove line"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : null
            }
          />
        )}
      </div>

      {editRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-sm">
            <h2 className="font-semibold mb-1">Edit issuance</h2>
            <p className="text-sm text-gray-500 mb-4">
              {editRow.student_name} · {editRow.product_name}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                <SizeInput
                  id="edit-issuance-size"
                  className="input-field w-full"
                  value={editForm.size}
                  onChange={(size) => setEditForm({ ...editForm, size })}
                  suggestions={DEFAULT_SIZES}
                  hideHint
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  className="input-field w-full"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary flex-1" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-secondary flex-1" onClick={() => setEditRow(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const location = useLocation();
  const type = location.pathname.split('/').pop();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const isIssuances = type === 'collections' || type === 'sales';

  useEffect(() => {
    if (isIssuances) return;
    setLoading(true);
    const fetcher = type === 'stock' ? api.reports.stock : api.reports.lowStock;
    fetcher().then(setData).finally(() => setLoading(false));
  }, [type, isIssuances]);

  if (isIssuances) {
    return <IssuancesReport />;
  }

  const titles = {
    stock: { title: 'Stock Report', subtitle: 'Complete inventory stock levels' },
    'low-stock': { title: 'Low Stock Report', subtitle: 'Items requiring reorder' },
  };
  const t = titles[type] || titles.stock;

  if (loading) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-school-red border-t-transparent rounded-full" />
      </div>
    );
  }

  const rows = Array.isArray(data) ? data : [];

  const downloadCurrentReport = async () => {
    const reportType = type === 'low-stock' ? 'low-stock' : 'stock';
    setDownloading(true);
    try {
      const { blob, filename } = await api.reports.downloadExcel(reportType);
      const match = filename.match(/filename="?([^"]+)"?/i);
      const name = match?.[1] || `${reportType}-report-${Date.now()}.xls`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        action={
          <button className="btn-primary flex items-center gap-2" onClick={downloadCurrentReport} disabled={downloading}>
            <Download className="w-4 h-4" />
            {downloading ? 'Downloading…' : 'Download Excel'}
          </button>
        }
      />
      <div className="card">
        <DataTable
          columns={[
            { key: 'name', label: 'Product' },
            { key: 'category_name', label: 'Category' },
            {
              key: 'current_stock',
              label: 'Stock',
              render: (r) => (
                <span
                  className={
                    r.is_low_stock || r.current_stock <= r.min_stock_level
                      ? 'text-red-600 font-semibold'
                      : ''
                  }
                >
                  {formatNumber(r.current_stock)}
                </span>
              ),
            },
            { key: 'min_stock_level', label: 'Min Level' },
            ...(type === 'low-stock'
              ? [
                  {
                    key: 'units_needed',
                    label: 'Units Needed',
                    render: (r) => Math.max(0, r.min_stock_level - r.current_stock),
                  },
                ]
              : []),
          ]}
          data={rows}
        />
      </div>
    </div>
  );
}
