/**
 * @fileoverview Task Manager Module
 * Handles task CRUD, persistence, filtering, and DOM rendering.
 * Uses the module pattern to expose a single global `TaskManager` object.
 *
 * Storage key : 'pdb_tasks'
 * Task schema : { id, text, priority, dueDate, completed, createdAt, completedAt? }
 *
 * @module tasks
 */

'use strict';

const TaskManager = (() => {
  // -------------------------------------------------------------------------
  // Private state
  // -------------------------------------------------------------------------

  /** @type {Array<Task>} In-memory task store */
  let tasks = [];

  /** @type {string} Currently active filter: 'all' | 'active' | 'done' */
  let activeFilter = 'all';

  const STORAGE_KEY = 'pdb_tasks';

  // -------------------------------------------------------------------------
  // Type definitions (JSDoc only — no TypeScript)
  // -------------------------------------------------------------------------

  /**
   * @typedef {Object} Task
   * @property {number}      id          - Unique identifier (Date.now() at creation)
   * @property {string}      text        - Task description
   * @property {'high'|'medium'|'low'} priority - Priority level
   * @property {string|null} dueDate     - ISO date string (YYYY-MM-DD) or null
   * @property {boolean}     completed   - Whether the task is done
   * @property {number}      createdAt   - Unix timestamp (ms)
   * @property {number|null} completedAt - Unix timestamp when marked done, or null
   */

  // -------------------------------------------------------------------------
  // Core CRUD
  // -------------------------------------------------------------------------

  /**
   * Creates a new task and persists it.
   * Dispatches a 'taskchange' custom event on the document.
   *
   * @param {string} text      - Task description (required, non-empty)
   * @param {'high'|'medium'|'low'} [priority='medium'] - Priority level
   * @param {string|null} [dueDate=null] - ISO date string or empty string
   * @returns {Task|null} The newly created task, or null if text is empty
   */
  function addTask(text, priority = 'medium', dueDate = null) {
    const trimmed = text.trim();
    if (!trimmed) return null;

    /** @type {Task} */
    const task = {
      id:          Date.now(),
      text:        trimmed,
      priority:    ['high', 'medium', 'low'].includes(priority) ? priority : 'medium',
      dueDate:     dueDate || null,
      completed:   false,
      createdAt:   Date.now(),
      completedAt: null,
    };

    tasks.unshift(task); // newest first
    saveTasks();
    _dispatchChange();
    return task;
  }

  /**
   * Removes a task by its numeric ID.
   *
   * @param {number} id - Task ID to remove
   * @returns {boolean} True if a task was found and removed
   */
  function deleteTask(id) {
    const before = tasks.length;
    tasks = tasks.filter(t => t.id !== id);
    if (tasks.length === before) return false;
    saveTasks();
    _dispatchChange();
    return true;
  }

  /**
   * Toggles the completed state of a task.
   * Records `completedAt` timestamp when marking done; clears it on un-do.
   *
   * @param {number} id - Task ID to toggle
   * @returns {Task|null} The updated task object, or null if not found
   */
  function toggleComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return null;

    task.completed   = !task.completed;
    task.completedAt = task.completed ? Date.now() : null;

    saveTasks();
    _dispatchChange();
    return task;
  }

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  /**
   * Filters the internal task array.
   *
   * @param {'all'|'active'|'done'} filter - Which subset to return
   * @returns {Array<Task>} Filtered (shallow copy) array of tasks
   */
  function filterTasks(filter) {
    switch (filter) {
      case 'active': return tasks.filter(t => !t.completed);
      case 'done':   return tasks.filter(t =>  t.completed);
      default:       return [...tasks]; // 'all'
    }
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Serialises the current task array to localStorage.
   * Silently catches quota / serialisation errors.
   *
   * @returns {void}
   */
  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.warn('[TaskManager] Failed to save tasks:', err);
    }
  }

  /**
   * Deserialises tasks from localStorage into memory.
   * Invalid or missing data results in an empty array.
   *
   * @returns {void}
   */
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      tasks = parsed.filter(_isValidTask);
    } catch (err) {
      console.warn('[TaskManager] Failed to load tasks:', err);
      tasks = [];
    }
  }

  // -------------------------------------------------------------------------
  // Stats helpers
  // -------------------------------------------------------------------------

  /**
   * Returns the count of tasks that were completed today (local date).
   *
   * @returns {number} Count of tasks completed since midnight today
   */
  function getCompletedToday() {
    const startOfToday = _startOfToday();
    return tasks.filter(t => t.completedAt && t.completedAt >= startOfToday).length;
  }

  /**
   * Returns the count of tasks that are not yet completed.
   *
   * @returns {number} Active task count
   */
  function getActiveCount() {
    return tasks.filter(t => !t.completed).length;
  }

  // -------------------------------------------------------------------------
  // DOM Rendering
  // -------------------------------------------------------------------------

  /**
   * Builds and injects the task list DOM from the current task data.
   * Attaches event listeners to each rendered item.
   * Updates the task-count badge.
   *
   * @param {string} [filter] - Optional filter override; uses `activeFilter` if omitted
   * @returns {void}
   */
  function renderTasks(filter) {
    if (filter) activeFilter = filter;

    const list    = document.getElementById('task-list');
    const badge   = document.getElementById('task-count-badge');
    if (!list) return;

    const visible = filterTasks(activeFilter);

    // Update badge to show active (incomplete) count
    if (badge) {
      const activeCount = getActiveCount();
      badge.textContent = activeCount;
      badge.setAttribute('aria-label', `${activeCount} active task${activeCount !== 1 ? 's' : ''}`);
    }

    // Empty state
    if (visible.length === 0) {
      list.innerHTML = `<li class="task-list__empty">${_emptyMessage(activeFilter)}</li>`;
      return;
    }

    // Build fragment for efficiency
    const fragment = document.createDocumentFragment();
    visible.forEach(task => {
      const el = _buildTaskElement(task);
      fragment.appendChild(el);
    });

    list.innerHTML = '';
    list.appendChild(fragment);

    // Update filter tab aria states
    _updateFilterTabs();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Validates a raw parsed object is a usable Task.
   *
   * @param {*} obj - Value to validate
   * @returns {boolean}
   */
  function _isValidTask(obj) {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      typeof obj.id === 'number' &&
      typeof obj.text === 'string' &&
      obj.text.trim().length > 0
    );
  }

  /**
   * Returns the Unix ms timestamp for the start of today (midnight local time).
   *
   * @returns {number}
   */
  function _startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  /**
   * Returns an appropriate empty-state message for the given filter.
   *
   * @param {'all'|'active'|'done'} filter
   * @returns {string}
   */
  function _emptyMessage(filter) {
    switch (filter) {
      case 'active': return 'No active tasks — great work!';
      case 'done':   return 'No completed tasks yet.';
      default:       return 'No tasks yet. Add one above!';
    }
  }

  /**
   * Builds a single task `<li>` element with all sub-elements and listeners.
   *
   * @param {Task} task
   * @returns {HTMLLIElement}
   */
  function _buildTaskElement(task) {
    const li = document.createElement('li');
    li.className = `task-item${task.completed ? ' task-item--completed' : ''}`;
    li.dataset.id       = task.id;
    li.dataset.priority = task.priority;
    li.setAttribute('role', 'listitem');

    // --- Checkbox ---
    const checkbox = document.createElement('input');
    checkbox.type      = 'checkbox';
    checkbox.className = 'task-item__checkbox';
    checkbox.checked   = task.completed;
    checkbox.setAttribute('aria-label', `Mark "${_truncate(task.text, 40)}" as ${task.completed ? 'incomplete' : 'complete'}`);
    checkbox.addEventListener('change', () => {
      toggleComplete(task.id);
      renderTasks();
      // Notify stats
      document.dispatchEvent(new CustomEvent('taskchange'));
    });

    // --- Content ---
    const content = document.createElement('div');
    content.className = 'task-item__content';

    const textEl = document.createElement('span');
    textEl.className   = 'task-item__text';
    textEl.textContent = task.text;

    const meta = document.createElement('div');
    meta.className = 'task-item__meta';

    // Priority badge
    const badge = document.createElement('span');
    badge.className   = `priority-badge priority-badge--${task.priority}`;
    badge.textContent = _priorityLabel(task.priority);
    badge.setAttribute('aria-label', `Priority: ${task.priority}`);

    meta.appendChild(badge);

    // Due date (if set)
    if (task.dueDate) {
      const dueEl = document.createElement('span');
      const overdue = !task.completed && _isOverdue(task.dueDate);
      dueEl.className   = `task-item__due${overdue ? ' task-item__due--overdue' : ''}`;
      dueEl.textContent = `📅 ${_formatDate(task.dueDate)}`;
      dueEl.setAttribute('aria-label', `Due ${_formatDate(task.dueDate)}${overdue ? ' (overdue)' : ''}`);
      meta.appendChild(dueEl);
    }

    content.appendChild(textEl);
    content.appendChild(meta);

    // --- Delete button ---
    const deleteBtn = document.createElement('button');
    deleteBtn.className   = 'btn btn--danger btn--icon btn--sm task-item__delete';
    deleteBtn.innerHTML   = '✕';
    deleteBtn.setAttribute('aria-label', `Delete task: ${_truncate(task.text, 40)}`);
    deleteBtn.addEventListener('click', () => {
      // Brief fade-out before removal
      li.style.opacity    = '0';
      li.style.transform  = 'translateX(12px)';
      li.style.transition = 'opacity 150ms ease, transform 150ms ease';
      setTimeout(() => {
        deleteTask(task.id);
        renderTasks();
        document.dispatchEvent(new CustomEvent('taskchange'));
      }, 150);
    });

    li.appendChild(checkbox);
    li.appendChild(content);
    li.appendChild(deleteBtn);

    return li;
  }

  /**
   * Returns a short human-readable label for a priority level.
   *
   * @param {'high'|'medium'|'low'} priority
   * @returns {string}
   */
  function _priorityLabel(priority) {
    return { high: 'High', medium: 'Med', low: 'Low' }[priority] || priority;
  }

  /**
   * Formats an ISO date string (YYYY-MM-DD) as "D Mon" e.g. "4 Jun".
   *
   * @param {string} isoDate - ISO date string
   * @returns {string}
   */
  function _formatDate(isoDate) {
    const [year, month, day] = isoDate.split('-').map(Number);
    const date  = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.getTime() === today.getTime())    return 'Today';
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';

    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  /**
   * Returns true if the given ISO date string represents a date before today.
   *
   * @param {string} isoDate
   * @returns {boolean}
   */
  function _isOverdue(isoDate) {
    const [year, month, day] = isoDate.split('-').map(Number);
    const due   = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }

  /**
   * Truncates a string to a max length, appending '…' if trimmed.
   *
   * @param {string} str
   * @param {number} max
   * @returns {string}
   */
  function _truncate(str, max) {
    return str.length > max ? `${str.slice(0, max)}…` : str;
  }

  /**
   * Updates aria-selected and active class on filter tab buttons.
   *
   * @returns {void}
   */
  function _updateFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
      const isActive = tab.dataset.filter === activeFilter;
      tab.classList.toggle('filter-tab--active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });
  }

  /**
   * Dispatches a 'taskchange' custom event so other modules can react.
   *
   * @returns {void}
   */
  function _dispatchChange() {
    document.dispatchEvent(new CustomEvent('taskchange'));
  }

  // -------------------------------------------------------------------------
  // Init — wire up static DOM listeners
  // -------------------------------------------------------------------------

  /**
   * Attaches form submit and filter tab click listeners.
   * Called once from app.js after DOMContentLoaded.
   *
   * @returns {void}
   */
  function init() {
    loadTasks();

    // Task form submission
    const form      = document.getElementById('task-form');
    const input     = document.getElementById('task-input');
    const priority  = document.getElementById('task-priority');
    const dueDate   = document.getElementById('task-due-date');

    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const text = input ? input.value : '';
        if (!text.trim()) return;

        addTask(
          text,
          priority ? priority.value : 'medium',
          dueDate  ? dueDate.value  : null
        );

        // Reset form
        if (input)   input.value    = '';
        if (dueDate) dueDate.value  = '';
        if (priority) priority.value = 'medium';

        renderTasks();
        if (input) input.focus();
      });
    }

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        renderTasks(tab.dataset.filter);
      });
    });

    // Initial render
    renderTasks();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  return {
    init,
    addTask,
    deleteTask,
    toggleComplete,
    filterTasks,
    saveTasks,
    loadTasks,
    renderTasks,
    getCompletedToday,
    getActiveCount,
  };
})();
