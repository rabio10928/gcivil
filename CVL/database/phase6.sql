-- المرحلة 6: شغّله مرة واحدة في SQL Editor إن كنت قد شغّلت schema.sql سابقاً (آمن لإعادة التشغيل).
insert into public.app_settings (key, value)
values ('payment_instructions', to_jsonb('عدّل هذا النص من لوحة الإدارة > الإعدادات: اكتب هنا طريقة الدفع ورقم الحساب.'::text))
on conflict (key) do nothing;
