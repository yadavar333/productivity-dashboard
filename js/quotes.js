/**
 * @fileoverview Quotes Module
 * Fetches a random inspirational quote from the Quotable API on page load.
 * Renders into #quote-container. Gracefully handles network failures with
 * a curated local fallback pool.
 *
 * API endpoint: https://api.quotable.io/random
 *
 * @module quotes
 */

'use strict';

const Quotes = (() => {
  // -------------------------------------------------------------------------
  // Fallback quotes (used when the API is unreachable)
  // -------------------------------------------------------------------------

  /**
   * @typedef {Object} Quote
   * @property {string} content - The quote text
   * @property {string} author  - The author's name
   */

  /** @type {Array<Quote>} */
  const FALLBACK_QUOTES = [
    { content: 'The secret of getting ahead is getting started.',             author: 'Mark Twain' },
    { content: 'It is not enough to be busy, so too are the ants.',           author: 'Henry David Thoreau' },
    { content: 'Focus on being productive instead of busy.',                  author: 'Tim Ferriss' },
    { content: 'Simplicity is the ultimate sophistication.',                  author: 'Leonardo da Vinci' },
    { content: 'Work is the refuge of people who have nothing better to do.', author: 'Oscar Wilde' },
    { content: 'Done is better than perfect.',                                author: 'Sheryl Sandberg' },
    { content: 'Amateurs sit and wait for inspiration; the rest of us just get up and go to work.', author: 'Stephen King' },
    { content: 'The way to get started is to quit talking and begin doing.',  author: 'Walt Disney' },
    { content: 'You don\'t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
    { content: 'Productivity is never an accident. It is the result of a commitment to excellence.', author: 'Paul J. Meyer' },
  ];

  // -------------------------------------------------------------------------
  // DOM helpers
  // -------------------------------------------------------------------------

  /**
   * Renders a quote into the #quote-container element.
   *
   * @param {Quote} quote - The quote to display
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
   * Renders an error/loading message into the quote container.
   *
   * @param {string} message - Text to display
   * @returns {void}
   */
  function _renderFallback(message) {
    const container = document.getElementById('quote-container');
    if (!container) return;

    // Pick a random quote from the local pool
    const fallback = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
    _render(fallback);

    if (message) {
      console.info(`[Quotes] ${message} — showing fallback.`);
    }
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
  // API fetch
  // -------------------------------------------------------------------------

  /**
   * Fetches a random quote from the Quotable API.
   * Falls back to the local pool on any network or parse error.
   * Aborts after 5 seconds to avoid indefinite loading states.
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

      _render({ content: data.content, author: data.author });
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        _renderFallback('Request timed out');
      } else {
        _renderFallback(err.message);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------

  /**
   * Initialises the Quotes module. Fetches a quote immediately.
   *
   * @returns {void}
   */
  function init() {
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
