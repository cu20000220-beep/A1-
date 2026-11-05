'use strict';
(() => {
  const key = 'a1-fashion:language';
  const dictionary = new Map([['언어 선택', 'Language'], ['↗', '→']]);
  const textSources = new WeakMap(), attributeSources = new WeakMap(), bindings = new Map();
  let language, scheduled = false, observer;
  try { const saved = localStorage.getItem(key); if (saved === 'ko' || saved === 'en') language = saved; } catch { /* Browser language is sufficient when storage is unavailable. */ }
  if (!language) language = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase().startsWith('ko') ? 'ko' : 'en';

  function t(source, values = {}) {
    const result = language === 'en' ? dictionary.get(source) ?? source : source;
    return String(result).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
  }
  function setText(element, source, values = {}) {
    if (!element) return;
    bindings.set(element, { source, values });
    const next = t(source, values);
    if (element.textContent !== next) element.textContent = next;
  }
  function ignored(element) {
    return !element || Boolean(element.closest('script,style,code,pre,svg,[data-i18n-ignore]'));
  }
  function mountSwitchers() {
    document.querySelectorAll('[data-language-switcher]').forEach(mount => {
      if (mount.querySelector('[data-language-select]')) return;
      const label = document.createElement('label'); label.className = 'language-control';
      const text = document.createElement('span'); text.className = 'sr-only'; text.textContent = '언어 선택';
      const select = document.createElement('select'); select.dataset.languageSelect = ''; select.setAttribute('aria-label', '언어 선택');
      for (const [value, name] of [['ko', '한국어'], ['en', 'English']]) {
        const option = document.createElement('option'); option.value = value; option.textContent = name; option.dataset.i18nIgnore = ''; select.append(option);
      }
      select.value = language;
      select.addEventListener('change', () => setLanguage(select.value));
      label.append(text, select); mount.append(label);
    });
  }
  function translateNode(node) {
    if (ignored(node.parentElement)) return;
    const current = node.nodeValue;
    if (!current?.trim()) return;
    const old = textSources.get(node);
    const source = old && current === old.rendered ? old.source : current;
    const trimmed = source.trim();
    const translated = language === 'en' ? dictionary.get(trimmed) ?? trimmed : trimmed;
    const start = source.indexOf(trimmed);
    const rendered = source.slice(0, start) + translated + source.slice(start + trimmed.length);
    textSources.set(node, { source, rendered });
    if (rendered !== current) node.nodeValue = rendered;
  }
  function translateAttributes(element) {
    if (ignored(element)) return;
    let sources = attributeSources.get(element);
    if (!sources) { sources = new Map(); attributeSources.set(element, sources); }
    for (const name of ['aria-label', 'title', 'placeholder', 'alt', ...(element.tagName === 'META' ? ['content'] : [])]) {
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name), old = sources.get(name);
      const source = old && current === old.rendered ? old.source : current;
      const rendered = language === 'en' ? dictionary.get(source) ?? source : source;
      sources.set(name, { source, rendered });
      if (rendered !== current) element.setAttribute(name, rendered);
    }
  }
  function refresh() {
    observer?.disconnect();
    mountSwitchers();
    // A translated option label must never change the API's canonical value.
    document.querySelectorAll('option:not([value])').forEach(option => option.setAttribute('value', option.textContent));
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) translateNode(walker.currentNode);
    document.querySelectorAll('[aria-label],[title],[placeholder],[alt],meta[content]').forEach(translateAttributes);
    for (const [element, binding] of bindings) {
      if (!element.isConnected) { bindings.delete(element); continue; }
      const next = t(binding.source, binding.values);
      if (element.textContent !== next) element.textContent = next;
    }
    document.documentElement.lang = language;
    document.querySelectorAll('[data-language-select]').forEach(select => { select.value = language; });
    observer?.observe(document.documentElement, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder', 'alt', 'content'] });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; refresh(); });
  }
  function setLanguage(next, persist = true) {
    if (next !== 'ko' && next !== 'en') return;
    const changed = next !== language;
    language = next;
    if (persist) { try { localStorage.setItem(key, next); } catch { /* Keep the choice for this page. */ } }
    refresh();
    if (changed) document.dispatchEvent(new CustomEvent('a1:language-changed', { detail: Object.freeze({ language }) }));
  }
  function register(entries) {
    for (const [source, translated] of Object.entries(entries)) {
      if (typeof translated === 'string') dictionary.set(source, translated.replaceAll('↗', '→'));
    }
    schedule();
  }
  window.A1I18n = Object.freeze({ get language() { return language; }, get locale() { return language === 'ko' ? 'ko-KR' : 'en-US'; }, t, setText, setLanguage, register, refresh });
  observer = new MutationObserver(schedule);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();
  window.addEventListener('storage', event => { if (event.key === key && (event.newValue === 'ko' || event.newValue === 'en')) setLanguage(event.newValue, false); });
})();
