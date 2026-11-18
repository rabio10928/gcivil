// لوحة الإدارة: هوية الموقع ومحتوى الصفحة الرئيسية (الاسم، الشعار، العنوان، الوصف، التواصل، التذييل، الوضع الافتراضي)
(() => {
  const $ = id => document.getElementById(id), { esc } = ui, view = $('view');
  const pub = p => sb.storage.from('site-assets').getPublicUrl(p).data.publicUrl;
  let cur = {};

  adm.views.site = async () => {
    const r = await sb.from('app_settings').select('value').eq('key', 'site').maybeSingle(); if (r.error) throw r.error;
    cur = r.data && r.data.value && typeof r.data.value === 'object' ? r.data.value : {};
    const f = k => esc(cur[k] || ''), th = cur.default_theme || 'dark';
    return `<h1>هوية الموقع والمحتوى</h1>
      <form id="siteForm" class="glass form-card" style="margin-top:1.2rem;max-width:640px">
        <label>اسم الموقع<input name="site_name" maxlength="60" value="${f('site_name')}" placeholder="Civil Academy 3D"></label>
        <div class="logo-edit">
          ${cur.logo_path ? `<img class="logo-prev" src="${esc(pub(cur.logo_path))}" alt="الشعار الحالي">` : '<p class="note">لا يوجد شعار حالياً، فيُعرض اسم الموقع نصاً.</p>'}
          <label>الشعار (PNG أو JPG أو WebP أو SVG، حتى 1MB)<input type="file" name="logo_file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label>
          ${cur.logo_path ? '<label class="chk"><input type="checkbox" name="rm_logo"> إزالة الشعار الحالي</label>' : ''}
        </div>
        <label>عنوان الصفحة الرئيسية<input name="hero_title" maxlength="120" value="${f('hero_title')}" placeholder="اكتشف عالم الهندسة المدنية"></label>
        <label>وصف الصفحة الرئيسية<textarea name="hero_text" rows="3" maxlength="400">${f('hero_text')}</textarea></label>
        <div class="two"><label>عنوان قسم السنوات<input name="years_title" maxlength="80" value="${f('years_title')}" placeholder="اختر سنتك الدراسية"></label>
        <label>عنوان قسم المميزات<input name="features_title" maxlength="80" value="${f('features_title')}" placeholder="درس واحد، ثلاث طرق للفهم"></label></div>
        <div class="two"><label>عنوان قسم الاشتراكات<input name="pricing_title" maxlength="80" value="${f('pricing_title')}" placeholder="الاشتراكات"></label>
        <label>عنوان قسم التواصل<input name="contact_title" maxlength="80" value="${f('contact_title')}" placeholder="التواصل"></label></div>
        <div class="two"><label>بريد التواصل<input type="email" name="contact_email" dir="ltr" maxlength="120" value="${f('contact_email')}"></label>
        <label>هاتف التواصل<input name="contact_phone" dir="ltr" maxlength="30" value="${f('contact_phone')}"></label></div>
        <label>نص التذييل (اختياري)<input name="footer_text" maxlength="160" value="${f('footer_text')}"></label>
        <label>الوضع الافتراضي للزوار<select name="default_theme">${[['dark', 'داكن'], ['light', 'فاتح (أبيض)'], ['system', 'حسب إعداد الجهاز']].map(([v, t]) => `<option value="${v}"${v === th ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
        <p class="note">يستطيع كل زائر تبديل الوضع بزر الشمس/القمر، ويُحفظ اختياره في متصفحه. الحقول الفارغة تُترك على النص الأصلي، وبيانات التواصل الفارغة لا تُعرض.</p>
        <p id="siteMsg" class="form-msg" role="alert"></p><button class="btn" type="submit">حفظ</button></form>`;
  };

  view.addEventListener('submit', async e => {
    if (e.target.id !== 'siteForm') return;
    e.preventDefault();
    const fd = new FormData(e.target), m = $('siteMsg'), btn = e.target.querySelector('button[type=submit]');
    const say = (t, c) => { m.textContent = t; m.className = 'form-msg ' + (c || 'err'); };
    const g = k => (fd.get(k) || '').trim(), email = g('contact_email');
    if (email && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)) return say('بريد التواصل غير صحيح.');
    btn.disabled = true;
    try {
      const th = g('default_theme');
      const v = { site_name: g('site_name'), hero_title: g('hero_title'), hero_text: g('hero_text'), contact_email: email, contact_phone: g('contact_phone'),
        footer_text: g('footer_text'), years_title: g('years_title'), features_title: g('features_title'), pricing_title: g('pricing_title'), contact_title: g('contact_title'), default_theme: ['dark', 'light', 'system'].includes(th) ? th : 'dark', logo_path: cur.logo_path || null };
      const old = [], file = fd.get('logo_file');
      if (file && file.size) { v.logo_path = await uploads.put('logo', 'logo', file); if (cur.logo_path) old.push(['site-assets', cur.logo_path]); }
      else if (fd.get('rm_logo') === 'on' && cur.logo_path) { old.push(['site-assets', cur.logo_path]); v.logo_path = null; }
      const { error } = await sb.from('app_settings').upsert([{ key: 'site', value: v }], { onConflict: 'key' });
      if (error) throw error;
      await uploads.purge(old).catch(x => console.error(x));
      ui.toast('تم حفظ هوية الموقع.');
      if (window.site) await site.refresh();
      adm.render();
    } catch (err) { console.error(err); say('تعذّر الحفظ: ' + (err.message || '')); }
    btn.disabled = false;
  });
})();
