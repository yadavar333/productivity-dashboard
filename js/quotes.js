/**
 * @fileoverview Quotes Module
 * Fetches a random inspirational quote from the Quotable API on page load.
 * Caches the result to localStorage with today's date — only fetches once per day.
 * Falls back to a hardcoded quote on any network or API failure.
 *
 * API endpoint  : https://api.quotable.io/random
 * Cache key     : 'pdb_quote_cache'
 *
 * @module quotes
 */

'use strict';

const Quotes = (() => {
  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  const CACHE_KEY = 'pdb_quote_cache';

  /**
   * Hardcoded fallback quote shown when API is unreachable.
   * @type {{content: string, author: string}}
   */
  const FALLBACK_QUOTE = {
    content: 'The secret of getting ahead is getting started.',
    author:  'Mark Twain',
  };

  // -------------------------------------------------------------------------
  // Helpers
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
   * Escapes HTML special characters to prevent XSS when inserting API content.
   *
   * @param {string} str - Raw string from API
   * @returns {string} HTML-safe string
   */
  function _escapeHtml(str) {
    return str
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  // -------------------------------------------------------------------------
  // DOM rendering
  // -------------------------------------------------------------------------

  /**
   * Renders a quote into the #quote-container element.
   *
   * @param {{content: string, author: string}} quote
   * @returns {void}
   */
  function _render(quote) {
    const container = document.getElementById('quote-container');
    if (!container) return;

    container.innerHTML = `
      <blockquote class="quote-block">
        <p class="quote-block__text">${_escapeHtml(quote.content)}</p>
        <footer class="quote-block__author">— ${_escapeHtml(quote.author)}</footer>
      </blockquote>
    `;
  }

  /**
   * Renders a loading placeholder in the quote container.
   *
   * @returns {void}
   */
  function _renderLoading() {
    const container = document.getElementById('quote-container');
    if (!container) return;
    container.innerHTML = `
      <blockquote class="quote-block">
        <p class="quote-block__loading" id="quote-text">Loading quote…</p>
      </blockquote>
    `;
  }

  // -------------------------------------------------------------------------
  // Cache helpers
  // -------------------------------------------------------------------------

  /**
   * Attempts to return a cached quote for today.
   * Returns null if cache is empty or stale.
   *
   * @returns {{content: string, author: string}|null}
   */
  function _loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.date === _todayISO() && data.content && data.author) {
        return { content: data.content, author: data.author };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Saves a quote to the localStorage cache with today's date.
   *
   * @param {{content: string, author: string}} quote
   * @returns {void}
   */
  function _saveCache(quote) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        date:    _todayISO(),
        content: quote.content,
        author:  quote.author,
      }));
    } catch (err) {
      console.warn('[Quotes] Failed to cache quote:', err);
    }
  }

  // -------------------------------------------------------------------------
  // API fetch
  // -------------------------------------------------------------------------

  /**
   * Fetches a random quote from the Quotable API.
   * Aborts after 5 seconds to avoid indefinite loading states.
   * Falls back to FALLBACK_QUOTE on any network or parse error.
   *
   * @returns {Promise<void>}
   */
  async function fetchQuote() {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch('https://api.quotable.io/random', {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data || typeof data.content !== 'string' || typeof data.author !== 'string') {
        throw new Error('Unexpected API response shape');
      }

      const quote = { content: data.content, author: data.author };
      _saveCache(quote);
      _render(quote);
    } catch (err) {
      clearTimeout(timeoutId);
      const label = err.name === 'AbortError' ? 'Request timed out' : err.message;
      console.info(`[Quotes] ${label} — showing fallback.`);
      _render(FALLBACK_QUOTE);
    }
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------

  /**
   * Initialises the Quotes module.
   * Uses today's cached quote if available; otherwise fetches a fresh one.
   *
   * @returns {void}
   */
  function init() {
    _renderLoading();

    const cached = _loadCache();
    if (cached) {
      _render(cached);
      return;
    }

    fetchQuote();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  return {
    init,
    fetchQuote,
  };
})();
