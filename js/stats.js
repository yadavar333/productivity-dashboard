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
 * Listens for 'taskchange' and 'pomodorocomplete' custom events to
 * update reactively without polling.
 *
 * @module stats
 */

'use strict';

const Stats = (() => {
  // -------------------------------------------------------------------------
  // DOM element references — populated in init()
  // -------------------------------------------------------------------------

  let elTasksDone   = null; // #stat-tasks-completed
  let elPomodoros   = null; // #stat-pomodoros
  let elFocusTime   = null; // #stat-focus-time
  let elTasksActive = null; // #stat-tasks-active

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

    // Listen for changes emitted by other modules
    document.addEventListener('taskchange',       update);
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
