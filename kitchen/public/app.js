function resolveApiRoot() {
  const meta = document.querySelector('meta[name="kitchen-api-base"]')?.getAttribute('content')?.trim();
  let fromWin =
    typeof window !== 'undefined' && window.KITCHEN_API_BASE != null
      ? String(window.KITCHEN_API_BASE).trim()
      : '';
  if (!fromWin && !meta && typeof window !== 'undefined' && window.location.pathname.startsWith('/kitchen')) {
    fromWin = '/kitchen';
  }
  const base = (meta || fromWin || '').replace(/\/$/, '');
  return base ? `${base}/api` : '/api';
}

const API = resolveApiRoot();

function resolveUnifiedLoginUrl() {
  const fromConfig =
    typeof window !== 'undefined' && window.KITCHEN_UNIFIED_LOGIN_URL != null
      ? String(window.KITCHEN_UNIFIED_LOGIN_URL).trim()
      : '';
  if (fromConfig) return fromConfig;
  const { protocol, hostname, port } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000/login?system=kitchen';
  }
  const host = `${protocol}//${hostname}`;
  if (port === '8088') return `${host}:8088/login?system=kitchen`;
  return `${host}:8088/login?system=kitchen`;
}

const UNIFIED_LOGIN_URL = resolveUnifiedLoginUrl();

/** Sign out after 30 minutes without mouse/keyboard/touch activity. */
const INACTIVITY_MS = 30 * 60 * 1000;
let inactivityTimer = null;
let inactivityWatching = false;

/** Set after /auth/me or login — drives UI permissions. */
let currentUser = null;

/** Whole numbers only — UGX and stock quantities (no decimals). */
function intVal(n) {
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? x : 0;
}
function formatUGX(n) {
  return intVal(n).toLocaleString('en-UG');
}
function labelUGX(n) {
  return `UGX ${formatUGX(n)}`;
}

const DAY_LABELS = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const CAT_ORDER_STUDENTS = ['breakfast', 'lunch', 'dessert'];
const CAT_ORDER_STAFF_DIRECTORS = ['breakfast', 'lunch'];
const CAT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dessert: 'Dessert' };
const AUD_ORDER_FULL = ['students', 'staff', 'directors'];
const AUD_ORDER_SAT = ['staff', 'directors'];
const AUD_LABELS = { students: 'Children', staff: 'Staff', directors: 'Directors' };

/** Ingredient allergen flags — keep in sync with pupil watch list tags. */
const ALLERGEN_OPTIONS = [
  { id: 'peanuts', label: 'Peanuts' },
  { id: 'tree_nuts', label: 'Tree nuts' },
  { id: 'milk', label: 'Milk' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'soy', label: 'Soy' },
  { id: 'gluten', label: 'Gluten' },
  { id: 'fish', label: 'Fish' },
  { id: 'sesame', label: 'Sesame' },
  { id: 'shellfish', label: 'Shellfish' }
];

