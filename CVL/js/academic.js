// تصفح الطالب المتدرج: السنة ← المجال ← الوحدة ← الدروس (كل مستوى يعرض ما تحته مباشرة فقط)
(async () => {
  const root = document.getElementById('view'), { esc, bar } = ui;
  if (!window.api) { root.innerHTML = '<p class="state err">المنصة غير مهيأة: عدّل js/config.js</p>'; return; }
  await guards.requireAuth();
  const nf = t => { root.innerHTML = `<p class="state err">${t} <a class="lnk" href="student-dashboard.html#years">ارجع لاختيار السنة</a></p>`; };
  try {
    const P = new URLSearchParams(location.search), param = P.get('year') || '';
    const ye = await sb.from('academic_years').select('*').order('sort_order'); if (ye.error) throw ye.error;
    const year = ye.data.find(y => y.id === param) || (/^\d+$/.test(param) ? ye.data[param - 1] : null);
    if (!year) return nf('لم نجد هذه السنة.');
    const dm = await sb.from('domains').select('*').eq('year_id', year.id).order('sort_order'); if (dm.error) throw dm.error;
    const dIds = dm.data.map(d => d.id);
    const un = dIds.length ? await sb.from('units').select('*').in('domain_id', dIds).order('sort_order') : { data: [] }; if (un.error) throw un.error;
    const uIds = un.data.map(u => u.id);
    const [le, pr] = await Promise.all([
      uIds.length ? sb.from('lessons').select('id,unit_id,title').in('unit_id', uIds).order('sort_order') : { data: [] },
      sb.from('lesson_progress').select('lesson_id,completed')
    ]);
    if (le.error || pr.error) throw le.error || pr.error;

    const domain = P.get('domain') ? dm.data.find(d => d.id === P.get('domain')) : null;
    if (P.get('domain') && !domain) return nf('لم نجد هذا المجال.');
    const unit = P.get('unit') ? un.data.find(u => u.id === P.get('unit') && domain && u.domain_id === domain.id) : null;
    if (P.get('unit') && !unit) return nf('لم نجد هذه الوحدة.');

    const done = new Set(pr.data.filter(x => x.completed).map(x => x.lesson_id));
    const L = (d, u) => 'academic-year.html?year=' + year.id + (d ? '&domain=' + d.id : '') + (u ? '&unit=' + u.id : '');
    const lessonsIn = ids => le.data.filter(l => ids.includes(l.unit_id));
    const stat = ls => { const n = ls.filter(l => done.has(l.id)).length; return { n, total: ls.length, pct: ls.length ? Math.round(100 * n / ls.length) : 0 }; };
    const card = (i, t, d, stats, ls, href) => `<a class="card glass" data-tilt href="${href}"><span class="num">${i + 1}</span><h3>${esc(t)}</h3>${d ? `<p>${esc(d)}</p>` : ''}
      <ul class="stats">${stats}</ul>${bar(stat(ls).pct)}<span class="go">ادخل</span></a>`;
    const lrow = l => `<div class="lrow"><a href="lesson.html?id=${l.id}"><b>${esc(l.title)}</b></a>${done.has(l.id) ? '<span class="tick" title="مكتمل">✓</span>' : ''}</div>`;

    let head, ls, body, back, backLabel;
    if (!domain) {                                   // مستوى السنة: المجالات
      ls = lessonsIn(uIds); head = year; back = 'student-dashboard.html#years'; backLabel = 'العودة إلى السنوات';
      body = '<h2>المجالات</h2>' + (dm.data.length ? `<div class="grid">${dm.data.map((d, i) => {
        const us = un.data.filter(u => u.domain_id === d.id), dl = lessonsIn(us.map(u => u.id));
        return card(i, d.title, d.description, `<li>الوحدات <b>${us.length}</b></li><li>الدروس <b>${dl.length}</b></li>`, dl, L(d));
      }).join('')}</div>` : '<p class="state">لا توجد مجالات منشورة في هذه السنة بعد.</p>');
    } else if (!unit) {                              // مستوى المجال: الوحدات
      const us = un.data.filter(u => u.domain_id === domain.id);
      ls = lessonsIn(us.map(u => u.id)); head = domain; back = L(); backLabel = 'العودة إلى السنة';
      body = '<h2>الوحدات</h2>' + (us.length ? `<div class="grid">${us.map((u, i) => {
        const ul = lessonsIn([u.id]);
        return card(i, u.title, u.description, `<li>الدروس <b>${ul.length}</b></li>`, ul, L(domain, u));
      }).join('')}</div>` : '<p class="state">لا توجد وحدات منشورة في هذا المجال بعد.</p>');
    } else {                                         // مستوى الوحدة: الدروس
      ls = lessonsIn([unit.id]); head = unit; back = L(domain); backLabel = 'العودة إلى المجال';
      body = '<h2>الدروس</h2>' + (ls.length ? `<div class="lrows">${ls.map(lrow).join('')}</div>` : '<p class="state">لا توجد دروس منشورة في هذه الوحدة بعد.</p>');
    }
    const s = stat(ls);
    const crumb = [['لوحتي', 'student-dashboard.html#years'], [year.title, domain ? L() : null], domain ? [domain.title, unit ? L(domain) : null] : null, unit ? [unit.title, null] : null]
      .filter(Boolean).map(([t, h]) => h ? `<a href="${h}">${esc(t)}</a>` : esc(t)).join(' / ');
    document.title = head.title + ' | Civil Academy 3D';
    root.innerHTML = `<a class="back" href="${back}">${backLabel}</a><nav class="crumb" aria-label="مسار التصفح">${crumb}</nav>
      <h1>${esc(head.title)}</h1>${head.description ? `<p class="lead">${esc(head.description)}</p>` : ''}
      <div class="tile glass"><b>${s.pct}%</b><span>${s.n} من ${s.total} دروس مكتملة</span>${bar(s.pct)}</div>${body}`;
    ui.tilt(root);
  } catch (e) { console.error(e); root.innerHTML = '<p class="state err">تعذّر تحميل الصفحة. أعد تحميلها.</p>'; }
})();
