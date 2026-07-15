// ===== Утилиты =====
function formatMoney(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n));
}

function parseEntryText(raw) {
  const text = raw.trim();
  const match = text.match(/(\d+([.,]\d+)?)/);
  const amount = match ? parseFloat(match[0].replace(',', '.')) : null;
  const label = text.replace(match ? match[0] : '', '').trim();
  return { amount, label: label || text };
}

function todayDate() { return new Date(); }

function isoOf(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function humanDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (iso === isoOf(today)) return 'Сегодня, ' + d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  if (iso === isoOf(yesterday)) return 'Вчера, ' + d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function monthRange(d) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: isoOf(start), end: isoOf(end) };
}
function weekRange(d) {
  const end = new Date(d);
  const start = new Date(d); start.setDate(d.getDate() - 6);
  return { start: isoOf(start), end: isoOf(end) };
}
function yearRange(d) {
  return { start: d.getFullYear() + '-01-01', end: d.getFullYear() + '-12-31' };
}

// ===== Состояние =====
let currentStatsPeriod = 'month';
let currentHistoryFilter = 'all';
let manualCategory = null;
let lastAddedId = null;

// ===== Главный экран: быстрый ввод =====
const entryInput = document.getElementById('entryInput');
const stamp = document.getElementById('stamp');
const stampIcon = document.getElementById('stampIcon');
const stampText = document.getElementById('stampText');
const dateInput = document.getElementById('dateInput');
const dateText = document.getElementById('dateText');
const recordBtn = document.getElementById('recordBtn');
const quickChipsEl = document.getElementById('quickChips');

dateInput.value = isoOf(todayDate());

function setStamp(catKey) {
  const cat = CATEGORIES[catKey] || CATEGORIES.other;
  stampIcon.textContent = cat.icon;
  stampText.textContent = cat.name;
  stamp.classList.add('active');
}

entryInput.addEventListener('input', () => {
  const { label } = parseEntryText(entryInput.value);
  if (!entryInput.value.trim()) { stamp.classList.remove('active'); manualCategory = null; return; }
  if (manualCategory) { setStamp(manualCategory); return; }
  setStamp(detectCategory(label));
});

dateInput.addEventListener('change', () => {
  const d = new Date(dateInput.value + 'T00:00:00');
  dateText.textContent = (isoOf(d) === isoOf(todayDate())) ? 'Сегодня' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
});

const QUICK_KEYS = ['products', 'car', 'food', 'dog', 'medicine'];
function renderQuickChips() {
  quickChipsEl.innerHTML = QUICK_KEYS.map(key => {
    const c = CATEGORIES[key];
    return `<div class="chip" data-key="${key}">${c.icon} ${c.name}</div>`;
  }).join('');
  quickChipsEl.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      quickChipsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      manualCategory = chip.dataset.key;
      setStamp(manualCategory);
      entryInput.focus();
    });
  });
}

recordBtn.addEventListener('click', () => {
  const { amount, label } = parseEntryText(entryInput.value);
  if (!amount) { entryInput.focus(); return; }
  const category = manualCategory || detectCategory(label);
  const type = category === 'income' ? 'income' : 'expense';
  const entry = addEntry({ amount, text: label || CATEGORIES[category].name, category, type, date: dateInput.value });
  lastAddedId = entry.id;
  entryInput.value = '';
  manualCategory = null;
  quickChipsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  stamp.classList.remove('active');
  showToast('Записано ✓');
  renderHome();
});

