(() => {
  const $ = id => document.getElementById(id), { esc, bar } = ui, view = $('view');
  const adm = window.adm = { A: null, views: {}, sel: { year: '', domain: '', unit: '' } };
  const LEVELS = { years: { table: 'academic_years', label: 'سنة' }, domains: { table: 'domains', label: 'مجال' }, units: { table: 'units', label: 'وحدة' } };
  const TITLES = { years: 'إدارة السنوات', domains: 'إدارة المجالات', units: 'إدارة الوحدات' };
  const q = t => sb.from(t).select('*').order('sort_order').order('created_at');
  const first = a => (a[0] || {}).id || '';
  const fail = (e, what) => { console.error(e); ui.toast((what || 'تعذّرت العملية') + (e && e.message ? ': ' + e.message : ''), 'err'); };

  adm.load = async () => {
    const r = await Promise.all([q('academic_years'), q('domains'), q('units'), q('lessons')]);
    for (const x of r) if (x.error) throw x.error;
    adm.A = { years: r[0].data, domains: r[1].data, units: r[2].data, lessons: r[3].data };
  };
  adm.refresh = async () => { await adm.load(); adm.render(); };

  // اختيار افتراضي للسنة/المجال/الوحدة الأولى
  adm.norm = () => {
    const { A, sel } = adm;
    if (!A.years.some(y => y.id === sel.year)) sel.year = first(A.years);
    const ds = A.domains.filter(d => d.year_id === sel.year);
    if (!ds.some(d => d.id === sel.domain)) sel.domain = first(ds);
    const us = A.units.filter(u => u.domain_id === sel.domain);
    if (!us.some(u => u.id === sel.unit)) sel.unit = first(us);
  };
  const opts = (arr, cur, ph) => `<option value="">${ph}</option>` + arr.map(x => `<option value="${x.id}"${x.id === cur ? ' selected' : ''}>${esc(x.title)}</option>`).join('');
  adm.pickers = keys => {
    const { A, sel } = adm, out = [];
    if (keys.includes('year')) out.push(`<label>السنة<select data-pick="year">${opts(A.years, sel.year, 'لا توجد سنوات')}</select></label>`);
    if (keys.includes('domain')) out.push(`<label>المجال<select data-pick="domain">${opts(A.domains.filter(d => d.year_id === sel.year), sel.domain, 'لا توجد مجالات')}</select></label>`);
    if (keys.includes('unit')) out.push(`<label>الوحدة<select data-pick="unit">${opts(A.units.filter(u => u.domain_id === sel.domain), sel.unit, 'لا توجد وحدات')}</select></label>`);
    return `<div class="toolbar">${out.join('')}</div>`;
  };

  adm.confirm = text => new Promise(res => {
    const d = $('cdlg'); $('ctext').textContent = text; d.returnValue = '';
    d.onclose = () => res(d.returnValue === 'yes'); d.showModal();
  });
  adm.openForm = (title, html, onSubmit) => {
    const d = $('fdlg'), f = $('fform');
    f.innerHTML = `<h2>${title}</h2>${html}<p class="form-msg err" id="fmsg" role="alert"></p><div class="acts"><button class="btn" type="submit">حفظ</button><button class="btn ghost" type="button" data-close>إلغاء</button></div>`;
    f.onsubmit = async e => {
      e.preventDefault();
      const b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'جارٍ الحفظ...';
      try { await onSubmit(new FormData(f), f); d.close(); ui.toast('تم الحفظ.'); }
      catch (err) { console.error(err); $('fmsg').textContent = 'تعذّر الحفظ: ' + (err.message || 'خطأ غير معروف'); b.disabled = false; b.textContent = 'حفظ'; }
    };
    d.showModal();
    return f;
  };
  adm.move = async (table, rows, id, dir) => {
    const i = rows.findIndex(r => r.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
    const order = rows.map(r => r.id); [order[i], order[j]] = [order[j], order[i]];
    const res = await Promise.all(order.map((rid, k) => rows.find(r => r.id === rid).sort_order === k ? null : sb.from(table).update({ sort_order: k }).eq('id', rid)).filter(Boolean));
    const bad = res.find(x => x.error); if (bad) throw bad.error;
  };

  // ===== السنوات / المجالات / الوحدات =====
  const rowsOf = kind => {
    const { A, sel } = adm;
    return kind === 'years' ? A.years : kind === 'domains' ? A.domains.filter(d => d.year_id === sel.year) : A.units.filter(u => u.domain_id === sel.domain);
  };
  const itemRow = (kind, r, i, n) => `<div class="lrow"><div class="grow"><b>${esc(r.title)}</b><small>${esc(r.description || '')}</small></div>
    <span class="badge ${r.is_published ? 'pub' : 'draft'}">${r.is_published ? 'منشور' : 'مخفي'}</span>
    <div class="acts"><button class="btn ghost sm" data-up="${kind}:${r.id}" aria-label="تحريك للأعلى"${i === 0 ? ' disabled' : ''}>▲</button>
    <button class="btn ghost sm" data-down="${kind}:${r.id}" aria-label="تحريك للأسفل"${i === n - 1 ? ' disabled' : ''}>▼</button>
    <button class="btn ghost sm" data-pub="${kind}:${r.id}">${r.is_published ? 'إخفاء' : 'نشر'}</button>
    <button class="btn ghost sm" data-edit="${kind}:${r.id}">تعديل</button>
    <button class="btn ghost sm danger" data-del="${kind}:${r.id}">حذف</button></div></div>`;

  Object.keys(LEVELS).forEach(kind => {
    adm.views[kind] = () => {
      adm.norm();
      const rows = rowsOf(kind), { sel } = adm;
      const canAdd = kind === 'years' || (kind === 'domains' ? sel.year : sel.domain);
      const hint = canAdd ? 'اضغط «إضافة» للبدء.' : 'أنشئ العنصر الأعلى أولاً (سنة ثم مجال ثم وحدة).';
      return `<h1>${TITLES[kind]}</h1>${{ years: '', domains: adm.pickers(['year']), units: adm.pickers(['year', 'domain']) }[kind]}
        <div class="toolbar"><button class="btn" data-add="${kind}"${canAdd ? '' : ' disabled'}>إضافة ${LEVELS[kind].label}</button></div>
        ${rows.length ? `<div class="lrows">${rows.map((r, i) => itemRow(kind, r, i, rows.length)).join('')}</div>` : `<p class="state">لا يوجد شيء هنا بعد. ${hint}</p>`}`;
    };
  });

  const lessonIdsUnder = (kind, id) => {
    const { A } = adm;
    const ds = kind === 'years' ? A.domains.filter(d => d.year_id === id).map(d => d.id) : [id];
    const us = kind === 'units' ? [id] : A.units.filter(u => ds.includes(u.domain_id)).map(u => u.id);
    return A.lessons.filter(l => us.includes(l.unit_id)).map(l => l.id);
  };

  function openItem(kind, r) {
    const L = LEVELS[kind], isNew = !r, { sel } = adm;
    adm.openForm(`${isNew ? 'إضافة' : 'تعديل'} ${L.label}`, `
      <label>العنوان<input name="title" required maxlength="150" value="${esc(r && r.title)}"></label>
      <label>الوصف<textarea name="description" rows="3">${esc(r && r.description)}</textarea></label>
      <label>الترتيب<input name="sort_order" type="number" min="0" value="${r ? r.sort_order : rowsOf(kind).length}"></label>
      <label class="chk"><input type="checkbox" name="is_published"${!r || r.is_published ? ' checked' : ''}> منشور للطلاب</label>`,
      async fd => {
        const v = { title: fd.get('title').trim(), description: fd.get('description').trim() || null, sort_order: +fd.get('sort_order') || 0, is_published: fd.get('is_published') === 'on' };
        if (!v.title) throw new Error('العنوان مطلوب');
        if (isNew && kind === 'domains') v.year_id = sel.year;
        if (isNew && kind === 'units') v.domain_id = sel.domain;
        const { error } = isNew ? await sb.from(L.table).insert(v) : await sb.from(L.table).update(v).eq('id', r.id);
        if (error) throw error;
        await adm.refresh();
      });
  }

  async function act(a, kind, id) {
    const L = LEVELS[kind], rows = rowsOf(kind), r = rows.find(x => x.id === id);
    if (!r) return;
    if (a === 'edit') return openItem(kind, r);
    if (a === 'up' || a === 'down') await adm.move(L.table, rows, id, a === 'up' ? -1 : 1);
    else if (a === 'pub') { const { error } = await sb.from(L.table).update({ is_published: !r.is_published }).eq('id', id); if (error) throw error; }
    else if (a === 'del') {
      const lids = lessonIdsUnder(kind, id);
      if (!await adm.confirm(`حذف «${r.title}»${lids.length ? ` مع ${lids.length} درساً بداخله وملفاتها` : ''} نهائياً؟ لا يمكن التراجع.`)) return;
      const files = await uploads.filesFor(lids);
      const { error } = await sb.from(L.table).delete().eq('id', id); if (error) throw error;
      await uploads.purge(files);
      ui.toast('تم الحذف.');
    }
    await adm.refresh();
  }

  view.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    try {
      if (d.add) return openItem(d.add);
      for (const a of ['up', 'down', 'pub', 'edit', 'del']) if (d[a]) { const [kind, id] = d[a].split(':'); return await act(a, kind, id); }
    } catch (err) { fail(err); }
  });
  view.addEventListener('change', e => {
    const k = e.target.dataset.pick; if (!k) return;
    const { sel } = adm; sel[k] = e.target.value;
    if (k === 'year') { sel.domain = ''; sel.unit = ''; } else if (k === 'domain') sel.unit = '';
    adm.render();
  });
  document.addEventListener('click', e => { const c = e.target.closest('[data-close]'); if (c) c.closest('dialog').close(); });
  $('pdlg').addEventListener('close', () => { $('pframe').src = 'about:blank'; });

  // ===== لوحة المعلومات =====
  adm.views.dashboard = async () => {
    const { data: s, error } = await sb.rpc('admin_stats'); if (error) throw error;
    const t = (n, l) => `<div class="tile glass"><b>${n}</b><span>${l}</span></div>`;
    const segs = [['مشتركون', s.active_subscriptions, '#2f6bff'], ['في التجربة', s.trial_students, '#22d3ee'], ['منتهون', s.expired_students, '#64748b']];
    const tot = segs.reduce((a, x) => a + x[1], 0); let acc = 0;
    const grad = tot ? segs.map(x => { const a = acc / tot * 100; acc += x[1]; return `${x[2]} ${a}% ${acc / tot * 100}%`; }).join(',') : '#334155 0 100%';
    const hb = (items, empty) => items.length ? items.map(i => `<div class="hb"><span>${esc(i.title)}</span>${bar(Math.round(100 * i.opens / items[0].opens))}<b>${i.opens}</b></div>`).join('') : `<p class="state">${empty}</p>`;
    return `<h1>لوحة المعلومات</h1><section class="tiles" style="margin-top:1.2rem">
      ${t(s.students, 'إجمالي الطلاب')}${t(s.active_subscriptions + s.trial_students, 'الطلاب النشطون')}${t(s.trial_students, 'في الفترة التجريبية')}
      ${t(s.active_subscriptions, 'اشتراكات مدفوعة')}${t(s.expired_subscriptions, 'اشتراكات منتهية')}${t(s.revenue_da + ' DA', 'إجمالي الإيرادات')}${t(s.pending_payments, 'مدفوعات بانتظار التأكيد')}</section>
      <section class="charts">
        <div class="chart glass"><h3>توزيع الطلاب</h3><div class="donut-wrap"><div class="donut" style="background:conic-gradient(${grad})" role="img" aria-label="توزيع الطلاب"></div>
          <ul class="legend">${segs.map(x => `<li><i style="background:${x[2]}"></i>${x[0]}: ${x[1]}</li>`).join('')}</ul></div></div>
        <div class="chart glass"><h3>أكثر السنوات استخداماً</h3>${hb(s.top_years, 'لا توجد بيانات استخدام بعد.')}</div>
        <div class="chart glass"><h3>أكثر الدروس مشاهدة</h3>${hb(s.top_lessons, 'لا توجد بيانات مشاهدة بعد.')}</div>
      </section>`;
  };

  // ===== الطلاب =====
  adm.views.students = async () => {
    const [p, s] = await Promise.all([
      sb.from('profiles').select('id,full_name,role,trial_ends_at,created_at').order('created_at', { ascending: false }).limit(300),
      sb.from('subscriptions').select('user_id,starts_at,ends_at,status')
    ]);
    if (p.error || s.error) throw p.error || s.error;
    const now = Date.now(), sub = new Map();
    s.data.filter(x => x.status === 'active' && +new Date(x.starts_at) <= now && +new Date(x.ends_at) > now)
      .forEach(x => { if (!sub.get(x.user_id) || x.ends_at > sub.get(x.user_id)) sub.set(x.user_id, x.ends_at); });
    const st = r => r.role === 'admin' ? ['مدير', 'pub'] : sub.has(r.id) ? ['مشترك حتى ' + ui.date(sub.get(r.id)), 'pub'] : +new Date(r.trial_ends_at) > now ? ['تجربة حتى ' + ui.date(r.trial_ends_at), 'draft'] : ['منتهٍ', 'hid'];
    return `<h1>الطلاب</h1><div class="toolbar"><label>بحث بالاسم<input id="stSearch" type="search" placeholder="اكتب جزءاً من الاسم"></label></div>
      ${p.data.length ? `<div class="lrows" id="stRows">${p.data.map(r => { const [t, c] = st(r); return `<div class="lrow" data-n="${esc((r.full_name || '').toLowerCase())}"><div class="grow"><b>${esc(r.full_name || 'بدون اسم')}</b><small>انضم في ${ui.date(r.created_at)}</small></div><span class="badge ${c}">${esc(t)}</span></div>`; }).join('')}</div>` : '<p class="state">لا يوجد طلاب مسجّلون بعد.</p>'}`;
  };
  view.addEventListener('input', e => {
    if (e.target.id !== 'stSearch') return;
    const v = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#stRows [data-n]').forEach(r => { r.hidden = !r.dataset.n.includes(v); });
  });

  // ===== التوجيه =====
  let tok = 0;
  adm.render = async () => {
    const h = location.hash.slice(1), v = adm.views[h] ? h : 'dashboard', t = ++tok;
    document.querySelectorAll('#sideNav [data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === v));
    $('side').classList.remove('open');
    try { const html = await adm.views[v](); if (t === tok) view.innerHTML = html; }
    catch (e) { console.error(e); if (t === tok) view.innerHTML = '<p class="state err">تعذّر تحميل الصفحة. تأكد أنك مدير ثم أعد المحاولة.</p>'; }
  };

  async function init() {
    if (!window.api) { view.innerHTML = '<p class="state err">المنصة غير مهيأة: عدّل js/config.js</p>'; return; }
    await guards.requireAdmin();
    try { await adm.load(); adm.render(); }
    catch (e) {
      console.error(e);
      view.innerHTML = '<p class="state err">تعذّر تحميل البيانات.<br><button class="btn ghost" id="retry" type="button">إعادة المحاولة</button></p>';
      $('retry').onclick = init;
    }
  }
  $('menuBtn').addEventListener('click', () => $('side').classList.toggle('open'));
  addEventListener('hashchange', () => adm.A && adm.render());
  document.addEventListener('DOMContentLoaded', init);
})();
