'use strict';

// Logger structuré minimal : une ligne JSON par événement, jamais le texte des tâches.
const logger = {
  write(level, msg, ctx) {
    console[level](JSON.stringify({ ts: new Date().toISOString(), level, msg, ...ctx }));
  },
  info(msg, ctx = {}) { this.write('info', msg, ctx); },
  warn(msg, ctx = {}) { this.write('warn', msg, ctx); },
  error(msg, ctx = {}) { this.write('error', msg, ctx); },
};

const STORAGE_KEY = 'mochi-todo:v1';
const TAG_COLORS = 6; // --c1 … --c6 dans style.css
const SPARKLES = [['♥', '#ff7eb3'], ['✦', '#b28dff'], ['★', '#ffb347'], ['✿', '#5fd3a0']];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (sel) => document.querySelector(sel);
const els = {
  form: $('#add-form'),
  input: $('#new-task'),
  list: $('#list'),
  empty: $('#empty'),
  hint: $('#hint'),
  count: $('#count'),
  clear: $('#clear-done'),
  progress: $('#progress'),
  mood: $('#mood'),
  mochi: $('.mochi'),
  tpl: $('#item-tpl'),
  filters: document.querySelectorAll('[data-filter]'),
};

// Une tâche : { id, text, done, doneOn?, color, createdAt, worked: ['AAAA-MM-JJ', …] }
// `worked` liste les jours où l'on a avancé dessus (bouton 🌙) : non vide = mission en cours.
let tasks = load();
let filter = 'all';
let freshId = null;
let cheer = null;
let cheerTimer;

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map((t) => ({ worked: [], ...t })) : [];
  } catch (err) {
    logger.error('storage.load_failed', { error: String(err) });
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    logger.error('storage.save_failed', { error: String(err), count: tasks.length });
  }
}

// crypto.randomUUID() n'existe pas en HTTP simple (test sur le téléphone via le Wi-Fi)
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Date locale du jour au format AAAA-MM-JJ
function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

const restsToday = (t, day) => !t.done && t.worked.at(-1) === day;
// Jours d'effort d'une mission finie : jours avec 🌙 + le jour où on l'a cochée
const effortDays = (t) => t.worked.length + (t.worked.at(-1) === t.doneOn ? 0 : 1);

// Les victoires du jour : tâches finies aujourd'hui + missions avancées aujourd'hui (🌙).
function stats() {
  const day = today();
  return {
    day,
    wins: tasks.filter((t) => (t.done ? t.doneOn === day : restsToday(t, day))).length,
    left: tasks.filter((t) => !t.done && !restsToday(t, day)).length,
    resting: tasks.filter((t) => restsToday(t, day)).length,
  };
}

const FILTERS = {
  all: () => true,
  todo: (t) => !t.done && !t.worked.length,
  doing: (t) => !t.done && t.worked.length > 0,
  done: (t) => t.done,
};

function render() {
  const { day, wins, left } = stats();
  const visible = tasks.filter(FILTERS[filter]);
  els.list.replaceChildren(...visible.map((t) => renderItem(t, day)));
  freshId = null;

  const pct = wins + left ? Math.round((wins / (wins + left)) * 100) : tasks.length ? 100 : 0;
  els.progress.firstElementChild.style.width = `${pct}%`;
  els.progress.setAttribute('aria-valuenow', pct);
  els.count.parentElement.hidden = !tasks.length;
  els.count.textContent = t.winsToday(wins);
  els.clear.hidden = !tasks.some((task) => task.done);
  els.empty.hidden = visible.length > 0;
  els.empty.textContent = t.empty[filter];
  els.hint.hidden = !tasks.some((t) => !t.done) || tasks.some((t) => t.worked.length);
  els.filters.forEach((b) => b.setAttribute('aria-pressed', b.dataset.filter === filter));
  renderMood();
}

function renderMood() {
  const { wins, left, resting } = stats();
  if (!tasks.length) setMood('sleepy', t.sleepy);
  else if (!left) setMood('happy', resting ? t.dayDone : t.allDone);
  else if (cheer) setMood('happy', cheer);
  else if (left === 1) setMood('normal', t.oneLeft);
  else if (wins) setMood('normal', t.winsSoFar(wins));
  else setMood('normal', t.newDay);
}

function setMood(mood, text) {
  els.mochi.dataset.mood = mood;
  els.mood.textContent = text;
}

function chipText(task, day) {
  const n = task.worked.length;
  if (!n) return '';
  if (task.done) return t.finishedIn(effortDays(task));
  return task.worked.at(-1) === day ? t.resting(t.effort(n)) : t.ongoing(t.effort(n));
}

function renderItem(task, day) {
  const li = els.tpl.content.firstElementChild.cloneNode(true);
  const rests = restsToday(task, day);
  li.dataset.id = task.id;
  li.style.setProperty('--tag', `var(--c${task.color})`);
  li.classList.toggle('done', task.done);
  li.classList.toggle('rested', rests);
  li.classList.toggle('fresh', task.id === freshId);

  const check = li.querySelector('.check');
  check.setAttribute('aria-pressed', task.done);
  check.setAttribute('aria-label', task.done ? t.markTodo : t.markDone);
  const later = li.querySelector('.later');
  later.hidden = task.done;
  later.setAttribute('aria-pressed', rests);
  later.setAttribute('aria-label', rests ? t.undoLater : t.later);

  li.querySelector('.text').textContent = task.text;
  const chip = li.querySelector('.chip');
  chip.textContent = chipText(task, day);
  chip.hidden = !chip.textContent;
  return li;
}

