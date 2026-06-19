import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import { api } from '../api';

export default function Customers() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'individual', email: '', phone: '', address: '' });

  const load = () => api.customers.list().then(setItems);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (modal === 'new') await api.customers.create(form);
    else await api.customers.update(modal, form);
    setModal(null);
    load();
  };

  return (
    <div>
      <PageHeader title="Customers" subtitle="Schools and individual buyers" action={<button className="btn-primary flex items-center gap-2" onClick={() => { setModal('new'); setForm({ name: '', type: 'school', email: '', phone: '', address: '' }); }}><Plus className="w-4 h-4" /> Add Customer</button>} />
      <div className="card">
        <DataTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'type', label: 'Type', render: (r) => <span className="capitalize">{r.type}</span> },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
          ]}
          data={items}
          actions={(row) => (
            <div className="flex gap-2">
              <button onClick={() => { setModal(row.id); setForm(row); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4" /></button>
              <button onClick={async () => { if (confirm('Delete?')) { await api.customers.delete(row.id); load(); } }} className="p-1 hover:bg-red-50 text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          )}
        />
      </div>
      {modal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold">{modal === 'new' ? 'Add Customer' : 'Edit Customer'}</h2>
            <input className="input-field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="individual">Individual</option>
              <option value="school">School</option>
            </select>
            <input className="input-field" placeholder="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input-field" placeholder="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <div className="flex gap-2"><button className="btn-primary flex-1" onClick={save}>Save</button><button className="btn-secondary flex-1" onClick={() => setModal(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
