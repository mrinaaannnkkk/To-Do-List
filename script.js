/**
 * ============================================================
 * TASKFLOW — Premium To-Do App
 * script.js
 * ============================================================
 */

// ── STATE ────────────────────────────────────────────────────
let tasks = [];          // Array of task objects
let currentFilter = 'all';
let currentSort = 'created';
let deleteTargetId = null;  // ID of task pending deletion

// ── CONSTANTS ────────────────────────────────────────────────
const STORAGE_KEY = 'taskflow_tasks';
const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 };

// ── DOM REFERENCES ───────────────────────────────────────────
const taskInput       = document.getElementById('task-input');
const addBtn          = document.getElementById('add-btn');
const taskList        = document.getElementById('task-list');
const emptyState      = document.getElementById('empty-state');
const searchInput     = document.getElementById('search-input');
const filterTabs      = document.querySelectorAll('.filter-tab');
const sortSelect      = document.getElementById('sort-select');
const themeToggle     = document.getElementById('theme-toggle');
const themeIcon       = document.getElementById('theme-icon');
const clearCompletedBtn = document.getElementById('clear-completed-btn');
const modalOverlay    = document.getElementById('modal-overlay');
const modalCancel     = document.getElementById('modal-cancel');
const modalConfirm    = document.getElementById('modal-confirm');
const headerDate      = document.getElementById('header-date');
const bottomInfo      = document.getElementById('bottom-info');

// Stat elements
const statTotal     = document.getElementById('stat-total');
const statPending   = document.getElementById('stat-pending');
const statCompleted = document.getElementById('stat-completed');
const statHigh      = document.getElementById('stat-high');
const progressFill  = document.getElementById('progress-fill');
const progressPct   = document.getElementById('progress-pct');
const progressTrack = document.querySelector('.progress-track');

// ── INITIALISE ───────────────────────────────────────────────
function init() {
  loadFromStorage();
  setHeaderDate();
  applyStoredTheme();
  renderAll();
  initDragDrop();
  attachEventListeners();

  // Load sample tasks only on first visit
  if (tasks.length === 0) loadSampleTasks();
}

// ── SAMPLE DATA ──────────────────────────────────────────────
function loadSampleTasks() {
  const now = Date.now();
  const hour = 3600000;

  tasks = [
    createTask('Complete MERN Stack project documentation', 'Study',  'high',   new Date(now + 24 * hour).toISOString().slice(0,16)),
    createTask('Review lecture notes on React Hooks',        'Study',  'high',   new Date(now + 48 * hour).toISOString().slice(0,16)),
    createTask('Submit assignment to professor',              'Work',   'medium', new Date(now + 6  * hour).toISOString().slice(0,16)),
    createTask('Push code to GitHub',                        'Work',   'medium', ''),
    createTask('Exercise for 30 minutes',                    'Health', 'low',    ''),
    createTask('Read chapter 7 of DBMS book',                'Study',  'low',    new Date(now + 72 * hour).toISOString().slice(0,16)),
  ];

  // Mark one as completed for demo
  tasks[4].completed = true;
  tasks[4].completedAt = Date.now();

  saveToStorage();
}

/** Factory: create a new task object */
function createTask(title, category, priority, due) {
  return {
    id:          crypto.randomUUID(),
    title:       title.trim(),
    category:    category || '',
    priority:    priority || 'medium',
    due:         due || '',
    completed:   false,
    createdAt:   Date.now(),
    completedAt: null,
    order:       tasks.length,
  };
}

// ── LOCAL STORAGE ────────────────────────────────────────────
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
function loadFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) tasks = JSON.parse(saved);
  } catch (e) {
    tasks = [];
  }
}

// ── RENDER ───────────────────────────────────────────────────

/** Master render — filters, sorts, then paints list */
function renderAll() {
  const query = searchInput.value.toLowerCase().trim();

  // 1. Filter
  let filtered = tasks.filter(t => {
    const matchSearch =
      t.title.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query);

    let matchFilter = true;
    if (currentFilter === 'completed') matchFilter = t.completed;
    else if (currentFilter === 'pending')   matchFilter = !t.completed;
    else if (currentFilter === 'high')      matchFilter = t.priority === 'high';

    return matchSearch && matchFilter;
  });

  // 2. Sort
  filtered.sort((a, b) => {
    if (currentSort === 'priority') return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
    if (currentSort === 'due') {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    }
    // Default: created (newest first within same custom order)
    return a.order - b.order;
  });

  // 3. Paint
  taskList.innerHTML = '';
  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    filtered.forEach(t => taskList.appendChild(buildTaskElement(t)));
  }

  updateStats();
}

