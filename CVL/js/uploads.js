// رفع الملفات إلى Supabase Storage مع التحقق من الصيغة والحجم
window.uploads = (() => {
  const MB = 1048576;
  const MIME = { html: 'text/html', htm: 'text/html', mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf', svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml' };
  const RULES = { html: ['lesson-html', 5, ['html', 'htm']], video: ['lesson-videos', 50, ['mp4', 'webm']], pdf: ['lesson-pdf', 50, ['pdf']], exercises: ['lesson-html', 5, ['html', 'htm']], cover: ['lesson-covers', 3, ['jpg', 'jpeg', 'png', 'webp']], logo: ['site-assets', 1, ['png', 'jpg', 'jpeg', 'webp', 'svg']] };
  const BUCKET = { html: 'lesson-html', video: 'lesson-videos', pdf: 'lesson-pdf', exercises: 'lesson-html' };
  const rid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));

  async function put(kind, folder, file) {
    const [bucket, max, exts] = RULES[kind], ext = file.name.split('.').pop().toLowerCase();
    if (!exts.includes(ext)) throw new Error('صيغة غير مسموحة. المسموح: ' + exts.join(', '));
    if (file.size > max * MB) throw new Error('حجم الملف أكبر من ' + max + 'MB');
    const path = folder + '/' + rid() + '.' + ext;
    const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: MIME[ext], upsert: false });
    if (error) throw error;
    return path;
  }

  // كل ملفات الدروس (محتوى + أغلفة) كأزواج [bucket, path] لحذفها مع الدرس
  async function filesFor(lessonIds) {
    if (!lessonIds.length) return [];
    const [c, l] = await Promise.all([
      sb.from('lesson_contents').select('type,storage_path').in('lesson_id', lessonIds),
      sb.from('lessons').select('cover_path').in('id', lessonIds)
    ]);
    return [].concat(
      (c.data || []).filter(x => x.storage_path).map(x => [BUCKET[x.type], x.storage_path]),
      (l.data || []).filter(x => x.cover_path).map(x => ['lesson-covers', x.cover_path]));
  }

  async function purge(pairs) {
    const by = {};
    pairs.forEach(([b, p]) => { (by[b] = by[b] || []).push(p); });
    await Promise.all(Object.entries(by).map(([b, p]) => sb.storage.from(b).remove(p)));
  }

  return { put, filesFor, purge, BUCKET };
})();