const SERVING_ROWS = [
  ['breakfast', 'students'],
  ['breakfast', 'staff'],
  ['breakfast', 'directors'],
  ['lunch', 'students'],
  ['lunch', 'staff'],
  ['lunch', 'directors'],
  ['dessert', 'students']
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function todayMenuDayKey() {
  const d = new Date().getDay();
  if (d === 0) return 'mon';
  const map = ['mon', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[d];
}

function parseAllergenTags(raw) {
  if (Array.isArray(raw)) return raw.map(String);
  if (raw && typeof raw === 'object') return Object.keys(raw);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mealAllergenSummary(meal) {
  const set = new Set();
  (meal.ingredients || []).forEach(ing => {
    parseAllergenTags(ing.allergen_tags).forEach(t => set.add(t));
  });
  return [...set];
}

function renderAllergenGrid() {
  const el = $('#ingredient-allergen-grid');
  if (!el) return;
  el.innerHTML = ALLERGEN_OPTIONS.map(
    o => `<label><input type="checkbox" value="${o.id}" data-allergen-cb /> ${o.label}</label>`
  ).join('');
}

function collectIngredientAllergensFromForm() {
  return $$('#ingredient-allergen-grid input[data-allergen-cb]:checked').map(cb => cb.value);
}

function setIngredientAllergenCheckboxes(tags) {
  const tset = new Set(parseAllergenTags(tags).map(x => String(x).toLowerCase()));
  $$('#ingredient-allergen-grid input[data-allergen-cb]').forEach(cb => {
    cb.checked = tset.has(cb.value);
  });
}

function normalizeScheduleDays(meal) {
  let d = meal.schedule_days;
  if (d == null) return [];
  if (Array.isArray(d)) return d;
  if (typeof d === 'string') {
    try {
      const p = JSON.parse(d);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Meal appears on menu for this calendar day (sat = children never). */
function mealShowsOnDay(meal, dayKey) {
  if (dayKey === 'sat' && meal.audience === 'students') return false;
  if (meal.schedule_flexible) return true;
  return normalizeScheduleDays(meal).includes(dayKey);
}

function scheduleSummary(meal) {
  if (meal.schedule_flexible) return 'All menu days (old entry)';
  const days = normalizeScheduleDays(meal);
  if (!days.length) return 'No day set';
  if (days.length === 1) return DAY_LABELS[days[0]] || days[0];
  return days.map(k => DAY_LABELS[k] || k).join(', ');
}

function $(sel, el = document) {
  return el.querySelector(sel);
}

function $$(sel, el = document) {
  return [...el.querySelectorAll(sel)];
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

function isAdmin() {
  return currentUser?.role === 'admin';
}

function isFullKitchen() {
  return currentUser?.role === 'admin' || currentUser?.full_dashboard === true;
}

function applyPermissions(user) {
  currentUser = user;
  const full = isFullKitchen();
  const admin = isAdmin();
  document.body.classList.toggle('auth-admin', admin);
  document.body.classList.toggle('auth-chef-full', user?.role === 'chef' && full);
  document.body.classList.toggle('auth-chef-limited', user?.role === 'chef' && !full);
  $$('[data-require="full"]').forEach(el => {
    el.classList.toggle('hidden-by-role', !full);
  });
  $$('[data-require="admin"]').forEach(el => {
    el.classList.toggle('hidden-by-role', !admin);
  });
  const note = $('#chef-limited-note');
  if (note) note.classList.toggle('is-hidden', !(user?.role === 'chef' && !full));
  const ud = $('#user-display-name');
  if (ud) ud.textContent = user?.display_name || user?.username || '—';
  const rp = $('#role-display');
  if (rp) {
    if (admin) rp.textContent = 'Admin';
    else if (full) rp.textContent = 'Chef · full kitchen';
    else rp.textContent = 'Chef · operational';
  }
  const settingsLine = $('#settings-account-line');
  if (settingsLine && user) {
    settingsLine.textContent = `${user.display_name || user.username} (${user.username})`;
  }
}

function stopInactivityWatch() {
  if (!inactivityWatching) return;
  inactivityWatching = false;
  clearTimeout(inactivityTimer);
  const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  events.forEach(ev => window.removeEventListener(ev, onInactivityActivity));
}

function onInactivityActivity() {
  if (!inactivityWatching) return;
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(onInactivityTimeout, INACTIVITY_MS);
}

async function onInactivityTimeout() {
  stopInactivityWatch();
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (_) {
    /* ignore */
  }
  showLoginScreen({ reason: 'timeout' });
}

function startInactivityWatch() {
  if (inactivityWatching) return;
  inactivityWatching = true;
  const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  events.forEach(ev => window.addEventListener(ev, onInactivityActivity, { passive: true }));
  onInactivityActivity();
}

function showLoginScreen(opts = {}) {
  stopInactivityWatch();
  currentUser = null;
  if (typeof window.__kitchenGoUnifiedLogin === 'function') {
    window.__kitchenGoUnifiedLogin(opts);
    return;
  }
  const sep = UNIFIED_LOGIN_URL.includes('?') ? '&' : '?';
  let target = `${UNIFIED_LOGIN_URL}${sep}next=${encodeURIComponent(window.location.href)}`;
  if (opts.reason === 'timeout') target += '&reason=timeout';
  window.location.replace(target);
}

function showApp() {
  $('#auth-redirect')?.classList.add('is-hidden');
  $('#app-root')?.classList.remove('is-hidden');
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 300) || 'Invalid response from server' };
    }
  }
  if (res.status === 401 && path !== '/auth/me' && path !== '/auth/login') {
    showLoginScreen();
  }
  if (!res.ok) {
    const msg = data?.error ?? data?.message;
    let fallback =
      typeof msg === 'string' && msg.length
        ? msg
        : (typeof text === 'string' && text.length && text.length < 600 ? text.trim() : '');
    const looksHtml =
      typeof text === 'string' &&
      (/<!DOCTYPE/i.test(text) || /<html/i.test(text) || /Cannot POST \/api\//i.test(text));
    if (looksHtml || (typeof fallback === 'string' && /<[a-z][\s>/]/i.test(fallback))) {
      fallback =
        'Sign-in API not found on this address. Open the app via the Kitchen server (e.g. http://localhost:3000) or add <meta name="kitchen-api-base" content="http://localhost:3000"> in index.html.';
    }
    throw new Error(fallback || res.statusText || `Request failed (${res.status})`);
  }
  return data;
}

function setMobileNavOpen(open) {
  const shell = $('#app-shell');
  const burger = $('#nav-burger');
  const backdrop = $('#nav-backdrop');
  if (!shell) return;
  shell.classList.toggle('nav-open', open);
  document.body.classList.toggle('nav-drawer-open', open);
  if (burger) {
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (backdrop) backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function closeMobileNav() {
  setMobileNavOpen(false);
}

function toggleMobileNav() {
  const shell = $('#app-shell');
  setMobileNavOpen(!shell?.classList.contains('nav-open'));
}

const FULL_ONLY_TABS = ['procurement', 'budget', 'serving', 'reports'];

function switchPanel(tabId) {
  if (FULL_ONLY_TABS.includes(tabId) && !isFullKitchen()) {
    tabId = 'dashboard';
  }
  closeMobileNav();
  document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const nav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (nav) nav.classList.add('active');
  const panel = document.getElementById(tabId);
  if (panel) panel.classList.add('active');
  if (tabId === 'dashboard') loadDashboard();
  if (tabId === 'inventory') loadInventory();
  if (tabId === 'meals') loadMeals();
  if (tabId === 'menu') loadMenu();
  if (tabId === 'prepare') loadPrepareForm();
  if (tabId === 'procurement') loadProcurement();
  if (tabId === 'budget') loadBudget();
  if (tabId === 'serving') loadServing();
  if (tabId === 'reports') loadReports();
  if (tabId === 'alerts') loadAlerts();
  if (tabId === 'settings') loadSettings();
}

document.querySelectorAll('.nav-item').forEach(tab => {
  tab.addEventListener('click', () => switchPanel(tab.dataset.tab));
});

document.querySelectorAll('.tab-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const tabId = link.dataset.tab;
    if (tabId) switchPanel(tabId);
  });
});

document.querySelectorAll('.quick-tab').forEach(btn => {
  btn.addEventListener('click', () => switchPanel(btn.dataset.tab));
});

$('#btn-kitchen-mode')?.addEventListener('click', () => {
  document.body.classList.toggle('kitchen-mode');
});

$('#nav-burger')?.addEventListener('click', toggleMobileNav);
$('#nav-backdrop')?.addEventListener('click', closeMobileNav);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMobileNav();
});

// ----- Dashboard -----
async function loadDashboard() {
  const greet = $('#dash-greeting');
  const sub = $('#dash-sub');
  const datePill = $('#dash-date-pill');
  const h = new Date().getHours();
  if (greet) greet.textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  if (sub) sub.textContent = "Here's what's happening in your kitchen today.";
  if (datePill) {
    datePill.textContent = new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  try {
    const [summary, budget, alerts, activity, meals] = await Promise.all([
      api('/dashboard-summary'),
      api('/budget'),
      api('/alerts'),
      api('/activity-feed'),
      api('/meals')
    ]);

    const stPlanned = $('#dash-stat-planned');
    const stCost = $('#dash-stat-cost');
    const stLow = $('#dash-stat-low');
    const stAllergy = $('#dash-stat-allergy');
    if (stPlanned) stPlanned.textContent = String(summary.planned_portions_today ?? 0);
    if (stCost) stCost.textContent = labelUGX(summary.food_cost_today_ugx ?? 0);
    if (stLow) stLow.textContent = String(summary.low_stock_count ?? 0);
    if (stAllergy) stAllergy.textContent = String(summary.pupils_on_allergy_watch ?? 0);

    if (budget.budget_amount != null) {
      const mealsSp = budget.spent_meals != null ? Number(budget.spent_meals) : Number(budget.spent);
      const invSp = budget.spent_inventory != null ? Number(budget.spent_inventory) : 0;
      $('#dash-budget').textContent = `${labelUGX(budget.spent)} / ${labelUGX(budget.budget_amount)}`;
      $('#dash-spent').textContent = `${labelUGX(budget.spent)} (meals ${formatUGX(mealsSp)} · inventory ${formatUGX(invSp)})`;
      $('#dash-remaining').textContent = labelUGX(budget.remaining);
      const pct = budget.usage_percent ?? 0;
      $('#dash-progress').style.width = `${Math.min(100, pct)}%`;
    } else {
      $('#dash-budget').textContent = 'No budget set';
      $('#dash-spent').textContent = '—';
      $('#dash-remaining').textContent = '—';
      $('#dash-progress').style.width = '0%';
    }

    const dayKey = todayMenuDayKey();
    const todayMeals = meals.filter(m => mealShowsOnDay(m, dayKey));
    const menuEl = $('#dash-today-menu');
    if (menuEl) {
      if (todayMeals.length === 0) {
        menuEl.innerHTML = '<p class="muted">No meals scheduled for today in the planner.</p>';
      } else {
        const byCat = {};
        todayMeals.forEach(m => {
          const c = m.meal_category || 'lunch';
          if (!byCat[c]) byCat[c] = [];
          byCat[c].push(m);
        });
        menuEl.innerHTML = CAT_ORDER_STUDENTS.filter(c => byCat[c])
          .map(cat => {
            const items = (byCat[cat] || [])
              .map(m => {
                const tags = mealAllergenSummary(m);
                const tagHtml =
                  tags.length > 0
                    ? ` <span class="muted">(${tags.map(t => escapeHtml(t)).join(', ')})</span>`
                    : '';
                return `<li>${escapeHtml(m.name)} · ${AUD_LABELS[m.audience] || m.audience}${tagHtml}</li>`;
              })
              .join('');
            return `<div class="dash-menu-block"><h4>${CAT_LABELS[cat]}</h4><ul>${items}</ul></div>`;
          })
          .join('');
      }
    }

    const actEl = $('#dash-activity');
    if (actEl) {
      const lines = [];
      (activity.stock_movements || []).forEach(m => {
        const t = new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const sign = intVal(m.quantity_change) > 0 ? '+' : '';
        lines.push({
          at: new Date(m.created_at).getTime(),
          html: `<span class="act-time">${t}</span> · ${escapeHtml(m.movement_type)} · ${escapeHtml(m.ingredient_name)} (${sign}${m.quantity_change} ${escapeHtml(m.unit_name)})`
        });
      });
      (activity.temperature_checks || []).forEach(t => {
        const tm = new Date(t.checked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        lines.push({
          at: new Date(t.checked_at).getTime(),
          html: `<span class="act-time">${tm}</span> · Temperature · ${escapeHtml(t.zone_label)}${t.temp_c != null ? ` (${t.temp_c}°C)` : ''} ${t.ok ? '✓' : '⚠'}`
        });
      });
      lines.sort((a, b) => b.at - a.at);
      actEl.innerHTML = lines
        .slice(0, 12)
        .map(l => `<li>${l.html}</li>`)
        .join('');
      if (lines.length === 0) actEl.innerHTML = '<li class="muted">No recent activity.</li>';
    }

    const snap = $('#dash-alert-snap');
    if (snap) {
      const bits = [];
      (alerts.low_stock || []).slice(0, 4).forEach(x => {
        bits.push(`<li><strong>Low stock:</strong> ${escapeHtml(x.name)} (${intVal(x.current_stock)} ${escapeHtml(x.unit_name)})</li>`);
      });
      (alerts.expiring_soon || []).slice(0, 3).forEach(x => {
        bits.push(
          `<li><strong>Expiring:</strong> ${escapeHtml(x.ingredient_name)} · ${x.expiry_date} (${intVal(x.quantity_remaining)} ${escapeHtml(x.unit_name)})</li>`
        );
      });
      if ((alerts.pupils_on_allergy_watch || 0) > 0) {
        bits.push(`<li><strong>Allergy watch:</strong> ${alerts.pupils_on_allergy_watch} pupil(s) on file — review menus.</li>`);
      }
      snap.innerHTML = bits.length ? bits.join('') : '<li class="muted">No urgent alerts.</li>';
    }

    const chart = $('#dash-week-chart');
    if (chart && summary.weekly_spend) {
      const amounts = summary.weekly_spend.map(w => intVal(w.amount_ugx));
      const max = Math.max(1, ...amounts);
      chart.innerHTML = summary.weekly_spend
        .map(w => {
          const d = new Date(w.date);
          const label = d.toLocaleDateString('en-GB', { weekday: 'short' });
          const h = Math.round((intVal(w.amount_ugx) / max) * 100);
          return `<div class="week-bar-wrap"><div class="week-bar" style="height:${h}%"></div>${label}</div>`;
        })
        .join('');
    }
  } catch (e) {
    const db = $('#dash-budget');
    if (db) db.textContent = 'Error loading';
    const act = $('#dash-activity');
    if (act) act.innerHTML = '<li class="error">' + escapeHtml(e.message) + '</li>';
  }
}

// ----- Inventory -----
let units = [];

async function loadUnits() {
  units = await api('/units');
  const sel = $('#ingredient-unit');
  if (!sel) return;
  sel.innerHTML = units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
}

$('#inventory-purchase-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const amount = intVal($('#purchase-amount').value);
  const supplier = ($('#purchase-supplier')?.value || '').trim();
  const note = $('#purchase-note').value.trim();
  const dt = $('#purchase-date').value;
  if (isNaN(amount) || amount < 0) {
    alert('Enter a valid amount');
    return;
  }
  try {
    await api('/inventory-purchases', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        supplier_name: supplier || null,
        description: note || null,
        purchased_at: dt ? new Date(dt).toISOString() : null
      })
    });
    $('#inventory-purchase-form').reset();
    await loadInventoryPurchases();
    loadDashboard();
    loadBudget();
  } catch (err) {
    alert(err.message);
  }
});

