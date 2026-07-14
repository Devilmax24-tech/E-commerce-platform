// ============================================================
//  FRESHCUT – CUSTOMER JS  (Blinkit-style)
// ============================================================

// Canonical product photos and robust fallback matching by product name.
const PRODUCT_IMAGES = {
  'Whole Chicken':    'https://i.pinimg.com/736x/38/36/a1/3836a17c652c67f0d359c19027f9c233.jpg',
  'Chicken Breast':   'https://i.pinimg.com/736x/e1/c4/72/e1c472e09aff5ca4034f2ba451688402.jpg',
  'Chicken Leg':      'https://i.pinimg.com/736x/bc/e0/75/bce075d30d748591fa4de40e684609f7.jpg',
  'Chicken Wings':    'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=600&q=80',
  'Boneless Chicken': 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=600&q=80',
  'Goat Mutton':      'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
};

const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&q=80';

function resolveProductImage(product) {
  const explicit = (product?.imageUrl || '').trim();
  if (explicit) return explicit;

  const name = (product?.name || '').toLowerCase().trim();
  if (!name) return DEFAULT_PRODUCT_IMAGE;

  if (PRODUCT_IMAGES[product.name]) return PRODUCT_IMAGES[product.name];
  if (name.includes('whole') && name.includes('chicken')) return PRODUCT_IMAGES['Whole Chicken'];
  if (name.includes('breast') && name.includes('chicken')) return PRODUCT_IMAGES['Chicken Breast'];
  if ((name.includes('leg') || name.includes('drumstick')) && name.includes('chicken')) return PRODUCT_IMAGES['Chicken Leg'];
  if (name.includes('wing') && name.includes('chicken')) return PRODUCT_IMAGES['Chicken Wings'];
  if (name.includes('boneless') && name.includes('chicken')) return PRODUCT_IMAGES['Boneless Chicken'];
  if (name.includes('mutton') || name.includes('goat')) return PRODUCT_IMAGES['Goat Mutton'];

  return DEFAULT_PRODUCT_IMAGE;
}

// ── State ────────────────────────────────────────────────────
let products    = [];
let cart        = {};
let activeCategory = 'all';
let activeCoupon = null;

// ── DOM ──────────────────────────────────────────────────────
const productsGrid    = document.getElementById('productsGrid');
const tickerScroll    = document.getElementById('tickerScroll');
const cartBar         = document.getElementById('cartBar');
const cartCount       = document.getElementById('cartCount');
const cartTotal       = document.getElementById('cartTotal');
const cartBarBtn      = document.getElementById('cartBarBtn');
const orderModal      = document.getElementById('orderModal');
const modalClose      = document.getElementById('modalClose');
const orderForm       = document.getElementById('orderForm');
const cartItemsList   = document.getElementById('cartItemsList');
const formTotal       = document.getElementById('formTotal');
const submitBtn       = document.getElementById('submitBtn');
const submitText      = document.getElementById('submitText');
const submitSpinner   = document.getElementById('submitSpinner');
const successOverlay  = document.getElementById('successOverlay');
const confirmPhone    = document.getElementById('confirmPhone');
const confirmOrderId  = document.getElementById('confirmOrderId');
const newOrderBtn     = document.getElementById('newOrderBtn');
const searchInput     = document.getElementById('searchInput');
const sectionLabelText = document.getElementById('sectionLabelText');
const sectionCount    = document.getElementById('sectionCount');

// ── Load Products ─────────────────────────────────────────────
async function loadProducts() {
  try {
    const snap = await db.collection('products').orderBy('sortOrder').get();
    if (snap.empty) {
      await seedDefaultProducts();
      return loadProducts();
    }
    products = [];
    snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
    renderProducts();
    renderTicker();
  } catch (err) {
    console.error(err);
    productsGrid.innerHTML = `<div class="no-results"><div class="no-results-icon">⚠️</div><p>Unable to load. Check Firebase config.</p></div>`;
  }
}

