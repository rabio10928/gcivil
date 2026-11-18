// الوضع الفاتح/الداكن. يُحمَّل في <head> ليُطبَّق قبل الرسم (بدون وميض).
(() => {
  const root = document.documentElement, KEY = 'theme', DEF = 'site_theme';
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* تجاهل */ } } };
  const mm = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
  // اختيار الزائر أولاً، ثم الوضع الافتراضي الذي حدده المدير (داكن إن لم يحدد)
  const resolve = () => {
    const u = ls.get(KEY); if (u === 'light' || u === 'dark') return u;
    const d = ls.get(DEF); return d === 'light' ? 'light' : d === 'system' ? (mm && mm.matches ? 'light' : 'dark') : 'dark';
  };
  const apply = () => { root.dataset.theme = resolve(); window.dispatchEvent(new Event('themechange')); };
  const ICON = '<svg class="i-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    + '<svg class="i-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function mount() {
    if (document.querySelector('.theme-btn')) return;
    const make = () => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'theme-btn'; b.innerHTML = ICON;
      b.setAttribute('aria-label', 'تبديل بين الوضع الفاتح والداكن'); b.title = 'تبديل الوضع';
      b.addEventListener('click', () => theme.toggle());
      return b;
    };
    const slots = document.querySelectorAll('[data-theme-slot]');
    if (slots.length) slots.forEach(s => s.appendChild(make()));
    else { const b = make(); b.classList.add('theme-fab'); document.body.appendChild(b); }
  }

  const theme = window.theme = {
    get: () => root.dataset.theme,
    toggle() { ls.set(KEY, root.dataset.theme === 'light' ? 'dark' : 'light'); apply(); },
    setDefault(d) { if (ls.get(DEF) !== d) { ls.set(DEF, d); apply(); } },
    mount
  };
  apply();
  if (mm && mm.addEventListener) mm.addEventListener('change', () => { if (!ls.get(KEY)) apply(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
