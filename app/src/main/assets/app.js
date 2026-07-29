// ============================================================
// FSS-CAISSE-SALON Mobile — stockage 100% local (aucun serveur, aucun internet)
// ============================================================

const DEFAULT_CONFIG = {
  name: 'FSS-CAISSE-SALON',
  address: '',
  phone: '',
  footer: 'Merci pour votre visite, à très vite !',
  currency: 'FCFA',
  ticketCounter: 1,
  loyaltyReward1Id: null,
  loyaltyReward2Id: null,
};

const state = {
  config: { ...DEFAULT_CONFIG },
  staff: [],
  categories: ['Général'],
  services: [],
  sales: [],
  clients: [],
  users: [],
  timeEntries: [],
  payrollEntries: [],
  withdrawals: [],
  caisseOpenings: [],
  cart: [],
  selectedStaffId: null,
  clientName: '',
  currentUser: null,
  view: 'caisse',
  currentCategory: 'Tous',
  searchQuery: '',
  paieMonth: null,
  bilanFrom: null,
  bilanTo: null,
  bilanStaffFilter: 'all',
  clotureFrom: null,
  clotureTo: null,
  reglagesSection: 'general',
};

// ---------- Utilitaires ----------
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fmt(n) { return (n || 0).toLocaleString('fr-FR') + ' ' + state.config.currency; }
function cartTotal() { return state.cart.reduce((s, i) => s + i.price * i.qty, 0); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStr() { return new Date().toISOString().slice(0, 7); }
function monthLabel(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
function fmtDate(iso) { return new Date(iso).toLocaleDateString('fr-FR'); }
function fmtDateTime(iso) { return new Date(iso).toLocaleString('fr-FR'); }

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- Stockage local (localStorage) ----------
function load() {
  try {
    const raw = localStorage.getItem('fss-caisse-mobile');
    if (raw) {
      const data = JSON.parse(raw);
      state.config = { ...DEFAULT_CONFIG, ...(data.config || {}) };
      state.staff = data.staff || [];
      state.categories = data.categories && data.categories.length ? data.categories : ['Général'];
      state.services = data.services || [];
      state.sales = data.sales || [];
      state.clients = data.clients || [];
      state.users = data.users || [];
      state.timeEntries = data.timeEntries || [];
      state.payrollEntries = data.payrollEntries || [];
      state.withdrawals = data.withdrawals || [];
      state.caisseOpenings = data.caisseOpenings || [];
    }
  } catch (e) { /* première utilisation */ }
}

function save() {
  localStorage.setItem('fss-caisse-mobile', JSON.stringify({
    config: state.config,
    staff: state.staff,
    categories: state.categories,
    services: state.services,
    sales: state.sales,
    clients: state.clients,
    users: state.users,
    timeEntries: state.timeEntries,
    payrollEntries: state.payrollEntries,
    withdrawals: state.withdrawals,
    caisseOpenings: state.caisseOpenings,
  }));
}

async function ensureSuperAdmin() {
  if (state.users.some((u) => u.username === 'BITOME')) return;
  const passwordHash = await sha256Hex('Chrisrelamour24');
  state.users.push({ id: uid(), username: 'BITOME', passwordHash, role: 'Super Admin', staffId: null, active: true, protected: true });
  save();
}

// ---------- Modale générique ----------
function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('active');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});

// ============================================================
// CONNEXION
// ============================================================
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('login-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const user = state.users.find((u) => u.username.toLowerCase() === username.toLowerCase() && u.active !== false);
  if (!user) { errorEl.textContent = 'Utilisateur ou mot de passe incorrect.'; return; }
  const hash = await sha256Hex(password);
  if (hash !== user.passwordHash) { errorEl.textContent = 'Utilisateur ou mot de passe incorrect.'; return; }
  state.currentUser = user;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('drawer-user').textContent = user.username;
  document.getElementById('drawer-role').textContent = user.role;
  switchView('caisse');
}

document.getElementById('logout-btn').addEventListener('click', () => {
  state.currentUser = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
});

// ============================================================
// MENU LATÉRAL
// ============================================================
document.getElementById('menu-btn').addEventListener('click', () => document.getElementById('drawer-overlay').classList.add('active'));
document.getElementById('drawer-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'drawer-overlay') document.getElementById('drawer-overlay').classList.remove('active');
});
document.querySelectorAll('.drawer-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    switchView(btn.dataset.view);
    document.getElementById('drawer-overlay').classList.remove('active');
  });
});

function switchView(view) {
  state.view = view;
  document.querySelectorAll('.drawer-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const titles = {
    caisse: 'Caisse', fidelite: 'Fidélité', historique: 'Historique', prestations: 'Prestations',
    personnel: 'Personnel', utilisateurs: 'Utilisateurs', pointage: 'Pointage', paie: 'Paie',
    bilan: 'Bilan', cloture: 'Clôture', reglages: 'Réglages',
  };
  document.getElementById('topbar-title').textContent = titles[view] || '';
  const renderers = {
    caisse: renderCaisse, fidelite: renderFidelite, historique: renderHistorique, prestations: renderPrestations,
    personnel: renderPersonnel, utilisateurs: renderUtilisateurs, pointage: renderPointage, paie: renderPaie,
    bilan: renderBilan, cloture: renderCloture, reglages: renderReglages,
  };
  (renderers[view] || renderCaisse)();
}

// ============================================================
// CAISSE
// ============================================================
function renderCaisse() {
  const el = document.getElementById('view');
  const opening = state.caisseOpenings.find((o) => o.date === todayStr());
  const isCashier = ['Caissier', 'Caissière'].includes(state.currentUser.role);
  if (isCashier && !opening) { renderOuvertureCaisse(); return; }

  const cats = ['Tous', ...state.categories];
  el.innerHTML = `
    <div class="search-bar">
      <span>🔍</span>
      <input type="text" id="caisse-search" placeholder="Rechercher une prestation..." value="${state.searchQuery}">
    </div>
    <div class="pill-row" id="cat-pills">
      ${cats.map((c) => `<button class="pill ${state.currentCategory === c ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('')}
    </div>
    <div class="services-grid" id="services-grid"></div>
    <button id="cart-fab"><span id="cart-fab-label"></span><span>Voir le panier →</span></button>
  `;
  document.getElementById('caisse-search').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderServicesGrid();
  });
  document.querySelectorAll('#cat-pills [data-cat]').forEach((b) => {
    b.addEventListener('click', () => { state.currentCategory = b.dataset.cat; renderCaisse(); });
  });
  document.getElementById('cart-fab').addEventListener('click', openCheckoutModal);
  renderServicesGrid();
  updateCartFab();
}

function renderOuvertureCaisse() {
  const el = document.getElementById('view');
  el.innerHTML = `
    <div style="text-align:center; padding:30px 10px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:6px;">Ouverture de caisse</div>
      <p style="font-size:12.5px; color:var(--muted); margin-bottom:18px;">Indiquez le fond de caisse pour commencer la journée.</p>
      <div class="field"><label>Montant en caisse</label><input type="text" id="opening-amount" inputmode="numeric" placeholder="0"></div>
      <button class="btn" id="opening-confirm" style="margin-bottom:10px;">Ouvrir la caisse</button>
      <button class="btn secondary" id="opening-empty">La caisse est vide</button>
    </div>
  `;
  document.getElementById('opening-amount').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); });
  document.getElementById('opening-confirm').addEventListener('click', () => {
    const amount = Number(document.getElementById('opening-amount').value) || 0;
    openCaisse(amount, false);
  });
  document.getElementById('opening-empty').addEventListener('click', () => openCaisse(0, true));
}

function openCaisse(amount, isEmpty) {
  state.caisseOpenings = state.caisseOpenings.filter((o) => o.date !== todayStr());
  state.caisseOpenings.push({ date: todayStr(), amount, isEmpty, openedBy: state.currentUser.username });
  save();
  renderCaisse();
}

function renderServicesGrid() {
  const el = document.getElementById('services-grid');
  if (!el) return;
  let list = state.services;
  if (state.currentCategory !== 'Tous') list = list.filter((s) => s.category === state.currentCategory);
  const q = state.searchQuery.toLowerCase().trim();
  if (q) list = list.filter((s) => s.name.toLowerCase().includes(q));

  if (state.services.length === 0) {
    el.innerHTML = `<p class="empty-state">Aucune prestation. Ajoutez-en depuis l'onglet "Prestations".</p>`;
    return;
  }
  if (list.length === 0) {
    el.innerHTML = `<p class="empty-state">Aucun résultat.</p>`;
    return;
  }
  el.innerHTML = list.map((s) => `
    <button class="service-card" data-add="${s.id}">
      <div class="name">${s.name}</div>
      <div class="price">${fmt(s.price)}</div>
    </button>
  `).join('');
  el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addToCart(b.dataset.add)));
}

