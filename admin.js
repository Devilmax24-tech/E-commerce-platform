// ============================================================
//  FRESHCUT – ADMIN JAVASCRIPT
// ============================================================

// ── Admin credentials (change these!) ──────────────────────
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'freshcut2024';

// ── State ───────────────────────────────────────────────────
let allOrders   = [];
let allProducts = [];
let currentTab  = 'orders';

const PRODUCT_IMAGES = {
  'Whole Chicken':    'https://images.unsplash.com/photo-1606728035253-49e196721186?w=600&q=80',
  'Chicken Breast':   'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=600&q=80',
  'Chicken Leg':      'https://images.unsplash.com/photo-1604503468506-a8da13d11d36?w=600&q=80',
  'Chicken Wings':    'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=600&q=80',
  'Boneless Chicken': 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=600&q=80',
  'Goat Mutton':      'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
};

const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&q=80';

function resolveProductImageByName(name, explicitImageUrl = '') {
  const direct = (explicitImageUrl || '').trim();
  if (direct) return direct;

  const n = (name || '').toLowerCase().trim();
  if (!n) return DEFAULT_PRODUCT_IMAGE;

  if (PRODUCT_IMAGES[name]) return PRODUCT_IMAGES[name];
  if (n.includes('whole') && n.includes('chicken')) return PRODUCT_IMAGES['Whole Chicken'];
  if (n.includes('breast') && n.includes('chicken')) return PRODUCT_IMAGES['Chicken Breast'];
  if ((n.includes('leg') || n.includes('drumstick')) && n.includes('chicken')) return PRODUCT_IMAGES['Chicken Leg'];
  if (n.includes('wing') && n.includes('chicken')) return PRODUCT_IMAGES['Chicken Wings'];
  if (n.includes('boneless') && n.includes('chicken')) return PRODUCT_IMAGES['Boneless Chicken'];
  if (n.includes('mutton') || n.includes('goat')) return PRODUCT_IMAGES['Goat Mutton'];

  return DEFAULT_PRODUCT_IMAGE;
}

// ── DOM refs ────────────────────────────────────────────────
const loginScreen  = document.getElementById('loginScreen');
const dashboard    = document.getElementById('dashboard');
const loginForm    = document.getElementById('loginForm');
const loginError   = document.getElementById('loginError');
const loginText    = document.getElementById('loginText');
const loginSpinner = document.getElementById('loginSpinner');
const logoutBtn    = document.getElementById('logoutBtn');
const dashDate     = document.getElementById('dashDate');
const miniOrders   = document.getElementById('miniOrders');
const miniRevenue  = document.getElementById('miniRevenue');
const tabTitle     = document.getElementById('tabTitle');

// ── Login ────────────────────────────────────────────────────
loginForm.addEventListener('submit', e => {
  e.preventDefault();
  const u = document.getElementById('adminUser').value.trim();
  const p = document.getElementById('adminPass').value;
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    loginScreen.style.display = 'none';
    dashboard.style.display   = 'flex';
    initDashboard();
  } else {
    loginError.textContent = '❌ Invalid username or password';
  }
});

document.getElementById('togglePass').addEventListener('click', () => {
  const f = document.getElementById('adminPass');
  f.type = f.type === 'password' ? 'text' : 'password';
});

logoutBtn.addEventListener('click', () => {
  dashboard.style.display = 'none';
  loginScreen.style.display = 'flex';
  document.getElementById('adminPass').value = '';
});

// ── Tab Navigation ───────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item,.mnav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab' + cap(tab)).classList.add('active');
  document.querySelectorAll(`[data-tab="${tab}"]`).forEach(n => n.classList.add('active'));
  const titles = { orders:'Orders', prices:'Prices', financial:'Financial', restaurants:'Restaurants' };
  tabTitle.textContent = titles[tab] || tab;
  if (tab === 'orders')      renderOrders();
  if (tab === 'prices')      renderPrices();
  if (tab === 'financial')   renderFinancial();
  if (tab === 'restaurants') renderRestaurants();
}

document.querySelectorAll('[data-tab]').forEach(el => {
  el.addEventListener('click', () => switchTab(el.dataset.tab));
});

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Init ─────────────────────────────────────────────────────
function initDashboard() {
  const now = new Date();
  dashDate.textContent = now.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  loadDailyStats();
  loadOrders();
  loadProducts();
}