$('#form-receive')?.addEventListener('submit', async e => {
  e.preventDefault();
  const ingredient_id = $('#receive-ingredient').value;
  const quantity = intVal($('#receive-qty').value);
  const expiry_date = ($('#receive-expiry').value || '').trim() || null;
  const notes = ($('#receive-note').value || '').trim() || null;
  if (!ingredient_id || quantity <= 0) {
    alert('Choose an ingredient and quantity.');
    return;
  }
  try {
    await api('/inventory/receive', {
      method: 'POST',
      body: JSON.stringify({ ingredient_id: parseInt(ingredient_id, 10), quantity, expiry_date, notes })
    });
    e.target.reset();
    loadInventory();
    loadDashboard();
    loadAlerts();
    loadReports();
  } catch (err) {
    alert(err.message);
  }
});

$('#form-waste')?.addEventListener('submit', async e => {
  e.preventDefault();
  const ingredient_id = $('#waste-ingredient').value;
  const quantity = intVal($('#waste-qty').value);
  const notes = ($('#waste-note').value || '').trim() || null;
  if (!ingredient_id || quantity <= 0) {
    alert('Choose an ingredient and quantity.');
    return;
  }
  try {
    await api('/inventory/waste', {
      method: 'POST',
      body: JSON.stringify({ ingredient_id: parseInt(ingredient_id, 10), quantity, notes })
    });
    e.target.reset();
    loadInventory();
    loadDashboard();
    loadAlerts();
    loadReports();
  } catch (err) {
    alert(err.message);
  }
});

