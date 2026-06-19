import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SizeInput, { DEFAULT_SIZES } from '../components/SizeInput';
import { api } from '../api';
import { formatNumber } from '../utils/format';

const emptyForm = () => ({
  name: '',
  category_id: '',
  min_stock_level: 20,
  sizes: [{ size: '', quantity: '' }],
});

export default function Products() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [sizeSuggestions, setSizeSuggestions] = useState([]);

  const load = () => {
    api.products.list().then(setItems);
    api.categories.list().then(setCategories);
  };
  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm(emptyForm());
    setEditingProduct(null);
    setSizeSuggestions([]);
    setModal('new');
  };

  const sortSizes = (list) =>
    [...list].sort((a, b) => String(a.size).localeCompare(String(b.size), undefined, { numeric: true }));

  const mapSizesToForm = (sizeList) => {
    if (sizeList?.length > 0) {
      return sortSizes(sizeList).map((s) => ({
        size: s.size || '',
        quantity: s.quantity != null && s.quantity !== '' ? String(s.quantity) : '',
      }));
    }
    return [{ size: '', quantity: '' }];
  };

  /** Sizes for this product only — matches Inventory breakdown for that name. */
  const loadInventorySizesForProduct = async (productId, productName) => {
    const id = Number(productId);
    if (!id) return [];

    const { sizes: rows, product_name: apiName } = await api.products.inventorySizes(id);
    if (productName && apiName && apiName !== productName) {
      console.warn('Product name mismatch when loading inventory sizes');
    }

    return sortSizes(
      (rows || []).map((r) => ({
        size: r.size,
        quantity: r.quantity,
      }))
    );
  };

  const openEdit = async (row) => {
    const productId = Number(row.id);
    setEditingProduct({ id: productId, name: row.name });

    try {
      const [full, inventorySizes] = await Promise.all([
        api.products.get(productId),
        loadInventorySizesForProduct(productId, row.name),
      ]);

      const sizes =
        inventorySizes.length > 0
          ? inventorySizes
          : full.sizes?.length
            ? full.sizes
            : full.current_stock > 0
              ? [{ size: '', quantity: full.current_stock }]
              : [];

      const mapped = mapSizesToForm(sizes);
      setSizeSuggestions(mapped.map((s) => s.size).filter(Boolean));
      setForm({
        name: full.name,
        category_id: full.category_id || '',
        min_stock_level: full.min_stock_level ?? 20,
        sizes: mapped,
      });
      setModal(productId);
    } catch {
      try {
        const inventorySizes = await loadInventorySizesForProduct(productId, row.name);
        const mapped = mapSizesToForm(inventorySizes);
        setSizeSuggestions(mapped.map((s) => s.size).filter(Boolean));
        setForm({
          name: row.name,
          category_id: row.category_id || '',
          min_stock_level: row.min_stock_level ?? 20,
          sizes: mapped.length ? mapped : [{ size: '', quantity: '' }],
        });
      } catch {
        setSizeSuggestions([]);
        setForm({
          name: row.name,
          category_id: row.category_id || '',
          min_stock_level: row.min_stock_level ?? 20,
          sizes: [{ size: '', quantity: '' }],
        });
      }
      setModal(productId);
    }
  };

  const updateSizeRow = (index, field, value) => {
    setForm((prev) => {
      const sizes = [...prev.sizes];
      sizes[index] = { ...sizes[index], [field]: value };
      return { ...prev, sizes };
    });
  };

  const addSizeRow = () => {
    setForm((prev) => ({ ...prev, sizes: [...prev.sizes, { size: '', quantity: '' }] }));
  };

  const removeSizeRow = (index) => {
    setForm((prev) => ({
      ...prev,
      sizes: prev.sizes.length > 1 ? prev.sizes.filter((_, i) => i !== index) : [{ size: '', quantity: '' }],
    }));
  };

  const save = async () => {
    const sizes = form.sizes
      .filter((s) => s.size?.trim())
      .map((s) => ({ size: s.size.trim(), quantity: +s.quantity || 0 }));

    if (modal !== 'new' && sizes.length === 0) {
      alert('Add at least one size with a quantity, or keep the existing size rows.');
      return;
    }

    const data = {
      name: form.name,
      category_id: form.category_id || null,
      unit_price: 0,
      min_stock_level: +form.min_stock_level || 20,
      sizes,
    };

    setSaving(true);
    try {
      if (modal === 'new') await api.products.create(data);
      else await api.products.update(modal, data);
      setModal(null);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalFromSizes = form.sizes.reduce((sum, s) => sum + (parseInt(s.quantity, 10) || 0), 0);

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Individual items with sizes and stock levels"
        action={
          <button className="btn-primary flex items-center gap-2" onClick={openNew}>
            <Plus className="w-4 h-4" /> Add Product
          </button>
        }
      />
      <div className="card">
        <DataTable
          columns={[
            {
              key: 'name',
              label: 'Product',
              render: (r) => (
                <div className="flex items-center gap-2">
                  <img
                    src={r.image_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${r.id}`}
                    className="w-8 h-8 rounded"
                    alt=""
                  />
                  <p className="font-medium">{r.name}</p>
                </div>
              ),
            },
            { key: 'category_name', label: 'Category' },
            {
              key: 'current_stock',
              label: 'Stock',
              render: (r) => (
                <span className={r.current_stock <= r.min_stock_level ? 'text-red-600 font-semibold' : ''}>
                  {formatNumber(r.current_stock)}
                </span>
              ),
            },
          ]}
          data={items}
          actions={(row) => (
            <div className="flex gap-2">
              <button onClick={() => openEdit(row)} className="p-1 hover:bg-gray-100 rounded">
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={async () => {
                  if (confirm('Delete?')) {
                    await api.products.delete(row.id);
                    load();
                  }
                }}
                className="p-1 hover:bg-red-50 text-red-600 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        />
      </div>

      {modal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold mb-4">{modal === 'new' ? 'Add Product' : 'Edit Product'}</h2>
            <div className="space-y-3">
              <input
                className="input-field"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <select
                className="input-field"
                value={form.category_id || ''}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Sizes & stock</label>
                  <button type="button" onClick={addSizeRow} className="btn-secondary text-xs py-1 px-2">
                    + Add size
                  </button>
                </div>
                <div className="space-y-2">
                  {form.sizes.map((row, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 min-w-0">
                        <SizeInput
                          id={`product-size-${index}`}
                          className="input-field w-full py-2 text-sm"
                          value={row.size}
                          onChange={(size) => updateSizeRow(index, 'size', size)}
                          placeholder="Size (e.g. 8, M)"
                          hideHint
                          suggestions={
                            modal === 'new'
                              ? DEFAULT_SIZES
                              : sizeSuggestions.length > 0
                                ? sizeSuggestions
                                : form.sizes.map((s) => s.size).filter(Boolean)
                          }
                        />
                      </div>
                      <input
                        type="number"
                        min="0"
                        className="input-field w-24 py-2 text-sm"
                        placeholder="Qty"
                        value={row.quantity}
                        onChange={(e) => updateSizeRow(index, 'quantity', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeSizeRow(index)}
                        className="p-2 text-gray-400 hover:text-red-600 shrink-0"
                        aria-label="Remove size"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Total stock: {formatNumber(totalFromSizes)} units across sizes
                  {modal !== 'new' && editingProduct && (
                    <span className="block mt-0.5" style={{ color: '#152a5e' }}>
                      Sizes for <strong>{editingProduct.name}</strong> only — from Inventory (
                      {form.sizes.filter((s) => s.size?.trim()).length} size
                      {form.sizes.filter((s) => s.size?.trim()).length !== 1 ? 's' : ''}).
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Min stock alert level
                </label>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  placeholder="e.g. 25"
                  value={form.min_stock_level}
                  onChange={(e) => setForm({ ...form, min_stock_level: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Alert when total stock falls below this number (not the stock quantity).
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary flex-1" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                className="btn-secondary flex-1"
                onClick={() => {
                  setModal(null);
                  setEditingProduct(null);
                  setSizeSuggestions([]);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