/** Build a task list item element */
function buildTaskElement(task) {
  const li = document.createElement('li');
  li.classList.add('task-item');
  if (task.completed) li.classList.add('completed');
  li.dataset.id = task.id;
  li.dataset.priority = task.priority;

  // ── Checkbox
  const checkbox = document.createElement('button');
  checkbox.className = 'task-checkbox' + (task.completed ? ' checked' : '');
  checkbox.setAttribute('aria-label', task.completed ? 'Mark incomplete' : 'Mark complete');
  checkbox.innerHTML = '<i class="ph-bold ph-check check-icon"></i>';
  checkbox.addEventListener('click', () => toggleComplete(task.id));

  // ── Body
  const body = document.createElement('div');
  body.className = 'task-body';

  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = task.title;

  const metaRow = document.createElement('div');
  metaRow.className = 'task-meta-row';

  // Category badge
  if (task.category) {
    const catBadge = document.createElement('span');
    catBadge.className = 'task-category-badge';
    catBadge.innerHTML = `<i class="ph ph-tag"></i>${task.category}`;
    metaRow.appendChild(catBadge);
  }

  // Priority badge
  const pBadge = document.createElement('span');
  pBadge.className = `priority-badge ${task.priority}`;
  const pIcons = { high: '🔴', medium: '🟡', low: '🟢' };
  pBadge.textContent = `${pIcons[task.priority]} ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`;
  metaRow.appendChild(pBadge);

  // Due date
  if (task.due) {
    const dueEl = document.createElement('span');
    dueEl.className = 'task-due';
    const dueDate = new Date(task.due);
    const isOverdue = !task.completed && dueDate < new Date();
    if (isOverdue) dueEl.classList.add('overdue');
    dueEl.innerHTML = `<i class="ph ph-calendar-blank"></i>${formatDue(dueDate, isOverdue)}`;
    metaRow.appendChild(dueEl);
  }

  body.appendChild(title);
  body.appendChild(metaRow);

  // ── Actions
  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'action-btn edit-btn';
  editBtn.title = 'Edit task';
  editBtn.setAttribute('aria-label', 'Edit task');
  editBtn.innerHTML = '<i class="ph ph-pencil-simple"></i>';
  editBtn.addEventListener('click', () => startEdit(task.id, li, title));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-btn delete-btn';
  deleteBtn.title = 'Delete task';
  deleteBtn.setAttribute('aria-label', 'Delete task');
  deleteBtn.innerHTML = '<i class="ph ph-trash"></i>';
  deleteBtn.addEventListener('click', () => confirmDelete(task.id));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  li.appendChild(checkbox);
  li.appendChild(body);
  li.appendChild(actions);

  return li;
}

// ── TASK ACTIONS ─────────────────────────────────────────────

/** Add a new task from form inputs */
function addTask() {
  const title = taskInput.value.trim();
  if (!title) {
    showToast('Please enter a task!', 'warning');
    taskInput.focus();
    return;
  }

  const category = document.getElementById('task-category').value.trim();
  const priority  = document.getElementById('task-priority').value;
  const due       = document.getElementById('task-due').value;

  const newTask = createTask(title, category, priority, due);
  newTask.order = tasks.length;
  tasks.push(newTask);
  saveToStorage();
  renderAll();

  // Reset form
  taskInput.value = '';
  document.getElementById('task-category').value = '';
  document.getElementById('task-priority').value = 'medium';
  document.getElementById('task-due').value = '';
  taskInput.focus();

  showToast('Task added! 🚀', 'success');
}

/** Toggle completed state */
function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  task.completedAt = task.completed ? Date.now() : null;
  saveToStorage();
  renderAll();
  showToast(task.completed ? 'Task completed! ✅' : 'Task reopened 🔄', task.completed ? 'success' : 'info');
}

/** Inline edit */
function startEdit(id, li, titleEl) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  // Replace title div with an input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input';
  input.value = task.title;
  input.maxLength = 200;
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  // Hide edit button while editing
  const editBtn = li.querySelector('.edit-btn');
  if (editBtn) editBtn.style.display = 'none';

  // Save on blur or Enter; cancel on Escape
  const save = () => {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== task.title) {
      task.title = newTitle;
      saveToStorage();
      showToast('Task updated ✏️', 'info');
    }
    renderAll();
  };
  const cancel = () => renderAll();

  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', save); cancel(); }
  });
}