// ===== Тост с отменой =====
const toast = document.getElementById('toast');
const toastText = document.getElementById('toastText');
const toastUndo = document.getElementById('toastUndo');
let toastTimer = null;
function showToast(msg) {
  toastText.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
toastUndo.addEventListener('click', () => {
  if (lastAddedId) { deleteEntry(lastAddedId); lastAddedId = null; }
  toast.classList.remove('show');
  renderHome(); renderHistory(); renderStats();
});

// ===== Главный экран: рендер =====
function renderHome() {
  const all = loadEntries();
  const { start, end } = monthRange(todayDate());
  const monthEntries = getEntriesByDateRange(start, end).filter(e => e.type === 'expense');
  const total = monthEntries.reduce((s, e) => s + e.amount, 0);
  document.getElementById('homeTotal').textContent = formatMoney(total);
  const monthName = todayDate().toLocaleDateString('ru-RU', { month: 'long' });
  document.getElementById('homeEyebrow').textContent = 'Затрачено · ' + monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const todayIso = isoOf(todayDate());
  const todays = all.filter(e => e.date === todayIso).slice(0, 8);
  const recentList = document.getElementById('recentList');
  if (!todays.length) {
    recentList.innerHTML = '<div class="empty-state">Сегодня записей ещё нет</div>';
  } else {
    recentList.innerHTML = todays.map(e => ledgerItemHTML(e, false)).join('');
  }
}

function ledgerItemHTML(e, showDelete) {
  const cat = CATEGORIES[e.category] || CATEGORIES.other;
  const sign = e.type === 'income' ? '+' : '−';
  const cls = e.type === 'income' ? 'income' : 'expense';
  return `
    <div class="ledger-item editable" data-id="${e.id}">
      <div class="li-left">
        <div class="li-icon">${cat.icon}</div>
        <div class="li-text"><div class="li-title">${escapeHtml(e.text)}</div><div class="li-cat">${cat.name}</div></div>
      </div>
      <div class="li-amount ${cls}">${sign}${formatMoney(e.amount)} zł</div>
    </div>`;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ===== Статистика =====
function currentPeriodRange() {
  const d = todayDate();
  if (currentStatsPeriod === 'week') return weekRange(d);
  if (currentStatsPeriod === 'year') return yearRange(d);
  return monthRange(d);
}

function renderStats() {
  const { start, end } = currentPeriodRange();
  const entries = getEntriesByDateRange(start, end).filter(e => e.type === 'expense');
  const total = entries.reduce((s, e) => s + e.amount, 0);
  document.getElementById('statsTotal').textContent = formatMoney(total) + ' zł';

  const sums = {};
  entries.forEach(e => { sums[e.category] = (sums[e.category] || 0) + e.amount; });
  const sorted = Object.entries(sums).sort((a, b) => b[1] - a[1]);

  // donut
  const donut = document.getElementById('statsDonut');
  if (!sorted.length) {
    donut.style.background = '#DEDACB';
  } else {
    let acc = 0;
    const stops = sorted.map(([key, val]) => {
      const pct = (val / total) * 100;
      const from = acc; acc += pct;
      return `${CATEGORIES[key].color} ${from}% ${acc}%`;
    });
    donut.style.background = `conic-gradient(${stops.join(',')})`;
  }

  // cat list
  const catList = document.getElementById('statsCatList');
  if (!sorted.length) {
    catList.innerHTML = '<div class="empty-state">Нет данных за период</div>';
  } else {
    catList.innerHTML = sorted.map(([key, val]) => {
      const cat = CATEGORIES[key];
      const pct = Math.round((val / total) * 100);
      return `
        <div class="cat-row clickable" data-key="${key}">
          <div class="cat-left"><span class="cat-dot" style="background:${cat.color}"></span><span class="cat-name">${cat.name}</span></div>
          <div class="cat-right"><span class="cat-amount">${formatMoney(val)} zł</span><span class="cat-pct">${pct}%</span><span class="cat-arrow">›</span></div>
        </div>`;
    }).join('');
    catList.querySelectorAll('.cat-row').forEach(row => {
      row.addEventListener('click', () => openCategoryDetail(row.dataset.key));
    });
  }

  renderTrend(entries, start, end);
}

function renderTrend(entries, start, end) {
  const bars = document.getElementById('trendBars');
  const days = document.getElementById('trendDays');
  let bins = []; let labels = [];

  if (currentStatsPeriod === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = isoOf(d);
      bins.push(entries.filter(e => e.date === iso).reduce((s, e) => s + e.amount, 0));
      labels.push(d.toLocaleDateString('ru-RU', { weekday: 'short' }).slice(0, 2));
    }
  } else if (currentStatsPeriod === 'year') {
    for (let m = 0; m < 12; m++) {
      const monthEntries = entries.filter(e => new Date(e.date + 'T00:00:00').getMonth() === m);
      bins.push(monthEntries.reduce((s, e) => s + e.amount, 0));
      labels.push(['Я','Ф','М','А','М','И','И','А','С','О','Н','Д'][m]);
    }
  } else {
    for (let w = 0; w < 5; w++) {
      const wStart = w * 7 + 1, wEnd = Math.min(w * 7 + 7, 31);
      const weekEntries = entries.filter(e => {
        const day = parseInt(e.date.split('-')[2], 10);
        return day >= wStart && day <= wEnd;
      });
      if (w > 0 && wStart > new Date(end).getDate()) continue;
      bins.push(weekEntries.reduce((s, e) => s + e.amount, 0));
      labels.push((w + 1) + 'н');
    }
  }

  const max = Math.max(...bins, 1);
  bars.innerHTML = bins.map(v => `<div class="trend-bar${v === max && v > 0 ? ' peak' : ''}" style="height:${Math.max((v / max) * 100, 3)}%"></div>`).join('');
  days.innerHTML = labels.map(l => `<span>${l}</span>`).join('');
}

document.getElementById('statsPeriodTabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.period-tab');
  if (!tab) return;
  document.querySelectorAll('#statsPeriodTabs .period-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentStatsPeriod = tab.dataset.period;
  renderStats();
});

