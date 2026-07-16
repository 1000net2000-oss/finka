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
let drillRange = null; // {start, end, label} — выбранный конкретный отрезок на графике
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
  const range = drillRange || currentPeriodRange();
  const entries = getEntriesByDateRange(range.start, range.end).filter(e => e.type === 'expense');
  const total = entries.reduce((s, e) => s + e.amount, 0);
  document.getElementById('statsTotal').textContent = formatMoney(total) + ' zł';
  document.getElementById('statsDonutLabel').textContent = drillRange ? drillRange.label.toLowerCase() : 'потрачено';

  const crumb = document.getElementById('drillCrumb');
  if (drillRange) {
    crumb.style.display = 'flex';
    document.getElementById('drillLabel').textContent = drillRange.label;
  } else {
    crumb.style.display = 'none';
  }

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
      row.addEventListener('click', () => openCategoryDetail(row.dataset.key, range));
    });
  }

  // Тренд всегда строится по полному периоду (недрилленному), чтобы можно было выбрать другой отрезок
  const fullRange = currentPeriodRange();
  const fullEntries = getEntriesByDateRange(fullRange.start, fullRange.end).filter(e => e.type === 'expense');
  renderTrend(fullEntries, fullRange.start, fullRange.end);
}

document.getElementById('drillBack').addEventListener('click', () => {
  drillRange = null;
  renderStats();
});

function renderTrend(entries, start, end) {
  const bars = document.getElementById('trendBars');
  const days = document.getElementById('trendDays');
  let bins = []; // {value, start, end, label}

  if (currentStatsPeriod === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = isoOf(d);
      const value = entries.filter(e => e.date === iso).reduce((s, e) => s + e.amount, 0);
      const label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      bins.push({ value, start: iso, end: iso, label });
    }
  } else if (currentStatsPeriod === 'year') {
    const year = todayDate().getFullYear();
    const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    for (let m = 0; m < 12; m++) {
      const mStart = year + '-' + String(m + 1).padStart(2, '0') + '-01';
      const lastDay = new Date(year, m + 1, 0).getDate();
      const mEnd = year + '-' + String(m + 1).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
      const value = entries.filter(e => e.date >= mStart && e.date <= mEnd).reduce((s, e) => s + e.amount, 0);
      bins.push({ value, start: mStart, end: mEnd, label: monthNames[m] });
    }
  } else {
    const monthD = todayDate();
    const lastDay = new Date(monthD.getFullYear(), monthD.getMonth() + 1, 0).getDate();
    for (let w = 0; w * 7 < lastDay; w++) {
      const wStartDay = w * 7 + 1;
      const wEndDay = Math.min(wStartDay + 6, lastDay);
      const wStart = isoOf(monthD).slice(0, 8) + String(wStartDay).padStart(2, '0');
      const wEnd = isoOf(monthD).slice(0, 8) + String(wEndDay).padStart(2, '0');
      const value = entries.filter(e => e.date >= wStart && e.date <= wEnd).reduce((s, e) => s + e.amount, 0);
      bins.push({ value, start: wStart, end: wEnd, label: `Неделя ${w + 1} (${wStartDay}–${wEndDay})` });
    }
  }

  const short = currentStatsPeriod === 'week'
    ? bins.map(b => new Date(b.start + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short' }).slice(0, 2))
    : currentStatsPeriod === 'year'
      ? ['Я','Ф','М','А','М','И','И','А','С','О','Н','Д']
      : bins.map((_, i) => (i + 1) + 'н');

  const max = Math.max(...bins.map(b => b.value), 1);
  bars.innerHTML = bins.map((b, i) => {
    const isSelected = drillRange && drillRange.start === b.start && drillRange.end === b.end;
    const cls = isSelected ? ' selected' : (b.value === max && b.value > 0 ? ' peak' : '');
    return `<div class="trend-bar${cls}" style="height:${Math.max((b.value / max) * 100, 3)}%" data-i="${i}"></div>`;
  }).join('');
  days.innerHTML = short.map(l => `<span>${l}</span>`).join('');

  bars.querySelectorAll('.trend-bar').forEach(el => {
    el.addEventListener('click', () => {
      const bin = bins[parseInt(el.dataset.i, 10)];
      if (drillRange && drillRange.start === bin.start && drillRange.end === bin.end) {
        drillRange = null; // повторный тап по тому же бару — сброс
      } else {
        drillRange = { start: bin.start, end: bin.end, label: bin.label };
      }
      renderStats();
    });
  });
}

document.getElementById('statsPeriodTabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.period-tab');
  if (!tab) return;
  document.querySelectorAll('#statsPeriodTabs .period-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentStatsPeriod = tab.dataset.period;
  drillRange = null;
  renderStats();
});

