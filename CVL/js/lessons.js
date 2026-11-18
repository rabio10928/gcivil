(() => {
  const $ = id => document.getElementById(id), { esc } = ui, view = $('view');
  const STATUS = { draft: ['مسودة', 'draft'], published: ['منشور', 'pub'], hidden: ['مخفي', 'hid'] };
  const DEF = { html: 1, video: 2, pdf: 3, exercises: 4 };
  const rowsOf = () => adm.A.lessons.filter(l => l.unit_id === adm.sel.unit);
  const fail = (e, w) => { console.error(e); ui.toast((w || 'تعذّرت العملية') + (e && e.message ? ': ' + e.message : ''), 'err'); };

  adm.views.lessons = () => {
    adm.norm();
    const rows = rowsOf(), n = rows.length, sel = adm.sel.unit;
    return `<h1>إدارة الدروس</h1>${adm.pickers(['year', 'domain', 'unit'])}
      <div class="toolbar"><button class="btn" data-ladd${sel ? '' : ' disabled'}>إضافة درس</button></div>
      ${n ? `<div class="lrows">${rows.map((l, i) => `<div class="lrow"><div class="grow"><b>${esc(l.title)}</b><small>${esc(l.description || '')}</small></div>
        <span class="badge ${STATUS[l.status][1]}">${STATUS[l.status][0]}</span>
        <div class="acts"><button class="btn ghost sm" data-lup="${l.id}" aria-label="تحريك للأعلى"${i === 0 ? ' disabled' : ''}>▲</button>
        <button class="btn ghost sm" data-ldown="${l.id}" aria-label="تحريك للأسفل"${i === n - 1 ? ' disabled' : ''}>▼</button>
        <button class="btn ghost sm" data-lpub="${l.id}">${l.status === 'published' ? 'إخفاء' : 'نشر'}</button>
        <button class="btn ghost sm" data-ledit="${l.id}">تعديل</button>
        <button class="btn ghost sm danger" data-ldel="${l.id}">حذف</button></div></div>`).join('')}</div>`
        : `<p class="state">${sel ? 'لا توجد دروس في هذه الوحدة بعد. اضغط «إضافة درس».' : 'أنشئ سنة ثم مجالاً ثم وحدة أولاً، ثم أضف دروسك.'}</p>`}`;
  };

  async function form(l) {
    const isNew = !l, C = {};
    if (!isNew) {
      const { data, error } = await sb.from('lesson_contents').select('*').eq('lesson_id', l.id);
      if (error) return fail(error, 'تعذّر تحميل محتوى الدرس');
      data.forEach(c => { C[c.type] = c; });
    }
    const exist = t => C[t] ? `<p class="note">يوجد محتوى حالياً. اختر بديلاً لاستبداله أو فعّل الحذف.</p><label class="chk"><input type="checkbox" name="rm_${t}"> حذف هذا المحتوى</label>` : '';
    const ord = t => `<label>ترتيب العرض داخل الدرس (1 = الأول)<input type="number" name="ord_${t}" min="1" max="4" value="${C[t] ? C[t].sort_order : DEF[t]}"></label>`;
    const f = adm.openForm(isNew ? 'إضافة درس' : 'تعديل الدرس', `
      <label>عنوان الدرس<input name="title" required maxlength="150" value="${esc(l && l.title)}"></label>
      <label>وصف الدرس<textarea name="description" rows="2">${esc(l && l.description)}</textarea></label>
      <div class="two"><label>ترتيب الدرس<input type="number" name="sort_order" min="0" value="${l ? l.sort_order : rowsOf().length}"></label>
      <label>الحالة<select name="status">${Object.entries(STATUS).map(([v, s]) => `<option value="${v}"${(l ? l.status : 'draft') === v ? ' selected' : ''}>${v === 'draft' ? 'حفظ كمسودة' : v === 'published' ? 'نشر الدرس' : 'إخفاء مؤقتاً'}</option>`).join('')}</select></label></div>
      <label>صورة الغلاف (JPG أو PNG أو WebP، حتى 3MB)<input type="file" name="cover_file" accept="image/jpeg,image/png,image/webp"></label>${l && l.cover_path ? '<p class="note">يوجد غلاف حالياً.</p>' : ''}
      <fieldset class="ct"><legend>درس HTML تفاعلي</legend>${exist('html')}
        <label>رفع ملف HTML (حتى 5MB)<input type="file" name="html_file" accept=".html,.htm,text/html"></label>
        <label>أو الصق الكود هنا<textarea name="html_text" rows="5" dir="ltr"></textarea></label>
        <div><button class="btn ghost sm" type="button" id="prevBtn">معاينة آمنة</button></div>${ord('html')}</fieldset>
      <fieldset class="ct"><legend>تمارين HTML تفاعلية</legend>${exist('exercises')}
        <label>رفع ملف HTML للتمارين (حتى 5MB)<input type="file" name="exercises_file" accept=".html,.htm,text/html"></label>
        <label>أو الصق الكود هنا<textarea name="exercises_text" rows="5" dir="ltr"></textarea></label>
        <div><button class="btn ghost sm" type="button" id="prevEx">معاينة آمنة</button></div>${ord('exercises')}</fieldset>
      <fieldset class="ct"><legend>فيديو تعليمي</legend>${exist('video')}
        <label>رفع فيديو MP4 أو WebM (حتى 50MB)<input type="file" name="video_file" accept="video/mp4,video/webm"></label>
        <label>أو رابط فيديو (للملفات الكبيرة)<input type="url" name="video_url" dir="ltr" placeholder="https://" value="${esc(C.video && C.video.external_url)}"></label>${ord('video')}</fieldset>
      <fieldset class="ct"><legend>ملف PDF</legend>${exist('pdf')}
        <label>رفع PDF (حتى 50MB)<input type="file" name="pdf_file" accept="application/pdf"></label>
        <label class="chk"><input type="checkbox" name="pdf_dl"${C.pdf && C.pdf.downloadable ? ' checked' : ''}> السماح للطالب بتحميل الملف</label>${ord('pdf')}</fieldset>`,
    async fd => {
      const title = fd.get('title').trim();
      if (!title) throw new Error('العنوان مطلوب');
      const v = { title, description: fd.get('description').trim() || null, sort_order: +fd.get('sort_order') || 0, status: fd.get('status') };
      let id;
      if (isNew) {
        v.unit_id = adm.sel.unit;
        const r = await sb.from('lessons').insert(v).select('id').single(); if (r.error) throw r.error; id = r.data.id;
      } else {
        const r = await sb.from('lessons').update(v).eq('id', l.id); if (r.error) throw r.error; id = l.id;
      }
      const old = [];
      const cover = fd.get('cover_file');
      if (cover && cover.size) {
        const path = await uploads.put('cover', id, cover);
        const r = await sb.from('lessons').update({ cover_path: path }).eq('id', id); if (r.error) throw r.error;
        if (l && l.cover_path) old.push(['lesson-covers', l.cover_path]);
      }
      for (const t of ['html', 'exercises', 'video', 'pdf']) {
        const cur = C[t], ord = +fd.get('ord_' + t) || DEF[t];
        let file = fd.get(t + '_file'); file = file && file.size ? file : null;
        if ((t === 'html' || t === 'exercises') && !file) { const txt = (fd.get(t + '_text') || '').trim(); if (txt) file = new File([txt], t === 'html' ? 'lesson.html' : 'exercises.html', { type: 'text/html' }); }
        const url = t === 'video' ? (fd.get('video_url') || '').trim() : '';
        let patch = null;
        if (file) patch = { storage_path: await uploads.put(t, id, file), external_url: null };
        else if (cur && fd.get('rm_' + t) === 'on' && !(url && url !== cur.external_url)) {
          const r = await sb.from('lesson_contents').delete().eq('id', cur.id); if (r.error) throw r.error;
          if (cur.storage_path) old.push([uploads.BUCKET[t], cur.storage_path]);
          continue;
        }
        else if (url) patch = { external_url: url, storage_path: null };
        if (!patch && !cur) continue;
        const row = Object.assign({ sort_order: ord }, patch || {});
        if (t === 'pdf') row.downloadable = fd.get('pdf_dl') === 'on';
        if (patch && cur && cur.storage_path && cur.storage_path !== patch.storage_path) old.push([uploads.BUCKET[t], cur.storage_path]);
        const r = cur ? await sb.from('lesson_contents').update(row).eq('id', cur.id)
                      : await sb.from('lesson_contents').insert(Object.assign({ lesson_id: id, type: t }, row));
        if (r.error) throw r.error;
      }
      await uploads.purge(old).catch(e => console.error(e));
      await adm.refresh();
    });

    const preview = t => async () => {
      try {
        const el = f.elements; let txt = el[t + '_text'].value.trim();
        if (!txt && el[t + '_file'].files[0]) txt = await el[t + '_file'].files[0].text();
        if (!txt && C[t] && C[t].storage_path) txt = await api.downloadText('lesson-html', C[t].storage_path);
        if (!txt) return ui.toast('لا يوجد محتوى HTML للمعاينة.', 'err');
        ui.sandboxFrame($('pframe'), txt); $('pdlg').showModal();
      } catch (e) { fail(e, 'تعذّرت المعاينة'); }
    };
    $('prevBtn').onclick = preview('html'); $('prevEx').onclick = preview('exercises');
  }

  view.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset, byId = id => adm.A.lessons.find(x => x.id === id);
    try {
      if ('ladd' in d) return await form(null);
      if (d.ledit) return await form(byId(d.ledit));
      if (d.lup || d.ldown) await adm.move('lessons', rowsOf(), d.lup || d.ldown, d.lup ? -1 : 1);
      else if (d.lpub) {
        const l = byId(d.lpub), r = await sb.from('lessons').update({ status: l.status === 'published' ? 'hidden' : 'published' }).eq('id', l.id);
        if (r.error) throw r.error;
      } else if (d.ldel) {
        const l = byId(d.ldel);
        if (!await adm.confirm(`حذف الدرس «${l.title}» وجميع ملفاته نهائياً؟ لا يمكن التراجع.`)) return;
        const files = await uploads.filesFor([l.id]);
        const r = await sb.from('lessons').delete().eq('id', l.id); if (r.error) throw r.error;
        await uploads.purge(files).catch(x => console.error(x));
        ui.toast('تم حذف الدرس.');
      } else return;
      await adm.refresh();
    } catch (err) { fail(err); }
  });
})();
