import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import { api } from '../api';

export default function Suppliers() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', contact_person: '', email: '', phone: '', address: '' });

  const load = () => api.suppliers.list().then(setItems);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (modal === 'new') await api.suppliers.create(form);
    else await api.suppliers.update(modal, form);
    setModal(null);
    load();
  };

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Manage vendor database" action={<button className="btn-primary flex items-center gap-2" onClick={() => { setModal('new'); setForm({ name: '', contact_person: '', email: '', phone: '', address: '' }); }}><Plus className="w-4 h-4" /> Add Supplier</button>} />
      <div className="card">
        <DataTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'contact_person', label: 'Contact' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
          ]}
          data={items}
          actions={(row) => (
            <div className="flex gap-2">
              <button onClick={() => { setModal(row.id); setForm(row); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4" /></button>
              <button onClick={async () => { if (confirm('Delete?')) { await api.suppliers.delete(row.id); load(); } }} className="p-1 hover:bg-red-50 text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          )}
        />
      </div>
      {modal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold">{modal === 'new' ? 'Add Supplier' : 'Edit Supplier'}</h2>
            {['name', 'contact_person', 'email', 'phone'].map((f) => (
              <input key={f} className="input-field" placeholder={f.replace('_', ' ')} value={form[f] || ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
            ))}
            <textarea className="input-field" placeholder="Address" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <div className="flex gap-2"><button className="btn-primary flex-1" onClick={save}>Save</button><button className="btn-secondary flex-1" onClick={() => setModal(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