function addToCart(serviceId) {
  const service = state.services.find((s) => s.id === serviceId);
  if (!service) return;
  const existing = state.cart.find((i) => i.service_id === serviceId);
  if (existing) existing.qty += 1;
  else state.cart.push({ service_id: serviceId, name: service.name, price: service.price, qty: 1 });
  updateCartFab();
}

function updateCartFab() {
  const fab = document.getElementById('cart-fab');
  if (!fab) return;
  const count = state.cart.reduce((s, i) => s + i.qty, 0);
  if (count > 0) {
    fab.classList.add('active');
    document.getElementById('cart-fab-label').textContent = `🛒 ${count} · ${fmt(cartTotal())}`;
  } else {
    fab.classList.remove('active');
  }
}

function openCheckoutModal() {
  renderCheckoutModal('cart');
}

function renderCheckoutModal(step) {
  if (state.cart.length === 0) { closeModal(); return; }
  const total = cartTotal();

  if (step === 'cart') {
    openModal(`
      <h3>Panier</h3>
      <div id="cart-list">${state.cart.map((it, idx) => `
        <div class="cart-item">
          <div><strong>${it.name}</strong><div style="color:var(--muted); font-size:11px;">${fmt(it.price)}</div></div>
          <div class="qty-controls">
            <button class="qty-btn" data-dec="${idx}">−</button>
            <span>${it.qty}</span>
            <button class="qty-btn" data-inc="${idx}">+</button>
          </div>
        </div>
      `).join('')}</div>
      <div class="field">
        <label>Coiffeur / Esthéticien</label>
        <select id="staff-select">
          <option value="">— Sélectionner —</option>
          ${state.staff.map((s) => `<option value="${s.id}" ${state.selectedStaffId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Nom du client (optionnel)</label>
        <input type="text" id="client-name" value="${state.clientName}">
      </div>
      <div class="total-row"><span>Total</span><span>${fmt(total)}</span></div>
      <div class="modal-actions">
        <button class="btn secondary" id="cart-cancel">Fermer</button>
        <button class="btn" id="cart-next">Encaisser</button>
      </div>
    `);
    document.querySelectorAll('[data-inc]').forEach((b) => b.addEventListener('click', () => { state.cart[b.dataset.inc].qty += 1; renderCheckoutModal('cart'); updateCartFab(); }));
    document.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', () => {
      const idx = Number(b.dataset.dec);
      state.cart[idx].qty -= 1;
      if (state.cart[idx].qty <= 0) state.cart.splice(idx, 1);
      renderCheckoutModal('cart'); updateCartFab();
    }));
    document.getElementById('cart-cancel').addEventListener('click', closeModal);
    document.getElementById('staff-select').addEventListener('change', (e) => { state.selectedStaffId = e.target.value || null; });
    document.getElementById('client-name').addEventListener('input', (e) => { state.clientName = e.target.value; });
    document.getElementById('cart-next').addEventListener('click', () => {
      if (state.cart.length === 0) return;
      renderCheckoutModal('payment');
    });
    return;
  }

  let selectedMethod = 'especes';
  openModal(`
    <h3>Encaissement</h3>
    <div class="field">
      <label>Mode de paiement</label>
      <div style="display:flex; gap:6px;" id="payment-methods">
        <button type="button" class="btn secondary small" data-method="especes" style="flex:1;">Espèces</button>
        <button type="button" class="btn secondary small" data-method="carte" style="flex:1;">Carte</button>
      </div>
    </div>
    <div id="payment-fields"></div>
    <div class="total-row"><span>Total</span><span>${fmt(total)}</span></div>
    <div class="modal-actions">
      <button class="btn secondary" id="pay-back">Retour</button>
      <button class="btn" id="pay-confirm" disabled>Valider et imprimer</button>
    </div>
  `);

  function renderFields() {
    document.querySelectorAll('#payment-methods [data-method]').forEach((b) => {
      b.style.background = b.dataset.method === selectedMethod ? 'var(--red)' : '';
      b.style.color = b.dataset.method === selectedMethod ? '#fff' : '';
    });
    const el = document.getElementById('payment-fields');
    const confirmBtn = document.getElementById('pay-confirm');
    if (selectedMethod === 'especes') {
      el.innerHTML = `
        <div class="field"><label>Montant reçu</label><input type="text" id="cash-received" inputmode="numeric" placeholder="0"></div>
        <div class="quickpad" id="quickpad"></div>
        <p class="warning-text" id="cash-warning"></p>
      `;
      const bills = [500, 1000, 2000, 5000, 10000, 20000];
      document.getElementById('quickpad').innerHTML = [
        ...bills.map((b) => `<button type="button" class="btn secondary small" data-add="${b}">+${b.toLocaleString('fr-FR')}</button>`),
        `<button type="button" class="btn secondary small" id="cash-exact">Exact</button>`,
      ].join('');
      const input = document.getElementById('cash-received');
      const warn = document.getElementById('cash-warning');
      function check() {
        const received = Number(input.value) || 0;
        if (!input.value) { confirmBtn.disabled = true; warn.textContent = ''; }
        else if (received < total) { confirmBtn.disabled = true; warn.textContent = `⚠️ Il manque ${fmt(total - received)}.`; }
        else { confirmBtn.disabled = false; warn.textContent = ''; }
      }
      document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { input.value = (Number(input.value) || 0) + Number(b.dataset.add); check(); }));
      document.getElementById('cash-exact').addEventListener('click', () => { input.value = total; check(); });
      input.addEventListener('input', () => { input.value = input.value.replace(/[^0-9]/g, ''); check(); });
      confirmBtn.disabled = true;
    } else {
      el.innerHTML = `<p style="font-size:12px; color:var(--muted);">Encaissez sur votre TPE, puis validez ici.</p>`;
      confirmBtn.disabled = false;
    }
  }
  document.querySelectorAll('#payment-methods [data-method]').forEach((b) => b.addEventListener('click', () => { selectedMethod = b.dataset.method; renderFields(); }));
  renderFields();
  document.getElementById('pay-back').addEventListener('click', () => renderCheckoutModal('cart'));
  document.getElementById('pay-confirm').addEventListener('click', () => {
    const cashReceived = selectedMethod === 'especes' ? Number(document.getElementById('cash-received').value) || 0 : total;
    const paymentLabel = selectedMethod === 'especes' ? 'Espèces' : 'Carte';
    finalizeSale(paymentLabel, cashReceived);
  });
}

function finalizeSale(paymentLabel, cashReceived) {
  const staffMember = state.staff.find((s) => s.id === state.selectedStaffId);
  const total = cartTotal();
  const sale = {
    id: uid(),
    number: state.config.ticketCounter,
    date: new Date().toISOString(),
    items: state.cart.map((i) => ({ ...i })),
    staffId: state.selectedStaffId,
    staffName: staffMember ? staffMember.name : '',
    clientName: state.clientName,
    payment: paymentLabel,
    cashReceived,
    total,
    cashierUsername: state.currentUser.username,
  };
  state.sales.unshift(sale);
  state.config.ticketCounter += 1;
  save();
  closeModal();
  printReceipt(sale);
  state.cart = [];
  state.selectedStaffId = null;
  state.clientName = '';
  renderCaisse();
}

// ---------- Impression 58mm via le pont Android ----------
function print58mm(bodyHtml) {
  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page { size: 58mm auto; margin: 2mm; }
      body { width: 54mm; font-family: 'Consolas', monospace; font-size: 11px; color:#000; margin:0; padding:2mm; }
      .center { text-align:center; }
      .dashed { border-top: 1px dashed #000; margin: 5px 0; }
      .line { display:flex; justify-content:space-between; gap:6px; }
      .bold { font-weight:700; }
    </style></head><body>${bodyHtml}</body></html>
  `;
  if (window.AndroidPrint && window.AndroidPrint.printHtml) {
    window.AndroidPrint.printHtml(html);
  } else {
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  }
}

function buildReceiptBody(sale) {
  const c = state.config;
  const change = Math.max(0, (sale.cashReceived || 0) - sale.total);
  return `
    <div class="center bold">${c.name}</div>
    ${c.address ? `<div class="center">${c.address}</div>` : ''}
    ${c.phone ? `<div class="center">${c.phone}</div>` : ''}
    <div class="dashed"></div>
    <div class="line"><span>Ticket #${sale.number}</span></div>
    <div>${new Date(sale.date).toLocaleString('fr-FR')}</div>
    <div>Coiffeur(se): ${sale.staffName || '—'}</div>
    <div class="dashed"></div>
    ${sale.items.map((it) => `<div class="line"><span>${it.name} x${it.qty}</span><span>${fmt(it.price * it.qty)}</span></div>`).join('')}
    <div class="dashed"></div>
    <div class="line bold"><span>TOTAL</span><span>${fmt(sale.total)}</span></div>
    <div>Paiement: ${sale.payment}</div>
    ${sale.payment === 'Espèces' ? `
      <div class="line"><span>Reçu</span><span>${fmt(sale.cashReceived)}</span></div>
      <div class="line"><span>Rendu</span><span>${fmt(change)}</span></div>
    ` : ''}
    <div class="dashed"></div>
    <div class="center">${c.footer || ''}</div>
  `;
}
function printReceipt(sale) { print58mm(buildReceiptBody(sale)); }

// ============================================================
// PRESTATIONS
// ============================================================
function renderPrestations() {
  const el = document.getElementById('view');
  el.innerHTML = `
    <div style="display:flex; gap:8px; margin-bottom:14px;">
      <button class="btn secondary small" id="cats-btn" style="flex:1;">🏷️ Catégories</button>
      <button class="btn small" id="new-service-btn" style="flex:1;">+ Prestation</button>
    </div>
    <div id="services-list"></div>
  `;
  document.getElementById('cats-btn').addEventListener('click', openCategoriesModal);
  document.getElementById('new-service-btn').addEventListener('click', () => openServiceModal(null));
  renderServicesList();
}

function renderServicesList() {
  const el = document.getElementById('services-list');
  if (state.services.length === 0) { el.innerHTML = `<p class="empty-state">Aucune prestation pour le moment.</p>`; return; }
  el.innerHTML = state.categories.map((cat) => {
    const list = state.services.filter((s) => s.category === cat);
    if (!list.length) return '';
    return `
      <h2>${cat}</h2>
      <div class="list-box">${list.map((s) => `
        <div class="list-row">
          <div><strong>${s.name}</strong><div style="font-size:11px; color:var(--muted);">${fmt(s.price)}</div></div>
          <div>
            <button class="icon-btn gold" data-edit="${s.id}">✎</button>
            <button class="icon-btn danger" data-del="${s.id}">🗑</button>
          </div>
        </div>
      `).join('')}</div>
    `;
  }).join('');
  el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openServiceModal(b.dataset.edit)));
  el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Supprimer cette prestation ?')) return;
    state.services = state.services.filter((s) => s.id !== b.dataset.del);
    save();
    renderServicesList();
  }));
}

