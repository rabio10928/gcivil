(() => {
  const $ = id => document.getElementById(id);
  const note = (text, type) => { const m = $('formMsg'); if (m) { m.textContent = text; m.className = 'form-msg ' + (type || ''); } };
  const busy = (btn, on) => { btn.dataset.t = btn.dataset.t || btn.textContent; btn.disabled = on; btn.textContent = on ? 'جارٍ المعالجة...' : btn.dataset.t; };
  const safeNext = () => {
    const n = new URLSearchParams(location.search).get('next');
    return n && /^[\w-]+\.html(\?[\w=&.-]*)?$/.test(n) ? n : 'student-dashboard.html';
  };
  const reg = $('registerForm'), login = $('loginForm'), out = $('logoutBtn');
  if (!window.api) { note('المنصة غير مهيأة: عدّل js/config.js', 'err'); return; }
  if (reg || login) guards.requireGuest();

  if (reg) reg.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(reg), name = f.get('full_name').trim(), email = f.get('email').trim(), pw = f.get('password');
    if (name.length < 3) return note('اكتب اسمك الكامل.', 'err');
    if (pw.length < 8) return note('كلمة المرور 8 أحرف على الأقل.', 'err');
    if (pw !== f.get('confirm')) return note('كلمتا المرور غير متطابقتين.', 'err');
    const btn = reg.querySelector('button[type=submit]'); busy(btn, true);
    const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { full_name: name } } });
    busy(btn, false);
    if (error) return note(ui.errText(error), 'err');
    if (data.user && data.user.identities && data.user.identities.length === 0) return note(ui.errText({ message: 'already registered' }), 'err');
    if (data.session) return location.replace('student-dashboard.html');
    reg.reset(); note('تم إنشاء الحساب. أكّد بريدك من الرسالة المرسلة إليك ثم سجّل الدخول.', 'ok');
  });

  if (login) login.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(login), btn = login.querySelector('button[type=submit]'); busy(btn, true);
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email').trim(), password: f.get('password') });
    if (error) { busy(btn, false); return note(ui.errText(error), 'err'); }
    let dest = safeNext();
    if (!new URLSearchParams(location.search).get('next')) {
      try { if ((await api.access()).is_admin) dest = 'admin-dashboard.html'; } catch (x) { /* تجاهل */ }
    }
    location.replace(dest);
  });

  const forgot = $('forgotForm');
  if (forgot) forgot.addEventListener('submit', async e => {
    e.preventDefault();
    const email = new FormData(forgot).get('email').trim(), btn = forgot.querySelector('button[type=submit]');
    if (!/^\S+@\S+\.\S+$/.test(email)) return note('اكتب بريداً إلكترونياً صحيحاً.', 'err');
    busy(btn, true);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL('reset-password.html', location.href).href });
    if (error) { busy(btn, false); return note(ui.errText(error), 'err'); }
    // رسالة موحّدة سواء كان البريد مسجلاً أم لا، حتى لا يُكشف وجود الحسابات
    note('إن كان هذا البريد مسجلاً لدينا فستصلك رسالة خلال دقائق. تحقق أيضاً من البريد المزعج.', 'ok');
    let s = 60; btn.textContent = 'أعد الإرسال بعد 60 ثانية';
    const t = setInterval(() => { s -= 1; btn.textContent = 'أعد الإرسال بعد ' + s + ' ثانية'; if (s <= 0) { clearInterval(t); busy(btn, false); } }, 1000);
  });

  if (out) out.addEventListener('click', async () => { await sb.auth.signOut(); location.replace('login.html'); });

  // مدة التجربة من الإعدادات بدل نص ثابت
  if (document.querySelector('[data-trial]')) sb.rpc('public_pricing').then(({ data }) => {
    if (!data) return;
    document.querySelectorAll('[data-trial]').forEach(e => { e.textContent = data.trial_days; });
    document.querySelectorAll('[data-trial-line]').forEach(e => { e.hidden = !(data.trial_days > 0); });
  }).catch(() => {});
})();
