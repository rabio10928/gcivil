-- المرحلة 10: نوع محتوى جديد "exercises" (تمارين HTML) داخل الدرس. شغّله مرة واحدة على مشروع قائم (آمن لإعادة التشغيل).
alter table public.lesson_contents drop constraint if exists lesson_contents_type_check;
alter table public.lesson_contents add constraint lesson_contents_type_check check (type in ('html','video','pdf','exercises'));
