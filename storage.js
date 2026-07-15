// Работа с localStorage. Одна запись: {id, amount, text, category, type, date}
const STORAGE_KEY = 'finance_entries_v1';

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Storage read error', e);
    return [];
  }
}

function saveEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (e) {
    console.error('Storage write error', e);
    return false;
  }
}

function addEntry(entry) {
  const entries = loadEntries();
  entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  entries.unshift(entry);
  saveEntries(entries);
  return entry;
}

function updateEntry(id, changes) {
  const entries = loadEntries();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...changes };
  saveEntries(entries);
  return entries[idx];
}

function deleteEntry(id) {
  const entries = loadEntries().filter(e => e.id !== id);
  saveEntries(entries);
}

function getEntriesByDateRange(startDate, endDate) {
  return loadEntries().filter(e => e.date >= startDate && e.date <= endDate);
}

function getEntriesByCategory(category) {
  return loadEntries().filter(e => e.category === category);
}

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
