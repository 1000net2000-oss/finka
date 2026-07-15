// Словарь категорий: ключ -> {icon, name, words, color}
const CATEGORIES = {
  products:  { icon: '🛒', name: 'Продукты',      color: '#A85C42', words: ['продукт','магазин','ашан','бидронк','лидл','żabk','zabk','carrefour','biedronk'] },
  phone:     { icon: '📱', name: 'Телефон',        color: '#8B6F8E', words: ['телефон','связь','пополнен','plus','orange','play','t-mobile'] },
  child:     { icon: '🧸', name: 'Ребёнок',        color: '#5C7A5E', words: ['ребен','ребён','сад','школ','игрушк'] },
  car:       { icon: '🚗', name: 'Авто',           color: '#B8912E', words: ['бензин','азс','топливо','мойк','шиномонтаж','страховк','парковк','сто'] },
  food:      { icon: '☕', name: 'Еда (для себя)', color: '#C08552', words: ['обед','кафе','ресторан','кофе','перекус','пицц'] },
  cigarettes:{ icon: '🚬', name: 'Сигареты',       color: '#6B6A62', words: ['сигарет','табак','вейп'] },
  fun:       { icon: '🎬', name: 'Развлечения',    color: '#8B6F8E', words: ['кино','бар','концерт','игра','подписк','netflix','spotify'] },
  light:     { icon: '💡', name: 'Свет',           color: '#B8912E', words: ['свет','электр','счетчик','счётчик'] },
  wood:      { icon: '🪵', name: 'Дрова',          color: '#8A5A34', words: ['дров','уголь','отоплен'] },
  household: { icon: '🧹', name: 'Хоз товары',     color: '#6E8CA0', words: ['хозтовар','посуд','инструмент'] },
  medicine:  { icon: '💊', name: 'Медицина',       color: '#A85C42', words: ['аптек','врач','лекарств','клиник'] },
  dog:       { icon: '🐶', name: 'Собака',         color: '#5C7A5E', words: ['собак','ветеринар'] },
  home:      { icon: '🏠', name: 'Дом',            color: '#6E8CA0', words: ['аренд','ремонт','мебель','коммуналк'] },
  chemistry: { icon: '🧴', name: 'Химия',          color: '#5C7A5E', words: ['стиральн','порошок','чистящ','мыло'] },
  income:    { icon: '💰', name: 'Доход',          color: '#5C7A5E', words: ['зарплат','аванс','доход','премия','возврат'] },
  other:     { icon: '❔', name: 'Прочее',         color: '#8A8A80', words: [] },
};

// Ищет категорию по тексту записи. Возвращает ключ категории.
function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const key in CATEGORIES) {
    if (key === 'other') continue;
    if (CATEGORIES[key].words.some(w => lower.includes(w))) return key;
  }
  return 'other';
}

// Определяет тип операции (доход/расход) по тексту.
function detectType(text) {
  return detectCategory(text) === 'income' ? 'income' : 'expense';
}
