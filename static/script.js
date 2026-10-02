// ================= DEFAULT DATA =================
const DEFAULT_CATEGORIES = {
    income: [
      { id: 'gaji', label: 'Gaji', icon: '💼' },
      { id: 'usaha', label: 'Usaha', icon: '🏪' },
      { id: 'hadiah', label: 'Hadiah/Bonus', icon: '🎁' },
      { id: 'lainnya_in', label: 'Lainnya', icon: '➕' }
    ],
    expense: [
      { id: 'makan', label: 'Makan & Minum', icon: '🍽️' },
      { id: 'transport', label: 'Transportasi', icon: '🚌' },
      { id: 'belanja', label: 'Belanja', icon: '🛍️' },
      { id: 'tagihan', label: 'Tagihan', icon: '🧾' },
      { id: 'hiburan', label: 'Hiburan', icon: '🎮' },
      { id: 'kesehatan', label: 'Kesehatan', icon: '💊' },
      { id: 'lainnya_out', label: 'Lainnya', icon: '➖' }
    ]
  };
  const DEFAULT_WALLETS = [
    { id: 'tunai', name: 'Tunai', icon: '💵' },
    { id: 'bank', name: 'Bank', icon: '🏦' },
    { id: 'ewallet', name: 'E-Wallet', icon: '📱' }
  ];
  
  // ================= STORAGE (cache lokal) =================
  const LS = {
    tx: 'aturuang_tx',
    wallets: 'aturuang_wallets',
    customCats: 'aturuang_custom_cats',
    budgets: 'aturuang_budgets',
    goals: 'aturuang_goals',
    theme: 'aturuang_theme'
  };
  function loadJSON(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; }
    catch(e) { return fallback; }
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  }
  
  let transactions = loadJSON(LS.tx, []);
  let wallets = loadJSON(LS.wallets, DEFAULT_WALLETS);
  let customCats = loadJSON(LS.customCats, []);
  let budgets = loadJSON(LS.budgets, {});
  let goals = loadJSON(LS.goals, []);
  
  // migrate old tx without walletId
  let migrated = false;
  transactions.forEach(t => { if (!t.walletId) { t.walletId = wallets[0].id; migrated = true; } });
  if (migrated) saveJSON(LS.tx, transactions);
  
  function persistAll() {
    saveJSON(LS.tx, transactions);
    saveJSON(LS.wallets, wallets);
    saveJSON(LS.customCats, customCats);
    saveJSON(LS.budgets, budgets);
    saveJSON(LS.goals, goals);
    saveToServer();
  }
  
  // ================= SINKRON KE SERVER (akun login) =================
  function saveToServer() {
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions, wallets, customCats, budgets, goals })
    }).catch(() => { showToast('Gagal menyimpan ke server, cek koneksi'); });
  }
  
  async function loadFromServer() {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) { if (res.status === 401) window.location.href = '/login'; return; }
      const data = await res.json();
      transactions = data.transactions || [];
      wallets = (data.wallets && data.wallets.length) ? data.wallets : DEFAULT_WALLETS;
      customCats = data.customCats || [];
      budgets = data.budgets || {};
      goals = data.goals || [];
      saveJSON(LS.tx, transactions);
      saveJSON(LS.wallets, wallets);
      saveJSON(LS.customCats, customCats);
      saveJSON(LS.budgets, budgets);
      saveJSON(LS.goals, goals);
      renderAllViews();
    } catch(e) { /* biarkan pakai data cache lokal kalau server tidak terjangkau */ }
  }
  
  // ================= HELPERS =================
  function getCategories(type) {
    return [...DEFAULT_CATEGORIES[type], ...customCats.filter(c => c.type === type)];
  }
  function getAllCategories() { return [...getCategories('income'), ...getCategories('expense')]; }
  function catInfo(id) { return getAllCategories().find(c => c.id === id) || { label: id, icon: '•' }; }
  function walletInfo(id) { return wallets.find(w => w.id === id) || { name: 'Tidak diketahui', icon: '❔' }; }
  function formatRp(n) { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
  const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }
  
  // ================= THEME =================
  function initTheme() {
    const saved = localStorage.getItem(LS.theme);
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  }
  document.getElementById('themeToggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : (cur === 'light' ? 'dark' : (matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark'));
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(LS.theme, next); } catch(e) {}
  });
  initTheme();
  
  // ================= TABS =================
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-view').forEach(v => v.classList.toggle('active', v.id === 'tab-' + tab));
    window.scrollTo(0,0);
    if (tab === 'anggaran') renderBudgetTab();
    if (tab === 'tabungan') renderGoalsTab();
    if (tab === 'tren') renderTrend();
    if (tab === 'dompet') renderWalletTab();
    if (tab === 'transaksi') renderTransaksiTab();
  }
  
  // ================= QUICK ADD FORM (Ringkasan) =================
  let currentType = 'income';
  function setType(t) {
    currentType = t;
    document.getElementById('btnTypeIncome').classList.toggle('active', t === 'income');
    document.getElementById('btnTypeIncome').classList.toggle('income-active', t === 'income');
    document.getElementById('btnTypeExpense').classList.toggle('active', t === 'expense');
    document.getElementById('btnTypeExpense').classList.toggle('expense-active', t === 'expense');
    populateCategorySelect();
  }
  function populateCategorySelect() {
    const sel = document.getElementById('inpCategory');
    sel.innerHTML = '';
    getCategories(currentType).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = `${c.icon} ${c.label}`;
      sel.appendChild(opt);
    });
  }
  function populateWalletSelect(selectEl) {
    selectEl.innerHTML = '';
    wallets.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.id; opt.textContent = `${w.icon} ${w.name}`;
      selectEl.appendChild(opt);
    });
  }
  document.getElementById('inpDate').value = todayStr();
  populateCategorySelect();
  populateWalletSelect(document.getElementById('inpWallet'));
  
  document.getElementById('btnAdd').addEventListener('click', () => {
    const amountEl = document.getElementById('inpAmount');
    const amount = parseFloat(amountEl.value);
    if (!amount || amount <= 0) { amountEl.focus(); return; }
    const category = document.getElementById('inpCategory').value;
    const walletId = document.getElementById('inpWallet').value;
    const date = document.getElementById('inpDate').value || todayStr();
    const note = document.getElementById('inpNote').value.trim();
  
    transactions.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      type: currentType, amount, category, date, note, walletId
    });
    persistAll();
    amountEl.value = '';
    document.getElementById('inpNote').value = '';
  
    const d = new Date(date);
    viewMonth = d.getMonth(); viewYear = d.getFullYear();
  
    showToast('Transaksi disimpan');
    renderRingkasan();
  });
  
  // ================= MONTH STATE =================
  let viewMonth = new Date().getMonth();
  let viewYear = new Date().getFullYear();
  document.getElementById('prevMonth').addEventListener('click', () => { viewMonth--; if (viewMonth<0){viewMonth=11;viewYear--;} renderTransaksiTab(); renderRingkasan(); });
  document.getElementById('nextMonth').addEventListener('click', () => { viewMonth++; if (viewMonth>11){viewMonth=0;viewYear++;} renderTransaksiTab(); renderRingkasan(); });
  
  function txInViewMonth() {
    return transactions.filter(t => { const d = new Date(t.date); return d.getMonth()===viewMonth && d.getFullYear()===viewYear; });
  }
  
  // ================= RINGKASAN TAB =================
  function renderRingkasan() {
    const list = txInViewMonth();
    const income = list.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const expense = list.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    document.getElementById('sumIncome').textContent = formatRp(income);
    document.getElementById('sumExpense').textContent = formatRp(expense);
    document.getElementById('sumBalance').textContent = formatRp(income-expense);
    document.getElementById('curMonthLabel').textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
  
    // chart
    const totals = {};
    list.filter(t=>t.type==='expense').forEach(t => { totals[t.category] = (totals[t.category]||0)+t.amount; });
    const entries = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
    const row = document.getElementById('chartRow');
    row.innerHTML = '';
    if (entries.length===0) { row.innerHTML = '<div class="empty-state">✨ Belum ada pengeluaran bulan ini, mantap!</div>'; }
    else {
      const max = Math.max(...entries.map(e=>e[1]));
      entries.forEach(([catId,total]) => {
        const info = catInfo(catId);
        const h = Math.max(4,(total/max)*110);
        const col = document.createElement('div');
        col.className = 'chart-bar-col';
        col.innerHTML = `<div class="chart-value">${(total/1000).toFixed(0)}k</div><div class="chart-bar" style="height:${h}px;"></div><div class="chart-label">${info.icon}<br>${info.label}</div>`;
        row.appendChild(col);
      });
    }
  
    // recent
    const recent = [...transactions].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
    const rl = document.getElementById('recentList');
    rl.innerHTML = '';
    if (recent.length===0) { rl.innerHTML = '<div class="empty-state">🧾 Belum ada transaksi, yuk catat yang pertama!</div>'; }
    else recent.forEach(t => rl.appendChild(renderTxItem(t)));
  }
  
  function renderTxItem(t) {
    const info = catInfo(t.category);
    const w = walletInfo(t.walletId);
    const item = document.createElement('div');
    item.className = 'tx-item';
    item.innerHTML = `
      <div class="tx-left">
        <div class="tx-icon ${t.type}">${info.icon}</div>
        <div class="tx-info">
          <div class="tx-cat">${info.label}</div>
          <div class="tx-note">${w.icon} ${w.name}${t.note ? ' · '+t.note : ''} · ${new Date(t.date).toLocaleDateString('id-ID',{day:'numeric',month:'short'})}</div>
        </div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${t.type}">${t.type==='income'?'+':'-'}${formatRp(t.amount)}</div>
        <button class="tx-del" title="Hapus" data-id="${t.id}">🗑️</button>
      </div>`;
    item.querySelector('.tx-del').addEventListener('click', () => {
      transactions = transactions.filter(x=>x.id!==t.id);
      persistAll();
      renderRingkasan(); renderTransaksiTab();
      showToast('Transaksi dihapus');
    });
    return item;
  }
  
  // ================= TRANSAKSI TAB =================
  function populateFilterCategory() {
    const sel = document.getElementById('filterCategory');
    const prevValue = sel.value || 'all';
    sel.innerHTML = '<option value="all">Semua Kategori</option>';
    getAllCategories().forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = `${c.icon} ${c.label}`;
      sel.appendChild(opt);
    });
    const stillExists = Array.from(sel.options).some(o => o.value === prevValue);
    sel.value = stillExists ? prevValue : 'all';
  }
  let txTypeFilter = 'all';
  document.getElementById('typeChipRow').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-filter');
    if (!btn) return;
    txTypeFilter = btn.dataset.type;
    document.querySelectorAll('#typeChipRow .chip-filter').forEach(b => b.classList.toggle('active', b===btn));
    renderTransaksiTab();
  });
  ['filterSearch','filterCategory'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderTransaksiTab);
    document.getElementById(id).addEventListener('change', renderTransaksiTab);
  });
  
  function renderTransaksiTab() {
    populateFilterCategory();
    document.getElementById('curMonthLabel').textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
  
    const monthList = txInViewMonth();
    const monthIncome = monthList.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const monthExpense = monthList.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    document.getElementById('txSumIncome').textContent = formatRp(monthIncome);
    document.getElementById('txSumExpense').textContent = formatRp(monthExpense);
    document.getElementById('txSumNet').textContent = formatRp(monthIncome-monthExpense);
  
    const search = document.getElementById('filterSearch').value.toLowerCase();
    const catFilter = document.getElementById('filterCategory').value;
  
    let list = monthList;
    if (txTypeFilter !== 'all') list = list.filter(t=>t.type===txTypeFilter);
    if (catFilter !== 'all') list = list.filter(t=>t.category===catFilter);
    if (search) list = list.filter(t => (t.note||'').toLowerCase().includes(search) || catInfo(t.category).label.toLowerCase().includes(search));
    list = list.sort((a,b)=>new Date(b.date)-new Date(a.date));
  
    const wrap = document.getElementById('txGroupedList');
    wrap.innerHTML = '';
    if (list.length===0) {
      wrap.innerHTML = '<div class="no-results"><span class="nr-icon">🗂️</span><div class="nr-text">Tidak ada transaksi yang cocok</div></div>';
      return;
    }
  
    const groups = {};
    const order = [];
    list.forEach(t => {
      if (!groups[t.date]) { groups[t.date] = []; order.push(t.date); }
      groups[t.date].push(t);
    });
  
    const todayIso = todayStr();
    const yestDate = new Date(); yestDate.setDate(yestDate.getDate()-1);
    const yestIso = `${yestDate.getFullYear()}-${String(yestDate.getMonth()+1).padStart(2,'0')}-${String(yestDate.getDate()).padStart(2,'0')}`;
  
    order.forEach(dateKey => {
      const items = groups[dateKey];
      const net = items.reduce((s,t)=> s + (t.type==='income'?t.amount:-t.amount), 0);
      let label;
      if (dateKey === todayIso) label = 'Hari Ini';
      else if (dateKey === yestIso) label = 'Kemarin';
      else label = new Date(dateKey).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  
      const groupDiv = document.createElement('div');
      groupDiv.className = 'date-group';
      const header = document.createElement('div');
      header.className = 'date-group-header';
      header.innerHTML = `<span>${label}</span><span class="dg-net ${net>=0?'positive':'negative'}">${net>=0?'+':''}${formatRp(net)}</span>`;
      groupDiv.appendChild(header);
      items.forEach(t => groupDiv.appendChild(renderTxItem(t)));
      wrap.appendChild(groupDiv);
    });
  }
  
  // ================= ANGGARAN TAB =================
  function populateBudgetCategorySelect() {
    const sel = document.getElementById('budgetCategory');
    sel.innerHTML = '';
    getCategories('expense').forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = `${c.icon} ${c.label}`;
      sel.appendChild(opt);
    });
  }
  document.getElementById('btnSetBudget').addEventListener('click', () => {
    const cat = document.getElementById('budgetCategory').value;
    const amt = parseFloat(document.getElementById('budgetAmount').value);
    if (!amt || amt <= 0) return;
    budgets[cat] = amt;
    persistAll();
    document.getElementById('budgetAmount').value = '';
    showToast('Anggaran disimpan');
    renderBudgetTab();
  });
  function renderBudgetTab() {
    populateBudgetCategorySelect();
    document.getElementById('budgetMonthLabel').textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
    const list = txInViewMonth().filter(t=>t.type==='expense');
    const spentByCat = {};
    list.forEach(t => { spentByCat[t.category] = (spentByCat[t.category]||0)+t.amount; });
  
    const wrap = document.getElementById('budgetList');
    wrap.innerHTML = '';
    const catIds = Object.keys(budgets);
    if (catIds.length===0) { wrap.innerHTML = '<div class="empty-state">🎯 Belum ada anggaran, yuk atur biar belanja lebih terkontrol</div>'; return; }
    catIds.forEach(catId => {
      const limit = budgets[catId];
      const spent = spentByCat[catId] || 0;
      const pct = Math.min(100, (spent/limit)*100);
      const over = spent > limit;
      const info = catInfo(catId);
      const div = document.createElement('div');
      div.className = 'budget-item';
      div.innerHTML = `
        <div class="budget-top">
          <span class="name">${info.icon} ${info.label}</span>
          <button class="tx-del" data-cat="${catId}">🗑️</button>
        </div>
        <div class="budget-bar-track"><div class="budget-bar-fill ${over?'over':''}" style="width:${pct}%;"></div></div>
        <div class="budget-sub ${over?'over-text':''}">
          <span>${formatRp(spent)} / ${formatRp(limit)}</span>
          <span>${over ? 'Melebihi anggaran!' : Math.round(pct)+'%'}</span>
        </div>`;
      div.querySelector('.tx-del').addEventListener('click', () => {
        delete budgets[catId]; persistAll(); renderBudgetTab(); showToast('Anggaran dihapus');
      });
      wrap.appendChild(div);
    });
  }
  
  // ================= TABUNGAN TAB =================
  document.getElementById('btnAddGoal').addEventListener('click', () => {
    const name = document.getElementById('goalName').value.trim();
    const icon = document.getElementById('goalIcon').value;
    const target = parseFloat(document.getElementById('goalTarget').value);
    if (!name || !target || target<=0) return;
    goals.push({ id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), name, icon, target, saved: 0 });
    persistAll();
    document.getElementById('goalName').value = '';
    document.getElementById('goalTarget').value = '';
    showToast('Target tabungan dibuat');
    renderGoalsTab();
  });
  function renderGoalsTab() {
    const wrap = document.getElementById('goalList');
    wrap.innerHTML = '';
    if (goals.length===0) { wrap.innerHTML = '<div class="empty-state">🐷 Belum ada target tabungan, yuk buat impianmu jadi nyata!</div>'; return; }
    goals.forEach(g => {
      const pct = Math.min(100, (g.saved/g.target)*100);
      const div = document.createElement('div');
      div.className = 'goal-card';
      div.innerHTML = `
        <div class="goal-top">
          <div>
            <div class="goal-name">${g.icon} ${g.name}</div>
            <div class="goal-target">${formatRp(g.saved)} dari ${formatRp(g.target)} (${Math.round(pct)}%)</div>
          </div>
        </div>
        <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%;"></div></div>
        <div class="goal-actions">
          <input type="number" placeholder="Tambah dana (Rp)" min="0" class="goal-add-input">
          <button class="btn btn-small goal-add-btn">Tambah</button>
          <button class="goal-del" title="Hapus target">🗑️</button>
        </div>`;
      div.querySelector('.goal-add-btn').addEventListener('click', () => {
        const inp = div.querySelector('.goal-add-input');
        const val = parseFloat(inp.value);
        if (!val || val<=0) return;
        g.saved += val;
        persistAll();
        inp.value = '';
        showToast(g.saved >= g.target ? 'Target tercapai! 🎉' : 'Dana ditambahkan');
        renderGoalsTab();
      });
      div.querySelector('.goal-del').addEventListener('click', () => {
        goals = goals.filter(x=>x.id!==g.id);
        persistAll(); renderGoalsTab(); showToast('Target dihapus');
      });
      wrap.appendChild(div);
    });
  }
  
  // ================= TREN TAB =================
  function renderTrend() {
    const now = new Date();
    const months = [];
    for (let i=5;i>=0;i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      months.push({ m: d.getMonth(), y: d.getFullYear() });
    }
    const data = months.map(({m,y}) => {
      const list = transactions.filter(t => { const d=new Date(t.date); return d.getMonth()===m && d.getFullYear()===y; });
      const income = list.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
      const expense = list.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
      return { m, y, income, expense };
    });
    const max = Math.max(1, ...data.map(d=>Math.max(d.income,d.expense)));
    const row = document.getElementById('trendRow');
    row.innerHTML = '';
    data.forEach(d => {
      const hIncome = Math.max(2,(d.income/max)*115);
      const hExpense = Math.max(2,(d.expense/max)*115);
      const col = document.createElement('div');
      col.className = 'trend-col';
      col.innerHTML = `
        <div class="trend-bars">
          <div class="trend-bar income-bar" style="height:${hIncome}px;" title="Pemasukan: ${formatRp(d.income)}"></div>
          <div class="trend-bar expense-bar" style="height:${hExpense}px;" title="Pengeluaran: ${formatRp(d.expense)}"></div>
        </div>
        <div class="chart-label">${MONTH_NAMES[d.m].slice(0,3)}<br>${d.y}</div>`;
      row.appendChild(col);
    });
  }
  
  // ================= DOMPET TAB =================
  function renderWalletTab() {
    const grid = document.getElementById('walletGrid');
    grid.innerHTML = '';
    wallets.forEach(w => {
      const bal = transactions.filter(t=>t.walletId===w.id).reduce((s,t)=> s + (t.type==='income'?t.amount:-t.amount), 0);
      const card = document.createElement('div');
      card.className = 'wallet-card';
      card.innerHTML = `
        <span class="w-icon">${w.icon}</span>
        <div class="w-name">${w.name}</div>
        <div class="w-balance">${formatRp(bal)}</div>
        ${wallets.length>1 ? `<button class="wallet-del" title="Hapus dompet">✕</button>` : ''}`;
      if (wallets.length>1) {
        card.querySelector('.wallet-del').addEventListener('click', () => {
          const hasTx = transactions.some(t=>t.walletId===w.id);
          if (hasTx) { showToast('Tidak bisa hapus, dompet masih punya transaksi'); return; }
          wallets = wallets.filter(x=>x.id!==w.id);
          persistAll(); renderWalletTab();
          showToast('Dompet dihapus');
        });
      }
      grid.appendChild(card);
    });
  
    const chipWrap = document.getElementById('customCatChips');
    chipWrap.innerHTML = '';
    if (customCats.length===0) { chipWrap.innerHTML = '<span class="hint" style="margin:0;">Belum ada kategori kustom</span>'; }
    customCats.forEach(c => {
      const chip = document.createElement('span');
      chip.className = 'cat-chip';
      chip.innerHTML = `${c.icon} ${c.label} <button data-id="${c.id}">✕</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        customCats = customCats.filter(x=>x.id!==c.id);
        persistAll(); renderWalletTab();
        showToast('Kategori dihapus');
      });
      chipWrap.appendChild(chip);
    });
  }
  document.getElementById('btnAddWallet').addEventListener('click', () => {
    const name = document.getElementById('newWalletName').value.trim();
    const icon = document.getElementById('newWalletIcon').value;
    if (!name) return;
    wallets.push({ id: 'w_'+Date.now().toString(36), name, icon });
    persistAll();
    document.getElementById('newWalletName').value = '';
    showToast('Dompet ditambahkan');
    renderWalletTab();
  });
  document.getElementById('btnAddCat').addEventListener('click', () => {
    const name = document.getElementById('newCatName').value.trim();
    const type = document.getElementById('newCatType').value;
    const icon = document.getElementById('newCatIcon').value.trim() || '🏷️';
    if (!name) return;
    customCats.push({ id: 'c_'+Date.now().toString(36), label: name, type, icon });
    persistAll();
    document.getElementById('newCatName').value = '';
    document.getElementById('newCatIcon').value = '';
    showToast('Kategori ditambahkan');
    renderWalletTab();
  });
  
  // ================= DATA TAB (export/import/reset) =================
  document.getElementById('btnExport').addEventListener('click', () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      transactions, wallets, customCats, budgets, goals
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aturuang-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Data berhasil diekspor');
  });
  
  document.getElementById('btnImportTrigger').addEventListener('click', () => {
    document.getElementById('fileImport').click();
  });
  document.getElementById('fileImport').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.transactions)) throw new Error('format tidak valid');
        transactions = data.transactions || [];
        wallets = (data.wallets && data.wallets.length) ? data.wallets : DEFAULT_WALLETS;
        customCats = data.customCats || [];
        budgets = data.budgets || {};
        goals = data.goals || [];
        persistAll();
        showToast('Data berhasil dipulihkan');
        renderAllViews();
      } catch(err) {
        showToast('Gagal membaca file, pastikan file backup valid');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });
  
  document.getElementById('btnReset').addEventListener('click', () => {
    if (!confirm('Yakin ingin menghapus semua data? Tindakan ini tidak bisa dibatalkan.')) return;
    transactions = []; wallets = [...DEFAULT_WALLETS]; customCats = []; budgets = {}; goals = [];
    persistAll();
    showToast('Semua data telah dihapus');
    renderAllViews();
  });
  
  // ================= INIT ALL =================
  function renderAllViews() {
    renderRingkasan();
    renderTransaksiTab();
    renderBudgetTab();
    renderGoalsTab();
    renderTrend();
    renderWalletTab();
    populateCategorySelect();
    populateWalletSelect(document.getElementById('inpWallet'));
  }
  renderAllViews();
  loadFromServer();