/** Show delete confirmation modal */
function confirmDelete(id) {
  deleteTargetId = id;
  modalOverlay.classList.remove('hidden');
}

/** Actually delete after confirmation */
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveToStorage();
  renderAll();
  showToast('Task deleted 🗑️', 'error');
}

/** Clear all completed tasks */
function clearCompleted() {
  const count = tasks.filter(t => t.completed).length;
  if (count === 0) { showToast('No completed tasks to clear!', 'warning'); return; }
  tasks = tasks.filter(t => !t.completed);
  saveToStorage();
  renderAll();
  showToast(`Cleared ${count} completed task${count > 1 ? 's' : ''} 🧹`, 'success');
}

// ── STATS & PROGRESS ─────────────────────────────────────────
function updateStats() {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending   = total - completed;
  const high      = tasks.filter(t => t.priority === 'high' && !t.completed).length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  statTotal.textContent     = total;
  statPending.textContent   = pending;
  statCompleted.textContent = completed;
  statHigh.textContent      = high;
  progressFill.style.width  = pct + '%';
  progressPct.textContent   = pct + '%';
  progressTrack.setAttribute('aria-valuenow', pct);

  bottomInfo.textContent = `${total} task${total !== 1 ? 's' : ''} · ${completed} done`;
}

// ── DRAG & DROP ──────────────────────────────────────────────
function initDragDrop() {
  Sortable.create(taskList, {
    animation: 180,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    handle: '.task-item',
    onEnd(evt) {
      // Re-sync the `order` property after drag
      const items = taskList.querySelectorAll('.task-item');
      items.forEach((el, idx) => {
        const id = el.dataset.id;
        const task = tasks.find(t => t.id === id);
        if (task) task.order = idx;
      });
      saveToStorage();
    },
  });
}

// ── THEME ────────────────────────────────────────────────────
function applyStoredTheme() {
  const saved = localStorage.getItem('taskflow_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  themeIcon.className = saved === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  themeIcon.className = next === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
  localStorage.setItem('taskflow_theme', next);
}

// ── TOAST NOTIFICATIONS ───────────────────────────────────────
/**
 * Show a toast message
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 */
function showToast(message, type = 'info') {
  const icons = { success: 'ph-check-circle', error: 'ph-x-circle', info: 'ph-info', warning: 'ph-warning' };
  const toastEl = document.createElement('div');
  toastEl.className = `toast ${type}`;
  toastEl.innerHTML = `<i class="ph-fill ${icons[type]}"></i><span>${message}</span>`;
  document.getElementById('toast-container').appendChild(toastEl);

  // Auto-remove after 3s
  setTimeout(() => {
    toastEl.classList.add('out');
    setTimeout(() => toastEl.remove(), 300);
  }, 2800);
}

// ── UTILITIES ────────────────────────────────────────────────

/** Set header date string */
function setHeaderDate() {
  const opts = { weekday: 'long', month: 'long', day: 'numeric' };
  headerDate.textContent = new Date().toLocaleDateString(undefined, opts);
}

/** Format due date for display */
function formatDue(date, isOverdue) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((dueDay - today) / 86400000);

  let label = '';
  if (diffDays === 0) label = 'Today';
  else if (diffDays === 1) label = 'Tomorrow';
  else if (diffDays === -1) label = 'Yesterday';
  else if (diffDays > 1 && diffDays < 7) label = `In ${diffDays} days`;
  else label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (isOverdue && diffDays < 0) label = `Overdue · ${label}`;
  return label;
}

// ── EVENT LISTENERS ──────────────────────────────────────────
function attachEventListeners() {
  // Add task
  addBtn.addEventListener('click', addTask);
  taskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  // Search (instant)
  searchInput.addEventListener('input', renderAll);

  // Filter tabs
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderAll();
    });
  });

  // Sort
  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    renderAll();
  });

  // Theme toggle
  themeToggle.addEventListener('click', toggleTheme);

  // Clear completed
  clearCompletedBtn.addEventListener('click', clearCompleted);

  // Modal
  modalCancel.addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
    deleteTargetId = null;
  });
  modalConfirm.addEventListener('click', () => {
    if (deleteTargetId) deleteTask(deleteTargetId);
    modalOverlay.classList.add('hidden');
    deleteTargetId = null;
  });
  // Close modal on overlay click
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.add('hidden');
      deleteTargetId = null;
    }
  });

  // Keyboard: Escape closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
      modalOverlay.classList.add('hidden');
      deleteTargetId = null;
    }
  });
}

// ── BOOT ─────────────────────────────────────────────────────
init();