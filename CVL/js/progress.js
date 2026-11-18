// تقدم الطالب والمفضلة. الحماية الفعلية في سياسات RLS.
window.progress = (() => {
  const ok = async p => { const { error } = await p; if (error) throw error; };
  const up = (uid, lid, patch) => ok(sb.from('lesson_progress').upsert(
    Object.assign({ user_id: uid, lesson_id: lid }, patch), { onConflict: 'user_id,lesson_id' }));
  return {
    open: (uid, lid) => up(uid, lid, { last_opened_at: new Date().toISOString() }),
    save: up,
    fav: (uid, lid, on) => on
      ? ok(sb.from('favorites').insert({ user_id: uid, lesson_id: lid }))
      : ok(sb.from('favorites').delete().eq('user_id', uid).eq('lesson_id', lid))
  };
})();
