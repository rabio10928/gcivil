// هوية الموقع من قاعدة البيانات: الاسم والشعار ونصوص الصفحة الرئيسية وبيانات التواصل والوضع الافتراضي.
// يُخزَّن آخر إصدار محلياً ليظهر فوراً دون وميض، ثم يُحدَّث من الخادم.
(() => {
  const KEY = 'site_cache', NAME0 = 'Civil Academy 3D', RX = /Civil (?:Engineering )?Academy 3D/g;
  const SAFE_EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
  const $$ = s => document.querySelectorAll(s);
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
  const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* تجاهل */ } };
  const logoUrl = p => (p && window.sb) ? sb.storage.from('site-assets').getPublicUrl(p).data.publicUrl : '';
  let curName = NAME0;

  const fixTitle = () => { if (document.title.includes(curName)) return; const n = document.title.replace(RX, () => curName); if (n !== document.title) document.title = n; };

  function apply(s) {
    s = s || {};
    curName = (s.site_name || '').trim() || NAME0;
    const url = logoUrl(s.logo_path);
    $$('.logo:not([data-logo-keep])').forEach(a => {
      a.textContent = '';
      if (url) { const i = document.createElement('img'); i.className = 'logo-img'; i.src = url; i.alt = curName; a.append(i); }
      else a.textContent = curName;
    });
    $$('[data-site-name]').forEach(e => { e.textContent = curName; });
    $$('[data-site-footer]').forEach(e => { e.textContent = (s.footer_text || '').trim(); });
    $$('[data-site]').forEach(e => { const v = (s[e.dataset.site] || '').trim(); if (v) e.textContent = v; });

    const email = (s.contact_email || '').trim(), phone = (s.contact_phone || '').trim(), okMail = SAFE_EMAIL.test(email);
    const re = document.querySelector('[data-site-row="contact_email"]'), rp = document.querySelector('[data-site-row="contact_phone"]');
    if (re) { re.hidden = !okMail; const a = re.querySelector('[data-site-email]'); if (okMail && a) { a.textContent = email; a.href = 'mailto:' + email; } }
    if (rp) { rp.hidden = !phone; const a = rp.querySelector('[data-site-phone]'); if (phone && a) { a.textContent = phone; a.href = 'tel:' + phone.replace(/[^\d+]/g, ''); } }
    const empty = document.querySelector('[data-site-empty]'); if (empty) empty.hidden = okMail || !!phone;

    if (url) {
      let l = document.querySelector('link[rel="icon"]');
      if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.append(l); }
      l.href = url;
    }
    fixTitle();
    const t = document.querySelector('title');
    if (t && !t._siteObs && window.MutationObserver) { t._siteObs = new MutationObserver(fixTitle); t._siteObs.observe(t, { childList: true }); }
    if (window.theme && s.default_theme) theme.setDefault(s.default_theme);
  }

  async function refresh() {
    if (!window.sb) return;
    const { data, error } = await sb.rpc('public_site');
    if (error || !data) return;
    write(data); apply(data);
  }

  const cached = read(), go = () => refresh().catch(() => {});
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { if (cached) apply(cached); go(); });
  } else { if (cached) apply(cached); go(); }
  window.site = { refresh, apply };
})();
