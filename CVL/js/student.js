(async () => {
  const view = document.getElementById('view');
  if (!window.api) { view.innerHTML = '<p class="state err">المنصة غير مهيأة: عدّل js/config.js</p>'; return; }
  const session = await guards.requireAuth();
  const uid = session.user.id, { esc, bar } = ui;
  let D;

  const q = t => sb.from(t).select('*');
  async function load() {
    const [p, ac, ye, dm, un, le, pr, fv, an] = await Promise.all([
      q('profiles').eq('id', uid).single(), api.access(),
      q('academic_years').order('sort_order'), q('domains').order('sort_order'), q('units').order('sort_order'),
      q('lessons').order('sort_order'), q('lesson_progress'), q('favorites'),
      q('announcements').order('created_at', { ascending: false }).limit(3)
    ]);
    for (const x of [p, ye, dm, un, le, pr, fv, an]) if (x.error) throw x.error;
    const yMap = new Map(ye.data.map(y => [y.id, y]));
    const domains = dm.data.filter(d => yMap.has(d.year_id)), dMap = new Map(domains.map(d => [d.id, d]));
    const units = un.data.filter(u => dMap.has(u.domain_id)), uMap = new Map(units.map(u => [u.id, u]));
    const lessons = le.data.filter(l => uMap.has(l.unit_id)).map(l => {
      const unit = uMap.get(l.unit_id), domain = dMap.get(unit.domain_id);
      return { ...l, unit, domain, year: yMap.get(domain.year_id) };
    });
    let avatar = null;
    if (p.data.avatar_path) { try { avatar = await api.signedUrl('student-avatars', p.data.avatar_path); } catch (e) { /* بدون صورة */ } }
    D = { profile: p.data, access: ac, years: ye.data, domains, dMap, units, lessons, avatar, anns: an.data,
      prog: new Map(pr.data.map(x => [x.lesson_id, x])), favs: new Set(fv.data.map(x => x.lesson_id)) };
    document.getElementById('adminLink').hidden = !ac.is_admin;
  }

  const done = l => !!(D.prog.get(l.id) && D.prog.get(l.id).completed);
  const pct = ls => ls.length ? Math.round(100 * ls.filter(done).length / ls.length) : 0;
  const avatar = () => D.avatar ? `<img class="av" src="${esc(D.avatar)}" alt="">` : `<span class="av" aria-hidden="true">${esc((D.profile.full_name || '?').trim().charAt(0))}</span>`;
  const lrow = l => `<div class="lrow"><a href="lesson.html?id=${l.id}"><b>${esc(l.title)}</b><small>${esc(l.year.title)} / ${esc(l.domain.title)} / ${esc(l.unit.title)}</small></a>${done(l) ? '<span class="tick" title="مكتمل">✓</span>' : ''}<button class="star" data-fav="${l.id}" aria-pressed="${D.favs.has(l.id)}" aria-label="المفضلة">${D.favs.has(l.id) ? '★' : '☆'}</button></div>`;
  const list = (ls, empty) => ls.length ? `<div class="lrows">${ls.map(lrow).join('')}</div>` : `<p class="state">${empty}</p>`;
  const noYears = '<p class="state">لا توجد سنوات منشورة بعد. ستظهر هنا فور إضافتها.</p>';

  // بطاقات السنوات: نقطة الدخول الوحيدة للمحتوى (السنة ← المجال ← الوحدة ← الدروس)
  const yearCards = () => D.years.length ? `<div class="grid" style="margin-top:1.2rem">${D.years.map((y, i) => {
    const ls = D.lessons.filter(l => l.year.id === y.id);
    return `<a class="card glass" data-tilt href="academic-year.html?year=${y.id}"><span class="num">${i + 1}</span><h3>${esc(y.title)}</h3><p>${esc(y.description || '')}</p>
      <ul class="stats"><li>المجالات <b>${D.domains.filter(d => d.year_id === y.id).length}</b></li><li>الوحدات <b>${D.units.filter(u => D.dMap.get(u.domain_id).year_id === y.id).length}</b></li><li>الدروس <b>${ls.length}</b></li></ul>${bar(pct(ls))}<span class="go">ادخل</span></a>`;
  }).join('')}</div>` : noYears;
  const views = {
    home() {
      const { profile: p, access: a, lessons } = D;
      const started = [...D.prog.values()].filter(x => !x.completed).length;
      const msg = { admin: 'حساب مدير: وصول كامل.', trial: `تجربتك المجانية تنتهي في ${ui.date(a.trial_ends_at)}.`,
        subscription: `اشتراكك فعّال حتى ${ui.date(a.subscription_ends_at)}.`, none: 'انتهى وصولك إلى الدروس. جدّد اشتراكك لمتابعة التعلم.' }[a.reason];
      const label = { admin: 'مدير', trial: 'تجربة مجانية', subscription: 'اشتراك فعّال', none: 'منتهٍ' }[a.reason];
      return `<header class="hello">${avatar()}<div><h1>أهلاً ${esc(p.full_name || 'بك')}</h1><p>${msg}</p></div></header>
        ${a.has_access ? '' : '<a class="banner" href="subscription.html">اشترك الآن لفتح الدروس</a>'}
        <section class="tiles">
          <div class="tile glass"><b>${pct(lessons)}%</b><span>نسبة التقدم</span>${bar(pct(lessons))}</div>
          <div class="tile glass"><b>${lessons.filter(done).length}</b><span>دروس مكتملة</span></div>
          <div class="tile glass"><b>${started}</b><span>دروس بدأتها</span></div>
          <div class="tile glass"><b>${D.favs.size}</b><span>في المفضلة</span></div>
          <div class="tile glass"><b>${label}</b><span>${a.reason === 'none' ? 'حالة الاشتراك' : 'حتى ' + ui.date(a.reason === 'trial' ? a.trial_ends_at : a.subscription_ends_at)}</span></div>
        </section>
         <h2>سنواتك الدراسية</h2>${yearCards()}
        ${D.anns.length ? '<h2>إعلانات</h2>' + D.anns.map(n => `<div class="ann glass"><b>${esc(n.title)}</b><p>${esc(n.body || '')}</p></div>`).join('') : ''}`;
    },
    years: () => '<h1>اختر السنة الدراسية</h1>' + yearCards(),
    favorites: () => '<h1>دروسي المفضلة</h1>' + list(D.lessons.filter(l => D.favs.has(l.id)), 'لم تضف دروساً للمفضلة. اضغط النجمة بجانب أي درس لإضافته.'),
    progress() {
      return '<h1>تقدمي الدراسي</h1>' + (D.years.length ? `<div class="tiles" style="margin-top:1.2rem">${D.years.map(y => {
        const ls = D.lessons.filter(l => l.year.id === y.id);
        return `<div class="tile glass"><h3>${esc(y.title)}</h3><span>${ls.filter(done).length} من ${ls.length} دروس</span>${bar(pct(ls))}</div>`;
      }).join('')}</div>` : noYears);
    },
    account() {
      return `<h1>حسابي</h1><section class="glass form-card" style="margin-top:1.2rem">
        <div class="hello">${avatar()}<label>تغيير الصورة (JPG أو PNG أو WebP، حتى 2MB)<input type="file" id="avatarFile" accept="image/jpeg,image/png,image/webp"></label></div>
        <form id="nameForm"><label>الاسم الكامل<input name="full_name" value="${esc(D.profile.full_name)}" maxlength="100" required></label>
        <label>البريد الإلكتروني<input value="${esc(session.user.email)}" dir="ltr" disabled></label>
        <button class="btn" type="submit">حفظ التغييرات</button></form></section>`;
    }
  };

  function render() {
    const h = location.hash.slice(1), v = views[h] ? h : 'home';
    view.innerHTML = views[v](); ui.tilt(view);
    document.querySelectorAll('#sideNav [data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === v));
    document.getElementById('side').classList.remove('open');
    window.scrollTo(0, 0);
  }

  async function toggleFav(id) {
    const on = D.favs.has(id);
    const { error } = on ? await sb.from('favorites').delete().eq('lesson_id', id).eq('user_id', uid)
                         : await sb.from('favorites').insert({ user_id: uid, lesson_id: id });
    if (error) return ui.toast(ui.errText(error), 'err');
    on ? D.favs.delete(id) : D.favs.add(id);
    const y = window.scrollY; render(); window.scrollTo(0, y);
  }

  view.addEventListener('click', e => { const b = e.target.closest('[data-fav]'); if (b) toggleFav(b.dataset.fav); });
  view.addEventListener('submit', async e => {
    if (e.target.id !== 'nameForm') return;
    e.preventDefault();
    const name = new FormData(e.target).get('full_name').trim();
    if (name.length < 3) return ui.toast('اكتب اسمك الكامل.', 'err');
    const { error } = await sb.from('profiles').update({ full_name: name }).eq('id', uid);
    if (error) return ui.toast(ui.errText(error), 'err');
    D.profile.full_name = name; ui.toast('تم حفظ التغييرات.');
  });
  view.addEventListener('change', async e => {
    if (e.target.id !== 'avatarFile' || !e.target.files[0]) return;
    const f = e.target.files[0], ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[f.type];
    if (!ext || f.size > 2097152) return ui.toast('اختر صورة JPG أو PNG أو WebP بحجم أقصاه 2MB.', 'err');
    const path = `${uid}/avatar.${ext}`;
    const up = await sb.storage.from('student-avatars').upload(path, f, { upsert: true, contentType: f.type });
    const pr = up.error ? up : await sb.from('profiles').update({ avatar_path: path }).eq('id', uid);
    if (pr.error) return ui.toast(ui.errText(pr.error), 'err');
    D.profile.avatar_path = path;
    try { D.avatar = await api.signedUrl('student-avatars', path); } catch (x) { /* تجاهل */ }
    render(); ui.toast('تم تحديث الصورة.');
  });

  document.getElementById('menuBtn').addEventListener('click', () => document.getElementById('side').classList.toggle('open'));
  addEventListener('hashchange', () => D && render());

  async function init() {
    view.innerHTML = '<p class="state">جارٍ التحميل...</p>';
    try { await load(); render(); }
    catch (e) {
      console.error(e);
      view.innerHTML = '<p class="state err">تعذّر تحميل بياناتك. تحقق من الاتصال ثم أعد المحاولة.<br><button class="btn ghost" id="retry" type="button">إعادة المحاولة</button></p>';
      document.getElementById('retry').onclick = init;
    }
  }
  init();
})();