// ── Seed defaults ─────────────────────────────────────────────
async function seedDefaultProducts() {
  const defaults = [
    { name: 'Whole Chicken',    emoji: '🐔', imageUrl: PRODUCT_IMAGES['Whole Chicken'], unit: '1 kg', price: 180, sortOrder: 1, available: true, category: 'chicken' },
    { name: 'Chicken Breast',   emoji: '🍗', imageUrl: PRODUCT_IMAGES['Chicken Breast'], unit: '1 kg', price: 260, sortOrder: 2, available: true, category: 'chicken' },
    { name: 'Chicken Leg',      emoji: '🍗', imageUrl: PRODUCT_IMAGES['Chicken Leg'], unit: '1 kg', price: 200, sortOrder: 3, available: true, category: 'chicken' },
    { name: 'Chicken Wings',    emoji: '🍗', imageUrl: PRODUCT_IMAGES['Chicken Wings'], unit: '1 kg', price: 190, sortOrder: 4, available: true, category: 'chicken' },
    { name: 'Boneless Chicken', emoji: '🥩', imageUrl: PRODUCT_IMAGES['Boneless Chicken'], unit: '1 kg', price: 300, sortOrder: 5, available: true, category: 'chicken' },
    { name: 'Goat Mutton',      emoji: '🐑', imageUrl: PRODUCT_IMAGES['Goat Mutton'], unit: '1 kg', price: 700, sortOrder: 6, available: true, category: 'mutton' },
  ];
  const batch = db.batch();
  defaults.forEach(item => {
    const ref = db.collection('products').doc();
    batch.set(ref, { ...item, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  });
  await batch.commit();
}

// ── Render Products ───────────────────────────────────────────
function renderProducts() {
  const search = searchInput.value.toLowerCase().trim();

  let filtered = products.filter(p => {
    // Only allow chicken and mutton categories
    if (p.category !== 'chicken' && p.category !== 'mutton') return false;
    const matchChickenLeg = activeCategory === 'chicken-leg'
      ? (p.category === 'chicken' && /leg|drumstick/i.test(p.name || ''))
      : false;
    const matchCat  = activeCategory === 'all' || p.category === activeCategory || matchChickenLeg;
    const matchSearch = !search || p.name.toLowerCase().includes(search);
    return matchCat && matchSearch;
  });

  // Update label
  const catNames = { all: '🥩 All Products', chicken: '🍗 Chicken', 'chicken-leg': '🍗 Chicken Leg', mutton: '🐑 Mutton' };
  sectionLabelText.textContent = catNames[activeCategory] || '🥩 All Products';
  sectionCount.textContent = filtered.length ? `${filtered.length} items` : '';

  if (!filtered.length) {
    productsGrid.innerHTML = `<div class="no-results"><div class="no-results-icon">🔍</div><p>No products found</p></div>`;
    return;
  }

  productsGrid.innerHTML = '';

  filtered.forEach(p => {
    const inCart = cart[p.id];
    const qty    = inCart ? inCart.qty : 0;
    const imgUrl = resolveProductImage(p);

    const card = document.createElement('div');
    card.className = `product-card${!p.available ? ' unavailable' : ''}${inCart ? ' in-cart' : ''}`;
    card.dataset.id = p.id;
    card.addEventListener('click', e => {
      if (!e.target.closest('.add-btn') && !e.target.closest('.qty-controls')) {
        openProductDetail(p.id);
      }
    });

    const stockHtml = p.available ? '' : '<span class="pc-stock out">OUT OF STOCK</span>';
    const photoHtml = `<div class="pc-photo"><img src="${imgUrl}" alt="${p.name}" loading="lazy" onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${DEFAULT_PRODUCT_IMAGE}';}" />${stockHtml}</div>`;

    const addHtml = qty === 0
      ? `<button class="add-btn" data-id="${p.id}">Add</button>`
      : `<div class="qty-controls">
           <button class="qty-btn" data-action="dec" data-id="${p.id}">−</button>
           <span class="qty-value">${qty}</span>
           <button class="qty-btn" data-action="inc" data-id="${p.id}">+</button>
         </div>`;

    card.innerHTML = `
      <div style="position:relative">${photoHtml}</div>
      <div class="pc-body">
        <div class="pc-name">${p.name}</div>
        <div class="pc-unit">${p.unit}</div>
        <div class="pc-bottom-row">
          <div class="pc-price">₹${p.price}</div>
          <div class="pc-action-wrap">
            ${addHtml}
          </div>
        </div>
      </div>`;

    productsGrid.appendChild(card);
  });

  // Events
  productsGrid.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); addToCart(btn.dataset.id); });
  });
  productsGrid.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      btn.dataset.action === 'inc' ? increaseQty(btn.dataset.id) : decreaseQty(btn.dataset.id);
    });
  });
}

