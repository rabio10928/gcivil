// لوحة الإدارة: إدارة خطط الاشتراك (إضافة، تعديل، تفعيل/تعطيل، ترتيب، حذف)
(() => {
  const $ = id => document.getElementById(id), { esc } = ui, view = $('view');
  const fail = (e, w) => { console.error(e); ui.toast((w || 'تعذّرت العملية') + (e && e.message ? ': ' + e.message : ''), 'err'); };
  let cache = [];

  adm.views.plans = async () => {
    const r = await sb.from('plans').select('*').order('sort_order').order('created_at'); if (r.error) throw r.error;
    cache = r.data;
    return `<h1>خطط الاشتراك</h1>
      <p class="lead">الخطط المفعّلة فقط تظهر في الصفحة الرئيسية وصفحة الاشتراك. تعطيل خطة أو حذفها لا يؤثر على المشتركين الحاليين ولا على طلبات الدفع المعلّقة.</p>
      <div class="toolbar"><button class="btn" data-padd>إضافة خطة</button></div>
      ${cache.length ? `<div class="lrows">${cache.map((p, i) => `<div class="lrow"><div class="grow"><b>${esc(p.name)}</b>
        <small>${p.price_da} DA • ${esc(ui.durLabel(p.duration_days))} (${p.duration_days} يوماً)</small>${p.description ? `<small>${esc(p.description)}</small>` : ''}</div>
        ${p.is_featured ? '<span class="badge pub">مميزة</span>' : ''}<span class="badge ${p.is_active ? 'pub' : 'hid'}">${p.is_active ? 'مفعّلة' : 'معطّلة'}</span>
        <div class="acts"><button class="btn ghost sm" data-pup="${p.id}" aria-label="تحريك للأعلى"${i === 0 ? ' disabled' : ''}>▲</button>
        <button class="btn ghost sm" data-pdown="${p.id}" aria-label="تحريك للأسفل"${i === cache.length - 1 ? ' disabled' : ''}>▼</button>
        <button class="btn ghost sm" data-ptog="${p.id}">${p.is_active ? 'تعطيل' : 'تفعيل'}</button>
        <button class="btn ghost sm" data-pedit="${p.id}">تعديل</button>
        <button class="btn ghost sm danger" data-pdel="${p.id}">حذف</button></div></div>`).join('')}</div>`
        : '<p class="state">لا توجد خطط. أضف خطة لتظهر للطلاب في صفحة الاشتراك.</p>'}`;
  };

  function form(p) {
    const isNew = !p;
    adm.openForm(isNew ? 'إضافة خطة' : 'تعديل الخطة', `
      <label>اسم الخطة<input name="name" required maxlength="80" value="${esc(p && p.name)}"></label>
      <label>وصف قصير (اختياري)<input name="description" maxlength="300" value="${esc(p && p.description)}"></label>
      <div class="two"><label>السعر (DA)<input type="number" name="price_da" min="1" max="1000000" required value="${p ? p.price_da : ''}"></label>
      <label>المدة (بالأيام)<input type="number" name="duration_days" min="1" max="3650" required value="${p ? p.duration_days : 30}"></label></div>
      <p class="note">أمثلة: 30 = شهر، 90 = 3 أشهر، 180 = 6 أشهر، 365 = سنة. تغيير السعر أو المدة يسري على الطلبات الجديدة فقط.</p>
      <label>المزايا (ميزة في كل سطر)<textarea name="features" rows="5">${esc(p ? (p.features || []).join('\n') : '')}</textarea></label>
      <label class="chk"><input type="checkbox" name="is_active"${!p || p.is_active ? ' checked' : ''}> مفعّلة (تظهر للطلاب ويمكن شراؤها)</label>
      <label class="chk"><input type="checkbox" name="is_featured"${p && p.is_featured ? ' checked' : ''}> تمييز الخطة في الصفحة</label>`,
    async fd => {
      const name = fd.get('name').trim(), price = +fd.get('price_da'), days = +fd.get('duration_days');
      if (!name) throw new Error('اسم الخطة مطلوب');
      if (!Number.isInteger(price) || price < 1 || price > 1000000) throw new Error('السعر بين 1 و1000000 دينار');
      if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error('المدة بين 1 و3650 يوماً');
      const features = fd.get('features').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 12).map(x => x.slice(0, 120));
      const v = { name, description: fd.get('description').trim() || null, price_da: price, duration_days: days, features,
        is_active: fd.get('is_active') === 'on', is_featured: fd.get('is_featured') === 'on' };
      if (isNew) v.sort_order = cache.length;
      const { error } = isNew ? await sb.from('plans').insert(v) : await sb.from('plans').update(v).eq('id', p.id);
      if (error) throw error;
      adm.render();
    });
  }

  view.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset, byId = id => cache.find(x => x.id === id);
    try {
      if ('padd' in d) return form(null);
      if (d.pedit) return form(byId(d.pedit));
      if (d.pup || d.pdown) await adm.move('plans', cache, d.pup || d.pdown, d.pup ? -1 : 1);
      else if (d.ptog) {
        const p = byId(d.ptog), r = await sb.from('plans').update({ is_active: !p.is_active }).eq('id', p.id); if (r.error) throw r.error;
        ui.toast(p.is_active ? 'تم تعطيل الخطة.' : 'تم تفعيل الخطة.');
      } else if (d.pdel) {
        const p = byId(d.pdel);
        if (!await adm.confirm(`حذف خطة «${p.name}»؟ لا يتأثر المشتركون الحاليون، وتبقى الدفعات السابقة مسجّلة باسمها.`)) return;
        const r = await sb.from('plans').delete().eq('id', p.id); if (r.error) throw r.error;
        ui.toast('تم حذف الخطة.');
      } else return;
      adm.render();
    } catch (err) { fail(err); }
  });
})();
