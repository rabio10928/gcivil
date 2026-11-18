document.getElementById('yr').textContent = new Date().getFullYear();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('[data-tilt]').forEach(c => {
    c.addEventListener('pointermove', e => {
      const b = c.getBoundingClientRect();
      c.style.setProperty('--ry', ((e.clientX - b.left) / b.width - 0.5) * 10 + 'deg');
      c.style.setProperty('--rx', -((e.clientY - b.top) / b.height - 0.5) * 10 + 'deg');
    });
    c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
  });
}

// ربط الصفحة الرئيسية بـ Supabase (يتجاهل بصمت إن لم تُضبط الإعدادات)
if (window.api) {
  api.session().then(s => {
    const a = document.getElementById('navLogin');
    if (s && a) { a.textContent = 'لوحتي'; a.href = 'student-dashboard.html'; }
  }).catch(() => {});
  api.yearStats().then(rows => document.querySelectorAll('[data-year]').forEach((card, i) => {
    const r = rows[i]; if (!r) return;
    card.querySelector('[data-stat=domains]').textContent = r.domain_count;
    card.querySelector('[data-stat=units]').textContent = r.unit_count;
    card.querySelector('[data-stat=lessons]').textContent = r.lesson_count;
  })).catch(() => {});
}

// قسم الاشتراكات في الصفحة الرئيسية من الخطط المفعّلة في قاعدة البيانات (يبقى المحتوى الثابت إن تعذّر الاتصال)
if (window.api && window.ui) {
  Promise.all([api.session().catch(() => null), sb.rpc('public_pricing')]).then(([s, r]) => {
    if (r.error || !r.data) return;
    const { trial_days: td, plans } = r.data, dest = s ? 'subscription.html' : 'register.html', esc = ui.esc;
    document.querySelectorAll('[data-trial]').forEach(e => { e.textContent = td; });
    document.querySelectorAll('[data-trial-line]').forEach(e => { e.hidden = !(td > 0); });
    const grid = document.getElementById('planGrid'); if (!grid) return;
    const cards = [];
    if (td > 0) cards.push(`<div class="glass plan"><h3>تجربة مجانية</h3><p class="amount">${td} أيام</p><ul><li>كل الدروس</li><li>الفيديوهات</li><li>ملفات PDF</li><li>دروس HTML التفاعلية</li></ul><a class="btn ghost" href="register.html">ابدأ التجربة</a></div>`);
    plans.forEach(p => cards.push(`<div class="glass plan${p.is_featured ? ' featured' : ''}"><h3>${esc(p.name)}</h3><p class="amount">${p.price_da} DA <small>/ ${esc(ui.durLabel(p.duration_days))}</small></p>${p.description ? `<p>${esc(p.description)}</p>` : ''}<ul>${(p.features || []).map(f => `<li>${esc(f)}</li>`).join('')}</ul><a class="btn" href="${dest}">اشترك الآن</a></div>`));
    grid.innerHTML = cards.length ? cards.join('') : '<p class="state">الاشتراكات غير متاحة حالياً.</p>';
  }).catch(() => {});
}