// ── Ticker ────────────────────────────────────────────────────
function renderTicker() {
  const text = products
    .filter(p => p.available)
    .filter(p => p.category === 'chicken' || p.category === 'mutton')
    .map(p => `${p.emoji} ${p.name}: ₹${p.price}/kg`).join('   ·   ');
  tickerScroll.textContent = text + '      ' + text;
}

// ── Category chips ────────────────────────────────────────────
document.querySelectorAll('.cat-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.dataset.cat;
    renderProducts();
  });
});

// ── Search ────────────────────────────────────────────────────
searchInput.addEventListener('input', renderProducts);

// ── Cart ──────────────────────────────────────────────────────
function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  cart[id] = { ...p, qty: 1 };
  updateCartBar();
  renderProducts();
  showToast(`${p.name} added ✓`, 'success');
}

function increaseQty(id) {
  if (cart[id]) { cart[id].qty++; updateCartBar(); renderProducts(); }
}

function decreaseQty(id) {
  if (cart[id]) {
    cart[id].qty--;
    if (cart[id].qty <= 0) delete cart[id];
    updateCartBar();
    renderProducts();
  }
}

function getTotal() {
  return Object.values(cart).reduce((s, i) => s + i.price * i.qty, 0);
}
function getCount() {
  return Object.values(cart).reduce((s, i) => s + i.qty, 0);
}

function updateCartBar() {
  const count = getCount();
  if (count === 0) {
    cartBar.style.display = 'none';
    document.body.classList.remove('cart-visible');
    return;
  }
  cartBar.style.display = 'flex';
  document.body.classList.add('cart-visible');
  cartCount.textContent = `${count} item${count > 1 ? 's' : ''}`;
  cartTotal.textContent = `₹${getTotal()}`;
  cartBarBtn.innerHTML  = `View Order · <span id="cartTotal">₹${getTotal()}</span> →`;
}

// ── Modal ─────────────────────────────────────────────────────
cartBarBtn.addEventListener('click', openOrderModal);
modalClose.addEventListener('click', closeOrderModal);
orderModal.addEventListener('click', e => { if (e.target === orderModal) closeOrderModal(); });