async function loadInventoryPurchases() {
  try {
    const rows = await api('/inventory-purchases');
    const tbody = $('#inventory-purchases-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    rows.slice(0, 30).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(r.purchased_at).toLocaleString()}</td>
        <td>${labelUGX(r.amount)}</td>
        <td>${escapeHtml(r.supplier_name || '—')}</td>
        <td>${escapeHtml(r.description || '—')}</td>
      `;
      tbody.appendChild(tr);
    });
    if (rows.length === 0) tbody.innerHTML = '<tr><td colspan="4" class="muted">No purchases recorded yet.</td></tr>';
  } catch (_) {
    const tbody = $('#inventory-purchases-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4">Could not load purchases.</td></tr>';
  }
}

function loadProcurement() {
  loadInventoryPurchases();
}

async function loadInventory() {
  try {
    const list = await api('/ingredients');
    const opts =
      '<option value="">Select…</option>' + list.map(i => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('');
    const r = $('#receive-ingredient');
    const w = $('#waste-ingredient');
    if (r) r.innerHTML = opts;
    if (w) w.innerHTML = opts;
    const tbody = $('#inventory-tbody');
    tbody.innerHTML = '';
    list.forEach(ing => {
      const tr = document.createElement('tr');
      const low = intVal(ing.current_stock) < intVal(ing.min_stock);
      const surplus = ing.max_stock != null && intVal(ing.current_stock) > intVal(ing.max_stock);
      let stockClass = '';
      if (low) stockClass = 'stock-low';
      else if (surplus) stockClass = 'stock-surplus';
      else stockClass = 'stock-ok';
      const tags = parseAllergenTags(ing.allergen_tags);
      const tagCell =
        tags.length === 0
          ? '—'
          : tags.map(t => `<span class="tag-mini">${escapeHtml(t)}</span>`).join('');
      const actionsHtml = isFullKitchen()
        ? `<button type="button" class="btn btn-sm secondary" data-edit-id="${ing.id}">Edit</button>
          <button type="button" class="btn btn-sm primary" data-adjust-id="${ing.id}">Adjust stock</button>`
        : '<span class="muted">—</span>';
      tr.innerHTML = `
        <td>${escapeHtml(ing.name)}</td>
        <td>${escapeHtml(ing.unit_name)}</td>
        <td class="${stockClass}">${intVal(ing.current_stock)} ${ing.unit_name}</td>
        <td>${tagCell}</td>
        <td>${intVal(ing.min_stock)} / ${ing.max_stock != null ? intVal(ing.max_stock) : '—'}</td>
        <td>${labelUGX(ing.cost_per_unit)}</td>
        <td class="actions">${actionsHtml}</td>
      `;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', () => openIngredientModal(parseInt(btn.dataset.editId, 10)));
    });
    tbody.querySelectorAll('[data-adjust-id]').forEach(btn => {
      btn.addEventListener('click', () => openAdjustStock(parseInt(btn.dataset.adjustId, 10)));
    });
  } catch (e) {
    $('#inventory-tbody').innerHTML = '<tr><td colspan="7">' + e.message + '</td></tr>';
  }
}

// ----- Ingredient modal -----
function openIngredientModal(id) {
  const modal = $('#modal-ingredient');
  const overlay = $('#modal-overlay');
  $('#modal-ingredient-title').textContent = id ? 'Edit ingredient' : 'Add ingredient';
  $('#form-ingredient').reset();
  $('#ingredient-id').value = id || '';
  renderAllergenGrid();
  setIngredientAllergenCheckboxes([]);

  if (id) {
    api('/ingredients').then(list => {
      const ing = list.find(i => i.id === id || String(i.id) === String(id));
      if (!ing) return;
      $('#ingredient-name').value = ing.name;
      $('#ingredient-unit').value = ing.unit_id;
      $('#ingredient-cost').value = intVal(ing.cost_per_unit);
      $('#ingredient-stock').value = intVal(ing.current_stock);
      $('#ingredient-min').value = intVal(ing.min_stock);
      $('#ingredient-max').value = ing.max_stock != null ? intVal(ing.max_stock) : '';
      setIngredientAllergenCheckboxes(ing.allergen_tags);
    });
  }

  overlay.classList.add('active');
  modal.classList.add('active');
}

function closeIngredientModal() {
  $('#modal-overlay').classList.remove('active');
  $('#modal-ingredient').classList.remove('active');
}

$('#btn-new-ingredient')?.addEventListener('click', () => openIngredientModal(null));

$('#form-ingredient').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#ingredient-id').value;
  const payload = {
    name: $('#ingredient-name').value.trim(),
    unit_id: parseInt($('#ingredient-unit').value, 10),
    cost_per_unit: intVal($('#ingredient-cost').value),
    current_stock: intVal($('#ingredient-stock').value),
    min_stock: intVal($('#ingredient-min').value),
    max_stock: $('#ingredient-max').value ? intVal($('#ingredient-max').value) : null,
    allergen_tags: collectIngredientAllergensFromForm()
  };
  try {
    if (id) {
      await api(`/ingredients/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      await api('/ingredients', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeIngredientModal();
    loadInventory();
    loadDashboard();
  } catch (err) {
    alert(err.message);
  }
});

function openAdjustStock(id) {
  const qty = prompt('Enter new current stock (whole units only):');
  if (qty === null) return;
  const raw = String(qty).trim();
  if (raw === '') return;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    alert('Enter a valid whole number');
    return;
  }
  const num = intVal(n);
  api(`/ingredients/${id}`, { method: 'PATCH', body: JSON.stringify({ current_stock: num }) })
    .then(() => { loadInventory(); loadAlerts(); loadDashboard(); })
    .catch(e => alert(e.message));
}

$('#modal-ingredient .modal-close').addEventListener('click', closeIngredientModal);
$('#modal-ingredient .modal-cancel').addEventListener('click', closeIngredientModal);
$('#modal-overlay').addEventListener('click', () => {
  closeIngredientModal();
  closeMealModal();
});

// ----- Meals -----
let ingredientsList = [];

