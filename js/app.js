/**
 * @fileoverview App Entry Point
 * Bootstraps the entire Productivity Dashboard.
 *
 * Responsibilities:
 *  1. Apply persisted theme (dark/light) before first paint (avoids flash)
 *  2. On DOMContentLoaded, initialise all feature modules in dependency order
 *  3. Wire the theme toggle button
 *  4. Register keyboard shortcuts:
 *       N — focus the task input (when not in a text field)
 *       P — toggle Pomodoro start / pause
 *
 * Theme storage key : 'pdb_theme'   Values: 'dark' | 'light'
 *
 * @module app
 */

'use strict';

// =============================================================================
// 1. Theme — applied immediately (before DOMContentLoaded) to prevent FOUC
// =============================================================================

const THEME_KEY = 'pdb_theme';

/**
 * Reads the saved theme preference and applies it to <html> as a data attribute.
 * Called synchronously at script evaluation time so the correct theme is in
 * place before any rendering occurs.
 *
 * @returns {void}
 */
(function applyPersistedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      // Respect OS preference when no saved choice exists
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = prefersDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', initial);
      // Don't persist yet — only save on explicit user toggle
    }
  } catch {
    // localStorage unavailable (e.g. private browsing restrictions) — silently default to light
    document.documentElement.setAttribute('data-theme', 'light');
  }
}());

// =============================================================================
// 2. Theme toggle logic
// =============================================================================

/**
 * Returns the current theme from the <html> data attribute.
 *
 * @returns {'dark'|'light'}
 */
function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/**
 * Switches to the given theme, updates the DOM attribute, persists to
 * localStorage, and refreshes the toggle button label/icon.
 *
 * @param {'dark'|'light'} theme - Target theme
 * @returns {void}
 */
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (err) {
    console.warn('[App] Could not persist theme:', err);
  }
  _updateThemeToggleUI(theme);
}

/**
 * Toggles between dark and light themes.
 *
 * @returns {void}
 */
function toggleTheme() {
  const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

/**
 * Updates the theme toggle button's icon and accessible label
 * to reflect the currently active theme.
 *
 * @param {'dark'|'light'} theme - The now-active theme
 * @returns {void}
 */
function _updateThemeToggleUI(theme) {
  const btn  = document.getElementById('theme-toggle');
  const icon = btn ? btn.querySelector('.theme-toggle__icon') : null;

  if (!btn) return;

  if (theme === 'dark') {
    if (icon) icon.textContent = '☽';
    btn.setAttribute('aria-label', 'Switch to light mode');
    btn.setAttribute('title',      'Switch to light mode');
  } else {
    if (icon) icon.textContent = '☀';
    btn.setAttribute('aria-label', 'Switch to dark mode');
    btn.setAttribute('title',      'Switch to dark mode');
  }
}

// =============================================================================
// 3. Keyboard shortcuts
// =============================================================================

/**
 * Returns true if the currently focused element is a text-entry field.
 * Used to suppress shortcuts when the user is typing.
 *
 * @returns {boolean}
 */
function _focusedOnInput() {
  const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

/**
 * Registers global keyboard shortcut listeners.
 *  N — focus the task input field (skipped when already in a text field)
 *  P — toggle Pomodoro timer start / pause
 *
 * @returns {void}
 */
function _initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if modifier keys are held (Ctrl+N, etc.)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.key.toUpperCase()) {
      case 'N': {
        if (_focusedOnInput()) return;
        const taskInput = document.getElementById('task-input');
        if (taskInput) {
          e.preventDefault();
          taskInput.focus();
        }
        break;
      }
      case 'P': {
        if (_focusedOnInput()) return;
        if (typeof PomodoroTimer !== 'undefined') {
          e.preventDefault();
          PomodoroTimer.startPause();
        }
        break;
      }
    }
  });
}

// =============================================================================
// 4. Module bootstrap
// =============================================================================

/**
 * Main initialisation function.
 * Called once the DOM is fully parsed and all scripts are loaded.
 * Modules are initialised in dependency order:
 *   tasks → timer → notes → quotes → stats (reads from tasks + timer)
 *
 * @returns {void}
 */
function initApp() {
  // --- Theme toggle button ---
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // Sync toggle icon with the theme that was applied at script load time
  _updateThemeToggleUI(getCurrentTheme());

  // --- Feature modules ---
  // Each module exposes an `init()` function. We guard with typeof checks
  // so a missing script file produces a clear warning rather than a crash.

  if (typeof TaskManager !== 'undefined') {
    TaskManager.init();
  } else {
    console.error('[App] TaskManager module not loaded.');
  }

  if (typeof PomodoroTimer !== 'undefined') {
    PomodoroTimer.init();
  } else {
    console.error('[App] PomodoroTimer module not loaded.');
  }

  if (typeof Notes !== 'undefined') {
    Notes.init();
  } else {
    console.error('[App] Notes module not loaded.');
  }

  if (typeof Quotes !== 'undefined') {
    Quotes.init();
  } else {
    console.error('[App] Quotes module not loaded.');
  }

  // Stats depends on TaskManager + PomodoroTimer being initialised first
  if (typeof Stats !== 'undefined') {
    Stats.init();
  } else {
    console.error('[App] Stats module not loaded.');
  }

  // --- Keyboard shortcuts ---
  _initKeyboardShortcuts();

  // --- Cross-module event wiring ---
  // tasks.js dispatches 'taskchange' on every add/delete/toggle;
  // also listen for 'taskToggled' for stats updates.
  document.addEventListener('taskchange', () => {
    if (typeof Stats !== 'undefined') Stats.update();
  });

  document.addEventListener('taskToggled', () => {
    if (typeof Stats !== 'undefined') Stats.update();
  });

  console.info('[App] All modules initialised. Dashboard ready.');
}

// =============================================================================
// 5. Entry point
// =============================================================================

document.addEventListener('DOMContentLoaded', initApp);