function openServiceModal(id) {
  const s = id ? state.services.find((x) => x.id === id) : null;
  openModal(`
    <h3>${s ? 'Modifier' : 'Nouvelle'} prestation</h3>
    <div class="field"><label>Nom</label><input type="text" id="sv-name" value="${s ? s.name : ''}"></div>
    <div class="field"><label>Prix</label><input type="text" id="sv-price" inputmode="numeric" value="${s ? s.price : ''}"></div>
    <div class="field"><label>Catégorie</label>
      <select id="sv-cat">${state.categories.map((c) => `<option ${s && s.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
    </div>
    <div class="modal-actions">
      <button class="btn secondary" id="sv-cancel">Annuler</button>
      <button class="btn" id="sv-save">Enregistrer</button>
    </div>
  `);
  document.getElementById('sv-price').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); });
  document.getElementById('sv-cancel').addEventListener('click', closeModal);
  document.getElementById('sv-save').addEventListener('click', () => {
    const name = document.getElementById('sv-name').value.trim();
    const price = Number(document.getElementById('sv-price').value) || 0;
    const category = document.getElementById('sv-cat').value;
    if (!name || !price) return;
    if (s) { s.name = name; s.price = price; s.category = category; }
    else state.services.push({ id: uid(), name, price, category });
    save();
    closeModal();
    renderServicesList();
  });
}

function openCategoriesModal() {
  openModal(`
    <h3>Catégories</h3>
    <div id="cats-list" style="margin-bottom:12px;">
      ${state.categories.map((c) => `
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <input type="text" data-cat-old="${c}" value="${c}">
          <button class="icon-btn danger" data-cat-del="${c}">🗑</button>
        </div>
      `).join('')}
    </div>
    <div style="display:flex; gap:8px;">
      <input type="text" id="new-cat" placeholder="Nouvelle catégorie">
      <button class="btn small" id="add-cat">+</button>
    </div>
    <div class="modal-actions"><button class="btn secondary" id="cats-close" style="width:100%;">Fermer</button></div>
  `);
  document.getElementById('cats-close').addEventListener('click', () => { closeModal(); renderServicesList(); });
  document.querySelectorAll('[data-cat-old]').forEach((input) => {
    input.addEventListener('blur', () => {
      const oldName = input.dataset.catOld;
      const newName = input.value.trim();
      if (newName && newName !== oldName) {
        state.categories = state.categories.map((c) => (c === oldName ? newName : c));
        state.services.forEach((s) => { if (s.category === oldName) s.category = newName; });
        save();
        openCategoriesModal();
      }
    });
  });
  document.querySelectorAll('[data-cat-del]').forEach((b) => b.addEventListener('click', () => {
    const cat = b.dataset.catDel;
    if (state.categories.length <= 1) { alert('Il doit rester au moins une catégorie.'); return; }
    state.categories = state.categories.filter((c) => c !== cat);
    state.services.forEach((s) => { if (s.category === cat) s.category = state.categories[0]; });
    save();
    openCategoriesModal();
  }));
  document.getElementById('add-cat').addEventListener('click', () => {
    const name = document.getElementById('new-cat').value.trim();
    if (!name || state.categories.includes(name)) return;
    state.categories.push(name);
    save();
    openCategoriesModal();
  });
}

// ============================================================
// PERSONNEL
// ============================================================
function renderPersonnel() {
  const el = document.getElementById('view');
  el.innerHTML = `
    <button class="btn small" id="new-staff-btn" style="margin-bottom:14px;">+ Nouvel(le) employé(e)</button>
    <div id="staff-list"></div>
  `;
  document.getElementById('new-staff-btn').addEventListener('click', () => openStaffModal(null));
  renderStaffList();
}

function renderStaffList() {
  const el = document.getElementById('staff-list');
  if (state.staff.length === 0) { el.innerHTML = `<p class="empty-state">Aucun employé pour le moment.</p>`; return; }
  el.innerHTML = `<div class="list-box">${state.staff.map((s) => `
    <div class="list-row">
      <div><strong>${s.name}</strong><div style="font-size:11px; color:var(--muted);">${s.poste || '—'} ${s.salaireBase ? '· ' + fmt(s.salaireBase) : ''}</div></div>
      <div>
        <button class="icon-btn gold" data-edit="${s.id}">✎</button>
        <button class="icon-btn danger" data-del="${s.id}">🗑</button>
      </div>
    </div>
  `).join('')}</div>`;
  el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openStaffModal(b.dataset.edit)));
  el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Retirer cet(te) employé(e) ?')) return;
    state.staff = state.staff.filter((s) => s.id !== b.dataset.del);
    save();
    renderStaffList();
  }));
}

function openStaffModal(id) {
  const s = id ? state.staff.find((x) => x.id === id) : null;
  openModal(`
    <h3>${s ? 'Modifier' : 'Nouvel(le)'} employé(e)</h3>
    <div class="field"><label>Nom complet</label><input type="text" id="st-name" value="${s ? s.name : ''}"></div>
    <div class="field"><label>Poste occupé</label><input type="text" id="st-poste" value="${s ? (s.poste || '') : ''}"></div>
    <div class="field"><label>Salaire brut mensuel</label><input type="text" id="st-salaire" inputmode="numeric" value="${s ? (s.salaireBase || '') : ''}"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="st-cancel">Annuler</button>
      <button class="btn" id="st-save">Enregistrer</button>
    </div>
  `);
  document.getElementById('st-salaire').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); });
  document.getElementById('st-cancel').addEventListener('click', closeModal);
  document.getElementById('st-save').addEventListener('click', () => {
    const name = document.getElementById('st-name').value.trim();
    const poste = document.getElementById('st-poste').value.trim();
    const salaireBase = Number(document.getElementById('st-salaire').value) || 0;
    if (!name) return;
    if (s) { s.name = name; s.poste = poste; s.salaireBase = salaireBase; }
    else state.staff.push({ id: uid(), name, poste, salaireBase });
    save();
    closeModal();
    renderStaffList();
  });
}

// ============================================================
// HISTORIQUE
// ============================================================
function renderHistorique() {
  const el = document.getElementById('view');
  if (state.sales.length === 0) { el.innerHTML = `<p class="empty-state">Aucune vente enregistrée.</p>`; return; }
  el.innerHTML = `<div class="list-box">${state.sales.map((t) => `
    <div class="list-row">
      <div>
        <strong>Ticket #${t.number}</strong>
        <div style="font-size:11px; color:var(--muted);">${fmtDateTime(t.date)} · ${t.staffName || '—'}</div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-family:'Consolas',monospace; font-weight:700;">${fmt(t.total)}</span>
        <button class="icon-btn gold" data-print="${t.id}">🖨️</button>
      </div>
    </div>
  `).join('')}</div>`;
  el.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => {
    const sale = state.sales.find((s) => s.id === b.dataset.print);
    if (sale) printReceipt(sale);
  }));
}

// ============================================================
// FIDÉLITÉ
// ============================================================
function renderFidelite() {
  const el = document.getElementById('view');
  el.innerHTML = `
    <button class="btn small" id="new-client-btn" style="margin-bottom:14px;">+ Nouveau client</button>
    <div class="search-bar"><span>🔍</span><input type="text" id="client-search" placeholder="Rechercher..."></div>
    <div id="client-list"></div>
  `;
  document.getElementById('new-client-btn').addEventListener('click', openNewClientModal);
  document.getElementById('client-search').addEventListener('input', renderClientList);
  renderClientList();
}

function renderClientList() {
  const q = (document.getElementById('client-search').value || '').toLowerCase().trim();
  const filtered = state.clients.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));
  const el = document.getElementById('client-list');
  if (filtered.length === 0) { el.innerHTML = `<p class="empty-state">Aucun client.</p>`; return; }
  el.innerHTML = `<div class="list-box">${filtered.map((c) => `
    <div class="list-row" data-client="${c.id}">
      <div><strong>${c.name}</strong>${c.phone ? `<div style="font-size:11px; color:var(--muted);">📞 ${c.phone}</div>` : ''}</div>
    </div>
  `).join('')}</div>`;
  el.querySelectorAll('[data-client]').forEach((row) => row.addEventListener('click', () => openClientDetail(row.dataset.client)));
}

function openNewClientModal() {
  openModal(`
    <h3>Nouveau client</h3>
    <div class="field"><label>Nom</label><input type="text" id="nc-name"></div>
    <div class="field"><label>Téléphone</label><input type="text" id="nc-phone"></div>
    <div class="modal-actions"><button class="btn secondary" id="nc-cancel">Annuler</button><button class="btn" id="nc-save">Créer</button></div>
  `);
  document.getElementById('nc-cancel').addEventListener('click', closeModal);
  document.getElementById('nc-save').addEventListener('click', () => {
    const name = document.getElementById('nc-name').value.trim();
    if (!name) return;
    const client = { id: uid(), name, phone: document.getElementById('nc-phone').value.trim(), redeemedCycles: 0, rewardHistory: [] };
    state.clients.push(client);
    save();
    closeModal();
    renderClientList();
    openClientDetail(client.id);
  });
}

function openClientDetail(id) {
  const c = state.clients.find((x) => x.id === id);
  const history = state.sales.filter((t) => (t.clientName || '').toLowerCase() === c.name.toLowerCase());
  const visits = history.length;
  const totalSpent = history.reduce((s, t) => s + t.total, 0);
  const totalCycles = Math.floor(visits / 10);
  const available = Math.max(0, totalCycles - (c.redeemedCycles || 0));
  const stamps = available > 0 ? 10 : visits % 10;
  const reward1 = state.services.find((s) => s.id === state.config.loyaltyReward1Id);
  const reward2 = state.services.find((s) => s.id === state.config.loyaltyReward2Id);

  openModal(`
    <h3>${c.name}</h3>
    <div style="background:#0D0D0D; border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; font-size:10.5px; text-transform:uppercase; color:var(--muted); margin-bottom:6px;">
        <span>🏅 Carte de fidélité</span><span>${stamps}/10</span>
      </div>
      <div class="stamp-row">${Array.from({ length: 10 }).map((_, i) => `<div class="stamp ${i < stamps ? 'filled' : ''}">✂</div>`).join('')}</div>
      ${available > 0
        ? (reward1 && reward2 ? `<div class="reward-banner">🎉 Récompense débloquée ! <button class="btn small" id="claim-reward">Choisir</button></div>`
          : `<p style="font-size:11.5px; color:var(--muted);">Configurez les prestations offertes dans Réglages.</p>`)
        : `<p style="font-size:11.5px; color:var(--muted);">Encore ${10 - stamps} visite(s) avant la prochaine récompense.</p>`}
    </div>
    <div class="kpi-grid">
      <div class="kpi-card"><div class="k-label">Visites</div><div class="k-value">${visits}</div></div>
      <div class="kpi-card"><div class="k-label">Total dépensé</div><div class="k-value" style="font-size:13px; color:#7E9B76;">${fmt(totalSpent)}</div></div>
    </div>
    <div class="modal-actions">
      <button class="btn secondary" id="client-del" style="color:var(--danger);">Supprimer</button>
      <button class="btn secondary" id="client-close">Fermer</button>
    </div>
  `);
  document.getElementById('client-close').addEventListener('click', closeModal);
  document.getElementById('client-del').addEventListener('click', () => {
    if (!confirm('Supprimer ce client ?')) return;
    state.clients = state.clients.filter((x) => x.id !== id);
    save();
    closeModal();
    renderClientList();
  });
  const claimBtn = document.getElementById('claim-reward');
  if (claimBtn) claimBtn.addEventListener('click', () => openRewardChoiceModal(c, reward1, reward2));
}

function openRewardChoiceModal(client, reward1, reward2) {
  openModal(`
    <h3>10 visites atteintes — Choisissez la récompense</h3>
    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
      ${[reward1, reward2].map((s) => `<button class="service-card" data-choose="${s.id}" style="text-align:left;"><div class="name">${s.name}</div><div class="price">Offert(e)</div></button>`).join('')}
    </div>
  `);
  document.querySelectorAll('[data-choose]').forEach((b) => b.addEventListener('click', () => {
    client.redeemedCycles = (client.redeemedCycles || 0) + 1;
    client.rewardHistory = client.rewardHistory || [];
    client.rewardHistory.push({ date: new Date().toISOString(), serviceId: b.dataset.choose });
    save();
    closeModal();
    renderClientList();
    openClientDetail(client.id);
  }));
}

// ============================================================
// UTILISATEURS
// ============================================================
function renderUtilisateurs() {
  const el = document.getElementById('view');
  el.innerHTML = `
    <button class="btn small" id="new-user-btn" style="margin-bottom:10px;">+ Nouvel utilisateur</button>
    <p style="font-size:11px; color:var(--muted); margin-bottom:14px;">Le compte <strong style="color:var(--red);">BITOME</strong> est protégé.</p>
    <div id="users-list"></div>
  `;
  document.getElementById('new-user-btn').addEventListener('click', openNewUserModal);
  renderUsersList();
}

function renderUsersList() {
  const el = document.getElementById('users-list');
  el.innerHTML = `<div class="list-box">${state.users.map((u) => `
    <div class="list-row">
      <div>
        <strong>${u.protected ? '🛡️ ' : ''}${u.username}</strong>
        <div style="font-size:11px; color:var(--muted);">${u.role} · ${u.active !== false ? 'actif' : 'inactif'}</div>
      </div>
      ${u.protected ? `<span style="font-size:10.5px; color:var(--muted); font-style:italic;">protégé</span>`
        : `<div><button class="icon-btn gold" data-pass="${u.id}">🔑</button><button class="icon-btn danger" data-del="${u.id}">🗑</button></div>`}
    </div>
  `).join('')}</div>`;
  el.querySelectorAll('[data-pass]').forEach((b) => b.addEventListener('click', () => openChangePasswordModal(b.dataset.pass)));
  el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    state.users = state.users.filter((u) => u.id !== b.dataset.del);
    save();
    renderUsersList();
  }));
}

function openNewUserModal() {
  openModal(`
    <h3>Nouvel utilisateur</h3>
    <div class="field"><label>Nom d'utilisateur</label><input type="text" id="nu-username"></div>
    <div class="field"><label>Mot de passe</label><input type="password" id="nu-password"></div>
    <div class="field"><label>Rôle</label>
      <select id="nu-role">
        <option>Administrateur</option><option>Gérant</option><option>Caissier</option><option>Caissière</option><option>Employé</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn secondary" id="nu-cancel">Annuler</button>
      <button class="btn" id="nu-save">Créer</button>
    </div>
  `);
  document.getElementById('nu-cancel').addEventListener('click', closeModal);
  document.getElementById('nu-save').addEventListener('click', async () => {
    const username = document.getElementById('nu-username').value.trim();
    const password = document.getElementById('nu-password').value;
    if (!username || !password) return;
    if (state.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) { alert('Ce nom existe déjà.'); return; }
    const passwordHash = await sha256Hex(password);
    state.users.push({ id: uid(), username, passwordHash, role: document.getElementById('nu-role').value, active: true, protected: false });
    save();
    closeModal();
    renderUsersList();
  });
}

function openChangePasswordModal(id) {
  const u = state.users.find((x) => x.id === id);
  openModal(`
    <h3>Nouveau mot de passe — ${u.username}</h3>
    <div class="field"><label>Mot de passe</label><input type="password" id="cp-password"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="cp-cancel">Annuler</button>
      <button class="btn" id="cp-save">Enregistrer</button>
    </div>
  `);
  document.getElementById('cp-cancel').addEventListener('click', closeModal);
  document.getElementById('cp-save').addEventListener('click', async () => {
    const password = document.getElementById('cp-password').value;
    if (!password) return;
    u.passwordHash = await sha256Hex(password);
    save();
    closeModal();
  });
}

// ============================================================
// POINTAGE
// ============================================================
function renderPointage() {
  const el = document.getElementById('view');
  el.innerHTML = `<div id="pointage-staff-list" class="list-box" style="margin-bottom:16px;"></div>
    <h2>Historique du jour</h2>
    <div id="pointage-today-list" class="list-box"></div>`;
  refreshPointage();
}

function refreshPointage() {
  const staffList = document.getElementById('pointage-staff-list');
  staffList.innerHTML = state.staff.map((s) => {
    const active = state.timeEntries.find((t) => t.staffId === s.id && !t.clockOut);
    return `
      <div class="list-row">
        <div><strong>${s.name}</strong>${active ? `<div style="font-size:11px; color:#7E9B76;">En service depuis ${new Date(active.clockIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>` : `<div style="font-size:11px; color:var(--muted);">Non pointé(e)</div>`}</div>
        ${active ? `<button class="btn small" style="background:var(--danger);" data-out="${active.id}">Départ</button>` : `<button class="btn small" style="background:#7E9B76;" data-in="${s.id}">Arrivée</button>`}
      </div>
    `;
  }).join('');
  staffList.querySelectorAll('[data-in]').forEach((b) => b.addEventListener('click', () => {
    state.timeEntries.push({ id: uid(), staffId: b.dataset.in, clockIn: new Date().toISOString(), clockOut: null });
    save(); refreshPointage();
  }));
  staffList.querySelectorAll('[data-out]').forEach((b) => b.addEventListener('click', () => {
    const entry = state.timeEntries.find((t) => t.id === b.dataset.out);
    if (entry) entry.clockOut = new Date().toISOString();
    save(); refreshPointage();
  }));

  const todayEntries = state.timeEntries.filter((t) => t.clockIn.slice(0, 10) === todayStr());
  const listEl = document.getElementById('pointage-today-list');
  if (todayEntries.length === 0) { listEl.innerHTML = `<p class="empty-state">Aucun pointage aujourd'hui.</p>`; return; }
  listEl.innerHTML = todayEntries.map((t) => {
    const s = state.staff.find((x) => x.id === t.staffId);
    return `<div class="list-row">
      <div><strong>${s ? s.name : '—'}</strong><div style="font-size:11px; color:var(--muted); font-family:'Consolas',monospace;">${new Date(t.clockIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → ${t.clockOut ? new Date(t.clockOut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'en cours'}</div></div>
      <button class="icon-btn danger" data-del="${t.id}">🗑</button>
    </div>`;
  }).join('');
  listEl.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    state.timeEntries = state.timeEntries.filter((t) => t.id !== b.dataset.del);
    save(); refreshPointage();
  }));
}

