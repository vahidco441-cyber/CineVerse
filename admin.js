
/* =====================================
   CineVerse Admin Panel - admin.js
   ===================================== */

document.addEventListener("DOMContentLoaded", () => {
  const config = window.CINEVERSE_CONFIG;

  if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
    alert("تنظیمات سایت پیدا نشد. فایل config.js را بررسی کنید.");
    return;
  }

  const client = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey
  );

  const BUCKET = "cineverse-media";
  const MOVIES_TABLE = "cv_movies";
  const ADMINS_TABLE = "cv_admins";

  // عناصر صفحه
  const $ = (id) => document.getElementById(id);

  const loginPanel = $("loginPanel");
  const loginForm = $("loginForm");
  const loginMessage = $("loginMessage");
  const dashboard = $("dashboard");
  const logoutBtn = $("logoutBtn");

  const movieForm = $("movieForm");
  const movieId = $("movieId");
  const formTitle = $("formTitle");
  const formMessage = $("formMessage");
  const resetBtn = $("resetBtn");
  const adminMovies = $("adminMovies");

  let currentUser = null;

  function message(element, text, success = false) {
    if (!element) return;

    element.textContent = text;
    element.style.color = success ? "#22c55e" : "#ef4444";
  }

  function showDashboard(show) {
    if (loginPanel) loginPanel.hidden = show;
    if (dashboard) dashboard.hidden = !show;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  // بررسی دسترسی مدیر
  async function verifyAdmin(user) {
    const { data, error } = await client
      .from(ADMINS_TABLE)
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      await client.auth.signOut();
      throw new Error("این حساب دسترسی مدیریت ندارد.");
    }

    currentUser = user;
    showDashboard(true);
    await loadMovies();
  }

  // ورود مدیر
  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("email").value.trim();
    const password = $("password").value;

    message(loginMessage, "در حال بررسی اطلاعات ورود...", true);

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      message(loginMessage, "ورود ناموفق بود: " + error.message);
      return;
    }

    try {
      await verifyAdmin(data.user);
      message(loginMessage, "با موفقیت وارد شدید.", true);
    } catch (err) {
      showDashboard(false);
      message(loginMessage, err.message);
    }
  });

  // خروج مدیر
  logoutBtn?.addEventListener("click", async () => {
    const { error } = await client.auth.signOut();

    if (error) {
      alert("خطا در خروج: " + error.message);
      return;
    }

    currentUser = null;
    showDashboard(false);
    loginForm?.reset();
    message(loginMessage, "از پنل خارج شدید.", true);
  });

  // آپلود فایل
  async function uploadFile(file, folder) {
    if (!file) return null;

    const extension = file.name.split(".").pop().toLowerCase();
    const allowedExtensions = folder === "posters"
      ? ["jpg", "jpeg", "png", "webp"]
      : ["mp4", "webm", "mov", "m4v"];

    if (!allowedExtensions.includes(extension)) {
      throw new Error("فرمت فایل انتخاب‌شده مجاز نیست.");
    }

    const fileName =
      `${folder}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error } = await client.storage
      .from(BUCKET)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false
      });

    if (error) throw error;

    const { data } = client.storage
      .from(BUCKET)
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  // ثبت یا ویرایش فیلم
  movieForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      message(formMessage, "ابتدا وارد حساب مدیر شوید.");
      return;
    }

    const submitButton = movieForm.querySelector(
      '[type="submit"]'
    );

    if (submitButton) submitButton.disabled = true;

    try {
      message(formMessage, "در حال ذخیره اطلاعات...", true);

      const posterFile = $("posterFile")?.files[0];
      const videoFile = $("videoFile")?.files[0];

      let posterUrl = $("posterUrl").value.trim();
      let videoUrl = $("videoUrl").value.trim();

      if (posterFile) {
        posterUrl = await uploadFile(posterFile, "posters");
      }

      if (videoFile) {
        videoUrl = await uploadFile(videoFile, "videos");
      }

      const movie = {
        title: $("title").value.trim(),
        year: Number($("year").value) || null,
        rating: Number($("rating").value) || 0,
        category: $("category").value.trim(),
        language: $("language").value.trim(),
        poster_url: posterUrl,
        cloud_url: videoUrl,
        overview: $("overview").value.trim(),
        published: $("published").checked
      };

      if (!movie.title) {
        throw new Error("عنوان فیلم را وارد کنید.");
      }

      if (!movie.cloud_url) {
        throw new Error("لینک یا فایل فیلم را وارد کنید.");
      }

      let result;

      if (movieId.value) {
        result = await client
          .from(MOVIES_TABLE)
          .update(movie)
          .eq("id", movieId.value);
      } else {
        result = await client
          .from(MOVIES_TABLE)
          .insert(movie);
      }

      if (result.error) throw result.error;

      message(
        formMessage,
        movieId.value
          ? "فیلم با موفقیت ویرایش شد."
          : "فیلم با موفقیت اضافه شد.",
        true
      );

      resetMovieForm();
      await loadMovies();

    } catch (error) {
      message(formMessage, "خطا: " + error.message);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  // پاک کردن فرم
  function resetMovieForm() {
    movieForm?.reset();

    if (movieId) movieId.value = "";

    if (formTitle) {
      formTitle.textContent = "افزودن فیلم جدید";
    }

    message(formMessage, "");
  }

  resetBtn?.addEventListener("click", resetMovieForm);

  // دریافت فهرست فیلم‌ها
  async function loadMovies() {
    if (!adminMovies) return;

    adminMovies.innerHTML = "<p>در حال دریافت فیلم‌ها...</p>";

    const { data, error } = await client
      .from(MOVIES_TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      adminMovies.textContent = "خطا در دریافت فیلم‌ها: " + error.message;
      return;
    }

    if (!data || data.length === 0) {
      adminMovies.innerHTML = "<p>هنوز فیلمی ثبت نشده است.</p>";
      return;
    }

    adminMovies.innerHTML = data.map((movie) => `
      <article class="admin-movie-card">
        <img
          src="${escapeHTML(movie.poster_url || "")}"
          alt="${escapeHTML(movie.title)}"
          class="admin-movie-poster"
          onerror="this.style.display='none'"
        >

        <div class="admin-movie-info">
          <h3>${escapeHTML(movie.title)}</h3>

          <p>سال: ${escapeHTML(movie.year || "-")}</p>
          <p>امتیاز: ${escapeHTML(movie.rating ?? "-")}</p>
          <p>دسته‌بندی: ${escapeHTML(movie.category || "-")}</p>
          <p>وضعیت: ${movie.published ? "منتشر شده" : "پیش‌نویس"}</p>

          <button
            type="button"
            data-edit="${escapeHTML(movie.id)}"
          >ویرایش</button>

          <button
            type="button"
            data-delete="${escapeHTML(movie.id)}"
          >حذف</button>
        </div>
      </article>
    `).join("");
  }

  // ویرایش و حذف فیلم
  adminMovies?.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");

    if (editButton) {
      await editMovie(editButton.dataset.edit);
    }

    if (deleteButton) {
      await deleteMovie(deleteButton.dataset.delete);
    }
  });

  // بارگذاری اطلاعات فیلم در فرم
  async function editMovie(id) {
    const { data, error } = await client
      .from(MOVIES_TABLE)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      alert("خطا در دریافت اطلاعات فیلم: " + error.message);
      return;
    }

    movieId.value = data.id;
    $("title").value = data.title || "";
    $("year").value = data.year ?? "";
    $("rating").value = data.rating ?? "";
    $("category").value = data.category || "";
    $("language").value = data.language || "";
    $("posterUrl").value = data.poster_url || "";
    $("videoUrl").value = data.cloud_url || "";
    $("overview").value = data.overview || "";
    $("published").checked = Boolean(data.published);

    if (formTitle) {
      formTitle.textContent = "ویرایش فیلم";
    }

    message(formMessage, "اطلاعات فیلم برای ویرایش آماده است.", true);

    movieForm.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // حذف فیلم
  async function deleteMovie(id) {
    if (!confirm("آیا از حذف این فیلم مطمئن هستید؟")) {
      return;
    }

    const { error } = await client
      .from(MOVIES_TABLE)
      .delete()
      .eq("id", id);

    if (error) {
      alert("خطا در حذف فیلم: " + error.message);
      return;
    }

    alert("فیلم با موفقیت حذف شد.");
    await loadMovies();
  }

  // بررسی وضعیت ورود هنگام باز شدن صفحه
  async function initialize() {
    showDashboard(false);

    const { data, error } = await client.auth.getSession();

    if (error) {
      message(loginMessage, error.message);
      return;
    }

    if (data.session?.user) {
      try {
        await verifyAdmin(data.session.user);
      } catch (err) {
        showDashboard(false);
        message(loginMessage, err.message);
      }
    }
  }

  initialize();
});
