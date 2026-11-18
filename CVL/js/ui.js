window.ui = {
  esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  bar: pct => '<div class="bar"><i style="width:' + pct + '%"></i></div>',
  durLabel: d => ({ 30: 'شهر', 60: 'شهران', 90: '3 أشهر', 180: '6 أشهر', 365: 'سنة' }[d] || d + ' يوماً'),
  date: d => d ? new Date(d).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' }) : '—',
  toast(text, type) {
    const t = document.getElementById('toast'); if (!t) return;
    t.textContent = text; t.className = 'toast show ' + (type || 'ok');
    clearTimeout(t._h); t._h = setTimeout(() => { t.className = 'toast'; }, 3500);
  },
  errText(e) {
    const m = String((e && e.message) || '');
    if (/invalid login/i.test(m)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    if (/already registered/i.test(m)) return 'هذا البريد مسجّل مسبقاً. سجّل الدخول بدلاً من ذلك.';
    if (/not confirmed/i.test(m)) return 'أكّد بريدك الإلكتروني من الرسالة المرسلة إليك ثم أعد المحاولة.';
    if (/rate limit|too many|only request this after/i.test(m)) return 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.';
    if (/different from the old/i.test(m)) return 'اختر كلمة مرور مختلفة عن القديمة.';
    if (/session missing|expired|invalid.*(token|link)/i.test(m)) return 'انتهت صلاحية الرابط. اطلب رابطاً جديداً.';
    if (/password/i.test(m)) return 'كلمة المرور لا تستوفي الشروط. استعمل 8 أحرف على الأقل.';
    return 'حدث خطأ غير متوقع. أعد المحاولة.';
  },
  // يعرض كود HTML داخل iframe معزول عبر sandbox.html (يعمل مع ترويسات CSP أيضاً)
  sandboxFrame(f, html) {
    f.setAttribute('sandbox', 'allow-scripts');
    f.addEventListener('load', () => f.contentWindow.postMessage({ html }, '*'), { once: true });
    f.src = 'sandbox.html';
  },
  tilt(root) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('[data-tilt]').forEach(c => {
      c.onpointermove = e => {
        const b = c.getBoundingClientRect();
        c.style.setProperty('--ry', ((e.clientX - b.left) / b.width - 0.5) * 10 + 'deg');
        c.style.setProperty('--rx', -((e.clientY - b.top) / b.height - 0.5) * 10 + 'deg');
      };
      c.onpointerleave = () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); };
    });
  }
};