async function loadMeals() {
  try {
    ingredientsList = await api('/ingredients');
    const meals = await api('/meals');
    const container = $('#meals-list');
    container.innerHTML = '';
    meals.forEach(meal => {
      const card = document.createElement('div');
      card.className = 'meal-card';
      const ings = (meal.ingredients || []).map(i =>
        `${i.ingredient_name}: ${intVal(i.quantity)} ${i.unit_name}`
      ).join(', ') || 'No ingredients';
      const cat = meal.meal_category || 'lunch';
      const aud = meal.audience || 'students';
      card.innerHTML = `
        <h4>${escapeHtml(meal.name)}</h4>
        <p class="meal-meta">
          <span class="meal-badge">${CAT_LABELS[cat] || cat}</span>
          <span class="meal-badge">${AUD_LABELS[aud] || aud}</span><br />
          ${scheduleSummary(meal)}
        </p>
        ${meal.description ? `<p>${escapeHtml(meal.description)}</p>` : ''}
        <ul class="ingredients-list">${(meal.ingredients || []).map(i =>
          `<li>${escapeHtml(i.ingredient_name)}: ${intVal(i.quantity)} ${i.unit_name}</li>`
        ).join('')}</ul>
        ${
          isFullKitchen()
            ? `<div class="card-actions">
          <button type="button" class="btn btn-sm secondary" data-edit-meal="${meal.id}">Edit</button>
          <button type="button" class="btn btn-sm primary" data-delete-meal="${meal.id}">Delete</button>
        </div>`
            : ''
        }
      `;
      container.appendChild(card);
      card.querySelector(`[data-edit-meal="${meal.id}"]`)?.addEventListener('click', () => openMealModal(meal.id));
      card.querySelector(`[data-delete-meal="${meal.id}"]`)?.addEventListener('click', async () => {
        if (!confirm(`Are you sure you want to delete the meal "${meal.name}"?`)) return;
        try {
          await api(`/meals/${meal.id}`, { method: 'DELETE' });
          loadMeals();
          loadPrepareForm();
          loadMenu();
        } catch (e) {
          alert(e.message);
        }
      });
    });
    if (meals.length === 0) {
      container.innerHTML = `<p class="empty-state">No meals defined.${isFullKitchen() ? ' Add a meal and attach ingredients.' : ''}</p>`;
    }
  } catch (e) {
    $('#meals-list').innerHTML = '<p class="empty-state">' + e.message + '</p>';
  }
}

// ----- Meal modal -----
let mealIngredientsRows = [];

async function openMealModal(id) {
  if (!ingredientsList.length) {
    try {
      ingredientsList = await api('/ingredients');
    } catch (_) {
      ingredientsList = [];
    }
  }
  const modal = $('#modal-meal');
  const overlay = $('#modal-overlay');
  $('#modal-meal-title').textContent = id ? 'Edit meal' : 'Add meal';
  $('#form-meal').reset();
  $('#meal-id').value = id || '';
  mealIngredientsRows = [];

  const listEl = $('#meal-ingredients-list');
  listEl.innerHTML = '';

  if (id) {
    api('/meals').then(meals => {
      const meal = meals.find(m => m.id == id || String(m.id) === String(id));
      if (!meal) return;
      $('#meal-name').value = meal.name;
      $('#meal-description').value = meal.description || '';
      $('#meal-category').value = meal.meal_category || 'lunch';
      $('#meal-audience').value = meal.audience || 'students';
      const daySel = $('#meal-schedule-day');
      if (daySel) {
        const days = normalizeScheduleDays(meal);
        if (meal.schedule_flexible) {
          daySel.value = 'mon';
        } else {
          daySel.value = days[0] || '';
        }
      }
      (meal.ingredients || []).forEach(ing => {
        addMealIngredientRow(ing.ingredient_id, ing.quantity);
      });
      if (mealIngredientsRows.length === 0) addMealIngredientRow('', '');
    });
  } else {
    $('#meal-category').value = 'lunch';
    $('#meal-audience').value = 'students';
    const daySelNew = $('#meal-schedule-day');
    if (daySelNew) daySelNew.value = '';
    addMealIngredientRow('', '');
  }

  overlay.classList.add('active');
  modal.classList.add('active');
}

function unitForIngredientId(ingredientId) {
  const ing = ingredientsList.find(i => i.id === parseInt(ingredientId, 10));
  return ing?.unit_name || '—';
}

function updateMealRowUnit(row) {
  const sel = row.querySelector('[data-ingredient]');
  const box = row.querySelector('.meal-unit-box');
  if (!box || !sel) return;
  box.textContent = sel.value ? unitForIngredientId(sel.value) : '—';
}

function addMealIngredientRow(ingredientId = '', quantity = '') {
  const id = Date.now() + Math.random();
  const row = document.createElement('div');
  row.className = 'meal-ingredient-row';
  row.dataset.rowId = id;
  const options = ingredientsList.map(i =>
    `<option value="${i.id}" ${i.id === parseInt(ingredientId, 10) ? 'selected' : ''}>${escapeHtml(i.name)}</option>`
  ).join('');
  const unitLabel = ingredientId ? unitForIngredientId(ingredientId) : '—';
  row.innerHTML = `
    <select class="meal-ing-select" data-ingredient>
      <option value="">Select ingredient</option>
      ${options}
    </select>
    <input type="number" step="1" min="0" placeholder="Qty" class="meal-ing-qty" data-quantity value="${quantity}" />
    <span class="meal-unit-box" title="Unit for this ingredient">${escapeHtml(unitLabel)}</span>
    <button type="button" class="btn-remove" data-remove aria-label="Remove row">×</button>
  `;
  $('#meal-ingredients-list').appendChild(row);
  const ingSel = row.querySelector('[data-ingredient]');
  ingSel.addEventListener('change', () => updateMealRowUnit(row));
  row.querySelector('[data-remove]').addEventListener('click', () => row.remove());
  mealIngredientsRows.push(row);
}

function closeMealModal() {
  $('#modal-overlay').classList.remove('active');
  $('#modal-meal').classList.remove('active');
}

function collectMealSchedulePayload() {
  const v = ($('#meal-schedule-day')?.value || '').trim();
  if (!v) return { schedule_flexible: false, schedule_days: [] };
  return { schedule_flexible: false, schedule_days: [v] };
}