// ── Daily Stats ──────────────────────────────────────────────
async function loadDailyStats() {
  const today = getToday();
  try {
    const doc = await db.collection('dailyStats').doc(today).get();
    if (doc.exists) {
      const d = doc.data();
      miniOrders.textContent  = d.orderCount || 0;
      miniRevenue.textContent = '₹' + (d.totalRevenue || 0);
    } else {
      miniOrders.textContent  = '0';
      miniRevenue.textContent = '₹0';
    }
  } catch(e) { console.warn(e); }
}

// ── Load Orders ──────────────────────────────────────────────
function loadOrders() {
  db.collection('orders').orderBy('createdAt','desc').onSnapshot(snap => {
    allOrders = [];
    snap.forEach(doc => allOrders.push({ id: doc.id, ...doc.data() }));
    if (currentTab === 'orders') renderOrders();
    loadDailyStats();
  });
}

// ── Render Orders ────────────────────────────────────────────
function renderOrders() {
  const dateVal   = document.getElementById('filterDate').value;
  const search    = document.getElementById('filterSearch').value.toLowerCase();
  const statusVal = document.getElementById('filterStatus').value;
  const list      = document.getElementById('ordersList');

  let filtered = allOrders.filter(o => {
    if (dateVal && o.date !== dateVal) return false;
    if (search && !o.restaurantName.toLowerCase().includes(search)) return false;
    if (statusVal && o.status !== statusVal) return false;
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><p>No orders found</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(o => `
    <div class="order-card" data-id="${o.id}" onclick="openOrderDetail('${o.id}')">
      <div class="order-card-top">
        <div>
          <div class="order-restaurant">${o.restaurantName}</div>
          <div class="order-meta">📞 ${o.phone} &nbsp;·&nbsp; 📅 ${o.date || '–'}</div>
        </div>
        <div class="order-amount">₹${o.totalAmount}</div>
      </div>
      <div class="order-card-bottom">
        <span class="badge badge-${o.status}">${o.status.toUpperCase()}</span>
        <span class="badge badge-${o.paymentStatus}">${o.paymentStatus === 'paid' ? 'PAID ✅' : o.paymentStatus === 'partial' ? 'PARTIAL' : 'UNPAID'}</span>
        ${o.dueAmount > 0 ? `<span class="order-due-chip">Due: ₹${o.dueAmount}</span>` : ''}
      </div>
    </div>`).join('');
}

['filterDate','filterSearch','filterStatus'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderOrders);
});

