// صفحة تعيين كلمة مرور جديدة: تُفتح من رابط البريد (جلسة استرداد مؤقتة يلتقطها supabase-js من الرابط).
(() => {
  const $ = id => document.getElementById(id);
  const state = (t, type) => { const s = $('resetState'); s.textContent = t; s.className = 'form-msg ' + (type || ''); };
  const msg = (t, type) => { const m = $('formMsg'); m.textContent = t; m.className = 'form-msg ' + (type || ''); };
  const hash = location.hash, linkError = /error=/.test(hash), looksRecovery = /type=recovery/.test(hash);
  const expired = () => { state('الرابط غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً.', 'err'); $('again').hidden = false; };
  if (!window.api) { state('المنصة غير مهيأة: عدّل js/config.js', 'err'); return; }

  let ready = false;
  const show = () => { if (ready) return; ready = true; $('resetState').hidden = true; $('resetForm').hidden = false; };
  sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') show(); });
  (async () => {
    if (linkError) return expired();
    const s = await api.session();
    if (s && looksRecovery) return show();
    await new Promise(r => setTimeout(r, 800));   // انتظر حدث الاسترداد إن تأخر
    if (!ready) expired();
  })();

  $('resetForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target), pw = f.get('password'), btn = e.target.querySelector('button[type=submit]');
    if (pw.length < 8) return msg('كلمة المرور 8 أحرف على الأقل.', 'err');
    if (pw !== f.get('confirm')) return msg('كلمتا المرور غير متطابقتين.', 'err');
    btn.disabled = true;
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) { btn.disabled = false; return msg(ui.errText(error), 'err'); }
    msg('تم تغيير كلمة المرور. سننقلك إلى حسابك...', 'ok');
    let dest = 'student-dashboard.html';
    try { if ((await api.access()).is_admin) dest = 'admin-dashboard.html'; } catch (x) { /* تجاهل */ }
    setTimeout(() => location.replace(dest), 1200);
  });
})();
