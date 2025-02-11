/**
 * @fileoverview Stats Module
 * Aggregates and displays productivity statistics in the stats widget.
 *
 * Stats displayed:
 *  - Tasks completed today     (from TaskManager)
 *  - Pomodoro sessions today   (from PomodoroTimer)
 *  - Focus time (minutes)      (derived: sessions × 25)
 *  - Active tasks remaining    (from TaskManager)
 *
 * Streak logic: localStorage key 'pdb_streak' stores { lastActiveDate, count }.
 * If lastActiveDate was yesterday → increment count.
 * If lastActiveDate is today → keep count.
 * Otherwise → reset to 1.
 *
 * Listens for 'taskchange' and 'pomodorocomplete' custom events to
 * update reactively without polling.
 *
 * @module stats
 */

'use strict';

const Stats = (() => {
  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  const STREAK_KEY = 'pdb_streak';

  // -------------------------------------------------------------------------
  // DOM element references — populated in init()
  // -------------------------------------------------------------------------

  let elTasksDone   = null; // #stat-tasks-completed
  let elPomodoros   = null; // #stat-pomodoros
  let elFocusTime   = null; // #stat-focus-time
  let elTasksActive = null; // #stat-tasks-active

  // -------------------------------------------------------------------------
  // Streak helpers
  // -------------------------------------------------------------------------

  /**
   * Returns today's date as YYYY-MM-DD in local time.
   *
   * @returns {string}
   */
  function _todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * Returns yesterday's date as YYYY-MM-DD in local time.
   *
   * @returns {string}
   */
  function _yesterdayISO() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * Reads and updates the streak from localStorage, then returns the current count.
   *
   * Rules:
   *  - If lastActiveDate === today   → keep streak as-is
   *  - If lastActiveDate === yesterday → increment streak + update date
   *  - Otherwise                      → reset to 1 with today's date
   *
   * @returns {number} Current streak day count
   */
  function _computeStreak() {
    const today     = _todayISO();
    const yesterday = _yesterdayISO();

    let streak = { lastActiveDate: null, count: 0 };

    try {
      const raw = localStorage.getItem(STREAK_KEY);
      if (raw) streak = JSON.parse(raw);
    } catch {
      streak = { lastActiveDate: null, count: 0 };
    }

    let newCount;

    if (streak.lastActiveDate === today) {
      // Already counted today — keep streak
      newCount = streak.count;
    } else if (streak.lastActiveDate === yesterday) {
      // Consecutive day — increment
      newCount = (streak.count || 0) + 1;
    } else {
      // Gap or first visit — reset
      newCount = 1;
    }

    try {
      localStorage.setItem(STREAK_KEY, JSON.stringify({
        lastActiveDate: today,
        count:          newCount,
      }));
    } catch (err) {
      console.warn('[Stats] Failed to save streak:', err);
    }

    return newCount;
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  /**
   * Reads current values from TaskManager and PomodoroTimer, then
   * updates every stat card in the DOM.
   *
   * Safe to call multiple times — purely reads and writes, no side effects.
   *
   * @returns {void}
   */
  function update() {
    // Guard: modules must be available
    if (typeof TaskManager === 'undefined' || typeof PomodoroTimer === 'undefined') {
      console.warn('[Stats] Dependent modules not loaded yet.');
      return;
    }

    const completedToday = TaskManager.getCompletedToday();
    const activeTasks    = TaskManager.getActiveCount();
    const sessions       = PomodoroTimer.getSessionCount();
    const focusMinutes   = sessions * 25;

    if (elTasksDone)   elTasksDone.textContent   = String(completedToday);
    if (elPomodoros)   elPomodoros.textContent   = String(sessions);
    if (elFocusTime)   elFocusTime.textContent   = `${focusMinutes}m`;
    if (elTasksActive) elTasksActive.textContent = String(activeTasks);
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------

  /**
   * Initialises the Stats module.
   * Caches DOM references, performs an initial render, and subscribes to
   * reactive update events from other modules.
   *
   * @returns {void}
   */
  function init() {
    elTasksDone   = document.getElementById('stat-tasks-completed');
    elPomodoros   = document.getElementById('stat-pomodoros');
    elFocusTime   = document.getElementById('stat-focus-time');
    elTasksActive = document.getElementById('stat-tasks-active');

    if (!elTasksDone || !elPomodoros || !elFocusTime || !elTasksActive) {
      console.warn('[Stats] One or more stat elements not found in DOM.');
    }

    // Compute (and persist) today's streak on page load
    _computeStreak();

    // Listen for changes emitted by other modules
    document.addEventListener('taskchange',       update);
    document.addEventListener('taskToggled',      update);
    document.addEventListener('pomodorocomplete', update);

    // Initial render
    update();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  return {
    init,
    update,
  };
})();
