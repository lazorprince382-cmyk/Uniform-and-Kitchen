import { useEffect, useState, useMemo } from 'react';
import { AlertCircle, Check, ChevronRight, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import SizeInput, { DEFAULT_SIZES } from '../components/SizeInput';
import {
  evaluateStudentUniform,
  isProductStillNeeded,
  normalizeGender,
  productsForStudentGender,
} from '../utils/uniformRules';

const REPLACEMENT_REASONS = [
  { value: 'outgrown', label: 'Outgrown — needs larger size' },
  { value: 'lost', label: 'Lost or missing' },
  { value: 'damaged', label: 'Damaged or worn out' },
  { value: 'extra', label: 'Extra spare (same size)' },
  { value: 'other', label: 'Other' },
];

function sortSizes(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export default function IssueUniform() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(true);
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [studentUniform, setStudentUniform] = useState(null);
  const [uniformLoading, setUniformLoading] = useState(false);
  const [extraIssue, setExtraIssue] = useState(false);
  const [replacementReason, setReplacementReason] = useState('');
  const [childSearchQuery, setChildSearchQuery] = useState('');
  const [childSearchOpen, setChildSearchOpen] = useState(false);

  const load = () => {
    api.products.list().then(setProducts).catch(() => setProducts([]));
    api.stock.inventory().then(setInventory).catch(() => setInventory([]));
    api.parents.allStudents().then(setStudents).catch(() => setStudents([]));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setExtraIssue(false);
    setReplacementReason('');
    setSelected({});
  }, [studentId]);

  useEffect(() => {
    if (!studentId) {
      setStudentUniform(null);
      setUniformLoading(false);
      return;
    }
    setUniformLoading(true);
    api.uniformHistory
      .get(studentId)
      .then(setStudentUniform)
      .catch(() => setStudentUniform(null))
      .finally(() => setUniformLoading(false));
  }, [studentId]);

  const stockByProduct = useMemo(() => {
    const map = {};
    for (const row of inventory) {
      if (!map[row.product_id]) map[row.product_id] = {};
      map[row.product_id][row.size] = row.quantity;
    }
    return map;
  }, [inventory]);

  const receivedSkus = useMemo(() => {
    const set = new Set();
    for (const item of studentUniform?.items_received || []) {
      if (item.sku) set.add(item.sku);
    }
    return set;
  }, [studentUniform]);

  const student = useMemo(
    () => students.find((s) => String(s.id) === String(studentId)),
    [students, studentId]
  );

  const receivedItems = useMemo(() => {
    return (studentUniform?.items_received || []).map((item) => ({
      sku: item.sku,
      category_name: item.category_name,
      product_name: item.product_name,
    }));
  }, [studentUniform]);

  const uniformEvaluation = useMemo(() => {
    if (!studentId) return null;
    const gender = student?.gender ?? studentUniform?.gender;
    return evaluateStudentUniform({ gender, receivedItems });
  }, [studentId, student, studentUniform, receivedItems]);

  /** Group all registered children by class/grade (from Parents & Students). */
  const childSearchResults = useMemo(() => {
    const q = childSearchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return students
      .filter((s) => {
        const text = [
          s.full_name,
          s.admission_no,
          s.class_grade,
          s.section,
          s.parent_name,
          s.parent_phone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return text.includes(q);
      })
      .slice(0, 20);
  }, [students, childSearchQuery]);

  const selectChild = (id) => {
    setStudentId(String(id));
    setChildSearchQuery('');
    setChildSearchOpen(false);
    setMessage(null);
  };

  const runChildSearch = () => {
    const q = childSearchQuery.trim();
    if (q.length < 2) {
      setMessage({ type: 'error', text: 'Type at least 2 characters to search for a child.' });
      setChildSearchOpen(false);
      return;
    }
    if (childSearchResults.length === 0) {
      setChildSearchOpen(true);
      setMessage({ type: 'error', text: `No child found matching "${q}".` });
      return;
    }
    if (childSearchResults.length === 1) {
      selectChild(childSearchResults[0].id);
      setMessage({
        type: 'success',
        text: `Selected ${childSearchResults[0].full_name}.`,
      });
      return;
    }
    setChildSearchOpen(true);
    setMessage(null);
  };

  const studentsByClass = useMemo(() => {
    const groups = {};
    for (const s of students) {
      const classLabel = (s.class_grade || '').trim() || 'Class not set';
      if (!groups[classLabel]) groups[classLabel] = [];
      groups[classLabel].push(s);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([classLabel, list]) => ({
        classLabel,
        students: list.sort((a, b) => a.full_name.localeCompare(b.full_name)),
      }));
  }, [students]);

  const hasFullUniform =
    uniformEvaluation?.status === 'full' || studentUniform?.uniform_status === 'full';

  const productsToShow = useMemo(() => {
    if (!studentId || !uniformEvaluation) return [];
    const gender = student?.gender ?? studentUniform?.gender;

    if (hasFullUniform && extraIssue) {
      const eligible = productsForStudentGender(products, gender);
      const withStock = eligible.filter((p) => {
        const total = Object.values(stockByProduct[p.id] || {}).reduce((a, b) => a + b, 0);
        return total > 0;
      });
      return withStock.sort((a, b) => {
        const aPrev = receivedSkus.has(a.sku) ? 0 : 1;
        const bPrev = receivedSkus.has(b.sku) ? 0 : 1;
        if (aPrev !== bPrev) return aPrev - bPrev;
        return (a.category_name || '').localeCompare(b.category_name || '');
      });
    }

    if (hasFullUniform) return [];

    return products.filter((p) =>
      isProductStillNeeded(p, uniformEvaluation, receivedSkus, student?.gender)
    );
  }, [
    studentId,
    uniformEvaluation,
    products,
    receivedSkus,
    student,
    hasFullUniform,
    extraIssue,
    stockByProduct,
    studentUniform,
  ]);

  const byCategory = useMemo(() => {
    const groups = {};
    for (const p of productsToShow) {
      const cat = p.category_name || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    }
    return groups;
  }, [productsToShow]);

  const categoryColumns = useMemo(() => {
    const ordered = ['Uniform Store', 'Socks', 'Sports Wear', 'Track Suits', 'Sweaters', 'Other'];
    const entries = Object.entries(byCategory).sort((a, b) => {
      const ia = ordered.indexOf(a[0]);
      const ib = ordered.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    const columns = [[], [], []];
    const preferredColumnByCategory = {
      'Uniform Store': 0,
      'Track Suits': 0,
      Socks: 1,
      Sweaters: 1,
      'Sports Wear': 2,
    };

    for (const entry of entries) {
      const category = entry[0];
      const preferred = preferredColumnByCategory[category];
      if (preferred !== undefined) {
        columns[preferred].push(entry);
      } else {
        const smallest = columns
          .map((col, i) => ({ i, size: col.length }))
          .sort((a, b) => a.size - b.size)[0].i;
        columns[smallest].push(entry);
      }
    }
    return columns;
  }, [byCategory]);

  const lineItems = useMemo(() => {
    return Object.entries(selected)
      .filter(([, v]) => v?.included && v?.size && v?.qty > 0)
      .map(([productId, v]) => {
        const p = products.find((x) => x.id == productId);
        return { product: p, quantity: v.qty, size: v.size };
      })
      .filter((x) => x.product);
  }, [selected, products]);

  const incompleteItems = useMemo(() => {
    return Object.entries(selected)
      .filter(([, v]) => v?.included && (!v?.size || !v?.qty))
      .map(([productId]) => products.find((p) => p.id == productId)?.name)
      .filter(Boolean);
  }, [selected, products]);

  const toggleItem = (productId, included) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (included) next[productId] = { included: true, qty: 1, size: '' };
      else delete next[productId];
      return next;
    });
  };

  const updateItem = (productId, field, value) => {
    setSelected((prev) => {
      const current = prev[productId] || { included: true, qty: 1, size: '' };
      const next = { ...current, [field]: value };

      if (field === 'size' && value) {
        const avail = stockByProduct[productId]?.[value] || 0;
        if (next.qty > avail) next.qty = Math.max(1, avail);
      }

      return { ...prev, [productId]: next };
    });
  };

  const inStockSizes = (productId) => {
    const sizes = stockByProduct[productId] || {};
    return Object.entries(sizes)
      .filter(([, qty]) => qty > 0)
      .map(([size, qty]) => ({ size, qty }))
      .sort((a, b) => sortSizes(a.size, b.size));
  };

  const stockForSize = (productId, size) => stockByProduct[productId]?.[size] || 0;

  const submit = async (e) => {
    e.preventDefault();
    const student = students.find((s) => s.id == studentId);
    if (!student) {
      setMessage({ type: 'error', text: 'Select the child receiving the uniform' });
      return;
    }
    if (incompleteItems.length > 0) {
      setMessage({
        type: 'error',
        text: `Choose a size for: ${incompleteItems.join(', ')}`,
      });
      return;
    }
    if (lineItems.length === 0) {
      setMessage({ type: 'error', text: 'Add at least one item with size and quantity' });
      return;
    }
    if (!paymentConfirmed) {
      setMessage({ type: 'error', text: 'Confirm the issuance is ready to proceed' });
      return;
    }
    if (extraIssue && !replacementReason) {
      setMessage({ type: 'error', text: 'Select a reason for this replacement or re-issue' });
      return;
    }

    for (const { product, quantity, size } of lineItems) {
      const avail = stockForSize(product.id, size);
      if (avail < quantity) {
        setMessage({
          type: 'error',
          text: `Insufficient stock: ${product.name} size ${size} (${avail} available)`,
        });
        return;
      }
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const reasonLabel = REPLACEMENT_REASONS.find((r) => r.value === replacementReason)?.label;
      const issueNotes = extraIssue
        ? `[Replacement: ${reasonLabel}]${notes ? ` ${notes}` : ''}`
        : notes;

      await api.orders.create({
        parent_id: student.parent_id,
        student_id: student.id,
        payment_confirmed: paymentConfirmed,
        status: 'completed',
        notes: issueNotes,
        created_by: user?.id,
        items: lineItems.map(({ product, quantity, size }) => ({
          product_id: product.id,
          quantity,
          size,
          unit_price: 0,
        })),
      });
      setMessage({
        type: 'success',
        text: extraIssue
          ? `Replacement issued to ${student.full_name}. Stock deducted.`
          : `Uniform issued to ${student.full_name}. Stock deducted by size.`,
      });
      setSelected({});
      setNotes('');
      setExtraIssue(false);
      setReplacementReason('');
      setStudentId('');
      load();
      if (studentId) {
        api.uniformHistory.get(studentId).then(setStudentUniform).catch(() => {});
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const displayUniform = uniformEvaluation || studentUniform;
  const canSubmit =
    studentId &&
    paymentConfirmed &&
    lineItems.length > 0 &&
    incompleteItems.length === 0 &&
    !submitting;

  const renderCategoryBlock = (category, items) => (
    <div key={category} className="card p-4 h-fit">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-school-red/80" />
        {category}
      </h3>
      <div className="space-y-2.5">
        {items.map((p) => {
          const sel = selected[p.id];
          const included = !!sel?.included;
          const sizes = inStockSizes(p.id);
          const totalStock = Object.values(stockByProduct[p.id] || {}).reduce((a, b) => a + b, 0);
          const pickedSize = sel?.size || '';
          const availAtSize = pickedSize ? stockForSize(p.id, pickedSize) : 0;
          const sizeMissing = included && !pickedSize;
          const maxQty = pickedSize ? availAtSize : 1;

          return (
            <div
              key={p.id}
              className={`rounded-xl border transition-colors shadow-sm ${
                included
                  ? sizeMissing
                    ? 'border-amber-300 bg-amber-50/40'
                    : pickedSize
                      ? 'border-school-red/40 bg-school-red/5'
                      : 'border-school-navy/20 bg-school-navy/5'
                  : 'border-gray-100 bg-white'
              }`}
            >
              <div className="flex items-start gap-3 p-2.5">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={included}
                  disabled={totalStock === 0}
                  onChange={(e) => toggleItem(p.id, e.target.checked)}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm flex flex-wrap items-center gap-2">
                    {p.name}
                    {extraIssue && receivedSkus.has(p.sku) && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-school-navy/10 text-school-navy">
                        Issued before
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {totalStock} total in stock
                    {totalStock === 0 && (
                      <span className="text-red-600 font-medium"> — add stock first</span>
                    )}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
              </div>

              {included && (
                <div className="px-3 pb-3 pt-0 ml-9 space-y-3 border-t border-gray-100/80 mt-0 pt-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      1. Select size <span className="text-red-500">*</span>
                    </p>
                    {sizes.length === 0 ? (
                      <p className="text-sm text-red-600 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        No sizes in stock — add stock with sizes first
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {sizes.map(({ size, qty }) => {
                          const active = pickedSize === size;
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => updateItem(p.id, 'size', size)}
                              className={active ? 'btn-chip btn-chip-active' : 'btn-chip'}
                            >
                              {size} ({qty})
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-2 max-w-xs">
                      <p className="text-xs text-gray-500 mb-1">Or type a custom size (must match stock):</p>
                      <SizeInput
                        id={`issue-size-${p.id}`}
                        className="input-field w-full py-2 text-sm"
                        value={pickedSize}
                        onChange={(size) => updateItem(p.id, 'size', size)}
                        placeholder="e.g. 8, M, 12"
                        hideHint
                        suggestions={[
                          ...new Set([...sizes.map((s) => s.size), ...DEFAULT_SIZES]),
                        ]}
                      />
                    </div>
                    {pickedSize && (
                      <p className="text-xs text-green-700 mt-1.5 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Size {pickedSize}: {availAtSize} available
                      </p>
                    )}
                    {sizeMissing && sizes.length > 0 && (
                      <p className="text-xs text-amber-700 mt-1">Pick a size above to continue</p>
                    )}
                  </div>

                  <div className={pickedSize ? '' : 'opacity-50 pointer-events-none'}>
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      2. Quantity
                    </p>
                    <input
                      type="number"
                      min="1"
                      max={maxQty || 1}
                      className="input-field w-24 py-2 text-sm"
                      value={sel?.qty || 1}
                      disabled={!pickedSize || availAtSize === 0}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10) || 1;
                        updateItem(p.id, 'qty', Math.min(Math.max(1, n), maxQty || 1));
                      }}
                    />
                    {pickedSize && availAtSize > 0 && (
                      <p className="text-xs text-gray-400 mt-1">Max {maxQty} for size {pickedSize}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Issue Uniform" />

      {student && !normalizeGender(student.gender) && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-amber-50 text-amber-900 border border-amber-200">
          Set <strong>gender</strong> for {student.full_name} under Parents &amp; Students so the right
          uniform items appear.
        </div>
      )}

      {studentId && displayUniform && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm border ${
            displayUniform.status === 'full' || displayUniform.uniform_status === 'full'
              ? 'bg-green-50 text-green-800 border-green-200'
              : 'bg-white border-gray-200 text-gray-700'
          }`}
        >
          <strong>{student?.full_name}</strong>
          {normalizeGender(student?.gender) && (
            <span className="text-gray-500 font-normal">
              {' '}
              ({normalizeGender(student.gender) === 'boy' ? 'Boy' : 'Girl'})
            </span>
          )}{' '}
          — {displayUniform.label || displayUniform.uniform_label}
          {(displayUniform.missing_core_items?.length > 0 ||
            uniformEvaluation?.missing_core_items?.length > 0) && (
            <span className="block mt-1 text-amber-800">
              Still needed:{' '}
              {(uniformEvaluation?.missing_core_items || displayUniform.missing_core_items || []).join(
                ', '
              )}
            </span>
          )}
        </div>
      )}

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        <div className="card p-5 grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search for a child</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  className="input-field pl-10 w-full"
                  placeholder="Name, admission no., class, section, or parent…"
                  value={childSearchQuery}
                  onChange={(e) => {
                    setChildSearchQuery(e.target.value);
                    setChildSearchOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      runChildSearch();
                    }
                  }}
                />
                {childSearchOpen && childSearchResults.length > 1 && (
                  <ul className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {childSearchResults.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-school-navy/5 border-b border-gray-50 last:border-0"
                          onClick={() => selectChild(s.id)}
                        >
                          <span className="font-medium text-gray-900">{s.full_name}</span>
                          <span className="text-gray-500">
                            {' '}
                            · {s.class_grade}
                            {s.section ? ` · ${s.section}` : ''}
                            {s.admission_no ? ` · ${s.admission_no}` : ''}
                          </span>
                          <span className="block text-xs text-gray-400 mt-0.5">
                            Parent: {s.parent_name}
                            {s.parent_phone ? ` · ${s.parent_phone}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="button" className="btn-primary shrink-0 px-6" onClick={runChildSearch}>
                Search
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Searches all children registered under Parents &amp; Students. One match selects automatically;
              several matches — pick from the list.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Or select by class
            </label>
            <select
              className="input-field"
              value={studentId}
              onChange={(e) => {
                setStudentId(e.target.value);
                setChildSearchOpen(false);
                setChildSearchQuery('');
              }}
              required
            >
              <option value="">Select child</option>
              {studentsByClass.map(({ classLabel, students: classStudents }) => (
                <optgroup key={classLabel} label={classLabel}>
                  {classStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                      {s.section ? ` · Section ${s.section}` : ''}
                      {s.admission_no ? ` · ${s.admission_no}` : ''}
                      {s.gender
                        ? ` (${normalizeGender(s.gender) === 'boy' ? 'Boy' : 'Girl'})`
                        : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {student && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Collected by parent</p>
              <p className="font-medium">{student.parent_name}</p>
              <p className="text-gray-500">{student.parent_phone}</p>
            </div>
          )}
          <div className="md:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="paid"
              checked={paymentConfirmed}
              onChange={(e) => setPaymentConfirmed(e.target.checked)}
            />
            <label htmlFor="paid" className="text-sm font-medium">
              Ready to issue (confirmed)
            </label>
          </div>
        </div>

        {!studentId ? (
          <div className="card p-8 text-center text-gray-500 text-sm">
            Select a child above to see only the uniform items they still need.
          </div>
        ) : (
        <>
        {extraIssue && replacementReason && productsToShow.length > 0 && (
          <div className="card p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-school-navy/20 bg-school-navy/5">
            <div className="text-sm">
              <span className="font-semibold text-school-navy">Replacement issue</span>
              <span className="text-gray-600">
                {' '}
                — {REPLACEMENT_REASONS.find((r) => r.value === replacementReason)?.label}
              </span>
            </div>
            <button
              type="button"
              className="text-sm text-gray-600 hover:text-gray-900 shrink-0"
              onClick={() => {
                setReplacementReason('');
                setSelected({});
              }}
            >
              Change reason
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_1fr_minmax(280px,340px)] gap-4 items-start">
          {uniformLoading ? (
            <div className="xl:col-span-3 card p-8 text-center text-gray-500 text-sm">
              Loading what this child still needs…
            </div>
          ) : hasFullUniform && !extraIssue ? (
            <div className="xl:col-span-3 card p-8 text-center space-y-4">
              <p className="text-green-700 text-sm font-medium">
                {student?.full_name} has a full uniform on record.
              </p>
              <p className="text-gray-600 text-sm max-w-md mx-auto">
                Children outgrow clothes, items get lost, or wear out. You can still issue replacements or a
                new size — stock will deduct as usual and their full-uniform status stays complete.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setExtraIssue(true);
                  setSelected({});
                  setMessage(null);
                }}
              >
                Issue replacement or new size
              </button>
            </div>
          ) : hasFullUniform && extraIssue && !replacementReason ? (
            <div className="xl:col-span-3 card p-6 space-y-4">
              <p className="text-sm text-gray-700">
                <strong>Replacement issue</strong> for {student?.full_name} — pick why, then choose items
                and sizes below.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {REPLACEMENT_REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className="text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-school-navy hover:bg-school-navy/5 text-sm transition-colors"
                    onClick={() => setReplacementReason(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-800"
                onClick={() => {
                  setExtraIssue(false);
                  setReplacementReason('');
                  setSelected({});
                }}
              >
                Cancel
              </button>
            </div>
          ) : !normalizeGender(student?.gender) ? (
            <div className="xl:col-span-3 card p-8 text-center text-gray-500 text-sm">
              Set <strong>gender</strong> for {student?.full_name || 'this child'} under Parents &amp;
              Students, then return here.
            </div>
          ) : productsToShow.length === 0 ? (
            <div className="xl:col-span-3 card p-8 text-center text-gray-500 text-sm">
              {extraIssue
                ? 'No in-stock items for this child’s gender. Add stock under Products.'
                : 'No matching items in stock for what this child still needs. Add stock under Products.'}
            </div>
          ) : (
            <>
              {categoryColumns.map((column, idx) => (
                <div key={idx} className="space-y-4">
                  {column.map(([category, items]) => renderCategoryBlock(category, items))}
                </div>
              ))}
            </>
          )}

          <div className="xl:sticky xl:top-4 space-y-4">
            {extraIssue && replacementReason && (
              <div className="card p-4 space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="issue-notes">
                  Notes (optional)
                </label>
                <textarea
                  id="issue-notes"
                  className="input-field text-sm min-h-[72px]"
                  placeholder="e.g. new size 12, lost at sports day…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            )}
            <div className="card p-5 min-h-[200px] flex flex-col">
              <h3 className="font-semibold text-gray-900 mb-3">
                {extraIssue ? 'Ready to issue (replacement)' : 'Ready to issue'}
              </h3>
              {lineItems.length === 0 ? (
                <p className="text-sm text-gray-400 flex-1">
                  Tick items on the left, pick each size and quantity — they will appear here.
                </p>
              ) : (
                <ul className="space-y-2 text-sm flex-1">
                  {lineItems.map(({ product, quantity, size }) => (
                    <li
                      key={`${product.id}-${size}`}
                      className="border-b border-gray-100 pb-2 last:border-0"
                    >
                      {product.name}{' '}
                      <span className="font-semibold" style={{ color: '#c41e3a' }}>
                        size {size}
                      </span>{' '}
                      × {quantity}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                {lineItems.length > 0 && (
                  <p className="text-sm text-gray-600">
                    {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} ready
                  </p>
                )}
                {incompleteItems.length > 0 && (
                  <p className="text-sm text-amber-700">Missing size: {incompleteItems.join(', ')}</p>
                )}
                <button
                  type="submit"
                  className="btn-primary w-full py-3"
                  disabled={!canSubmit}
                >
                  {submitting ? 'Issuing…' : extraIssue ? 'Issue replacement' : 'Issue & Deduct Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </form>
    </div>
  );
}
