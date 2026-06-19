import { useEffect, useState, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import SizeInput from '../components/SizeInput';

export default function StockOut() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ category_id: '', product_id: '', size: '', quantity: '', notes: '' });

  useEffect(() => {
    api.categories.list().then(setCategories);
    api.products.list().then(setProducts);
  }, []);

  const categoryProducts = useMemo(
    () => products.filter((p) => p.category_id == form.category_id),
    [products, form.category_id]
  );

  const stockOut = async (e) => {
    e.preventDefault();
    await api.stock.out({
      product_id: +form.product_id,
      size: form.size,
      quantity: +form.quantity,
      notes: form.notes,
      created_by: user?.id,
    });
    setForm({ category_id: '', product_id: '', size: '', quantity: '', notes: '' });
    alert('Stock adjustment recorded');
  };

  return (
    <div>
      <PageHeader title="Stock Adjustment" subtitle="Remove damaged stock by type, product, and size" />
      <form className="card p-5 space-y-4 max-w-lg" onSubmit={stockOut}>
        <select
          className="input-field"
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value, product_id: '' })}
          required
        >
          <option value="">Product type</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className="input-field"
          value={form.product_id}
          onChange={(e) => setForm({ ...form, product_id: e.target.value })}
          required
          disabled={!form.category_id}
        >
          <option value="">Product</option>
          {categoryProducts.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
          <SizeInput
            id="stock-out-size"
            value={form.size}
            onChange={(size) => setForm({ ...form, size })}
            required
          />
        </div>
        <input type="number" className="input-field" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required min="1" />
        <textarea className="input-field" placeholder="Reason" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit" className="btn-secondary w-full">Record Stock Out</button>
      </form>
    </div>
  );
}