// ===== Детали категории =====
function openCategoryDetail(key, range) {
  const cat = CATEGORIES[key];
  const { start, end } = range || currentPeriodRange();
  const entries = getEntriesByDateRange(start, end).filter(e => e.category === key && e.type === 'expense')
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = entries.reduce((s, e) => s + e.amount, 0);

  document.getElementById('catDetailIcon').textContent = cat.icon;
  document.getElementById('catDetailName').textContent = cat.name;
  document.getElementById('catDetailAmount').textContent = formatMoney(total) + ' zł';
  document.getElementById('catTotalCircle').style.borderColor = cat.color;
  const periodLabel = drillRange ? drillRange.label.toLowerCase() : { week: 'за неделю', month: 'за месяц', year: 'за год' }[currentStatsPeriod];
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

// ===== Аналитика =====
const MONTH_NAMES_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function renderAnalytics() {
  const today = todayDate();

  // --- Сравнение месяцев ---
  const { start: currStart, end: currEnd } = monthRange(today);
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const { start: prevStart, end: prevEnd } = monthRange(prevMonthDate);

  const currEntries = getEntriesByDateRange(currStart, currEnd).filter(e => e.type === 'expense');
  const prevEntries = getEntriesByDateRange(prevStart, prevEnd).filter(e => e.type === 'expense');
  const currTotal = currEntries.reduce((s, e) => s + e.amount, 0);
  const prevTotal = prevEntries.reduce((s, e) => s + e.amount, 0);

  document.getElementById('compareCurrMonth').textContent = MONTH_NAMES_RU[today.getMonth()];
  document.getElementById('compareCurrAmount').textContent = formatMoney(currTotal) + ' zł';
  document.getElementById('comparePrevLabel').textContent = MONTH_NAMES_RU[prevMonthDate.getMonth()].slice(0, 3);
  document.getElementById('compareCurrLabel').textContent = MONTH_NAMES_RU[today.getMonth()].slice(0, 3);
  document.getElementById('comparePrevVal').textContent = formatMoney(prevTotal) + ' zł';
  document.getElementById('compareCurrVal').textContent = formatMoney(currTotal) + ' zł';

  const maxTotal = Math.max(currTotal, prevTotal, 1);
  document.getElementById('comparePrevFill').style.width = (prevTotal / maxTotal * 100) + '%';
  document.getElementById('compareCurrFill').style.width = (currTotal / maxTotal * 100) + '%';

  const badge = document.getElementById('diffBadge');
  if (prevTotal === 0) {
    badge.className = 'diff-badge flat';
    badge.textContent = 'Нет данных за прошлый месяц';
  } else {
    const diffPct = Math.round(((currTotal - prevTotal) / prevTotal) * 100);
    if (diffPct > 0) {
      badge.className = 'diff-badge up';
      badge.textContent = `▲ +${diffPct}% к прошлому месяцу`;
    } else if (diffPct < 0) {
      badge.className = 'diff-badge down';
      badge.textContent = `▼ ${diffPct}% к прошлому месяцу`;
    } else {
      badge.className = 'diff-badge flat';
      badge.textContent = 'Без изменений к прошлому месяцу';
    }
  }

  // --- Средний чек по категориям ---
  const byCategory = {};
  currEntries.forEach(e => {
    if (!byCategory[e.category]) byCategory[e.category] = { sum: 0, count: 0 };
    byCategory[e.category].sum += e.amount;
    byCategory[e.category].count += 1;
  });
  const avgList = document.getElementById('avgList');
  const avgEntries = Object.entries(byCategory).sort((a, b) => b[1].sum - a[1].sum);
  if (!avgEntries.length) {
    avgList.innerHTML = '<div class="empty-state">Нет записей в этом месяце</div>';
  } else {
    avgList.innerHTML = avgEntries.map(([key, d]) => {
      const cat = CATEGORIES[key];
      const avg = d.sum / d.count;
      return `
        <div class="avg-row">
          <div class="avg-left">
            <span class="avg-icon">${cat.icon}</span>
            <div><div class="avg-name">${cat.name}</div><div class="avg-count">${d.count} ${pluralize(d.count, 'покупка', 'покупки', 'покупок')}</div></div>
          </div>
          <div class="avg-right">
            <div class="avg-value">${formatMoney(avg)} zł</div>
            <div class="avg-sub">в среднем</div>
          </div>
        </div>`;
    }).join('');
  }

  // --- Прогноз до конца месяца ---
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dailyAvg = dayOfMonth > 0 ? currTotal / dayOfMonth : 0;
  const projected = dailyAvg * daysInMonth;
  const remaining = Math.max(projected - currTotal, 0);
  const pctElapsed = Math.round((dayOfMonth / daysInMonth) * 100);

  document.getElementById('forecastAmount').textContent = currEntries.length ? '≈ ' + formatMoney(projected) + ' zł' : '— ';
  document.getElementById('forecastNote').textContent = currEntries.length
    ? `При текущем темпе трат за оставшиеся ${daysInMonth - dayOfMonth} дн. потратишь ещё около ${formatMoney(remaining)} zł`
    : 'Добавь записи за этот месяц, чтобы увидеть прогноз';
  document.getElementById('forecastProgress').style.width = pctElapsed + '%';
  document.getElementById('forecastDaysLabel').textContent = `День ${dayOfMonth} из ${daysInMonth}`;
  document.getElementById('forecastPct').textContent = pctElapsed + '%';
}

function pluralize(n, one, few, many) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

document.getElementById('openAnalytics').addEventListener('click', () => {
  renderAnalytics();
  switchView('view-analytics');
});
document.getElementById('backFromAnalytics').addEventListener('click', () => switchView('view-stats'));

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
