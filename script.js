// CineVerse V6 - FIXED PROXY LIST
// This version talks to the existing CineVerse proxy at /jellyfin.
// It keeps the V6 PC architecture and only fixes library pagination.

const $ = (id) => document.getElementById(id);
let movies = [];
let currentHero = null;

function jellyfin(path) {
  const clean = path.startsWith("/") ? path : "/" + path;
  return "/jellyfin" + clean;
}

function imageUrl(item) {
  if (!item || !item.Id) return "";
  return jellyfin(`/Items/${encodeURIComponent(item.Id)}/Images/Primary?fillWidth=500&quality=90`);
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function card(item) {
  const rating = item.CommunityRating ? Number(item.CommunityRating).toFixed(1) : "—";
  const year = item.ProductionYear || "—";
  const bg = imageUrl(item);

  return `<article class="movie-card" data-id="${esc(item.Id)}">
    <div class="poster" style="background-image:url('${bg}')">
      <div class="rating">★ ${rating}</div>
    </div>
    <div class="card-info">
      <div class="card-title">${esc(item.Name)}</div>
      <div class="card-meta">${year}</div>
    </div>
  </article>`;
}

function render(id, list) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = list.length
    ? list.map(card).join("")
    : `<div class="empty">فیلمی برای نمایش پیدا نشد.</div>`;

  el.querySelectorAll(".movie-card").forEach(c => {
    c.onclick = () => openMovie(c.dataset.id);
  });
}

function setStatus(text, type = "") {
  const el = $("status");
  if (!el) return;
  el.textContent = text;
  el.className = "status " + type;
}

/*
 * IMPORTANT FIX:
 * Jellyfin's Items endpoint supports StartIndex + Limit.
 * The old V6 frontend effectively stopped at the first page.
 * We now fetch every page through the existing /jellyfin proxy.
 */
async function loadAllMovies() {
  const pageSize = 100;
  const all = [];
  let start = 0;
  let total = null;

  while (true) {
    const params =
      `?IncludeItemTypes=Movie` +
      `&Recursive=true` +
      `&Fields=PrimaryImageAspectRatio,ProductionYear,CommunityRating,Overview,ImageTags,DateCreated` +
      `&SortBy=DateCreated` +
      `&SortOrder=Descending` +
      `&StartIndex=${start}` +
      `&Limit=${pageSize}` +
      `&EnableTotalRecordCount=true`;

    const response = await fetch(jellyfin("/Items" + params), {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Jellyfin proxy HTTP " + response.status);
    }

    const data = await response.json();
    const page = Array.isArray(data.Items) ? data.Items : [];

    all.push(...page);

    if (typeof data.TotalRecordCount === "number") {
      total = data.TotalRecordCount;
    }

    if (page.length === 0) break;
    start += page.length;

    if (page.length < pageSize) break;
    if (total !== null && all.length >= total) break;
    if (start >= 100000) break;
  }

  return all;
}

function removeNewestSection() {
  const section = document.getElementById("newest");
  if (section) section.remove();

  document.querySelectorAll('a[href="#newest"]').forEach(a => a.remove());
}

async function loadMovies() {
  removeNewestSection();
  setStatus("در حال دریافت فیلم‌ها از Jellyfin...");

  try {
    movies = await loadAllMovies();

    if (!movies.length) {
      setStatus("اتصال برقرار شد، اما فیلمی پیدا نشد.", "error");
      return;
    }

    const popular = [...movies]
      .sort((a,b) => (b.CommunityRating || 0) - (a.CommunityRating || 0))
      .slice(0, 12);

    render("popularGrid", popular);

    setHero(popular[0]);
    setStatus(`اتصال موفق است — ${movies.length} فیلم از Jellyfin دریافت شد.`, "ok");

  } catch (e) {
    console.error(e);
    setStatus("دریافت فیلم‌ها از Jellyfin انجام نشد. پنجره مشکی CineVerse را برای خطا بررسی کنید.", "error");
  }
}

function setHero(item) {
  currentHero = item;
  if (!item) return;

  const title = $("heroTitle");
  const meta = $("heroMeta");
  const overview = $("heroOverview");
  const hero = $("hero");

  if (title) title.textContent = item.Name || "";
  if (meta) {
    meta.textContent =
      `${item.ProductionYear || "—"}  •  ★ ${
        item.CommunityRating ? Number(item.CommunityRating).toFixed(1) : "—"
      }`;
  }
  if (overview) overview.textContent = item.Overview || "";

  const bg = imageUrl(item);
  if (hero && bg) {
    hero.style.backgroundImage =
      `linear-gradient(90deg,#050505 8%,rgba(5,5,5,.76) 42%,rgba(5,5,5,.25) 100%),url("${bg}")`;
  }
}

function openMovie(id) {
  const item = movies.find(x => x.Id === id);
  if (!item) return;

  currentHero = item;
  setHero(item);

  // V6 keeps playback separate. If player.html exists, use it.
  window.location.href = `player.html?id=${encodeURIComponent(item.Id)}`;
}

const reload = $("reloadBtn");
if (reload) reload.onclick = loadMovies;

const search = $("searchInput");
if (search) {
  search.addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = q
      ? movies.filter(x => (x.Name || "").toLowerCase().includes(q)).slice(0, 24)
      : [...movies]
          .sort((a,b) => (b.CommunityRating || 0) - (a.CommunityRating || 0))
          .slice(0, 12);

    render("popularGrid", filtered);
  });
}

loadMovies();
