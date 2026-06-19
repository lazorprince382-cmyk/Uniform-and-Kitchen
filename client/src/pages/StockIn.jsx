import { useEffect, useState, useMemo } from 'react';
import { PackagePlus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { api } from '../api';
import { formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import SizeInput from '../components/SizeInput';

const fieldClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-school-red/30 focus:border-school-red transition disabled:bg-gray-50 disabled:text-gray-400';

function FieldLabel({ children }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1.5">{children}</label>;
}

export default function StockIn() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState({
    category_id: '',
    product_id: '',
    size: '',
    quantity: '',
    notes: '',
  });
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    api.categories.list().then(setCategories);
    api.products.list().then(setProducts);
    api.stock.transactions().then((t) => setTransactions(t.filter((x) => x.type === 'stock_in')));
  };
  useEffect(() => {
    load();
  }, []);

  const categoryProducts = useMemo(() => {
    if (!form.category_id) return [];
    return products.filter((p) => p.category_id == form.category_id);
  }, [products, form.category_id]);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(form.product_id)),
    [products, form.product_id]
  );

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      await api.stock.in({
        product_id: +form.product_id,
        size: form.size,
        quantity: +form.quantity,
        notes: form.notes,
        created_by: user?.id,
      });
      setForm({ category_id: '', product_id: '', size: '', quantity: '', notes: '' });
      setMessage({ type: 'success', text: 'Stock added to inventory successfully.' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Stock"
        subtitle="Select product type, item, size, then quantity — inventory updates automatically"
      />

      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm border ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border-green-100'
              : 'bg-red-50 text-red-700 border-red-100'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <form
          onSubmit={submit}
          className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5"
        >
          <h2 className="text-base font-semibold text-gray-900">Add Stock</h2>

          <div>
            <FieldLabel>Product type</FieldLabel>
            <select
              className={fieldClass}
              value={form.category_id}
              onChange={(e) =>
                setForm({ ...form, category_id: e.target.value, product_id: '', size: '' })
              }
              required
            >
              <option value="">Select type (Uniform Store, Sports Wear…)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Product</FieldLabel>
            <select
              className={fieldClass}
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              required
              disabled={!form.category_id}
            >
              <option value="">{form.category_id ? 'Select item' : 'Choose product type first'}</option>
              {categoryProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {selectedProduct && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <img
                  src={selectedProduct.image_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedProduct.id}`}
                  alt=""
                  className="h-16 w-16 rounded-lg border border-gray-200 bg-white object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedProduct.name}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <FieldLabel>Size</FieldLabel>
            <SizeInput
              id="stock-in-size"
              className={fieldClass}
              value={form.size}
              onChange={(size) => setForm({ ...form, size })}
              required
              placeholder="e.g. 2, 3, M, or type custom"
              hideHint={false}
              hint="Leave blank if not applicable — or type a custom size"
            />
          </div>

          <div>
            <FieldLabel>Quantity</FieldLabel>
            <input
              type="number"
              className={fieldClass}
              placeholder="How many units"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
              min="1"
            />
          </div>

          <div>
            <FieldLabel>Notes (optional)</FieldLabel>
            <textarea
              className={`${fieldClass} resize-none`}
              placeholder="Add any note here…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !form.product_id || !form.size}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold shadow-sm"
          >
            <PackagePlus className="w-5 h-5" />
            {submitting ? 'Adding…' : 'Add to Inventory'}
          </button>
        </form>

        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-900">Recent stock added</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 text-left">
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Product
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Size
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Qty
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">
                      No stock added yet
                    </td>
                  </tr>
                ) : (
                  transactions.slice(0, 12).map((r) => (
                    <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3.5 px-4 text-gray-600">{r.category_name}</td>
                      <td className="py-3.5 px-4 font-medium text-gray-900">{r.product_name}</td>
                      <td className="py-3.5 px-4 text-gray-700">{r.size}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex font-semibold text-green-600">+{r.quantity}</span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                        {formatDate(r.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