// ============================================================
// PAIE
// ============================================================
function payrollEntryFor(staffId, month) {
  let entry = state.payrollEntries.find((e) => e.staffId === staffId && e.month === month);
  if (!entry) {
    entry = { staffId, month, absences: 0, heuresRetard: 0, sanction: 0, accompte: 0, produitsFacture: 0 };
    state.payrollEntries.push(entry);
  }
  return entry;
}

function computePayrollRow(staffMember, month) {
  const brut = staffMember.salaireBase || 0;
  const entry = payrollEntryFor(staffMember.id, month);
  const salaireJour = brut / 30;
  const salaireHeure = brut / 240;
  const retenueAbsences = (entry.absences || 0) * salaireJour;
  const retenueRetard = (entry.heuresRetard || 0) * salaireHeure;
  const netAPayer = Math.max(0, brut - retenueAbsences - retenueRetard - (entry.produitsFacture || 0) - (entry.sanction || 0) - (entry.accompte || 0));
  return { staff: staffMember, entry, brut, salaireJour, salaireHeure, retenueAbsences, retenueRetard, netAPayer };
}

function renderPaie() {
  if (!state.paieMonth) state.paieMonth = monthStr();
  const el = document.getElementById('view');
  el.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
      <button class="btn secondary small" id="paie-prev">‹</button>
      <strong style="text-transform:capitalize;">${monthLabel(state.paieMonth)}</strong>
      <button class="btn secondary small" id="paie-next">›</button>
    </div>
    <button class="btn secondary" id="paie-print-btn" style="margin-bottom:14px;">🖨️ Imprimer l'état de paie</button>
    <div class="kpi-grid"><div class="kpi-card" style="grid-column:span 2;"><div class="k-label">Masse salariale (net à payer)</div><div class="k-value" id="paie-total"></div></div></div>
    <div id="paie-rows" class="list-box"></div>
  `;
  document.getElementById('paie-prev').addEventListener('click', () => { shiftMonth(-1); renderPaie(); });
  document.getElementById('paie-next').addEventListener('click', () => { shiftMonth(1); renderPaie(); });
  document.getElementById('paie-print-btn').addEventListener('click', printPaie58mm);
  refreshPaieRows();
}

function shiftMonth(delta) {
  const [y, m] = state.paieMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.paieMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function refreshPaieRows() {
  const rows = state.staff.map((s) => computePayrollRow(s, state.paieMonth));
  state.paieRows = rows;
  const totalNet = rows.reduce((s, r) => s + r.netAPayer, 0);
  document.getElementById('paie-total').textContent = fmt(totalNet);
  document.getElementById('paie-rows').innerHTML = rows.map((r, idx) => `
    <div>
      <div class="list-row" data-toggle="${r.staff.id}">
        <div><strong>${idx + 1}. ${r.staff.name}</strong><div style="font-size:11px; color:var(--muted);">${r.staff.poste || '—'} · ${fmt(r.brut)}</div></div>
        <div style="text-align:right;"><div style="font-weight:700; color:var(--red); font-family:'Consolas',monospace;">${fmt(r.netAPayer)}</div></div>
      </div>
      <div id="paie-detail-${r.staff.id}" style="display:none; padding:12px; border-bottom:1px solid var(--border);"></div>
    </div>
  `).join('');
  document.querySelectorAll('[data-toggle]').forEach((row) => row.addEventListener('click', () => togglePaieDetail(row.dataset.toggle)));
}

function togglePaieDetail(staffId) {
  const el = document.getElementById('paie-detail-' + staffId);
  const opening = el.style.display === 'none';
  document.querySelectorAll('[id^="paie-detail-"]').forEach((d) => d.style.display = 'none');
  if (!opening) return;
  const r = state.paieRows.find((x) => x.staff.id === staffId);
  el.style.display = 'block';
  el.innerHTML = `
    <div class="field"><label>Absences (jours)</label><input type="number" data-field="absences" value="${r.entry.absences || 0}"></div>
    <div class="field"><label>Retard (heures)</label><input type="number" data-field="heuresRetard" value="${r.entry.heuresRetard || 0}"></div>
    <div class="field"><label>Sanction</label><input type="number" data-field="sanction" value="${r.entry.sanction || 0}"></div>
    <div class="field"><label>Accompte</label><input type="number" data-field="accompte" value="${r.entry.accompte || 0}"></div>
    <div class="field"><label>Produits/Facture</label><input type="number" data-field="produitsFacture" value="${r.entry.produitsFacture || 0}"></div>
    <button class="btn secondary small" id="payslip-btn">📄 Bulletin de salaire</button>
  `;
  el.querySelectorAll('[data-field]').forEach((input) => {
    input.addEventListener('change', (e) => {
      r.entry[e.target.dataset.field] = Number(e.target.value) || 0;
      save();
      refreshPaieRows();
      document.getElementById('paie-detail-' + staffId).style.display = 'block';
    });
  });
  document.getElementById('payslip-btn').addEventListener('click', () => printPayslip58mm(r));
}

function printPaie58mm() {
  const c = state.config;
  const rows = state.paieRows;
  const total = rows.reduce((s, r) => s + r.netAPayer, 0);
  print58mm(`
    <div class="center bold">${c.name}</div>
    <div class="dashed"></div>
    <div class="center">ÉTAT DE PAIE</div>
    <div class="center">${monthLabel(state.paieMonth)}</div>
    <div class="dashed"></div>
    ${rows.map((r, i) => `<div class="line"><span>${i + 1}. ${r.staff.name}</span></div><div class="line"><span>${r.staff.poste || '—'}</span><span>${fmt(r.netAPayer)}</span></div>`).join('<div class="dashed"></div>')}
    <div class="dashed"></div>
    <div class="line bold"><span>MASSE SALARIALE</span><span>${fmt(total)}</span></div>
  `);
}

function printPayslip58mm(r) {
  const c = state.config;
  const e = r.entry;
  print58mm(`
    <div class="center bold">${c.name}</div>
    <div class="dashed"></div>
    <div class="center">BULLETIN DE SALAIRE</div>
    <div class="center">${monthLabel(state.paieMonth)}</div>
    <div class="dashed"></div>
    <div class="bold">${r.staff.name}</div>
    <div>${r.staff.poste || '—'}</div>
    <div class="dashed"></div>
    <div class="line"><span>Salaire brut</span><span>${fmt(r.brut)}</span></div>
    <div class="line"><span>Absences (${e.absences || 0}j)</span><span>-${fmt(r.retenueAbsences)}</span></div>
    <div class="line"><span>Retard (${e.heuresRetard || 0}h)</span><span>-${fmt(r.retenueRetard)}</span></div>
    <div class="line"><span>Produits/Facture</span><span>-${fmt(e.produitsFacture || 0)}</span></div>
    <div class="line"><span>Sanction</span><span>-${fmt(e.sanction || 0)}</span></div>
    <div class="line"><span>Accomptes</span><span>-${fmt(e.accompte || 0)}</span></div>
    <div class="dashed"></div>
    <div class="line bold"><span>NET À PAYER</span><span>${fmt(r.netAPayer)}</span></div>
  `);
}

// ============================================================
// BILAN
// ============================================================
function renderBilan() {
  if (!state.bilanFrom) { state.bilanFrom = todayStr(); state.bilanTo = todayStr(); }
  const el = document.getElementById('view');
  el.innerHTML = `
    <div class="pill-row">
      ${[['jour', "Aujourd'hui"], ['semaine', 'Cette semaine'], ['mois', 'Ce mois'], ['annee', 'Cette année']]
        .map(([id, label]) => `<button class="pill" data-preset="${id}">${label}</button>`).join('')}
    </div>
    <div class="filters-row">
      <div class="field"><label>Du</label><input type="date" id="bilan-from" value="${state.bilanFrom}"></div>
      <div class="field"><label>Au</label><input type="date" id="bilan-to" value="${state.bilanTo}"></div>
    </div>
    <div class="field"><label>Collaborateur</label>
      <select id="bilan-staff-filter">
        <option value="all">Tous les collaborateurs</option>
        ${state.staff.map((s) => `<option value="${s.id}" ${state.bilanStaffFilter === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex; gap:8px; margin-bottom:14px;">
      <button class="btn secondary" id="bilan-refresh" style="flex:1;">Actualiser</button>
      <button class="btn" id="bilan-print" style="flex:1;">🖨️ Imprimer</button>
    </div>
    <div id="bilan-chart" class="list-box" style="padding:14px; margin-bottom:14px;"></div>
    <div id="bilan-rows" class="list-box"></div>
  `;
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { setBilanPreset(b.dataset.preset); refreshBilan(); }));
  document.getElementById('bilan-refresh').addEventListener('click', () => {
    state.bilanFrom = document.getElementById('bilan-from').value;
    state.bilanTo = document.getElementById('bilan-to').value;
    state.bilanStaffFilter = document.getElementById('bilan-staff-filter').value;
    refreshBilan();
  });
  document.getElementById('bilan-print').addEventListener('click', printBilan58mm);
  refreshBilan();
}

