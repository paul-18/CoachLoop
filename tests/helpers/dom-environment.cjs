const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await wait(20); }
  assert.ok(await check(), label);
}
function environment() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/CoachLoop/', pretendToBeVisual: true });
  const bound = new Set(['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']);
  for (const key of ['window', 'document', 'navigator', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLDetailsElement', 'SVGElement', 'Node', 'NodeFilter', 'MutationObserver', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    Object.defineProperty(globalThis, key, { value: bound.has(key) ? dom.window[key].bind(dom.window) : dom.window[key], configurable: true });
  }
  Object.assign(globalThis, { indexedDB, IDBKeyRange, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, ResizeObserver: class { observe() {} disconnect() {} unobserve() {} } });
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  Object.defineProperty(navigator, 'locks', { value: { request: async (_name, _options, callback) => callback({}) } });
  return dom;
}
function tab(name) {
  const button = [...document.querySelectorAll('[role="tab"]')].find(b => b.textContent === name);
  assert.ok(button, name);
  button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
}
module.exports = { environment, until, tab, wait };
