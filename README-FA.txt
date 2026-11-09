راهنمای راه‌اندازی CineVerse V2

۱) محتوای این بسته را در ریشه مخزن GitHub با نام CineVerse قرار بده.
۲) در Supabase > SQL Editor محتوای database.sql را اجرا کن. این کار جدول‌های تازه cv_movies و cv_admins می‌سازد و جدول قدیمی movies را حذف نمی‌کند.
۳) در Supabase > Authentication > Users یک کاربر مدیر بساز (ایمیل و رمز عبور). UUID کاربر را کپی کن و در SQL Editor اجرا کن:
insert into public.cv_admins(user_id) values('UUID-اینجا');
۴) در Supabase > Project Settings > API مقدار Project URL و کلید عمومی anon/publishable را بردار و در config.js جایگزین دو مقدار PASTE_ کن.
۵) فقط کلید عمومی anon/publishable را در سایت بگذار؛ هرگز service_role یا secret key را در GitHub نگذار.
۶) در GitHub Settings > Pages انتشار از main و /(root) را فعال کن.

نکته مهم درباره ورود: این نسخه فعلاً با ایمیل و رمز عبور Supabase وارد می‌شود، نه نام کاربری مستقل. لینک فیلم باید لینک مستقیم و عمومی فایل ویدئو باشد؛ لینک پست تلگرام لزوماً در پخش‌کننده مرورگر کار نمی‌کند.