function setBilanPreset(preset) {
  const now = new Date();
  let from, to;
  if (preset === 'jour') { from = new Date(now); to = new Date(now); }
  else if (preset === 'semaine') {
    const day = now.getDay() === 0 ? 7 : now.getDay();
    from = new Date(now); from.setDate(now.getDate() - (day - 1));
    to = new Date(from); to.setDate(from.getDate() + 6);
  } else if (preset === 'mois') { from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
  else if (preset === 'annee') { from = new Date(now.getFullYear(), 0, 1); to = new Date(now.getFullYear(), 11, 31); }
  state.bilanFrom = from.toISOString().slice(0, 10);
  state.bilanTo = to.toISOString().slice(0, 10);
  document.getElementById('bilan-from').value = state.bilanFrom;
  document.getElementById('bilan-to').value = state.bilanTo;
}

function refreshBilan() {
  const sales = state.sales.filter((t) => t.date.slice(0, 10) >= state.bilanFrom && t.date.slice(0, 10) <= state.bilanTo);
  const byStaff = {};
  state.staff.forEach((s) => byStaff[s.id] = { staff: s, nbTickets: 0, nbServices: 0, ca: 0 });
  sales.forEach((t) => {
    if (!t.staffId || !byStaff[t.staffId]) return;
    byStaff[t.staffId].nbTickets += 1;
    byStaff[t.staffId].nbServices += t.items.reduce((s, i) => s + i.qty, 0);
    byStaff[t.staffId].ca += t.total;
  });
  let rows = Object.values(byStaff).filter((r) => r.nbTickets > 0).sort((a, b) => b.ca - a.ca);
  if (state.bilanStaffFilter && state.bilanStaffFilter !== 'all') rows = rows.filter((r) => r.staff.id === state.bilanStaffFilter);
  state.bilanRows = rows;
  const totalCa = rows.reduce((s, r) => s + r.ca, 0);

  const chartEl = document.getElementById('bilan-chart');
  if (rows.length === 0) { chartEl.innerHTML = ''; }
  else {
    const maxCa = Math.max(...rows.map((r) => r.ca), 1);
    chartEl.innerHTML = rows.map((r) => `
      <div class="chart-bar-row">
        <div class="line"><span>${r.staff.name}</span><strong>${fmt(r.ca)}</strong></div>
        <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.max(2, Math.round((r.ca / maxCa) * 100))}%;"></div></div>
      </div>
    `).join('');
  }

  const el = document.getElementById('bilan-rows');
  el.innerHTML = rows.length
    ? rows.map((r) => `<div class="list-row"><span>${r.staff.name}</span><span>${r.nbTickets} tickets</span><strong>${fmt(r.ca)}</strong></div>`).join('') +
      `<div class="list-row" style="background:#252019;"><strong>Total</strong><span></span><strong>${fmt(totalCa)}</strong></div>`
    : `<p class="empty-state">Aucune donnée sur cette période.</p>`;
}

function printBilan58mm() {
  const c = state.config;
  const rows = state.bilanRows;
  const total = rows.reduce((s, r) => s + r.ca, 0);
  print58mm(`
    <div class="center bold">${c.name}</div>
    <div class="dashed"></div>
    <div class="center">BILAN</div>
    <div class="center">Du ${fmtDate(state.bilanFrom)} au ${fmtDate(state.bilanTo)}</div>
    <div class="dashed"></div>
    ${rows.map((r) => `<div class="line"><span>${r.staff.name}</span></div><div class="line"><span>${r.nbTickets} tickets · ${r.nbServices} prest.</span><span>${fmt(r.ca)}</span></div>`).join('<div class="dashed"></div>')}
    <div class="dashed"></div>
    <div class="line bold"><span>TOTAL CA</span><span>${fmt(total)}</span></div>
  `);
}

// ============================================================
// CLÔTURE
// ============================================================
function renderCloture() {
  if (!state.clotureFrom) { state.clotureFrom = todayStr(); state.clotureTo = todayStr(); }
  const el = document.getElementById('view');
  el.innerHTML = `
    <div class="filters-row">
      <div class="field"><label>Du</label><input type="date" id="cl-from" value="${state.clotureFrom}"></div>
      <div class="field"><label>Au</label><input type="date" id="cl-to" value="${state.clotureTo}"></div>
    </div>
    <div style="display:flex; gap:8px; margin-bottom:14px;">
      <button class="btn secondary" id="cl-refresh" style="flex:1;">Actualiser</button>
      <button class="btn secondary" id="cl-withdrawal" style="flex:1;">💵 Prélèvement</button>
      <button class="btn" id="cl-print" style="flex:1;">🖨️</button>
    </div>
    <div class="kpi-grid" id="cl-kpis"></div>
    <h2>Prélèvements</h2>
    <div id="cl-withdrawals" class="list-box"></div>
  `;
  document.getElementById('cl-refresh').addEventListener('click', () => {
    state.clotureFrom = document.getElementById('cl-from').value;
    state.clotureTo = document.getElementById('cl-to').value;
    refreshCloture();
  });
  document.getElementById('cl-withdrawal').addEventListener('click', openWithdrawalModal);
  document.getElementById('cl-print').addEventListener('click', printCloture58mm);
  refreshCloture();
}

function refreshCloture() {
  const sales = state.sales.filter((t) => t.date.slice(0, 10) >= state.clotureFrom && t.date.slice(0, 10) <= state.clotureTo);
  const withdrawals = state.withdrawals.filter((w) => w.date.slice(0, 10) >= state.clotureFrom && w.date.slice(0, 10) <= state.clotureTo);
  const openings = state.caisseOpenings.filter((o) => o.date >= state.clotureFrom && o.date <= state.clotureTo);
  const totalCa = sales.reduce((s, t) => s + t.total, 0);
  const totalServices = sales.reduce((s, t) => s + t.items.reduce((a, i) => a + i.qty, 0), 0);
  const totalWithdrawals = withdrawals.reduce((s, w) => s + w.amount, 0);
  const fondsOuverture = openings.reduce((s, o) => s + (o.amount || 0), 0);
  const solde = fondsOuverture + totalCa - totalWithdrawals;
  state.clotureData = { sales, withdrawals, totalCa, totalServices, totalWithdrawals, fondsOuverture, solde };

  document.getElementById('cl-kpis').innerHTML = [
    ['Fonds de caisse', fmt(fondsOuverture)], ['Tickets', sales.length],
    ['Recette totale', fmt(totalCa)], ['Prélèvements', fmt(totalWithdrawals)],
    ['Solde en caisse', fmt(solde)],
  ].map(([l, v]) => `<div class="kpi-card"><div class="k-label">${l}</div><div class="k-value">${v}</div></div>`).join('');

  const withdrawBtn = document.getElementById('cl-withdrawal');
  withdrawBtn.disabled = solde <= 0;

  document.getElementById('cl-withdrawals').innerHTML = withdrawals.length
    ? withdrawals.map((w) => `<div class="list-row"><div><span style="color:var(--danger); font-family:'Consolas',monospace;">-${fmt(w.amount)}</span><div style="font-size:10.5px; color:var(--muted);">${w.reason || 'Sans motif'}</div></div><button class="icon-btn danger" data-wdel="${w.id}">🗑</button></div>`).join('')
    : `<p class="empty-state">Aucun prélèvement.</p>`;
  document.querySelectorAll('[data-wdel]').forEach((b) => b.addEventListener('click', () => {
    state.withdrawals = state.withdrawals.filter((w) => w.id !== b.dataset.wdel);
    save(); refreshCloture();
  }));
}

function openWithdrawalModal() {
  const solde = state.clotureData ? state.clotureData.solde : 0;
  openModal(`
    <h3>Nouveau prélèvement</h3>
    <p style="font-size:11.5px; color:var(--muted); margin-bottom:10px;">Solde disponible : <strong>${fmt(solde)}</strong></p>
    <div class="field"><label>Montant</label><input type="text" id="wd-amount" inputmode="numeric"></div>
    <p class="warning-text" id="wd-warning"></p>
    <div class="field"><label>Motif (facultatif)</label><input type="text" id="wd-reason"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="wd-cancel">Annuler</button>
      <button class="btn" id="wd-save">Enregistrer</button>
    </div>
  `);
  const amountInput = document.getElementById('wd-amount');
  const warn = document.getElementById('wd-warning');
  const saveBtn = document.getElementById('wd-save');
  amountInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
    const amount = Number(e.target.value) || 0;
    if (amount > solde) { warn.textContent = `⚠️ Dépasse le solde disponible (${fmt(solde)}).`; saveBtn.disabled = true; }
    else { warn.textContent = ''; saveBtn.disabled = false; }
  });
  document.getElementById('wd-cancel').addEventListener('click', closeModal);
  document.getElementById('wd-save').addEventListener('click', () => {
    const amount = Number(amountInput.value);
    if (!amount || amount > solde) return;
    state.withdrawals.push({ id: uid(), amount, reason: document.getElementById('wd-reason').value, date: new Date().toISOString(), createdBy: state.currentUser.username });
    save();
    closeModal();
    refreshCloture();
  });
}

