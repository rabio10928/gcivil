# Civil Engineering Academy 3D
موقع ثابت (HTML/CSS/JS + Three.js + Supabase). شغّله محلياً بـ `python3 -m http.server`، وانشره على Vercel أو Netlify.

## إعداد Supabase (المرحلة 2)
1. أنشئ مشروعاً في supabase.com.
2. SQL Editor: شغّل `database/schema.sql` ثم `database/policies.sql`.
3. Project Settings > API: انسخ Project URL ومفتاح anon إلى `js/config.js`.
4. Authentication > Providers > Email: للتجربة عطّل Confirm email، وللإنتاج فعّله.
5. سجّل حساباً من الموقع (المرحلة 3) ثم شغّل سطر "اجعل نفسك مديراً" في آخر policies.sql.

## الصفحات التي تستخدم Supabase تضيف قبل سكربتاتها:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script src="js/config.js"></script>
<script src="js/supabase.js"></script>
```

## الأمان
- مفتاح service_role لا يوضع في الواجهة أبداً.
- فحص الاشتراك يتم في `has_access()` داخل سياسات RLS وسياسات Storage.
- مدة التجربة تُحسب من الخادم عند التسجيل، والدور `admin` يُعيَّن من SQL فقط.

## المرحلة 3: الحسابات ولوحة الطالب
register.html, login.html, student-dashboard.html, academic-year.html + js/auth, guards, ui, student, academic + css/dashboard.css
اختبار: سجّل حساباً، ادخل، جرّب السنوات والمفضلة وتغيير الاسم والصورة، ثم سجّل الخروج وافتح student-dashboard.html (يجب أن يحوّلك إلى login.html).
لإضافة بيانات تجريبية قبل المرحلة 4: أدخل صفوفاً في academic_years وdomains وunits وlessons (status = published) من Table Editor.

## المرحلة 4: لوحة المدير
admin-dashboard.html + css/admin.css + js/admin.js + js/uploads.js
اختبار: اجعل حسابك مديراً (آخر policies.sql)، سجّل الدخول (يحوّلك إلى لوحة الإدارة)، أضف سنة ثم مجالاً ثم وحدة ثم درساً بالأنواع الثلاثة، ثم افتح student-dashboard.html وتأكد أن الدرس المنشور يظهر.

## المرحلة 4: لوحة الإدارة
admin-dashboard.html + css/admin.css + js/admin, lessons, uploads
إدارة السنوات والمجالات والوحدات والدروس (إضافة/تعديل/حذف/ترتيب/نشر/إخفاء)، رفع HTML وفيديو وPDF وغلاف إلى Storage، معاينة HTML داخل sandbox، لوحة إحصائيات، قائمة الطلاب.
الدخول: حساب role = admin يُحوَّل تلقائياً إلى admin-dashboard.html بعد تسجيل الدخول.

## المرحلة 5: صفحة الدرس
lesson.html + css/lesson.css + js/progress.js + js/lesson-view.js
HTML داخل iframe sandbox (srcdoc)، فيديو (رفع أو YouTube/Vimeo/رابط مباشر)، PDF بروابط موقّعة، بالترتيب الذي حدده المدير. تقدم الطالب والمفضلة والسابق/التالي. غير المشترك يرى جدار الاشتراك.

## المرحلة 6: الاشتراكات والمدفوعات
subscription.html + css/subscription.css + js/subscriptions.js (الطالب) + js/billing.js (المدفوعات والاشتراكات والإعدادات في لوحة الإدارة) + database/phase6.sql
الدفع يدوي: الطالب يحوّل المبلغ ويرسل رقم العملية (حالة pending)، والمدير يؤكد أو يرفض. لا يوجد ربط ببوابة دفع إلكترونية بعد.

## المرحلة 7: الأمان والنشر
database/phase7.sql (للتثبيتات القديمة) + vercel.json + sandbox.html + js/sandbox.js + tests/ + TESTING.md
- دروس HTML تُعرض عبر sandbox.html داخل iframe معزول، لتعمل مع ترويسات CSP.
- إعدادات المنصة (ومنها تعليمات الدفع) صارت للمسجّلين فقط، وإخفاء مجال يخفي وحداته.

## نسيان كلمة المرور
forgot-password.html (يطلب الرابط) + reset-password.html (كلمة مرور جديدة) + js/reset.js، مع رابط «نسيت كلمة المرور؟» في login.html.
يلزم إضافة `/reset-password.html` إلى Redirect URLs في Supabase (Authentication > URL Configuration).

## المرحلة 8: خطط الاشتراك القابلة للإدارة
database/phase8.sql (للتثبيتات القائمة) + js/plans.js + تحديث subscription.html وindex.html
- جدول `plans`: الاسم والوصف والسعر والمدة بالأيام والمزايا والتفعيل والتمييز والترتيب.
- لوحة الإدارة > خطط الاشتراك: إضافة وتعديل وتفعيل/تعطيل وترتيب وحذف.
- الصفحة الرئيسية وصفحة الاشتراك تعرضان الخطط المفعّلة فقط. الدفعة تحفظ لقطة من الخطة (الاسم والسعر والمدة) فلا يغيّر تعديل الخطة طلباً قائماً.
- مدة التجربة وتعليمات الدفع في لوحة الإدارة > الإعدادات.

## المرحلة 9: الوضع الفاتح وهوية الموقع
js/theme.js (في <head>) + js/site.js + js/site-admin.js + database/phase9.sql
- زر الشمس/القمر في كل الصفحات، ويُحفظ اختيار الزائر في متصفحه. الوضع الافتراضي (داكن أو فاتح أو حسب الجهاز) يحدده المدير.
- لوحة الإدارة > هوية الموقع والمحتوى: اسم الموقع والشعار (PNG/JPG/WebP/SVG حتى 1MB) وعنوان الصفحة الرئيسية ووصفها وعناوين الأقسام والتواصل والتذييل. الحقل الفارغ يعيد النص الأصلي.
- الشعار في Bucket عام اسمه site-assets (الكتابة للمدير فقط)، ويظهر أيضاً أيقونةً للتبويب.

## المرحلة 10: التصفح المتدرج وتمارين HTML
database/phase10.sql (للمشاريع القائمة) + js/academic.js (أُعيدت كتابته) + تحديثات lessons.js وlesson-view.js وstudent.js
- الطالب يرى السنوات فقط في لوحته، ومنها: السنة ← المجالات ← الوحدات ← الدروس، في صفحة واحدة بمسار تصفح (breadcrumb) وزر رجوع لكل مستوى.
- قسم جديد في الدرس: «تمارين HTML» (رفع ملف أو لصق كود مع معاينة آمنة)، يُعرض في iframe معزول بالترتيب الذي يحدده المدير، ويدخل في حساب تقدم الدرس.