function openOrderModal() {
  renderCartItems();
  formTotal.textContent = `₹${getTotal()}`;
  orderModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeOrderModal() {
  orderModal.classList.remove('open');
  document.body.style.overflow = '';
}

function renderCartItems() {
  const items = Object.values(cart);
  cartItemsList.innerHTML = items.map(item => {
    const imgUrl = resolveProductImage(item);
    const imgHtml = `<img class="cart-item-img" src="${imgUrl}" alt="${item.name}" onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${DEFAULT_PRODUCT_IMAGE}';}" />`;
    return `
      <div class="cart-item-row">
        ${imgHtml}
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${item.qty} kg × ₹${item.price}</div>
        </div>
        <div class="cart-item-total">₹${item.qty * item.price}</div>
      </div>`;
  }).join('');
}

// ── Submit Order ──────────────────────────────────────────────
orderForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!validateForm()) return;
  setLoading(true);

  const restaurantName = document.getElementById('restaurantName').value.trim();
  const address        = document.getElementById('address').value.trim();
  const pinCode        = document.getElementById('pinCode').value.trim();
  const phone          = document.getElementById('phone').value.trim();
  const contactName    = document.getElementById('contactName').value.trim();
  const deliverySlot   = document.getElementById('deliverySlot').value;
  const orderNote      = document.getElementById('orderNote').value.trim();
  const totalAmount    = getTotal();

  const items = Object.values(cart).map(i => ({
    productId: i.id, productName: i.name, emoji: i.emoji,
    imageUrl: resolveProductImage(i),
    unit: i.unit, pricePerUnit: i.price, qty: i.qty, subtotal: i.price * i.qty,
  }));

  const orderData = {
    restaurantName, address, pinCode, phone,
    contactName: contactName || null,
    deliverySlot,
    orderNote:   orderNote   || null,
    items, totalAmount,
    couponApplied: activeCoupon ? activeCoupon.code : null,
    status:        'pending',
    paidAmount:    0,
    dueAmount:     totalAmount,
    paymentStatus: 'unpaid',
    createdAt:     firebase.firestore.FieldValue.serverTimestamp(),
    date:          getToday(),
  };

  try {
    const docRef = await db.collection('orders').add(orderData);
    await updateDailyStats(totalAmount);
    confirmPhone.textContent   = phone;
    confirmOrderId.textContent = docRef.id;
    closeOrderModal();
    successOverlay.style.display = 'flex';
    cart = {};
    orderForm.reset();
    updateCartBar();
    renderProducts();
  } catch (err) {
    console.error(err);
    showToast('Order failed. Try again.', 'error');
  } finally {
    setLoading(false);
  }
});

async function updateDailyStats(amount) {
  const statsRef = db.collection('dailyStats').doc(getToday());
  try {
    await db.runTransaction(async tx => {
      const doc = await tx.get(statsRef);
      if (doc.exists) {
        tx.update(statsRef, {
          orderCount:   firebase.firestore.FieldValue.increment(1),
          totalRevenue: firebase.firestore.FieldValue.increment(amount),
        });
      } else {
        tx.set(statsRef, { date: getToday(), orderCount: 1, totalRevenue: amount });
      }
    });
  } catch(e) { console.warn(e); }
}

// ── Validation ────────────────────────────────────────────────
function validateForm() {
  if (!getCount()) { showToast('Cart is empty!', 'error'); return false; }
  let valid = true;
  const rules = [
    { id: 'restaurantName', msg: 'Restaurant name required' },
    { id: 'address',        msg: 'Address required' },
    { id: 'pinCode',        msg: 'Valid 6-digit pin required', re: /^\d{6}$/ },
    { id: 'phone',          msg: 'Valid 10-digit phone required', re: /^\d{10}$/ },
  ];
  rules.forEach(r => {
    const el = document.getElementById(r.id);
    const ok = r.re ? r.re.test(el.value.trim()) : el.value.trim().length > 0;
    el.classList.toggle('error', !ok);
    if (!ok && valid) { showToast(r.msg, 'error'); valid = false; }
  });
  return valid;
}

// ── Helpers ───────────────────────────────────────────────────
function setLoading(on) {
  submitBtn.disabled = on;
  submitText.style.display    = on ? 'none' : 'inline';
  submitSpinner.style.display = on ? 'inline-block' : 'none';
}

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

newOrderBtn.addEventListener('click', () => {
  successOverlay.style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── FAQ Accordions ───────────────────────────────────────────
const faqItems = document.querySelectorAll('.faq-item');
faqItems.forEach(item => {
  const question = item.querySelector('.faq-question');
  const answer = item.querySelector('.faq-answer');
  if (!question || !answer) return;

  question.addEventListener('click', () => {
    const isOpen = item.classList.contains('active');

    faqItems.forEach(other => {
      other.classList.remove('active');
      const otherAnswer = other.querySelector('.faq-answer');
      if (otherAnswer) otherAnswer.style.maxHeight = '0px';
    });

    if (!isOpen) {
      item.classList.add('active');
      answer.style.maxHeight = `${answer.scrollHeight}px`;
    }
  });
});

// ── Init ──────────────────────────────────────────────────────
loadProducts();
