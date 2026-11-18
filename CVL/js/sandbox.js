// يعمل داخل iframe معزول (sandbox بدون allow-same-origin): يستقبل كود الدرس من الصفحة الأم ويكتبه هنا.
// لا يملك أي وصول إلى جلسة الطالب أو مفاتيح الموقع.
(() => {
  let done = false;
  addEventListener('message', e => {
    if (done || e.source !== parent || !e.data || typeof e.data.html !== 'string') return;
    done = true;
    document.open(); document.write(e.data.html); document.close();
  });
})();