// ===== Детали категории =====
function openCategoryDetail(key) {
  const cat = CATEGORIES[key];
  const { start, end } = currentPeriodRange();
  const entries = getEntriesByDateRange(start, end).filter(e => e.category === key && e.type === 'expense')
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = entries.reduce((s, e) => s + e.amount, 0);

  document.getElementById('catDetailIcon').textContent = cat.icon;
  document.getElementById('catDetailName').textContent = cat.name;
  document.getElementById('catDetailAmount').textContent = formatMoney(total) + ' zł';
  document.getElementById('catTotalCircle').style.borderColor = cat.color;
  const periodLabel = { week: 'за неделю', month: 'за месяц', year: 'за год' }[currentStatsPeriod];
  document.getElementById('catDetailPeriod').textContent = periodLabel;

  const list = document.getElementById('catDetailList');
  list.innerHTML = entries.length ? entries.map(e => `
    <div class="ledger-item">
      <div class="li-left">
        <div class="li-icon">${cat.icon}</div>
        <div class="li-text"><div class="li-title">${escapeHtml(e.text)}</div><div class="li-cat">${humanDate(e.date)}</div></div>
      </div>
      <div class="li-amount expense">−${formatMoney(e.amount)} zł</div>
    </div>`).join('') : '<div class="empty-state">Записей нет</div>';

  switchView('view-category');
}
document.getElementById('backFromCat').addEventListener('click', () => switchView('view-stats'));

// ===== История =====
function renderHistoryFilters() {
  const el = document.getElementById('historyFilters');
  const keys = Object.keys(CATEGORIES).filter(k => k !== 'other');
  el.innerHTML = ['<div class="filter-chip active" data-key="all">Все</div>']
    .concat(keys.map(k => `<div class="filter-chip" data-key="${k}">${CATEGORIES[k].icon} ${CATEGORIES[k].name}</div>`)).join('');
  el.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      el.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentHistoryFilter = chip.dataset.key;
      renderHistory();
    });
  });
}