function printCloture58mm() {
  const c = state.config, d = state.clotureData;
  print58mm(`
    <div class="center bold">${c.name}</div>
    <div class="dashed"></div>
    <div class="center">CLÔTURE DE CAISSE</div>
    <div class="center">Du ${fmtDate(state.clotureFrom)} au ${fmtDate(state.clotureTo)}</div>
    <div class="dashed"></div>
    <div class="line"><span>Fonds de caisse</span><span>${fmt(d.fondsOuverture)}</span></div>
    <div class="line"><span>Recette (${d.sales.length} tickets)</span><span>${fmt(d.totalCa)}</span></div>
    <div class="line"><span>Prélèvements</span><span>-${fmt(d.totalWithdrawals)}</span></div>
    <div class="dashed"></div>
    <div class="line bold"><span>SOLDE EN CAISSE</span><span>${fmt(d.solde)}</span></div>
  `);
}

// ============================================================
// RÉGLAGES
// ============================================================
function renderReglages() {
  const el = document.getElementById('view');
  const c = state.config;
  el.innerHTML = `
    <div class="field"><label>Nom du salon</label><input type="text" id="cfg-name" value="${c.name}"></div>
    <div class="field"><label>Adresse</label><input type="text" id="cfg-address" value="${c.address || ''}"></div>
    <div class="field"><label>Téléphone</label><input type="text" id="cfg-phone" value="${c.phone || ''}"></div>
    <div class="field"><label>Message de fin de ticket</label><input type="text" id="cfg-footer" value="${c.footer || ''}"></div>
    <div class="field"><label>Devise</label><input type="text" id="cfg-currency" value="${c.currency || 'FCFA'}"></div>
    <button class="btn" id="cfg-save" style="margin-bottom:20px;">Enregistrer</button>

    <h2>Récompenses fidélité (10 visites)</h2>
    <div class="field"><label>Prestation offerte 1</label>
      <select id="cfg-reward1"><option value="">— Choisir —</option>${state.services.map((s) => `<option value="${s.id}" ${s.id === c.loyaltyReward1Id ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
    </div>
    <div class="field"><label>Prestation offerte 2</label>
      <select id="cfg-reward2"><option value="">— Choisir —</option>${state.services.map((s) => `<option value="${s.id}" ${s.id === c.loyaltyReward2Id ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
    </div>
    <button class="btn secondary" id="cfg-save-rewards" style="margin-bottom:20px;">Enregistrer les récompenses</button>

    <h2>Numérotation</h2>
    <div class="list-box" style="padding:12px; display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <span>Prochain ticket : <strong>#${c.ticketCounter}</strong></span>
      <button class="btn secondary small" id="cfg-reset">Réinitialiser</button>
    </div>
    <p style="font-size:11px; color:var(--muted);">Toutes les données sont stockées uniquement sur cet appareil — aucune synchronisation avec un PC ou un autre téléphone.</p>
  `;
  document.getElementById('cfg-save').addEventListener('click', () => {
    state.config.name = document.getElementById('cfg-name').value.trim() || DEFAULT_CONFIG.name;
    state.config.address = document.getElementById('cfg-address').value.trim();
    state.config.phone = document.getElementById('cfg-phone').value.trim();
    state.config.footer = document.getElementById('cfg-footer').value.trim();
    state.config.currency = document.getElementById('cfg-currency').value.trim() || 'FCFA';
    save();
    alert('Réglages enregistrés.');
  });
  document.getElementById('cfg-save-rewards').addEventListener('click', () => {
    state.config.loyaltyReward1Id = document.getElementById('cfg-reward1').value || null;
    state.config.loyaltyReward2Id = document.getElementById('cfg-reward2').value || null;
    save();
    alert('Récompenses enregistrées.');
  });
  document.getElementById('cfg-reset').addEventListener('click', () => {
    if (!confirm('Réinitialiser le compteur de tickets à 1 ?')) return;
    state.config.ticketCounter = 1;
    save();
    renderReglages();
  });
}

// ============================================================
// DÉMARRAGE
// ============================================================
(async function boot() {
  load();
  await ensureSuperAdmin();
})();
