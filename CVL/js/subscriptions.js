(async () => {
  const root = document.getElementById('view'), { esc } = ui;
  if (!window.api) { root.innerHTML = '<p class="state err">المنصة غير مهيأة: عدّل js/config.js</p>'; return; }
  const session = await guards.requireAuth(), uid = session.user.id;
  const METHODS = ['بريدي موب (BaridiMob)', 'حساب بريدي جاري (CCP)', 'تحويل بنكي', 'دفع نقدي', 'أخرى'];
  const PAY = { pending: ['قيد المراجعة', 'draft'], confirmed: ['مؤكد', 'pub'], rejected: ['مرفوض', 'rej'] };
  const DAY = 86400000;
  let selId = null, last = null;

  async function init() {
    root.innerHTML = '<p class="state">جارٍ التحميل...</p>';
    try {
      const [ac, pr, st, pay] = await Promise.all([
        api.access(), sb.rpc('public_pricing'),
        sb.from('app_settings').select('key,value'),
        sb.from('payments').select('*').order('created_at', { ascending: false })
      ]);
      for (const x of [pr, st, pay]) if (x.error) throw x.error;
      last = [ac, pr.data, Object.fromEntries(st.data.map(r => [r.key, r.value])), pay.data];
      render();
    } catch (e) {
      console.error(e);
      root.innerHTML = '<p class="state err">تعذّر تحميل الصفحة.<br><button class="btn ghost" id="retry" type="button">إعادة المحاولة</button></p>';
      document.getElementById('retry').onclick = init;
    }
  }

  function render() {
    const [ac, P, S, pays] = last, plans = P.plans || [], trial = +P.trial_days || 0;
    const info = typeof S.payment_instructions === 'string' ? S.payment_instructions : '';
    const pending = pays.find(p => p.status === 'pending');
    if (!plans.some(p => p.id === selId)) selId = plans.length === 1 ? plans[0].id : null;
    const sel = plans.find(p => p.id === selId);
    const soon = ac.reason === 'subscription' && +new Date(ac.subscription_ends_at) - Date.now() < 30 * DAY;
    const line = { admin: 'حساب مدير: وصول كامل ولا يحتاج اشتراكاً.', trial: `تجربتك المجانية تنتهي في ${ui.date(ac.trial_ends_at)}.`,
      subscription: `اشتراكك فعّال حتى ${ui.date(ac.subscription_ends_at)}.` + (soon ? ' يمكنك التجديد الآن، وتُضاف المدة الجديدة بعد نهاية اشتراكك الحالي.' : ''),
      none: 'انتهى وصولك إلى الدروس. اشترك لمتابعة التعلم.' }[ac.reason];
    const label = { admin: 'مدير', trial: 'تجربة مجانية', subscription: 'اشتراك فعّال', none: 'منتهٍ' }[ac.reason];
    const today = new Date().toISOString().slice(0, 10);

    const card = p => `<div class="glass plan${p.is_featured ? ' featured' : ''}${p.id === selId ? ' picked' : ''}"><h3>${esc(p.name)}</h3>
      <p class="amount">${p.price_da} DA <small>/ ${esc(ui.durLabel(p.duration_days))}</small></p>${p.description ? `<p class="note">${esc(p.description)}</p>` : ''}
      <ul>${(p.features || []).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <button class="btn${p.id === selId ? '' : ' ghost'}" type="button" data-plan="${p.id}"${pending ? ' disabled' : ''}>${p.id === selId ? 'الخطة المختارة ✓' : 'اختر هذه الخطة'}</button></div>`;

    const form = pending
      ? `<div class="glass wait"><h2 style="margin-top:0">طلبك قيد المراجعة</h2><p class="note">أرسلت بيانات العملية <span dir="ltr">${esc(pending.reference)}</span>${pending.plan_name ? ' لخطة «' + esc(pending.plan_name) + '»' : ''} بتاريخ ${ui.date(pending.created_at)}. يُفعَّل اشتراكك بعد أن تؤكد الإدارة استلام المبلغ.</p></div>`
      : !plans.length ? '<p class="state">لا توجد خطط اشتراك متاحة حالياً. تواصل مع الإدارة.</p>'
      : !sel ? '<p class="state">اختر خطة من الأعلى لتظهر لك بيانات الدفع.</p>'
      : `<form id="payForm" class="glass pay-form"><h2 style="margin:0">أرسل بيانات الدفع</h2>
          <p><b>${esc(sel.name)}</b> — ${sel.price_da} DA / ${esc(ui.durLabel(sel.duration_days))}</p>
          <p class="note">بعد تحويل ${sel.price_da} DA، أدخل بيانات العملية. لا يُفعَّل الاشتراك بمجرد إرسال الطلب، بل بعد أن تؤكد الإدارة استلام المبلغ.</p>
          <label>طريقة الدفع<select name="method">${METHODS.map(m => `<option>${m}</option>`).join('')}</select></label>
          <label>رقم العملية أو الوصل<input name="reference" required minlength="4" maxlength="60" dir="ltr" autocomplete="off"></label>
          <label>تاريخ العملية<input type="date" name="paid_on" required max="${today}"></label>
          <p id="formMsg" class="form-msg" role="alert"></p>
          <button class="btn lg" type="submit">أرسل الطلب</button></form>`;

    root.innerHTML = `<a class="back" href="student-dashboard.html">العودة إلى لوحتي</a>
      <h1 style="margin-top:.6rem">الاشتراك</h1>
      <section class="glass status"><b>${label}</b><p>${line}</p></section>
      ${ac.reason === 'admin' ? '' : `
      <section class="grid price">
        ${trial > 0 ? `<div class="glass plan"><h3>تجربة مجانية</h3><p class="amount">${trial} أيام</p>
          <ul><li>كل الدروس</li><li>الفيديوهات وPDF</li><li>دروس HTML التفاعلية</li></ul><p class="note">تبدأ تلقائياً عند إنشاء الحساب.</p></div>` : ''}
        ${plans.map(card).join('')}
      </section>
      <section class="glass pay-info"><h2 style="margin-top:0">طريقة الدفع</h2>
        <div class="pre">${esc(info) || 'ستظهر تعليمات الدفع هنا بعد أن تضيفها الإدارة.'}</div></section>
      <div id="payArea">${form}</div>`}
      ${pays.length ? `<h2>طلباتي السابقة</h2><div class="lrows">${pays.map(p => `<div class="lrow"><div class="grow"><b>${esc(p.plan_name || 'اشتراك')} — ${p.amount_da} DA</b>
        <small>${esc(p.method || '')} • <span dir="ltr">${esc(p.reference || '')}</span> • ${ui.date(p.paid_on)}</small>
        ${p.status === 'rejected' && p.admin_note ? `<small>سبب الرفض: ${esc(p.admin_note)}</small>` : ''}</div>
        <span class="badge ${PAY[p.status][1]}">${PAY[p.status][0]}</span></div>`).join('')}</div>` : ''}`;

    const f = document.getElementById('payForm');
    if (f) f.addEventListener('submit', async e => {
      e.preventDefault();
      const m = document.getElementById('formMsg'), fd = new FormData(f), ref = fd.get('reference').trim(), btn = f.querySelector('button[type=submit]');
      const say = t => { m.textContent = t; m.className = 'form-msg err'; };
      if (ref.length < 4) return say('اكتب رقم العملية كما يظهر في الوصل.');
      if (!fd.get('paid_on')) return say('اختر تاريخ العملية.');
      btn.disabled = true;
      const { error } = await sb.from('payments').insert({ user_id: uid, plan_id: sel.id, plan_name: sel.name, amount_da: sel.price_da, duration_days: sel.duration_days,
        method: fd.get('method'), reference: ref, paid_on: fd.get('paid_on'), status: 'pending' });
      btn.disabled = false;
      if (error) {
        const t = String(error.message || '');
        return say(/one_pending/.test(t) ? 'لديك طلب قيد المراجعة بالفعل.' : /reference_uq/.test(t) ? 'رقم العملية هذا مسجّل مسبقاً.'
          : /row-level security/.test(t) ? 'تغيّرت الخطة أو سعرها أو أُوقفت. أعد تحميل الصفحة ثم اختر الخطة من جديد.' : 'تعذّر إرسال الطلب. أعد المحاولة.');
      }
      ui.toast('تم إرسال طلبك. سيُفعَّل اشتراكك بعد تأكيد الإدارة.');
      init();
    });
  }

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-plan]'); if (!b || !last) return;
    selId = b.dataset.plan; render();
    const a = document.getElementById('payArea'); if (a && a.scrollIntoView) a.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  init();
})();
