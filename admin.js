(() => {
  "use strict";

  const cfg = window.CINEVERSE_CONFIG || {};
  const $ = id => document.getElementById(id);
  const BUCKET = "cineverse-media";
  let db = null;
  let movieCache = [];

  const message = (id, text) => { const el = $(id); if (el) el.textContent = text; };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));

  function showLogin(text = "") {
    $("loginPanel").hidden = false;
    $("dashboard").hidden = true;
    message("loginMessage", text);
  }

  function showDashboard() {
    $("loginPanel").hidden = true;
    $("dashboard").hidden = false;
    loadMovies();
  }

  function translateAuthError(error) {
    const raw = error?.message || "خطا در ورود";
    if (/invalid login credentials/i.test(raw)) return "ایمیل یا رمز عبور درست نیست.";
    if (/email not confirmed/i.test(raw)) return "ایمیل حساب هنوز تأیید نشده است.";
    if (/network|fetch/i.test(raw)) return "ارتباط اینترنت یا سرویس ورود برقرار نشد.";
    return raw;
  }

  async function verifySession() {
    const { data, error } = await db.auth.getSession();
    if (error) {
      showLogin("بررسی نشست ورود ناموفق بود: " + error.message);
      return;
    }
    if (!data.session) {
      showLogin();
      return;
    }
    const { data: admin, error: adminError } = await db
      .from("cv_admins")
      .select("user_id")
      .eq("user_id", data.session.user.id)
      .maybeSingle();
    if (adminError || !admin) {
      await db.auth.signOut();
      showLogin("این حساب مجوز مدیریت سایت را ندارد.");
      return;
    }
    showDashboard();
  }

  async function uploadFile(file, folder) {
    if (!file) return null;
    const extension = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = folder + "/" + crypto.randomUUID() + "." + extension;
    const { error } = await db.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream"
    });
    if (error) throw error;
    const { data } = db.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  function resetForm() {
    $("movieForm").reset();
    $("movieId").value = "";
    $("published").checked = true;
    $("formTitle").textContent = "افزودن فیلم جدید";
    message("formMessage", "");
  }

  async function loadMovies() {
    const container = $("adminMovies");
    container.textContent = "در حال دریافت فهرست فیلم‌ها...";
    const { data, error } = await db.from("cv_movies").select("*").order("created_at", { ascending: false });
    if (error) {
      container.textContent = "خطا در دریافت فیلم‌ها: " + error.message;
      return;
    }
    movieCache = data || [];
    if (!movieCache.length) {
      container.textContent = "هنوز فیلمی ثبت نشده است.";
      return;
    }
    container.innerHTML = movieCache.map(movie => `
      <div class="item">
        <span>${escapeHtml(movie.title)} <small>${movie.published ? "منتشرشده" : "پیش‌نویس"}</small></span>
        <button type="button" data-edit="${escapeHtml(movie.id)}">ویرایش</button>
        <button type="button" data-delete="${escapeHtml(movie.id)}">حذف</button>
      </div>`).join("");

    container.querySelectorAll("[data-edit]").forEach(button => {
      button.addEventListener("click", () => {
        const movie = movieCache.find(item => item.id === button.dataset.edit);
        if (!movie) return;
        $("movieId").value = movie.id;
        $("title").value = movie.title || "";
        $("year").value = movie.year || "";
        $("rating").value = movie.rating ?? "";
        $("category").value = movie.category || "سایر";
        $("language").value = movie.language || "";
        $("posterUrl").value = movie.poster_url || "";
        $("videoUrl").value = movie.cloud_url || "";
        $("overview").value = movie.overview || "";
        $("published").checked = !!movie.published;
        $("posterFile").value = "";
        $("videoFile").value = "";
        $("formTitle").textContent = "ویرایش فیلم";
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    container.querySelectorAll("[data-delete]").forEach(button => {
      button.addEventListener("click", async () => {
        if (!window.confirm("این فیلم حذف شود؟")) return;
        const { error: deleteError } = await db.from("cv_movies").delete().eq("id", button.dataset.delete);
        if (deleteError) window.alert("حذف انجام نشد: " + deleteError.message);
        else loadMovies();
      });
    });
  }

  async function init() {
    if (!cfg.supabaseUrl?.startsWith("https://") || !cfg.supabaseAnonKey || !window.supabase) {
      showLogin("تنظیمات اتصال سایت کامل نیست.");
      return;
    }
    db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    $("loginForm").addEventListener("submit", async event => {
      event.preventDefault();
      const button = $("loginForm").querySelector('button[type="submit"]');
      button.disabled = true;
      message("loginMessage", "در حال بررسی اطلاعات ورود...");
      const { error } = await db.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value
      });
      button.disabled = false;
      if (error) {
        message("loginMessage", translateAuthError(error));
        return;
      }
      await verifySession();
    });

    $("logoutBtn").addEventListener("click", async () => {
      await db.auth.signOut();
      showLogin("از حساب خارج شدی.");
    });
    $("resetBtn").addEventListener("click", resetForm);

    $("movieForm").addEventListener("submit", async event => {
      event.preventDefault();
      const submit = $("movieForm").querySelector('button[type="submit"]');
      submit.disabled = true;
      message("formMessage", "در حال ذخیره فیلم و آپلود فایل‌ها...");
      try {
        const posterFileUrl = await uploadFile($("posterFile").files[0], "posters");
        const videoFileUrl = await uploadFile($("videoFile").files[0], "videos");
        const oldMovie = movieCache.find(item => item.id === $("movieId").value);
        const posterUrl = posterFileUrl || $("posterUrl").value.trim() || oldMovie?.poster_url || null;
        const videoUrl = videoFileUrl || $("videoUrl").value.trim() || oldMovie?.cloud_url || null;
        const payload = {
          title: $("title").value.trim(),
          year: $("year").value ? Number($("year").value) : null,
          rating: $("rating").value ? Number($("rating").value) : null,
          category: $("category").value,
          language: $("language").value.trim() || null,
          poster_url: posterUrl,
          cloud_url: videoUrl,
          overview: $("overview").value.trim() || null,
          published: $("published").checked
        };
        if (!payload.title) throw new Error("نام فیلم را وارد کن.");
        if (!payload.cloud_url) throw new Error("فایل فیلم را انتخاب کن یا لینک مستقیم وارد کن.");

        const id = $("movieId").value;
        const result = id
          ? await db.from("cv_movies").update(payload).eq("id", id)
          : await db.from("cv_movies").insert(payload);
        if (result.error) throw result.error;
        message("formMessage", "فیلم با موفقیت ذخیره شد.");
        resetForm();
        await loadMovies();
      } catch (error) {
        console.error("CineVerse save error:", error);
        message("formMessage", "ذخیره انجام نشد: " + (error.message || "خطای نامشخص"));
      } finally {
        submit.disabled = false;
      }
    });

    await verifySession();
  }

  init();
})();
