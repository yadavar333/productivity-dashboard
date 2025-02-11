/**
 * @fileoverview Notes Module
 * Provides a freeform textarea that auto-saves content to localStorage.
 * Shows a transient "Saved" indicator and live word count on every keystroke.
 *
 * Storage key : 'pdb_notes'
 *
 * @module notes
 */

'use strict';

const Notes = (() => {
  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  const STORAGE_KEY    = 'pdb_notes';
  const AUTOSAVE_DELAY = 300; // ms after last keystroke before saving

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  /** @type {number|null} Debounce timer handle */
  let debounceHandle = null;

  /** @type {HTMLTextAreaElement|null} */
  let textarea = null;

  /** @type {HTMLElement|null} */
  let savedIndicator = null;

  /** @type {HTMLElement|null} */
  let wordCountEl = null;

  /** @type {number|null} Handle for hiding the saved indicator */
  let indicatorHandle = null;

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Reads the stored note content from localStorage and populates the textarea.
   * Silently handles missing or unreadable data.
   *
   * @returns {void}
   */
  function load() {
    try {
      const content = localStorage.getItem(STORAGE_KEY);
      if (textarea && content !== null) {
        textarea.value = content;
        _updateWordCount();
      }
    } catch (err) {
      console.warn('[Notes] Failed to load notes:', err);
    }
  }

  /**
   * Saves the current textarea content to localStorage.
   * Triggers the "Saved" indicator on success.
   *
   * @returns {void}
   */
  function save() {
    if (!textarea) return;
    try {
      localStorage.setItem(STORAGE_KEY, textarea.value);
      _showSavedIndicator();
    } catch (err) {
      console.warn('[Notes] Failed to save notes:', err);
    }
  }

  // -------------------------------------------------------------------------
  // UI feedback
  // -------------------------------------------------------------------------

  /**
   * Briefly shows the "✓ Saved" indicator then fades it out after 1 second.
   *
   * @returns {void}
   */
  function _showSavedIndicator() {
    if (!savedIndicator) return;

    savedIndicator.classList.add('notes-saved-indicator--visible');

    // Clear any previous hide timer
    if (indicatorHandle !== null) {
      clearTimeout(indicatorHandle);
    }

    indicatorHandle = setTimeout(() => {
      savedIndicator.classList.remove('notes-saved-indicator--visible');
      indicatorHandle = null;
    }, 1000);
  }

  /**
   * Counts words in the textarea and updates the word count element.
   *
   * @returns {void}
   */
  function _updateWordCount() {
    if (!wordCountEl || !textarea) return;
    const text  = textarea.value.trim();
    const count = text.length === 0 ? 0 : text.split(/\s+/).length;
    wordCountEl.textContent = `${count} word${count !== 1 ? 's' : ''}`;
  }

  // -------------------------------------------------------------------------
  // Event wiring
  // -------------------------------------------------------------------------

  /**
   * Input handler — updates word count immediately, debounces the save.
   *
   * @returns {void}
   */
  function _onInput() {
    _updateWordCount();

    if (debounceHandle !== null) {
      clearTimeout(debounceHandle);
    }
    debounceHandle = setTimeout(() => {
      save();
      debounceHandle = null;
    }, AUTOSAVE_DELAY);
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------

  /**
   * Initialises the Notes module.
   * Locates DOM elements, restores saved content, and attaches input listener.
   *
   * @returns {void}
   */
  function init() {
    textarea       = document.getElementById('notes-area');
    savedIndicator = document.getElementById('notes-saved-indicator');
    wordCountEl    = document.getElementById('notes-word-count');

    if (!textarea) {
      console.warn('[Notes] Textarea element not found.');
      return;
    }

    load();

    textarea.addEventListener('input', _onInput);

    // Also save immediately on blur (e.g. user tabs away before debounce fires)
    textarea.addEventListener('blur', () => {
      if (debounceHandle !== null) {
        clearTimeout(debounceHandle);
        debounceHandle = null;
      }
      save();
    });
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  return {
    init,
    save,
    load,
  };
})();
