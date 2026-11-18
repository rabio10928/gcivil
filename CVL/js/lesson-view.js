(async () => {
  const root = document.getElementById('view'), { esc } = ui;
  if (!window.api) { root.innerHTML = '<p class="state err">المنصة غير مهيأة: عدّل js/config.js</p>'; return; }
  const session = await guards.requireAuth(), uid = session.user.id;
  const id = new URLSearchParams(location.search).get('id') || '';
  const stop = t => { root.innerHTML = `<p class="state err">${t} <a class="lnk" href="student-dashboard.html#years">العودة إلى السنوات</a></p>`; };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return stop('رابط الدرس غير صحيح.');

  const NAMES = { html: 'الدرس التفاعلي', video: 'الفيديو التعليمي', pdf: 'ملف PDF', exercises: 'تمارين HTML' };

  // ===== الفيديو الخارجي: YouTube وVimeo أو ملف مباشر أو رابط يُفتح في تبويب =====
  function embed(raw) {
    let u; try { u = new URL(raw); } catch (e) { return null; }
    if (u.protocol !== 'https:') return null;
    const h = u.hostname.replace(/^www\./, '');
    let yt = '';
    if (h === 'youtu.be') yt = u.pathname.slice(1, 12);
    else if (h === 'youtube.com' || h === 'm.youtube.com') yt = (u.searchParams.get('v') || (u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/) || [])[1] || '').slice(0, 11);
    if (/^[\w-]{11}$/.test(yt)) return { src: 'https://www.youtube-nocookie.com/embed/' + yt, frame: true };
    if (h === 'vimeo.com' && /^\/\d+/.test(u.pathname)) return { src: 'https://player.vimeo.com/video/' + u.pathname.split('/')[1], frame: true };
    if (/\.(mp4|webm)$/i.test(u.pathname)) return { src: u.href, direct: true };
    return { src: u.href, link: true };
  }

  try {
    // ===== الهيكل لحساب الدرس السابق والتالي (RLS يُظهر المنشور فقط) =====
    const q = t => sb.from(t).select('*').order('sort_order');
    const [ye, dm, un, le, ac] = await Promise.all([q('academic_years'), q('domains'), q('units'), q('lessons'), api.access()]);
    for (const x of [ye, dm, un, le]) if (x.error) throw x.error;
    const idx = a => new Map(a.map((x, i) => [x.id, i])), map = a => new Map(a.map(x => [x.id, x]));
    const yI = idx(ye.data), dI = idx(dm.data), uI = idx(un.data), lI = idx(le.data), yM = map(ye.data), dM = map(dm.data), uM = map(un.data);
    const all = le.data.map(l => {
      const unit = uM.get(l.unit_id), domain = unit && dM.get(unit.domain_id), year = domain && yM.get(domain.year_id);
      return year ? { l, unit, domain, year, k: [yI.get(year.id), dI.get(domain.id), uI.get(unit.id), lI.get(l.id)] } : null;
    }).filter(Boolean).sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2] || a.k[3] - b.k[3]);
    const pos = all.findIndex(x => x.l.id === id);
    if (pos < 0) return stop('هذا الدرس غير متاح أو غير منشور.');
    const { l: lesson, unit, domain, year } = all[pos], prev = all[pos - 1], next = all[pos + 1];

    const [ct, pr, fv] = await Promise.all([
      ac.has_access ? sb.from('lesson_contents').select('*').eq('lesson_id', id).order('sort_order') : { data: [] },
      sb.from('lesson_progress').select('*').eq('lesson_id', id).maybeSingle(),
      sb.from('favorites').select('id').eq('lesson_id', id).maybeSingle()
    ]);
    for (const x of [ct, pr, fv]) if (x.error) throw x.error;
    const secs = ct.data;
    let pct = pr.data ? pr.data.progress_pct : 0, completed = pr.data ? pr.data.completed : false, fav = !!fv.data, track = ac.has_access;

    document.title = lesson.title + ' | Civil Academy 3D';
    const nav = (x, label) => x ? `<a class="btn ghost" href="lesson.html?id=${x.l.id}">${label}</a>` : `<span class="btn ghost" aria-disabled="true">${label}</span>`;
    root.innerHTML = `
      <nav class="crumb"><a href="student-dashboard.html">لوحتي</a> / <a href="academic-year.html?year=${year.id}">${esc(year.title)}</a> / <a href="academic-year.html?year=${year.id}&domain=${domain.id}">${esc(domain.title)}</a> / <a href="academic-year.html?year=${year.id}&domain=${domain.id}&unit=${unit.id}">${esc(unit.title)}</a></nav>
      <header class="lhead"><h1>${esc(lesson.title)}</h1>${lesson.description ? `<p class="lead">${esc(lesson.description)}</p>` : ''}
        <div class="acts"><button class="btn ghost" id="favBtn" type="button"></button>${ac.has_access ? '<button class="btn" id="doneBtn" type="button"></button>' : ''}</div>
        ${ac.has_access ? '<div class="pwrap"><span id="pLabel"></span><div class="bar"><i id="pFill"></i></div></div>' : ''}</header>
      ${!ac.has_access ? `<div class="wall glass"><h2>هذا الدرس للمشتركين</h2><p>انتهت تجربتك المجانية أو اشتراكك. اشترك للوصول إلى هذا الدرس وكل دروس المنصة.</p><a class="btn lg" href="subscription.html">اشترك الآن</a></div>`
        : secs.length ? `<nav class="toc glass" aria-label="محتويات الدرس">${secs.map(c => `<a href="#s-${c.type}" data-toc="${c.type}">${NAMES[c.type]}</a>`).join('')}</nav>
          ${secs.map(c => `<section class="lsec glass" id="s-${c.type}"><h2>${NAMES[c.type]}</h2><div class="body"><p class="state">جارٍ التحميل...</p></div></section>`).join('')}`
        : '<p class="state">لم تُضف محتويات لهذا الدرس بعد. عد لاحقاً.</p>'}
      <footer class="lnav">${nav(prev, 'الدرس السابق')}${nav(next, 'الدرس التالي')}</footer>`;

    // ===== التقدم =====
    const $ = s => root.querySelector(s), viewed = new Set();
    let pending = {}, timer;
    function save(patch, now) {
      Object.assign(pending, patch); clearTimeout(timer);
      const go = async () => {
        const p = pending; pending = {}; if (!track) return;
        try { await progress.save(uid, id, p); } catch (e) { track = false; console.error(e); ui.toast('لا يُسجَّل التقدم لهذا الدرس (غير منشور أو لا تملك صلاحية).', 'err'); }
      };
      return now ? go() : (timer = setTimeout(go, 700));
    }
    function paint() {
      const f = $('#favBtn'); f.textContent = fav ? '★ في المفضلة' : '☆ أضف للمفضلة'; f.className = 'btn ghost' + (fav ? ' on' : ''); f.setAttribute('aria-pressed', fav);
      if (!ac.has_access) return;
      $('#pFill').style.width = pct + '%'; $('#pLabel').textContent = `تقدمك في هذا الدرس: ${pct}%`;
      const d = $('#doneBtn'); d.textContent = completed ? 'تم إتمام الدرس ✓' : 'إتمام الدرس'; d.className = 'btn' + (completed ? ' ghost on' : '');
    }
    function seen(t) {
      if (viewed.has(t)) return; viewed.add(t);
      const a = $(`[data-toc=${t}]`); if (a) a.classList.add('seen');
      const np = Math.min(completed ? 100 : 99, Math.round(100 * viewed.size / secs.length));
      if (np > pct) { pct = np; paint(); save({ progress_pct: pct }); }
    }
    paint();
    $('#favBtn').onclick = async e => {
      e.target.disabled = true;
      try { await progress.fav(uid, id, !fav); fav = !fav; paint(); } catch (x) { console.error(x); ui.toast('تعذّر تحديث المفضلة.', 'err'); }
      e.target.disabled = false;
    };
    if (ac.has_access) {
      $('#doneBtn').onclick = () => {
        completed = !completed;
        pct = completed ? 100 : Math.min(99, Math.round(100 * viewed.size / Math.max(secs.length, 1)));
        paint();
        save({ completed, completed_at: completed ? new Date().toISOString() : null, progress_pct: pct }, true);
        if (completed) ui.toast('أحسنت! تم إتمام الدرس.');
      };
      progress.open(uid, id).catch(() => { track = false; });
    }

    // ===== عرض المحتوى =====
    const FILL = {
      // HTML يُحمَّل كنص ويُعرض في iframe معزول (sandbox بدون allow-same-origin)
      async html(body, c) {
        const f = document.createElement('iframe');
        f.className = 'frame'; f.title = NAMES[c.type]; f.setAttribute('sandbox', 'allow-scripts'); f.referrerPolicy = 'no-referrer';
        f.allow = 'fullscreen'; ui.sandboxFrame(f, await api.downloadText('lesson-html', c.storage_path));
        const b = document.createElement('button'); b.className = 'btn ghost sm'; b.type = 'button'; b.textContent = 'ملء الشاشة';
        b.onclick = () => f.requestFullscreen && f.requestFullscreen();
        const bar = document.createElement('div'); bar.className = 'acts'; bar.append(b);
        body.replaceChildren(bar, f);
      },
      async video(body, c) {
        if (c.storage_path) {
          const v = document.createElement('video');
          v.controls = true; v.preload = 'metadata'; v.playsInline = true; v.setAttribute('controlsList', 'nodownload');
          v.src = await api.signedUrl('lesson-videos', c.storage_path, 7200); v.onplay = () => seen('video');
          body.replaceChildren(v); return false;
        }
        const e = embed(c.external_url || '');
        if (!e) { body.innerHTML = '<p class="state err">رابط الفيديو غير صالح.</p>'; return false; }
        if (e.frame) {
          const f = document.createElement('iframe');
          f.className = 'frame vid'; f.title = NAMES.video; f.src = e.src; f.allowFullscreen = true; f.referrerPolicy = 'strict-origin-when-cross-origin';
          f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation'); body.replaceChildren(f);
        } else if (e.direct) {
          const v = document.createElement('video'); v.controls = true; v.preload = 'metadata'; v.playsInline = true; v.src = e.src; v.onplay = () => seen('video');
          body.replaceChildren(v); return false;
        } else body.innerHTML = `<a class="btn" href="${esc(e.src)}" target="_blank" rel="noopener noreferrer">فتح الفيديو في تبويب جديد</a>`;
      },
      async pdf(body, c) {
        const dlr = await sb.storage.from('lesson-pdf').download(c.storage_path);
        if (dlr.error) throw dlr.error;
        const url = URL.createObjectURL(new Blob([dlr.data], { type: 'application/pdf' }));
        let dl = '';
        if (c.downloadable) {
          const name = (lesson.title.replace(/[^\w\u0600-\u06FF -]/g, '').trim() || 'lesson') + '.pdf';
          const r = await sb.storage.from('lesson-pdf').createSignedUrl(c.storage_path, 3600, { download: name });
          if (r.data) dl = `<a class="btn sm" href="${esc(r.data.signedUrl)}">تحميل PDF</a>`;
        }
        body.innerHTML = `<div class="acts"><a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noopener">فتح في تبويب جديد</a>${dl}</div>
          <iframe class="frame" title="${NAMES.pdf}" src="${esc(url + (c.downloadable ? '' : '#toolbar=0&navpanes=0'))}"></iframe>`;
      }
    };
    FILL.exercises = FILL.html;   // التمارين تُعرض كصفحة HTML معزولة مثل الدرس التفاعلي
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) seen(e.target.id.slice(2)); }), { threshold: 0.2 });
    secs.forEach(c => {
      const sec = $('#s-' + c.type), body = sec.querySelector('.body');
      FILL[c.type](body, c).then(o => { if (o !== false) io.observe(sec); })
        .catch(e => { console.error(e); body.innerHTML = '<p class="state err">تعذّر تحميل هذا المحتوى. أعد تحميل الصفحة.</p>'; });
    });
  } catch (e) {
    console.error(e);
    stop('تعذّر تحميل الدرس. تحقق من الاتصال ثم أعد المحاولة.');
  }
})();