function renderHistory() {
  let entries = loadEntries();
  if (currentHistoryFilter !== 'all') entries = entries.filter(e => e.category === currentHistoryFilter);
  entries = entries.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const groups = {};
  entries.forEach(e => { (groups[e.date] = groups[e.date] || []).push(e); });
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const el = document.getElementById('historyList');
  if (!dates.length) {
    el.innerHTML = '<div class="empty-state">Записей не найдено</div>';
    return;
  }

  el.innerHTML = dates.map(date => {
    const dayEntries = groups[date];
    const dayTotal = dayEntries.reduce((s, e) => s + (e.type === 'income' ? e.amount : -e.amount), 0);
    const sign = dayTotal >= 0 ? '+' : '−';
    return `
      <div class="day-group">
        <div class="day-title"><span>${humanDate(date)}</span><span class="day-total">${sign}${formatMoney(Math.abs(dayTotal))} zł</span></div>
        ${dayEntries.map(e => historyItemHTML(e)).join('')}
      </div>`;
  }).join('');

  el.querySelectorAll('.ledger-item.editable').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.li-delete-btn')) return;
      const panel = document.getElementById('edit-' + item.dataset.id);
      const isOpen = panel.classList.contains('open');
      el.querySelectorAll('.edit-panel.open').forEach(p => p.classList.remove('open'));
      if (!isOpen) panel.classList.add('open');
    });
  });

  el.querySelectorAll('.li-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteEntry(btn.dataset.id);
      renderHistory(); renderHome(); renderStats();
    });
  });

  el.querySelectorAll('.edit-save').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = btn.closest('.edit-panel');
      const id = panel.dataset.id;
      const amount = parseFloat(panel.querySelector('.edit-amount').value.replace(',', '.'));
      const text = panel.querySelector('.edit-text').value.trim();
      const category = panel.querySelector('.edit-category').value;
      const date = panel.querySelector('.edit-date').value;
      if (!amount || !date) return;
      updateEntry(id, { amount, text, category, date, type: category === 'income' ? 'income' : 'expense' });
      renderHistory(); renderHome(); renderStats();
    });
  });
  el.querySelectorAll('.edit-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); btn.closest('.edit-panel').classList.remove('open'); });
  });
  el.querySelectorAll('.edit-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteEntry(btn.closest('.edit-panel').dataset.id);
      renderHistory(); renderHome(); renderStats();
    });
  });
}

function historyItemHTML(e) {
  const cat = CATEGORIES[e.category] || CATEGORIES.other;
  const sign = e.type === 'income' ? '+' : '−';
  const cls = e.type === 'income' ? 'income' : 'expense';
  const catOptions = Object.keys(CATEGORIES).filter(k => k !== 'other').map(k =>
    `<option value="${k}" ${k === e.category ? 'selected' : ''}>${CATEGORIES[k].icon} ${CATEGORIES[k].name}</option>`).join('');
  return `
    <div class="ledger-item swipeable editable" data-id="${e.id}">
      <div class="li-left">
        <div class="li-icon">${cat.icon}</div>
        <div class="li-text"><div class="li-title">${escapeHtml(e.text)}</div><div class="li-cat">${cat.name}</div></div>
      </div>
      <div class="li-amount ${cls}">${sign}${formatMoney(e.amount)} zł</div>
      <button class="li-delete-btn" data-id="${e.id}">✕</button>
    </div>
    <div class="edit-panel" id="edit-${e.id}" data-id="${e.id}">
      <div class="edit-row"><label>Сумма</label><input type="text" class="edit-input edit-amount" value="${e.amount}"></div>
      <div class="edit-row"><label>Описание</label><input type="text" class="edit-input edit-text" value="${escapeHtml(e.text)}"></div>
      <div class="edit-row"><label>Категория</label><select class="edit-input edit-category">${catOptions}</select></div>
      <div class="edit-row"><label>Дата</label><input type="date" class="edit-input edit-date" value="${e.date}"></div>
      <div class="edit-actions">
        <button class="edit-save">Сохранить</button>
        <button class="edit-cancel">Отмена</button>
        <button class="edit-cancel edit-delete">Удалить</button>
      </div>
    </div>`;
}

// ===== Навигация =====
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
function switchView(id) {
  views.forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  navItems.forEach(n => n.classList.toggle('active', n.dataset.view === id));
}
navItems.forEach(item => {
  item.addEventListener('click', () => switchView(item.dataset.view));
});

// ===== Инициализация =====
renderQuickChips();
renderHistoryFilters();
renderHome();
renderStats();
renderHistory();

// Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