// ── Order Detail Modal ───────────────────────────────────────
window.openOrderDetail = function(id) {
  const o = allOrders.find(x => x.id === id);
  if (!o) return;
  const box = document.getElementById('orderDetailBox');
  box.innerHTML = `
    <button class="modal-close" onclick="closeModal('orderDetailModal')">✕</button>
    <h3 class="modal-title" style="margin-bottom:4px;">📋 Order Details</h3>
    <p class="modal-sub" style="margin-bottom:18px;">ID: ${o.id}</p>

    <div class="detail-section">
      <h4>Restaurant Info</h4>
      <div class="detail-info-grid">
        <div class="detail-info-item"><div class="detail-info-lbl">Name</div><div class="detail-info-val">${o.restaurantName}</div></div>
        <div class="detail-info-item"><div class="detail-info-lbl">Phone</div><div class="detail-info-val">${o.phone}</div></div>
        <div class="detail-info-item" style="grid-column:1/-1"><div class="detail-info-lbl">Address</div><div class="detail-info-val">${o.address}, ${o.pinCode}</div></div>
        ${o.contactName ? `<div class="detail-info-item"><div class="detail-info-lbl">Contact</div><div class="detail-info-val">${o.contactName}</div></div>` : ''}
        ${o.orderNote ? `<div class="detail-info-item" style="grid-column:1/-1"><div class="detail-info-lbl">Note</div><div class="detail-info-val">${o.orderNote}</div></div>` : ''}
      </div>
    </div>

    <div class="detail-section">
      <h4>Items Ordered</h4>
      <table class="detail-items-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
        <tbody>
          ${(o.items||[]).map(i=>`<tr><td><div class="order-item-name-wrap"><img class="order-item-thumb" src="${resolveProductImageByName(i.productName, i.imageUrl)}" alt="${i.productName}" onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${DEFAULT_PRODUCT_IMAGE}';}" /> ${i.productName}</div></td><td>${i.qty} ${i.unit||'kg'}</td><td>₹${i.pricePerUnit}</td><td>₹${i.subtotal}</td></tr>`).join('')}
          <tr class="detail-total-row"><td colspan="3" style="text-align:right;padding-top:12px;">Total</td><td style="padding-top:12px;">₹${o.totalAmount}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="detail-section">
      <h4>Update Status</h4>
      <select class="status-select" onchange="updateOrderStatus('${o.id}',this.value)">
        ${['pending','confirmed','delivered','cancelled'].map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${cap(s)}</option>`).join('')}
      </select>
    </div>

    <div class="detail-section" style="display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn-primary btn-sm" onclick="closeModal('orderDetailModal');openPaymentModal('${o.id}')">💳 Record Payment</button>
    </div>`;
  openModal('orderDetailModal');
};

window.updateOrderStatus = async function(id, status) {
  try {
    await db.collection('orders').doc(id).update({ status });
    showToast('Status updated ✅', 'success');
  } catch(e) { showToast('Failed to update', 'error'); }
};

// ── Prices Tab ───────────────────────────────────────────────
function loadProducts() {
  db.collection('products').orderBy('sortOrder').onSnapshot(snap => {
    allProducts = [];
    snap.forEach(doc => allProducts.push({ id: doc.id, ...doc.data() }));
    if (currentTab === 'prices') renderPrices();
  });
}

function renderPrices() {
  const list = document.getElementById('pricesList');
  const info = document.getElementById('priceLastUpdated');
  if (!allProducts.length) { list.innerHTML = '<p style="color:var(--muted)">No products yet.</p>'; return; }

  const lastUp = allProducts.reduce((a, p) => {
    const t = p.updatedAt?.toDate?.() || null;
    return (t && (!a || t > a)) ? t : a;
  }, null);
  info.textContent = lastUp ? 'Last updated: ' + lastUp.toLocaleString('en-IN') : 'Prices not updated today (showing previous)';

  list.innerHTML = allProducts.map(p => `
    <div class="price-row">
      <img class="price-thumb" src="${resolveProductImageByName(p.name, p.imageUrl)}" alt="${p.name}" loading="lazy" onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${DEFAULT_PRODUCT_IMAGE}';}" />
      <div class="price-info">
        <div class="price-name">${p.name}</div>
        <div class="price-unit">${p.unit}</div>
      </div>
      <div class="price-input-wrap">
        <input type="number" class="price-input" value="${p.price}" min="1" id="price_${p.id}" />
        <button class="btn-save-price" id="savebtn_${p.id}" onclick="savePrice('${p.id}')">Save</button>
        <button class="toggle-avail ${p.available?'on':'off'}" onclick="toggleAvail('${p.id}',${!p.available})">${p.available?'ON':'OFF'}</button>
        <button class="btn-remove-product" onclick="removeProduct('${p.id}','${(p.name || '').replace(/'/g, "\\'")}')">Remove</button>
      </div>
    </div>`).join('');
}

window.savePrice = async function(id) {
  const val = parseInt(document.getElementById('price_' + id).value);
  if (!val || val < 1) { showToast('Enter valid price', 'error'); return; }
  const btn = document.getElementById('savebtn_' + id);
  btn.textContent = '…';
  try {
    await db.collection('products').doc(id).update({ price: val, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    btn.textContent = 'Saved ✓';
    btn.classList.add('saved');
    setTimeout(() => { btn.textContent = 'Save'; btn.classList.remove('saved'); }, 2000);
    showToast('Price updated ✅', 'success');
  } catch(e) { showToast('Failed', 'error'); btn.textContent = 'Save'; }
};

window.toggleAvail = async function(id, avail) {
  try {
    await db.collection('products').doc(id).update({ available: avail });
    showToast(avail ? 'Marked available ✅' : 'Marked unavailable', avail ? 'success' : '');
  } catch(e) { showToast('Failed', 'error'); }
};

window.removeProduct = async function(id, name) {
  try {
    await db.collection('products').doc(id).delete();
    showToast('Product removed ✅', 'success');
  } catch (e) {
    showToast('Failed to remove product', 'error');
  }
};

document.getElementById('addProductForm').addEventListener('submit', async e => {
  e.preventDefault();
  const emoji    = document.getElementById('newProductEmoji').value.trim() || '🥩';
  const name     = document.getElementById('newProductName').value.trim();
  const unit     = document.getElementById('newProductUnit').value.trim();
  const price    = parseInt(document.getElementById('newProductPrice').value);
  const imageUrl = document.getElementById('newProductImageUrl').value.trim() || null;
  if (!name || !unit || !price) return;
  try {
    await db.collection('products').add({
      emoji, name, unit, price, imageUrl, available: true, sortOrder: 99,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    e.target.reset();
    showToast('Product added ✅', 'success');
  } catch(err) { showToast('Failed to add product', 'error'); }
});

// ── Financial Tab ────────────────────────────────────────────
function renderFinancial(fromDate, toDate) {
  const list  = document.getElementById('financialList');
  let orders  = [...allOrders];

  if (fromDate) orders = orders.filter(o => o.date >= fromDate);
  if (toDate)   orders = orders.filter(o => o.date <= toDate);

  const totalBilled   = orders.reduce((s,o) => s + (o.totalAmount||0), 0);
  const totalPaid     = orders.reduce((s,o) => s + (o.paidAmount||0), 0);
  const totalDue      = orders.reduce((s,o) => s + (o.dueAmount||0), 0);

  document.getElementById('finTotalAmount').textContent    = '₹' + totalBilled;
  document.getElementById('finReceivedAmount').textContent = '₹' + totalPaid;
  document.getElementById('finDueAmount').textContent      = '₹' + totalDue;

  if (!orders.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><p>No orders in this range</p></div>`;
    return;
  }

  list.innerHTML = orders.map(o => {
    const due = o.dueAmount || 0;
    return `
    <div class="fin-order-card">
      <div class="fin-order-top">
        <div>
          <div class="fin-order-name">${o.restaurantName}</div>
          <div class="fin-order-date">📅 ${o.date || '–'} &nbsp;·&nbsp; 📞 ${o.phone}</div>
        </div>
        <span class="badge badge-${o.paymentStatus}">${o.paymentStatus === 'paid' ? 'PAID' : o.paymentStatus === 'partial' ? 'PARTIAL' : 'UNPAID'}</span>
      </div>
      <div class="fin-amounts">
        <div class="fin-amount-chip chip-total"><span class="fin-amount-chip-val">₹${o.totalAmount}</span><span class="fin-amount-chip-lbl">Total Billed</span></div>
        <div class="fin-amount-chip chip-paid"><span class="fin-amount-chip-val">₹${o.paidAmount||0}</span><span class="fin-amount-chip-lbl">Received</span></div>
        <div class="fin-amount-chip chip-due"><span class="fin-amount-chip-val">₹${due}</span><span class="fin-amount-chip-lbl">Due</span></div>
      </div>
      ${due === 0
        ? `<div class="nodues-tag">✅ No Dues – Fully Paid</div>`
        : `<button class="fin-payment-btn" onclick="openPaymentModal('${o.id}')">💳 Record Payment</button>`}
    </div>`;
  }).join('');
}

document.getElementById('finFilterBtn').addEventListener('click', () => {
  renderFinancial(document.getElementById('finFilterFrom').value, document.getElementById('finFilterTo').value);
});
document.getElementById('finClearBtn').addEventListener('click', () => {
  document.getElementById('finFilterFrom').value = '';
  document.getElementById('finFilterTo').value   = '';
  renderFinancial();
});

// ── Payment Modal ─────────────────────────────────────────────
let paymentOrderId = null;

window.openPaymentModal = function(orderId) {
  const o = allOrders.find(x => x.id === orderId);
  if (!o) return;
  paymentOrderId = orderId;
  document.getElementById('paymentRestaurantName').textContent = '🏪 ' + o.restaurantName;
  document.getElementById('paymentOrderId').value = orderId;
  document.getElementById('paymentAmount').value  = '';
  document.getElementById('paymentNote').value    = '';
  document.getElementById('paymentSummary').innerHTML = `
    <div class="payment-summary-row"><span>Total Billed</span><span style="font-weight:700">₹${o.totalAmount}</span></div>
    <div class="payment-summary-row"><span>Already Received</span><span style="font-weight:700;color:var(--green)">₹${o.paidAmount||0}</span></div>
    <div class="payment-summary-row"><span>Current Due</span><span style="font-weight:700;color:var(--red)">₹${o.dueAmount||0}</span></div>`;
  openModal('paymentModal');
};

document.getElementById('paymentModalClose').addEventListener('click', () => closeModal('paymentModal'));

document.getElementById('paymentForm').addEventListener('submit', async e => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const note   = document.getElementById('paymentNote').value.trim();
  if (!paymentOrderId || isNaN(amount) || amount < 0) { showToast('Enter valid amount', 'error'); return; }

  const o = allOrders.find(x => x.id === paymentOrderId);
  if (!o) return;

  const newPaid = (o.paidAmount || 0) + amount;
  const newDue  = Math.max(0, o.totalAmount - newPaid);
  const payStatus = newDue === 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

  try {
    await db.collection('orders').doc(paymentOrderId).update({
      paidAmount: newPaid,
      dueAmount:  newDue,
      paymentStatus: payStatus,
      paymentNote: note || null,
      lastPaymentAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeModal('paymentModal');
    showToast(`₹${amount} recorded ✅`, 'success');
    if (currentTab === 'financial') renderFinancial();
  } catch(err) { showToast('Failed to record payment', 'error'); }
});

// ── Restaurants Tab ───────────────────────────────────────────
function renderRestaurants() {
  const list = document.getElementById('restaurantsList');
  if (!allOrders.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏪</div><p>No restaurants yet</p></div>`;
    return;
  }

  // Group by restaurantName
  const map = {};
  allOrders.forEach(o => {
    const key = o.restaurantName;
    if (!map[key]) map[key] = { name: key, phone: o.phone, address: o.address, orders: [], totalBilled: 0, totalPaid: 0, totalDue: 0 };
    map[key].orders.push(o);
    map[key].totalBilled += o.totalAmount || 0;
    map[key].totalPaid   += o.paidAmount  || 0;
    map[key].totalDue    += o.dueAmount   || 0;
  });

  const restaurants = Object.values(map).sort((a,b) => b.totalBilled - a.totalBilled);

  list.innerHTML = restaurants.map(r => `
    <div class="rest-card" onclick="openRestaurantModal('${encodeURIComponent(r.name)}')">
      <div class="rest-card-top">
        <div>
          <div class="rest-name">🏪 ${r.name}</div>
          <div class="rest-meta">📞 ${r.phone}</div>
        </div>
        <span class="badge ${r.totalDue>0?'badge-unpaid':'badge-delivered'}">${r.totalDue>0?'HAS DUES':'NO DUES'}</span>
      </div>
      <div class="rest-stats">
        <div class="rest-stat">${r.orders.length} <span>Orders</span></div>
        <div class="rest-stat" style="color:var(--blue)">₹${r.totalBilled} <span style="color:var(--muted)">Billed</span></div>
        <div class="rest-stat" style="color:var(--green)">₹${r.totalPaid} <span style="color:var(--muted)">Paid</span></div>
        <div class="rest-stat" style="color:var(--red)">₹${r.totalDue} <span style="color:var(--muted)">Due</span></div>
      </div>
    </div>`).join('');
}

window.openRestaurantModal = function(encodedName) {
  const name = decodeURIComponent(encodedName);
  const orders = allOrders.filter(o => o.restaurantName === name);
  const box = document.getElementById('restaurantModalBox');
  const totalBilled = orders.reduce((s,o) => s + (o.totalAmount||0), 0);
  const totalPaid   = orders.reduce((s,o) => s + (o.paidAmount||0), 0);
  const totalDue    = orders.reduce((s,o) => s + (o.dueAmount||0), 0);

  box.innerHTML = `
    <button class="modal-close" onclick="closeModal('restaurantModal')">✕</button>
    <h3 class="modal-title" style="margin-bottom:4px;">🏪 ${name}</h3>
    <p class="modal-sub" style="margin-bottom:16px;">${orders.length} orders total</p>
    <div class="fin-amounts" style="margin-bottom:16px;">
      <div class="fin-amount-chip chip-total"><span class="fin-amount-chip-val">₹${totalBilled}</span><span class="fin-amount-chip-lbl">Total Billed</span></div>
      <div class="fin-amount-chip chip-paid"><span class="fin-amount-chip-val">₹${totalPaid}</span><span class="fin-amount-chip-lbl">Received</span></div>
      <div class="fin-amount-chip chip-due"><span class="fin-amount-chip-val">₹${totalDue}</span><span class="fin-amount-chip-lbl">Due</span></div>
    </div>
    <div style="max-height:50vh;overflow-y:auto;">
      ${orders.map(o => `
        <div class="order-card" style="margin-bottom:10px;cursor:default;">
          <div class="order-card-top">
            <div><div class="order-meta">📅 ${o.date||'–'}</div></div>
            <div class="order-amount">₹${o.totalAmount}</div>
          </div>
          <div class="order-card-bottom">
            <span class="badge badge-${o.status}">${o.status}</span>
            <span class="badge badge-${o.paymentStatus}">${o.paymentStatus}</span>
            ${o.dueAmount > 0 ? `<span class="order-due-chip">Due: ₹${o.dueAmount}</span>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
  openModal('restaurantModal');
};

// ── Modal Helpers ─────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow='hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow=''; }
window.openModal  = openModal;
window.closeModal = closeModal;

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});

// ── Utils ─────────────────────────────────────────────────────
function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

let toastTimer;
function showToast(msg, type = '') {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  clearTimeout(toastTimer);
  t.textContent = msg;
  t.className = `toast ${type}`;
  void t.offsetHeight;
  t.classList.add('show');
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// Pre-set today's date in filter
document.getElementById('filterDate').value = getToday();
