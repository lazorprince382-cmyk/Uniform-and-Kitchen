import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { api } from '../api';
import { formatDate } from '../utils/format';

export default function Returns() {
  const [returns, setReturns] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ order_id: '', student_id: '', product_id: '', quantity: '1', reason: '' });

  useEffect(() => {
    api.returns.list().then(setReturns);
    api.orders.list().then(setOrders);
    api.products.list().then(setProducts);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const order = orders.find((o) => o.id == form.order_id);
    const product = products.find((p) => p.id == form.product_id);
    await api.returns.create({
      order_id: +form.order_id,
      parent_id: order?.parent_id,
      student_id: order?.student_id || +form.student_id,
      reason: form.reason,
      items: [{ product_id: product.id, quantity: +form.quantity, unit_price: 0 }],
    });
    setShowForm(false);
    api.returns.list().then(setReturns);
  };

  return (
    <div>
      <PageHeader
        title="Returns"
        subtitle="Parents returning uniforms — items are restocked automatically"
        action={<button className="btn-primary" onClick={() => setShowForm(true)}>Process Return</button>}
      />
      <div className="card">
        <DataTable
          columns={[
            { key: 'return_number', label: 'Return #' },
            { key: 'order_number', label: 'Issuance' },
            { key: 'parent_name', label: 'Parent' },
            { key: 'student_name', label: 'Student' },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'created_at', label: 'Date', render: (r) => formatDate(r.created_at) },
          ]}
          data={returns}
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form className="card p-6 w-full max-w-md space-y-3" onSubmit={submit}>
            <h2 className="font-semibold">Process Parent Return</h2>
            <select className="input-field" value={form.order_id} onChange={(e) => setForm({ ...form, order_id: e.target.value })} required>
              <option value="">Select original issuance</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {o.parent_name} / {o.student_name}
                </option>
              ))}
            </select>
            <select className="input-field" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required>
              <option value="">Select item returned</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} min="1" />
            <textarea className="input-field" placeholder="Reason for return" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">Submit</button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
