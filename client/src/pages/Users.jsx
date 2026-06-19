import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import { api } from '../api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role_id: '' });

  useEffect(() => {
    api.system.users().then(setUsers);
    api.system.roles().then(setRoles);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api.system.createUser({ ...form, role_id: +form.role_id });
    setShowForm(false);
    api.system.users().then(setUsers);
  };

  return (
    <div>
      <PageHeader title="Users" subtitle="Admin user management" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add User</button>} />
      <div className="card">
        <DataTable
          columns={[
            { key: 'full_name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'role_name', label: 'Role' },
            { key: 'is_active', label: 'Status', render: (r) => r.is_active ? 'Active' : 'Inactive' },
          ]}
          data={users}
        />
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form className="card p-6 w-full max-w-md space-y-3" onSubmit={submit}>
            <h2 className="font-semibold">Add User</h2>
            <input className="input-field" placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            <input type="email" className="input-field" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input type="password" className="input-field" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <select className="input-field" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} required>
              <option value="">Select role</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">Create</button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