function burst(anchor, count = 8) {
  if (reduceMotion) return;
  const { left, top, width, height } = anchor.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const [glyph, color] = SPARKLES[i % SPARKLES.length];
    const angle = (i / count) * Math.PI * 2;
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.textContent = glyph;
    s.style.color = color;
    s.style.left = `${left + width / 2}px`;
    s.style.top = `${top + height / 2}px`;
    s.style.setProperty('--dx', `${Math.cos(angle) * 46}px`);
    s.style.setProperty('--dy', `${Math.sin(angle) * 46}px`);
    s.addEventListener('animationend', () => s.remove());
    document.body.append(s);
  }
}

// Message d'encouragement temporaire dans la bulle de Mochi
function celebrate(text) {
  cheer = text;
  clearTimeout(cheerTimer);
  cheerTimer = setTimeout(() => {
    cheer = null;
    renderMood();
  }, 3500);
}

// À appeler après avoir modifié la tâche, avant render() (qui remplace `anchor`).
function win(anchor, message) {
  burst(anchor);
  navigator.vibrate?.(20);
  celebrate(message);
  if (!stats().left) burst(els.mochi, 14);
}

function toggle(task, btn) {
  task.done = !task.done;
  if (task.done) {
    task.doneOn = today();
    const n = effortDays(task);
    win(btn, task.worked.length && n > 1 ? t.longDone(n) : pick(t.cheers.done));
  } else {
    delete task.doneOn;
    cheer = null;
  }
  save();
  render();
}

function later(task, btn) {
  const day = today();
  if (task.worked.at(-1) === day) {
    task.worked.pop();
    cheer = null;
  } else {
    task.worked.push(day);
    win(btn, pick(t.cheers.later));
  }
  save();
  render();
}

// Les données sont supprimées tout de suite ; l'animation n'est que visuelle.
function remove(task, li) {
  tasks = tasks.filter((t) => t !== task);
  save();
  if (reduceMotion) return render();
  li.animate(
    [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.6) rotate(-6deg)', opacity: 0 }],
    { duration: 220, easing: 'ease-in' },
  ).finished.then(render);
}

function startEdit(task, li) {
  const input = document.createElement('input');
  input.className = 'edit';
  input.value = task.text;
  input.maxLength = 120;
  input.enterKeyHint = 'done';
  input.setAttribute('aria-label', t.edit);
  li.querySelector('.text').replaceWith(input);
  input.focus();

  let cancelled = false;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cancelled = true;
    if (e.key === 'Enter' || e.key === 'Escape') input.blur();
  });
  input.addEventListener('blur', () => {
    const text = input.value.trim();
    if (!cancelled && text) {
      task.text = text;
      save();
    }
    render();
  }, { once: true });
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = els.input.value.trim();
  if (!text) return;
  const task = {
    id: newId(),
    text,
    done: false,
    color: ((tasks[0]?.color ?? 0) % TAG_COLORS) + 1,
    createdAt: Date.now(),
    worked: [],
  };
  tasks.unshift(task);
  freshId = task.id;
  if (filter === 'done' || filter === 'doing') filter = 'all';
  els.input.value = '';
  save();
  render();
});

els.list.addEventListener('click', (e) => {
  const li = e.target.closest('.item');
  const task = li && tasks.find((t) => t.id === li.dataset.id);
  if (!task) return;
  if (e.target.closest('.check')) toggle(task, e.target.closest('.check'));
  else if (e.target.closest('.later')) later(task, e.target.closest('.later'));
  else if (e.target.closest('.delete')) remove(task, li);
  else if (e.target.closest('.text')) startEdit(task, li);
});

els.filters.forEach((btn) => btn.addEventListener('click', () => {
  filter = btn.dataset.filter;
  render();
}));

els.clear.addEventListener('click', () => {
  if (!confirm(t.clearConfirm)) return;
  tasks = tasks.filter((t) => !t.done);
  save();
  render();
});

// Au retour sur l'appli (le lendemain matin par ex.), les « à demain » redeviennent à faire.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !els.list.querySelector('.edit')) render();
});

// Textes fixes de la page et du modèle de tâche, dans la langue de l'appareil (i18n.js)
document.documentElement.lang = LANG;
els.input.placeholder = t.newTask;
for (const root of [document, els.tpl.content]) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t[el.dataset.i18n]; });
  root.querySelectorAll('[data-i18n-label]').forEach((el) => el.setAttribute('aria-label', t[el.dataset.i18nLabel]));
}

render();
logger.info('app.start', { tasks: tasks.length, lang: LANG });

// Demande au navigateur de ne pas effacer nos données si le stockage manque
navigator.storage?.persist?.();

if ('serviceWorker' in navigator) {
  // Recharge une fois quand une nouvelle version de l'appli prend le relais
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) location.reload();
  });
  navigator.serviceWorker.register('sw.js')
    .then((reg) => logger.info('sw.registered', { scope: reg.scope }))
    .catch((err) => logger.warn('sw.register_failed', { error: String(err) }));
}