async function submitMealForm() {
  const rawMealId = String($('#meal-id')?.value || '').trim();
  const mealIdNum = parseInt(rawMealId, 10);
  const name = $('#meal-name').value.trim();
  if (!name) {
    alert('Enter a meal name.');
    return;
  }
  const ingredients = [];
  $$('#meal-ingredients-list .meal-ingredient-row').forEach(row => {
    const ingId = row.querySelector('[data-ingredient]').value;
    const qty = intVal(row.querySelector('[data-quantity]').value);
    if (ingId && qty > 0) ingredients.push({ ingredient_id: parseInt(ingId, 10), quantity: qty });
  });

  const sched = collectMealSchedulePayload();
  if (sched.schedule_days.length === 0) {
    alert('Choose one day (Mon–Sat) from the list, then save.');
    return;
  }
  const payload = {
    name,
    description: $('#meal-description').value.trim() || null,
    meal_category: $('#meal-category').value,
    audience: $('#meal-audience').value,
    schedule_days: sched.schedule_days,
    schedule_flexible: false,
    ingredients
  };

  const btn = $('#btn-save-meal');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving…';
  }
  try {
    if (rawMealId && Number.isFinite(mealIdNum) && mealIdNum > 0) {
      await api(`/meals/${mealIdNum}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      await api('/meals', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeMealModal();
    loadMeals();
    loadPrepareForm();
    loadMenu();
    loadDashboard();
  } catch (err) {
    alert(err.message || 'Could not save meal. Use http://localhost:3000 and check the server console.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Save meal';
    }
  }
}

$('#btn-new-meal')?.addEventListener('click', () => openMealModal(null));

$('#btn-add-meal-ingredient').addEventListener('click', () => addMealIngredientRow('', ''));

$('#form-meal').addEventListener('submit', e => {
  e.preventDefault();
  submitMealForm();
});

$('#btn-save-meal')?.addEventListener('click', e => {
  e.preventDefault();
  submitMealForm();
});

$('#modal-meal .modal-close').addEventListener('click', closeMealModal);
$('#modal-meal .modal-cancel').addEventListener('click', closeMealModal);

// ----- Weekly menu -----
async function loadMenu() {
  const board = $('#menu-board');
  const daySel = $('#menu-day-select');
  if (!board || !daySel) return;
  const dayKey = daySel.value;
  let meals;
  try {
    meals = await api('/meals');
  } catch (e) {
    board.innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`;
    return;
  }
  const audiences = dayKey === 'sat' ? AUD_ORDER_SAT : AUD_ORDER_FULL;
  const satNote = dayKey === 'sat'
    ? '<div class="menu-sat-note">Saturday: children are not on site. Staff and director meals only — weekend menus change from week to week.</div>'
    : '';

  const cols = audiences.map(aud => {
    const mealsAud = meals.filter(m => m.audience === aud && mealShowsOnDay(m, dayKey));
    const catOrder = aud === 'students' ? CAT_ORDER_STUDENTS : CAT_ORDER_STAFF_DIRECTORS;
    const slots = catOrder.map(cat => {
      const inCat = mealsAud.filter(m => (m.meal_category || 'lunch') === cat);
      const items = inCat.map(m => `
        <li>
          <span>${escapeHtml(m.name)}</span>
          ${isFullKitchen() ? `<button type="button" class="btn btn-sm secondary" data-edit-menu-meal="${m.id}">Edit</button>` : ''}
        </li>
      `).join('');
      return `
        <div class="menu-slot">
          <h4>${CAT_LABELS[cat]}</h4>
          <ul>${items || '<li class="muted">—</li>'}</ul>
        </div>
      `;
    }).join('');
    return `
      <div class="menu-col ${aud}">
        <h3>${AUD_LABELS[aud]}</h3>
        ${slots}
      </div>
    `;
  }).join('');

  board.innerHTML = satNote + `<div class="menu-columns cols-${audiences.length}">${cols}</div>`;

  board.querySelectorAll('[data-edit-menu-meal]').forEach(btn => {
    btn.addEventListener('click', () => openMealModal(parseInt(btn.dataset.editMenuMeal, 10)));
  });
}

$('#menu-day-select')?.addEventListener('change', loadMenu);

// ----- Prepare meal -----
async function loadPrepareForm() {
  const meals = await api('/meals').catch(() => []);
  const sel = $('#prepare-meal');
  sel.innerHTML = '<option value="">Select meal</option>' +
    meals.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  $('#prepare-qty').value = 1;
  $('#prepare-cost-preview').textContent = '';
  $('#prepare-message').textContent = '';
  $('#prepare-message').className = 'message';
}

$('#prepare-meal').addEventListener('change', updatePrepareCostPreview);
$('#prepare-qty').addEventListener('input', updatePrepareCostPreview);

async function updatePrepareCostPreview() {
  const mealId = $('#prepare-meal').value;
  const qty = parseInt($('#prepare-qty').value, 10) || 1;
  const el = $('#prepare-cost-preview');
  if (!mealId) {
    el.textContent = '';
    return;
  }
  try {
    const meals = await api('/meals');
    const meal = meals.find(m => m.id == mealId || String(m.id) === String(mealId));
    if (!meal || !meal.ingredients?.length) {
      el.textContent = 'No ingredients — ' + labelUGX(0);
      return;
    }
    let cost = 0;
    meal.ingredients.forEach(ing => {
      const lineUnits = intVal(ing.quantity) * qty;
      cost += lineUnits * intVal(ing.cost_per_unit);
    });
    cost = intVal(cost);
    el.textContent = `Estimated cost: ${labelUGX(cost)} (${qty} portion${qty > 1 ? 's' : ''})`;
  } catch {
    el.textContent = 'Could not calculate cost';
  }
}

$('#btn-prepare').addEventListener('click', async () => {
  const mealId = $('#prepare-meal').value;
  const qty = parseInt($('#prepare-qty').value, 10) || 1;
  const msg = $('#prepare-message');
  msg.textContent = '';
  msg.className = 'message';
  if (!mealId) {
    msg.textContent = 'Select a meal.';
    msg.classList.add('error');
    return;
  }
  try {
    const result = await api(`/meals/${mealId}/prepare`, {
      method: 'POST',
      body: JSON.stringify({ quantity: qty })
    });
    msg.textContent = `Prepared! Total cost: ${labelUGX(result.total_cost)}. Inventory updated.`;
    msg.classList.add('success');
    loadPrepareForm();
    loadInventory();
    loadDashboard();
    loadAlerts();
    loadReports();
  } catch (e) {
    msg.textContent = e.message;
    msg.classList.add('error');
  }
});

// ----- Budget -----
async function loadBudget() {
  try {
    const budget = await api('/budget');
    const currentEl = $('#budget-current');
    if (budget.period) {
      const sm = budget.spent_meals != null ? Number(budget.spent_meals) : Number(budget.spent);
      const si = budget.spent_inventory != null ? Number(budget.spent_inventory) : 0;
      currentEl.innerHTML = `
        <p><strong>${budget.period.period_start} → ${budget.period.period_end}</strong></p>
        <p>Budget: ${labelUGX(budget.budget_amount)} · Total spent: ${labelUGX(budget.spent)} · Remaining: ${labelUGX(budget.remaining)}</p>
        <p class="muted small-print">Meal preparations: ${labelUGX(sm)} · Inventory purchases: ${labelUGX(si)}</p>
        <p>Usage: ${(budget.usage_percent ?? 0).toFixed(1)}%</p>
      `;
    } else {
      currentEl.innerHTML = '<p class="muted">No budget period set. Add one below.</p>';
    }

    const preps = await api('/preparations');
    const tbody = $('#budget-preps-tbody');
    tbody.innerHTML = '';
    preps.slice(0, 50).forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(p.prepared_at).toLocaleDateString()}</td>
        <td>${escapeHtml(p.meal_name)}</td>
        <td>${p.quantity_prepared}</td>
        <td>${labelUGX(p.total_cost)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    $('#budget-current').innerHTML = '<p class="error">' + e.message + '</p>';
  }
}

$('#budget-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/budget', {
      method: 'POST',
      body: JSON.stringify({
        period_start: $('#budget-start').value,
        period_end: $('#budget-end').value,
        budget_amount: intVal($('#budget-amount').value)
      })
    });
    loadBudget();
    loadDashboard();
    $('#budget-form').reset();
  } catch (err) {
    alert(err.message);
  }
});

