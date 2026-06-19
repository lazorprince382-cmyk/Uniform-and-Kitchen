import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../api';

const ALL_PERMS = ['dashboard', 'inventory', 'orders', 'reports', 'stock_in', 'stock_out', 'users', 'settings'];

export default function Roles() {
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    api.system.roles().then(setRoles);
  }, []);

  const togglePerm = async (role, perm) => {
    const perms = role.permissions || [];
    const updated = perms.includes(perm) ? perms.filter((p) => p !== perm) : [...perms, perm];
    await api.system.updateRole(role.id, { name: role.name, description: role.description, permissions: updated });
    api.system.roles().then(setRoles);
  };

  return (
    <div>
      <PageHeader title="Roles & Permissions" subtitle="Configure access control (RBAC)" />
      <div className="space-y-4">
        {roles.map((role) => (
          <div key={role.id} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold">{role.name}</h3>
                <p className="text-sm text-gray-500">{role.description}</p>
              </div>
              {role.permissions?.includes('*') && (
                <span className="text-xs bg-school-navy/10 text-school-navy px-2 py-1 rounded">Full Access</span>
              )}
            </div>
            {!role.permissions?.includes('*') && (
              <div className="flex flex-wrap gap-2">
                {ALL_PERMS.map((perm) => (
                  <button
                    key={perm}
                    onClick={() => togglePerm(role, perm)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      role.permissions?.includes(perm)
                        ? 'btn-chip btn-chip-active'
                        : 'btn-chip'
                    }`}
                  >
                    {perm}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
