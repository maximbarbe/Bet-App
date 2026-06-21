// Small DOM and display helpers shared across the interface.
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];

export const money = (value) => new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2
}).format(value || 0);

export const signedMoney = (value) => `${value > 0 ? '+' : ''}${money(value)}`;

export function formatDate(value, short = false) {
  const date = new Date(value);
  const options = short
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-CA', options);
}

// Escape user-entered text before placing it inside generated HTML.
export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}
