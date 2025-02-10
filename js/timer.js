/**
 * @fileoverview Pomodoro Timer Module
 * Implements a 25/5 work-break cycle with:
 * - Circular SVG ring progress indicator
 * - Start / pause / reset controls
 * - Session counter (persisted to localStorage)
 * - Custom events so stats.js stays in sync
 *
 * Storage key : 'pdb_timer_sessions'
 *
 * @module timer
 */

'use strict';

const PomodoroTimer = (() => {
  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  const WORK_MINUTES  = 25;
  const BREAK_MINUTES = 5;
  const STORAGE_KEY   = 'pdb_timer_sessions';

  /** Full circumference of the SVG ring (r = 80): 2π × 80 ≈ 502.65 */
  const RING_CIRCUMFERENCE = 2 * Math.PI * 80;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  /** @type {'work'|'break'} */
  let mode = 'work';

  /** @type {number} Remaining seconds in the current interval */
  let remainingSeconds = WORK_MINUTES * 60;

  /** @type {boolean} */
  let running = false;

  /** @type {number|null} setInterval handle */
  let intervalHandle = null;

  /** @type {number} Number of completed work sessions (today, from storage) */
  let sessionCount = 0;

  // -------------------------------------------------------------------------
  // DOM references — populated in init()
  // -------------------------------------------------------------------------

  let elDisplay    = null; // #timer-display
  let elRing       = null; // #timer-ring-progress
  let elMode       = null; // #timer-mode-label
  let elStartBtn   = null; // #timer-start
  let elResetBtn   = null; // #timer-reset
  let elPips       = null; // #session-pips
  let elBadge      = null; // #session-count-badge

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Loads the session count stored for today from localStorage.
   * Resets to zero if stored date differs from today.
   *
   * @returns {void}
   */
  function loadSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.date === _todayISO()) {
        sessionCount = Number(data.count) || 0;
      } else {
        // New day — reset counter but keep key for potential debugging
        sessionCount = 0;
        _persistSessions();
      }
    } catch {
      sessionCount = 0;
    }
  }

  /**
   * Saves the current session count with today's date to localStorage.
   *
   * @returns {void}
   */
  function _persistSessions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        date:  _todayISO(),
        count: sessionCount,
      }));
    } catch (err) {
      console.warn('[PomodoroTimer] Failed to save sessions:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Timer control
  // -------------------------------------------------------------------------

  /**
   * Starts or pauses the timer depending on current state.
   *
   * @returns {void}
   */
  function startPause() {
    if (running) {
      _pause();
    } else {
      _start();
    }
  }

  /**
   * Starts the countdown interval.
   *
   * @returns {void}
   */
  function _start() {
    if (running) return;
    running = true;
    _updateStartButton();

    intervalHandle = setInterval(() => {
      if (remainingSeconds <= 0) {
        _onIntervalComplete();
        return;
      }
      remainingSeconds--;
      _renderDisplay();
      _renderRing();
    }, 1000);
  }

  /**
   * Pauses the countdown without resetting state.
   *
   * @returns {void}
   */
  function _pause() {
    running = false;
    _updateStartButton();
    if (intervalHandle !== null) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  /**
   * Resets the timer back to the beginning of the current mode.
   *
   * @returns {void}
   */
  function reset() {
    _pause();
    remainingSeconds = _totalSeconds();
    _renderDisplay();
    _renderRing();
    _renderMode();
  }

  /**
   * Called when a countdown interval (work or break) reaches zero.
   * Increments session counter on work completion, then switches mode.
   *
   * @returns {void}
   */
  function _onIntervalComplete() {
    _pause();

    if (mode === 'work') {
      sessionCount++;
      _persistSessions();
      _renderSessionPips();
      _updateBadge();
      document.dispatchEvent(new CustomEvent('pomodorocomplete', {
        detail: { sessionCount },
      }));
      _notify('Work session complete! Time for a break 🎉');
    } else {
      _notify('Break over. Ready to focus? 💪');
    }

    // Flip mode
    mode = mode === 'work' ? 'break' : 'work';
    remainingSeconds = _totalSeconds();

    _renderDisplay();
    _renderRing();
    _renderMode();
    // Auto-start the next interval
    _start();
  }

  // -------------------------------------------------------------------------
  // Rendering helpers
  // -------------------------------------------------------------------------

  /**
   * Updates the MM:SS text in the timer display element.
   *
   * @returns {void}
   */
  function _renderDisplay() {
    if (!elDisplay) return;
    elDisplay.textContent = _formatTime(remainingSeconds);
    // Keep the page title in sync so the user can see the timer in the tab
    document.title = `${_formatTime(remainingSeconds)} — Focus`;
  }

  /**
   * Updates the SVG ring's stroke-dashoffset to reflect remaining time.
   *
   * @returns {void}
   */
  function _renderRing() {
    if (!elRing) return;
    const progress = remainingSeconds / _totalSeconds();
    const offset   = RING_CIRCUMFERENCE * (1 - progress);
    elRing.style.strokeDashoffset = String(offset);

    elRing.classList.toggle('timer-ring-progress--break', mode === 'break');
  }

  /**
   * Updates the mode label text and CSS modifier class.
   *
   * @returns {void}
   */
  function _renderMode() {
    if (!elMode) return;
    elMode.textContent = mode === 'work' ? 'Work Session' : 'Short Break';
    elMode.className   = `timer-mode timer-mode--${mode}`;
  }

  /**
   * Renders session pip dots (filled = completed session).
   * Shows up to 8 pips; resets visually after a full set of 4.
   *
   * @returns {void}
   */
  function _renderSessionPips() {
    if (!elPips) return;
    const MAX_PIPS = 8;
    const filled   = Math.min(sessionCount, MAX_PIPS);
    elPips.innerHTML = '';

    for (let i = 0; i < MAX_PIPS; i++) {
      const pip = document.createElement('span');
      pip.className = `session-pip${i < filled ? ' session-pip--filled' : ''}`;
      pip.setAttribute('aria-hidden', 'true');
      elPips.appendChild(pip);
    }
  }

  /**
   * Updates the session count badge in the widget header.
   *
   * @returns {void}
   */
  function _updateBadge() {
    if (!elBadge) return;
    elBadge.textContent = String(sessionCount);
    elBadge.setAttribute('aria-label', `${sessionCount} session${sessionCount !== 1 ? 's' : ''} completed`);
  }

  /**
   * Toggles the start button label between "Start" and "Pause".
   *
   * @returns {void}
   */
  function _updateStartButton() {
    if (!elStartBtn) return;
    elStartBtn.textContent  = running ? 'Pause' : 'Start';
    elStartBtn.setAttribute('aria-label', running ? 'Pause timer' : 'Start timer');
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  /**
   * Returns total seconds for the current mode.
   *
   * @returns {number}
   */
  function _totalSeconds() {
    return (mode === 'work' ? WORK_MINUTES : BREAK_MINUTES) * 60;
  }

  /**
   * Formats seconds as MM:SS string.
   *
   * @param {number} seconds - Total seconds to format
   * @returns {string} e.g. "24:59"
   */
  function _formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Returns today's date as an ISO string (YYYY-MM-DD) in local time.
   *
   * @returns {string}
   */
  function _todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * Shows a browser Notification if permission allows, otherwise logs.
   *
   * @param {string} message - Notification body text
   * @returns {void}
   */
  function _notify(message) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification('Focus — Pomodoro', { body: message, icon: '' });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Focus — Pomodoro', { body: message });
        }
      });
    }
  }

  // -------------------------------------------------------------------------
  // Public accessor
  // -------------------------------------------------------------------------

  /**
   * Returns the number of completed work sessions today.
   *
   * @returns {number}
   */
  function getSessionCount() {
    return sessionCount;
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------

  /**
   * Initialises the Pomodoro timer module.
   * Grabs DOM references, restores session count, and wires event listeners.
   *
   * @returns {void}
   */
  function init() {
    elDisplay  = document.getElementById('timer-display');
    elRing     = document.getElementById('timer-ring-progress');
    elMode     = document.getElementById('timer-mode-label');
    elStartBtn = document.getElementById('timer-start');
    elResetBtn = document.getElementById('timer-reset');
    elPips     = document.getElementById('session-pips');
    elBadge    = document.getElementById('session-count-badge');

    if (!elDisplay || !elRing) {
      console.warn('[PomodoroTimer] Required DOM elements not found.');
      return;
    }

    // Initialise ring circumference attribute
    elRing.style.strokeDasharray = String(RING_CIRCUMFERENCE);

    // Restore persisted data
    loadSessions();

    // Attach controls
    if (elStartBtn) elStartBtn.addEventListener('click', startPause);
    if (elResetBtn) elResetBtn.addEventListener('click', reset);

    // Initial render
    _renderDisplay();
    _renderRing();
    _renderMode();
    _renderSessionPips();
    _updateBadge();
  }

  return {
    init,
    startPause,
    reset,
    getSessionCount,
  };
})();