// ----- Alerts -----
async function loadAlerts() {
  try {
    const alerts = await api('/alerts');
    const { low_stock, surplus, expiring_soon } = alerts;
    const lowEl = $('#alerts-low');
    const surplusEl = $('#alerts-surplus');
    const expEl = $('#alerts-expiring');
    lowEl.innerHTML = '';
    surplusEl.innerHTML = '';
    if (expEl) expEl.innerHTML = '';
    (low_stock || []).forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.name}: ${intVal(item.current_stock)} ${item.unit_name} (min: ${intVal(item.min_stock)}) — restock needed`;
      lowEl.appendChild(li);
    });
    (surplus || []).forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.name}: ${intVal(item.current_stock)} ${item.unit_name} (max: ${intVal(item.max_stock)}) — above max`;
      surplusEl.appendChild(li);
    });
    (expiring_soon || []).forEach(item => {
      if (!expEl) return;
      const li = document.createElement('li');
      li.textContent = `${item.ingredient_name}: ${item.expiry_date} · ${intVal(item.quantity_remaining)} ${item.unit_name} remaining`;
      expEl.appendChild(li);
    });
    if (low_stock?.length === 0) lowEl.innerHTML = '<li class="muted">None</li>';
    if (surplus?.length === 0) surplusEl.innerHTML = '<li class="muted">None</li>';
    if (expEl && (expiring_soon || []).length === 0) expEl.innerHTML = '<li class="muted">None in the next 7 days</li>';
  } catch (e) {
    $('#alerts-low').innerHTML = '<li class="error">' + e.message + '</li>';
  }
}

// ----- Reports -----
async function loadReports() {
  const tbody = $('#reports-movements-tbody');
  if (!tbody) return;
  try {
    const rows = await api('/stock-movements?limit=100');
    tbody.innerHTML = '';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td>${escapeHtml(r.movement_type)}</td>
        <td>${escapeHtml(r.ingredient_name)}</td>
        <td>${r.quantity_change > 0 ? '+' : ''}${r.quantity_change} ${escapeHtml(r.unit_name)}</td>
        <td>${escapeHtml(r.notes || '—')}</td>
      `;
      tbody.appendChild(tr);
    });
    if (rows.length === 0) tbody.innerHTML = '<tr><td colspan="5" class="muted">No movements yet.</td></tr>';
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" class="error">' + escapeHtml(e.message) + '</td></tr>';
  }
}

// ----- Serving -----
function servingKey(cat, aud) {
  return `${cat}-${aud}`;
}

async function loadServing() {
  const dateEl = $('#serving-date');
  if (!dateEl) return;
  if (!dateEl.value) dateEl.value = todayISO();
  const tbody = $('#serving-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  SERVING_ROWS.forEach(([cat, aud]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${CAT_LABELS[cat]}</td>
      <td>${AUD_LABELS[aud]}</td>
      <td><input type="number" min="0" step="1" data-serving-planned data-cat="${cat}" data-aud="${aud}" /></td>
      <td><input type="number" min="0" step="1" data-serving-served data-cat="${cat}" data-aud="${aud}" /></td>
    `;
    tbody.appendChild(tr);
  });
  try {
    const { rows } = await api(`/daily-servings?date=${encodeURIComponent(dateEl.value)}`);
    const map = new Map();
    (rows || []).forEach(r => {
      map.set(servingKey(r.meal_category, r.audience), r);
    });
    tbody.querySelectorAll('[data-serving-planned]').forEach(inp => {
      const r = map.get(servingKey(inp.dataset.cat, inp.dataset.aud));
      if (r) {
        inp.value = intVal(r.planned_portions);
        const sib = inp.closest('tr').querySelector('[data-serving-served]');
        if (sib && r.served_portions != null) sib.value = intVal(r.served_portions);
      }
    });
  } catch (_) {
    /* leave empty */
  }
}

$('#serving-date')?.addEventListener('change', loadServing);

$('#btn-save-servings')?.addEventListener('click', async () => {
  const dateEl = $('#serving-date');
  const d = dateEl?.value || todayISO();
  const tbody = $('#serving-tbody');
  if (!tbody) return;
  try {
    const tasks = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      const plannedInp = tr.querySelector('[data-serving-planned]');
      const servedInp = tr.querySelector('[data-serving-served]');
      if (!plannedInp) return;
      const cat = plannedInp.dataset.cat;
      const aud = plannedInp.dataset.aud;
      const planned = intVal(plannedInp.value);
      const servedRaw = servedInp?.value;
      const served = servedRaw === '' || servedRaw == null ? null : intVal(servedRaw);
      tasks.push(
        api('/daily-servings', {
          method: 'POST',
          body: JSON.stringify({
            service_date: d,
            meal_category: cat,
            audience: aud,
            planned_portions: planned,
            served_portions: served
          })
        })
      );
    });
    await Promise.all(tasks);
    loadDashboard();
    alert('Serving counts saved.');
  } catch (e) {
    alert(e.message);
  }
});

// ----- Settings -----
function loadSettings() {
  applyPermissions(currentUser);
  if (isFullKitchen()) loadPupilAllergies();
  if (isAdmin()) loadUsersAdmin();
}

