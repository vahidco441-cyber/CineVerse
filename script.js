// CineVerse catalogue — uses the same movie records managed in the admin panel.
(() => {
  const $ = id => document.getElementById(id);
  const cfg = window.CINEVERSE_CONFIG || {};
  let db = null;
  let movies = [];
  let currentHero = null;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));

  function setStatus(message, state = "") {
    const el = $("status");
    if (!el) return;
    el.textContent = message;
    el.className = "status " + state;
  }

  function openMovie(movie) {
    if (!movie || !movie.cloud_url) {
      setStatus("برای این فیلم هنوز لینک پخش ثبت نشده است.", "error");
      return;
    }
    const params = new URLSearchParams({
      src: movie.cloud_url,
      title: movie.title || "پخش فیلم"
    });
    location.href = "player.html?" + params.toString();
  }

  function card(movie) {
    const poster = movie.poster_url
      ? `background-image:url("${esc(movie.poster_url)}")`
      : "";
    const rating = movie.rating == null ? "—" : Number(movie.rating).toFixed(1);
    return `<article class="movie-card" data-id="${esc(movie.id)}">
      <div class="poster" style="${poster}">
        <div class="rating">★ ${esc(rating)}</div>
      </div>
      <div class="card-info">
        <div class="card-title">${esc(movie.title)}</div>
        <div class="card-meta">${esc(movie.year || "—")}</div>
      </div>
    </article>`;
  }

  function render(targetId, list) {
    const el = $(targetId);
    if (!el) return;
    el.innerHTML = list.length
      ? list.map(card).join("")
      : '<div class="empty">هنوز فیلمی منتشر نشده است.</div>';
    el.querySelectorAll(".movie-card").forEach(node => {
      node.addEventListener("click", () => {
        const movie = movies.find(item => item.id === node.dataset.id);
        openMovie(movie);
      });
    });
  }

  function setHero(movie) {
    currentHero = movie || null;
    if (!movie) return;
    $("heroTitle").textContent = movie.title || "";
    $("heroMeta").textContent = [
      movie.year || "—",
      movie.category || "سایر",
      movie.rating == null ? "بدون امتیاز" : "★ " + Number(movie.rating).toFixed(1)
    ].join("  •  ");
    $("heroOverview").textContent = movie.overview || "";
    const hero = $("hero");
    if (hero && movie.poster_url) {
      hero.style.backgroundImage =
        `linear-gradient(90deg,#050505 8%,rgba(5,5,5,.76) 42%,rgba(5,5,5,.25) 100%),url("${movie.poster_url.replace(/["\\\\]/g, "")}")`;
    }
  }

  async function loadMovies() {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
      setStatus("تنظیمات اتصال سایت کامل نیست.", "error");
      return;
    }
    setStatus("در حال دریافت فیلم‌ها...");
    try {
      if (!db) db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const { data, error } = await db
        .from("cv_movies")
        .select("id,title,year,rating,overview,poster_url,cloud_url,category,language,published,created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;

      movies = data || [];
      if (!movies.length) {
        render("popularGrid", []);
        render("newestGrid", []);
        setStatus("سایت آماده است؛ هنوز فیلمی منتشر نشده است.", "ok");
        $("heroTitle").textContent = "به CineVerse خوش آمدید";
        $("heroMeta").textContent = "فیلم‌های شما اینجا نمایش داده می‌شوند";
        return;
      }

      const popular = [...movies]
        .sort((a,b) => Number(b.rating || 0) - Number(a.rating || 0))
        .slice(0, 12);
      render("popularGrid", popular);
      render("newestGrid", movies.slice(0, 12));
      setHero(popular[0] || movies[0]);
      setStatus("اتصال موفق است — " + movies.length + " فیلم منتشرشده", "ok");
    } catch (error) {
      console.error("CineVerse catalogue error:", error);
      setStatus("دریافت فیلم‌ها انجام نشد. تنظیمات پایگاه داده و دسترسی عمومی را بررسی کنید.", "error");
    }
  }

  const reload = $("reloadBtn");
  if (reload) reload.addEventListener("click", loadMovies);
  const heroPlay = $("heroPlay");
  if (heroPlay) heroPlay.addEventListener("click", () => openMovie(currentHero));
  const search = $("searchInput");
  if (search) {
    search.addEventListener("input", event => {
      const q = event.target.value.trim().toLocaleLowerCase();
      const found = q
        ? movies.filter(movie => (movie.title || "").toLocaleLowerCase().includes(q))
        : [...movies].sort((a,b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0,12);
      render("popularGrid", found.slice(0, 48));
    });
  }
  loadMovies();
})();
