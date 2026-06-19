import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, UserPlus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { api } from '../api';
import { normalizeGender } from '../utils/uniformRules';

export default function Parents() {
  const [parents, setParents] = useState([]);
  const [modal, setModal] = useState(null);
  const [studentModal, setStudentModal] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', address: '', students: [] });
  const [studentForm, setStudentForm] = useState({
    full_name: '',
    admission_no: '',
    class_grade: '',
    section: '',
    gender: '',
  });
  const [message, setMessage] = useState(null);

  const load = () => api.parents.list().then(setParents);
  useEffect(() => { load(); }, []);

  const removeParent = async (parent) => {
    const label = parent.full_name;
    if (
      !window.confirm(
        `Delete "${label}" and all their registered children?\n\nPast uniform records will stay in the system but will no longer be linked to this parent.`
      )
    ) {
      return;
    }
    setMessage(null);
    try {
      await api.parents.delete(parent.id);
      setMessage({ type: 'success', text: `"${label}" deleted successfully.` });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not delete parent.' });
    }
  };

  const saveParent = async () => {
    if (modal === 'new') await api.parents.create(form);
    else await api.parents.update(modal, form);
    setModal(null);
    setForm({ full_name: '', email: '', phone: '', address: '', students: [] });
    load();
  };

  const saveStudent = async () => {
    const gender = normalizeGender(studentForm.gender);
    if (!gender) {
      setMessage({ type: 'error', text: 'Please select gender (Boy or Girl) for uniform rules.' });
      return;
    }
    const payload = {
      full_name: studentForm.full_name?.trim(),
      admission_no: studentForm.admission_no?.trim() || null,
      class_grade: studentForm.class_grade?.trim(),
      section: studentForm.section?.trim() || null,
      gender,
    };
    if (!payload.full_name || !payload.class_grade) {
      setMessage({ type: 'error', text: 'Student name and class are required.' });
      return;
    }
    setMessage(null);
    try {
      if (studentModal?.studentId) {
        await api.parents.updateStudent(studentModal.studentId, payload);
      } else {
        await api.parents.addStudent(studentModal.parentId, payload);
      }
      setStudentModal(null);
      setStudentForm({ full_name: '', admission_no: '', class_grade: '', section: '', gender: '' });
      setMessage({ type: 'success', text: 'Student saved.' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not save student.' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Parents & Students"
        subtitle="Parents who collect uniforms for their children enrolled at this school"
        action={
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => {
              setModal('new');
              setForm({ full_name: '', email: '', phone: '', address: '', students: [] });
            }}
          >
            <Plus className="w-4 h-4" /> Register Parent
          </button>
        }
      />

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {parents.map((p) => (
          <div key={p.id} className="card p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{p.full_name}</h3>
                <p className="text-sm text-gray-500">{p.phone} {p.email && `· ${p.email}`}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary flex items-center gap-1 text-xs"
                  onClick={() => {
                    setStudentModal({ parentId: p.id });
                    setStudentForm({
                      full_name: '',
                      admission_no: '',
                      class_grade: '',
                      section: '',
                      gender: '',
                    });
                  }}
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Child
                </button>
                <button
                  type="button"
                  className="p-2 hover:bg-gray-100 rounded"
                  title="Edit parent"
                  onClick={() => {
                    setModal(p.id);
                    setForm({ full_name: p.full_name, email: p.email, phone: p.phone, address: p.address });
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="p-2 hover:bg-red-50 text-red-600 rounded"
                  title="Delete parent"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeParent(p);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-gray-400 uppercase mb-2">Children at this school</p>
              {(p.students || []).length === 0 ? (
                <p className="text-sm text-gray-400">No students registered yet</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {p.students.map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{s.full_name}</p>
                        <p className="text-xs text-gray-500">
                          {s.class_grade}{s.section ? ` · Section ${s.section}` : ''}
                          {s.admission_no ? ` · ${s.admission_no}` : ''}
                          {s.gender
                            ? ` · ${String(s.gender).toLowerCase() === 'boy' || s.gender === 'male' ? 'Boy' : 'Girl'}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="p-1 hover:bg-white rounded"
                          onClick={() => {
                            setStudentModal({ parentId: p.id, studentId: s.id });
                            setStudentForm({
                              full_name: s.full_name || '',
                              admission_no: s.admission_no || '',
                              class_grade: s.class_grade || '',
                              section: s.section || '',
                              gender: normalizeGender(s.gender) || '',
                            });
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-1 hover:bg-white rounded text-red-600"
                          title="Delete student"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm(`Remove ${s.full_name}?`)) return;
                            try {
                              await api.parents.deleteStudent(s.id);
                              setMessage({ type: 'success', text: 'Student removed.' });
                              load();
                            } catch (err) {
                              setMessage({ type: 'error', text: err.message });
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {modal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold">{modal === 'new' ? 'Register Parent' : 'Edit Parent'}</h2>
            <input className="input-field" placeholder="Parent full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <input className="input-field" placeholder="Phone (required)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="input-field" placeholder="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <textarea className="input-field" placeholder="Address" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            {modal === 'new' && (
              <p className="text-xs text-gray-500">After saving, use &quot;Add Child&quot; to link students to this parent.</p>
            )}
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={saveParent}>Save</button>
              <button className="btn-secondary flex-1" onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {studentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold">{studentModal.studentId ? 'Edit Student' : 'Add Child'}</h2>
            <input className="input-field" placeholder="Student full name" value={studentForm.full_name} onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })} />
            <input className="input-field" placeholder="Admission / roll number" value={studentForm.admission_no || ''} onChange={(e) => setStudentForm({ ...studentForm, admission_no: e.target.value })} />
            <input className="input-field" placeholder="Class / Grade (e.g. Grade 5)" value={studentForm.class_grade} onChange={(e) => setStudentForm({ ...studentForm, class_grade: e.target.value })} />
            <input className="input-field" placeholder="Section (e.g. A)" value={studentForm.section || ''} onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender (for uniform)</label>
              <select
                className="input-field"
                value={studentForm.gender || ''}
                onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}
                required
              >
                <option value="">Select gender</option>
                <option value="boy">Boy</option>
                <option value="girl">Girl</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Boys get shirt + shorts; girls get shirt + skirt or dress.</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={saveStudent}>Save</button>
              <button className="btn-secondary flex-1" onClick={() => setStudentModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