async function loadUsersAdmin() {
  const tbody = $('#users-admin-tbody');
  if (!tbody) return;
  try {
    const rows = await api('/users');
    tbody.innerHTML = '';
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted">No users yet.</td></tr>';
      return;
    }
    rows.forEach(u => {
      const tr = document.createElement('tr');
      const access =
        u.role === 'admin' ? '—' : u.full_dashboard ? 'Full kitchen' : 'Operational only';
      const selfRow = currentUser && u.id === currentUser.id;
      tr.innerHTML = `
        <td>${escapeHtml(u.display_name || u.username)}<br /><span class="muted small-hint">${escapeHtml(u.username)}</span></td>
        <td>${u.role === 'admin' ? 'Admin' : 'Chef'}</td>
        <td>${access}</td>
        <td>${u.active ? 'Yes' : 'No'}</td>
        <td class="actions">${selfRow ? '<span class="muted">You</span>' : userAdminActionsHtml(u)}</td>
      `;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-user-toggle-full]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.userToggleFull, 10);
        const next = btn.dataset.nextFull === 'true';
        try {
          await api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ full_dashboard: next }) });
          loadUsersAdmin();
        } catch (e) {
          alert(e.message);
        }
      });
    });
    tbody.querySelectorAll('[data-user-toggle-active]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.userToggleActive, 10);
        const next = btn.dataset.nextActive === 'true';
        if (!next && !confirm('Deactivate this user? They will not be able to sign in.')) return;
        try {
          await api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ active: next }) });
          loadUsersAdmin();
        } catch (e) {
          alert(e.message);
        }
      });
    });
    tbody.querySelectorAll('[data-user-password]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.userPassword, 10);
        const pw = prompt('New password (min 6 characters):');
        if (!pw || pw.length < 6) {
          alert('Password too short.');
          return;
        }
        try {
          await api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ password: pw }) });
          alert('Password updated.');
        } catch (e) {
          alert(e.message);
        }
      });
    });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" class="error">' + escapeHtml(e.message) + '</td></tr>';
  }
}

function userAdminActionsHtml(u) {
  if (!u.active) {
    return `<button type="button" class="btn btn-sm secondary" data-user-toggle-active="${u.id}" data-next-active="true">Reactivate</button>`;
  }
  const bits = [];
  if (u.role === 'chef') {
    const nextFull = !u.full_dashboard;
    bits.push(
      `<button type="button" class="btn btn-sm secondary" data-user-toggle-full="${u.id}" data-next-full="${nextFull}">${u.full_dashboard ? 'Set operational only' : 'Grant full kitchen'}</button>`
    );
  }
  bits.push(
    `<button type="button" class="btn btn-sm secondary" data-user-password="${u.id}">Set password</button>`
  );
  bits.push(
    `<button type="button" class="btn btn-sm primary" data-user-toggle-active="${u.id}" data-next-active="false">Deactivate</button>`
  );
  return bits.join(' ');
}

$('#form-new-user')?.addEventListener('submit', async e => {
  e.preventDefault();
  const username = $('#new-user-username').value.trim().toLowerCase();
  const password = $('#new-user-password').value;
  const display_name = $('#new-user-display').value.trim() || username;
  const role = $('#new-user-role').value === 'admin' ? 'admin' : 'chef';
  const full_dashboard = role === 'admin' ? true : $('#new-user-full').checked;
  if (!username || !password) return;
  try {
    await api('/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, display_name, role, full_dashboard })
    });
    e.target.reset();
    $('#new-user-full').checked = true;
    loadUsersAdmin();
  } catch (err) {
    alert(err.message);
  }
});

$('#btn-logout')?.addEventListener('click', async () => {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (_) {
    /* ignore */
  }
  showLoginScreen();
});

async function loadPupilAllergies() {
  const ul = $('#pupil-list');
  if (!ul) return;
  try {
    const rows = await api('/pupil-allergies');
    ul.innerHTML = '';
    rows.forEach(p => {
      const li = document.createElement('li');
      const tags = parseAllergenTags(p.allergen_tags).join(', ');
      li.innerHTML = `
        <span><strong>${escapeHtml(p.pupil_name)}</strong> — ${escapeHtml(tags || '—')}</span>
        <button type="button" class="btn btn-sm secondary" data-remove-pupil="${p.id}">Remove</button>
      `;
      ul.appendChild(li);
    });
    ul.querySelectorAll('[data-remove-pupil]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this pupil from the watch list?')) return;
        try {
          await api(`/pupil-allergies/${btn.dataset.removePupil}`, { method: 'DELETE' });
          loadPupilAllergies();
          loadDashboard();
        } catch (e) {
          alert(e.message);
        }
      });
    });
    if (rows.length === 0) ul.innerHTML = '<li class="muted">No pupils on file.</li>';
  } catch (e) {
    ul.innerHTML = '<li class="error">' + escapeHtml(e.message) + '</li>';
  }
}

$('#form-pupil-allergy')?.addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#pupil-name').value.trim();
  const tagsRaw = ($('#pupil-tags').value || '').split(/[,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const notes = ($('#pupil-notes').value || '').trim() || null;
  if (!name) return;
  try {
    await api('/pupil-allergies', {
      method: 'POST',
      body: JSON.stringify({ pupil_name: name, allergen_tags: tagsRaw, notes })
    });
    e.target.reset();
    loadPupilAllergies();
    loadDashboard();
  } catch (err) {
    alert(err.message);
  }
});

$('#form-temp')?.addEventListener('submit', async e => {
  e.preventDefault();
  const zone_label = $('#temp-zone').value.trim();
  const temp_c = $('#temp-c').value === '' ? null : Number($('#temp-c').value);
  const ok = $('#temp-ok').checked;
  const notes = ($('#temp-notes').value || '').trim() || null;
  if (!zone_label) return;
  try {
    await api('/temperature-checks', {
      method: 'POST',
      body: JSON.stringify({ zone_label, temp_c, ok, notes })
    });
    e.target.reset();
    $('#temp-ok').checked = true;
    loadDashboard();
    alert('Temperature logged.');
  } catch (err) {
    alert(err.message);
  }
});

// ----- Init -----
(function setMenuDayDefault() {
  const d = new Date().getDay();
  const map = ['mon', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const sel = $('#menu-day-select');
  if (sel) sel.value = map[d];
})();

(async function bootstrap() {
  renderAllergenGrid();
  try {
    let user = window.__kitchenAuthedUser || null;
    if (!user) {
      user = (await api('/auth/me')).user;
    }
    if (!user) {
      showLoginScreen();
      return;
    }
    delete window.__kitchenAuthedUser;
    applyPermissions(user);
    showApp();
    startInactivityWatch();
    await loadUnits();
    loadDashboard();
    loadInventory();
    loadMeals();
    loadMenu();
    loadPrepareForm();
    loadBudget();
    loadAlerts();
    loadReports();
    loadSettings();
  } catch {
    showLoginScreen();
  }
})();
