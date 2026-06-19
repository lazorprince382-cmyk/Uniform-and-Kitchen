import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import { api } from '../api';

export default function Categories() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', color_code: '#c41e3a' });

  const load = () => api.categories.list().then(setItems);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (modal === 'new') await api.categories.create(form);
    else await api.categories.update(modal, form);
    setModal(null);
    setForm({ name: '', description: '', color_code: '#c41e3a' });
    load();
  };

  const remove = async (id) => {
    if (confirm('Delete this category?')) {
      await api.categories.delete(id);
      load();
    }
  };

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Organize uniform types (Uniform Store, Sports Wear, Track Suits, Socks)"
        action={
          <button className="btn-primary flex items-center gap-2" onClick={() => setModal('new')}>
            <Plus className="w-4 h-4" /> Add Category
          </button>
        }
      />
      <div className="card">
        <DataTable
          columns={[
            { key: 'name', label: 'Name', render: (r) => (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color_code }} />
                {r.name}
              </span>
            )},
            { key: 'description', label: 'Description' },
            { key: 'color_code', label: 'Color' },
          ]}
          data={items}
          actions={(row) => (
            <div className="flex gap-2">
              <button onClick={() => { setModal(row.id); setForm(row); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(row.id)} className="p-1 hover:bg-red-50 text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          )}
        />
      </div>

      {modal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h2 className="font-semibold mb-4">{modal === 'new' ? 'Add Category' : 'Edit Category'}</h2>
            <div className="space-y-3">
              <input className="input-field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input-field" placeholder="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <input type="color" className="w-full h-10 rounded" value={form.color_code} onChange={(e) => setForm({ ...form, color_code: e.target.value })} />
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary flex-1" onClick={save}>Save</button>
              <button className="btn-secondary flex-1" onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
