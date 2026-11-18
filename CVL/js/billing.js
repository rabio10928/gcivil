// لوحة الإدارة: المدفوعات والاشتراكات والإعدادات
(() => {
  const $ = id => document.getElementById(id), { esc } = ui, D = ui.date, view = $('view');
  const PAY = { pending: ['قيد المراجعة', 'draft'], confirmed: ['مؤكد', 'pub'], rejected: ['مرفوض', 'rej'] };
  const fail = (e, w) => { console.error(e); ui.toast((w || 'تعذّرت العملية') + (e && e.message ? ': ' + e.message : ''), 'err'); };
  let payFilter = 'pending';

  async function names(ids) {
    ids = [...new Set(ids)];
    if (!ids.length) return new Map();
    const r = await sb.from('profiles').select('id,full_name').in('id', ids);
    if (r.error) throw r.error;
    return new Map(r.data.map(x => [x.id, x.full_name || 'بدون اسم']));
  }

  // ===== المدفوعات =====
  adm.views.payments = async () => {
    let qy = sb.from('payments').select('*').order('created_at', { ascending: false }).limit(200);
    if (payFilter !== 'all') qy = qy.eq('status', payFilter);
    const r = await qy; if (r.error) throw r.error;
    const nm = await names(r.data.map(p => p.user_id));
    const opts = [['pending', 'بانتظار المراجعة'], ['confirmed', 'مؤكدة'], ['rejected', 'مرفوضة'], ['all', 'الكل']];
    return `<h1>إدارة المدفوعات</h1>
      <div class="toolbar"><label>الحالة<select data-payf>${opts.map(([v, t]) => `<option value="${v}"${v === payFilter ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
      ${r.data.length ? `<div class="lrows">${r.data.map(p => `<div class="lrow"><div class="grow"><b>${esc(nm.get(p.user_id))}</b>
        <small>${esc(p.plan_name || 'بدون خطة')} • ${p.amount_da} DA${p.duration_days ? ' • ' + esc(ui.durLabel(p.duration_days)) : ''} • ${esc(p.method || '—')} • رقم العملية: <span dir="ltr">${esc(p.reference || '—')}</span></small>
        <small>تاريخ العملية: ${D(p.paid_on)} • أُرسل: ${D(p.created_at)}${p.admin_note ? ' • ملاحظة: ' + esc(p.admin_note) : ''}</small></div>
        <span class="badge ${PAY[p.status][1]}">${PAY[p.status][0]}</span>
        ${p.status === 'pending' ? `<div class="acts"><button class="btn sm" data-pconf="${p.id}">تأكيد الدفع</button><button class="btn ghost sm danger" data-prej="${p.id}">رفض</button></div>` : ''}</div>`).join('')}</div>`
        : '<p class="state">لا توجد مدفوعات في هذه الحالة.</p>'}`;
  };

  // ===== الاشتراكات =====
  adm.views.subscriptions = async () => {
    const r = await sb.from('subscriptions').select('*').order('ends_at', { ascending: false }).limit(200); if (r.error) throw r.error;
    const nm = await names(r.data.map(s => s.user_id)), now = Date.now();
    const stat = s => s.status === 'cancelled' ? ['ملغى', 'rej'] : +new Date(s.ends_at) <= now ? ['منتهٍ', 'hid'] : +new Date(s.starts_at) > now ? ['لم يبدأ بعد', 'draft'] : ['فعّال', 'pub'];
    return `<h1>إدارة الاشتراكات</h1><div class="toolbar"><button class="btn" data-sgrant>منح اشتراك يدوي</button></div>
      ${r.data.length ? `<div class="lrows">${r.data.map(s => { const [t, c] = stat(s); return `<div class="lrow"><div class="grow"><b>${esc(nm.get(s.user_id))}</b>
        <small>من ${D(s.starts_at)} إلى ${D(s.ends_at)} • ${s.payment_id ? 'عن دفعة مؤكدة' : 'منح يدوي'}</small></div>
        <span class="badge ${c}">${t}</span>${s.status === 'active' && +new Date(s.ends_at) > now ? `<button class="btn ghost sm danger" data-scancel="${s.id}">إلغاء</button>` : ''}</div>`; }).join('')}</div>`
        : '<p class="state">لا توجد اشتراكات بعد. تظهر هنا عند تأكيد أول دفعة.</p>'}`;
  };

  async function grant() {
    const [p, st] = await Promise.all([
      sb.from('profiles').select('id,full_name').eq('role', 'student').order('full_name').limit(500),
      sb.from('app_settings').select('value').eq('key', 'subscription_days').maybeSingle()
    ]);
    if (p.error) throw p.error;
    if (!p.data.length) return ui.toast('لا يوجد طلاب مسجّلون بعد.', 'err');
    adm.openForm('منح اشتراك يدوي', `
      <label>الطالب<select name="user" required>${p.data.map(x => `<option value="${x.id}">${esc(x.full_name || 'بدون اسم')}</option>`).join('')}</select></label>
      <label>المدة بالأيام<input type="number" name="days" min="1" max="3650" required value="${st.data ? +st.data.value || 365 : 365}"></label>
      <p class="note">يبدأ الاشتراك الآن ولا يُحسب كدفعة في الإيرادات. للدفع النقدي الأفضل أن يرسل الطالب طلب دفع وتؤكده، لتظهر الدفعة في الإيرادات.</p>`,
      async fd => {
        const days = +fd.get('days');
        if (!(days >= 1 && days <= 3650)) throw new Error('المدة بين 1 و3650 يوماً');
        const now = new Date(), end = new Date(now.getTime() + days * 86400000);
        const { error } = await sb.from('subscriptions').insert({ user_id: fd.get('user'), status: 'active', starts_at: now.toISOString(), ends_at: end.toISOString() });
        if (error) throw error;
        adm.render();
      });
  }

  // ===== الإعدادات: التجربة المجانية وتعليمات الدفع (الأسعار والمدد في «خطط الاشتراك») =====
  adm.views.settings = async () => {
    const r = await sb.from('app_settings').select('key,value'); if (r.error) throw r.error;
    const S = Object.fromEntries(r.data.map(x => [x.key, x.value]));
    const td = Number.isFinite(+S.trial_days) ? +S.trial_days : 7;
    return `<h1>الإعدادات</h1><form id="setForm" class="glass form-card" style="margin-top:1.2rem;max-width:560px">
      <label>مدة التجربة المجانية بالأيام (0 = بدون تجربة)<input type="number" name="trial_days" min="0" max="365" required value="${esc(td)}"></label>
      <p class="note">تُطبَّق على الحسابات الجديدة فقط. أسعار الاشتراك ومددها تُدار من «خطط الاشتراك».</p>
      <label>تعليمات الدفع (تظهر للطلاب في صفحة الاشتراك)<textarea name="payment_instructions" rows="6" maxlength="1500">${esc(typeof S.payment_instructions === 'string' ? S.payment_instructions : '')}</textarea></label>
      <p id="setMsg" class="form-msg" role="alert"></p><button class="btn" type="submit">حفظ الإعدادات</button></form>`;
  };

  view.addEventListener('submit', async e => {
    if (e.target.id !== 'setForm') return;
    e.preventDefault();
    const fd = new FormData(e.target), m = $('setMsg'), td = +fd.get('trial_days');
    if (!(Number.isInteger(td) && td >= 0 && td <= 365)) { m.textContent = 'مدة التجربة غير صالحة (0 إلى 365).'; m.className = 'form-msg err'; return; }
    const rows = [['trial_days', td], ['payment_instructions', (fd.get('payment_instructions') || '').trim()]].map(([key, value]) => ({ key, value }));
    const { error } = await sb.from('app_settings').upsert(rows, { onConflict: 'key' });
    if (error) { m.textContent = 'تعذّر الحفظ: ' + error.message; m.className = 'form-msg err'; return; }
    m.textContent = ''; ui.toast('تم حفظ الإعدادات.');
  });

  view.addEventListener('change', e => {
    if (e.target.hasAttribute('data-payf')) { payFilter = e.target.value; adm.render(); }
  });

  view.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    try {
      if (d.pconf) {
        if (!await adm.confirm('تأكيد استلام المبلغ وتفعيل اشتراك لهذا الطالب؟')) return;
        const { error } = await sb.rpc('confirm_payment', { pid: d.pconf }); if (error) throw error;
        ui.toast('تم تأكيد الدفع وتفعيل الاشتراك.'); adm.render();
      } else if (d.prej) {
        adm.openForm('رفض طلب الدفع', '<label>سبب الرفض (يراه الطالب)<textarea name="note" rows="3" maxlength="300" required></textarea></label>', async fd => {
          const { error } = await sb.rpc('reject_payment', { pid: d.prej, note: fd.get('note').trim() }); if (error) throw error;
          adm.render();
        });
      } else if ('sgrant' in d) await grant();
      else if (d.scancel) {
        if (!await adm.confirm('إلغاء هذا الاشتراك؟ سيفقد الطالب الوصول فوراً.')) return;
        const { error } = await sb.from('subscriptions').update({ status: 'cancelled' }).eq('id', d.scancel); if (error) throw error;
        ui.toast('تم إلغاء الاشتراك.'); adm.render();
      }
    } catch (err) { fail(err); }
  });
})();
