
// ==========================================
// CINEVERSE V7 - MOVIE WEBSITE
// Jellyfin + Custom Posters + Search
// ==========================================

const $ = id => document.getElementById(id);

let movies = [];
let currentHero = null;

// ------------------------------------------
// Jellyfin connection
// ------------------------------------------

function jellyfin(path) {
  const clean = path.startsWith("/") ? path : "/" + path;
  const base = window.CINEVERSE_CONFIG?.proxyBase || "/jellyfin";
  return base + clean;
}

// ------------------------------------------
// Custom movie posters
// ------------------------------------------

function localPoster(item) {
  const name = (item?.Name || "").toLowerCase();

  if (name.includes("casanova")) {
    return "posters/casanova.jpg";
  }

  if (name.includes("pilya")) {
    return "posters/pilya.jpg";
  }

  return "";
}

function imageUrl(item) {
  if (!item || !item.Id) return "";

  return localPoster(item) ||
    jellyfin(
      `/Items/${encodeURIComponent(item.Id)}/Images/Primary?fillWidth=500&quality=90`
    );
}

// ------------------------------------------
// Safe text
// ------------------------------------------

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

// ------------------------------------------
// Movie card
// ------------------------------------------

function card(item) {
  const rating = item.CommunityRating
    ? Number(item.CommunityRating).toFixed(1)
    : "—";

  const year = item.ProductionYear || "—";
  const poster = imageUrl(item);

  return `
    <article class="movie-card" data-id="${esc(item.Id)}">

      <div class="poster"
        style="background-image:url('${esc(poster)}')">

        <div class="rating">★ ${rating}</div>

      </div>

      <div class="card-info">

        <div class="card-title">
          ${esc(item.Name)}
        </div>

        <div class="card-meta">
          ${year}
        </div>

      </div>

    </article>
  `;
}

// ------------------------------------------
// Render movies
// ------------------------------------------

function render(id, list) {
  const el = $(id);

  if (!el) return;

  el.innerHTML = list.length
    ? list.map(card).join("")
    : `<div class="empty">فیلمی برای نمایش پیدا نشد.</div>`;

  el.querySelectorAll(".movie-card").forEach(element => {
    element.onclick = () => openMovie(element.dataset.id);
  });
}

// ------------------------------------------
// Status
// ------------------------------------------

function setStatus(message, type = "") {
  const el = $("status");

  if (!el) return;

  el.textContent = message;
  el.className = "status " + type;
}

// ------------------------------------------
// Load all Jellyfin movies
// ------------------------------------------

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

    const response = await fetch(
      jellyfin("/Items" + params),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Jellyfin HTTP " + response.status);
    }

    const data = await response.json();

    const page = Array.isArray(data.Items)
      ? data.Items
      : [];

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

// ------------------------------------------
// Hero section
// ------------------------------------------

function setHero(item) {
  currentHero = item;

  if (!item) return;

  const title = $("heroTitle");
  const meta = $("heroMeta");
  const overview = $("heroOverview");
  const hero = $("hero");

  if (title) {
    title.textContent = item.Name || "";
  }

  if (meta) {
    meta.textContent =
      `${item.ProductionYear || "—"} • ★ ${
        item.CommunityRating
          ? Number(item.CommunityRating).toFixed(1)
          : "—"
      }`;
  }

  if (overview) {
    overview.textContent = item.Overview || "";
  }

  const poster = imageUrl(item);

  if (hero && poster) {
    hero.style.backgroundImage =
      `linear-gradient(90deg,#050505 8%,rgba(5,5,5,.76) 42%,rgba(5,5,5,.25) 100%),url("${poster}")`;
  }
}

// ------------------------------------------
// Load movies
// ------------------------------------------

async function loadMovies() {

  setStatus("در حال دریافت فیلم‌ها از Jellyfin...");

  try {

    movies = await loadAllMovies();

    if (!movies.length) {
      setStatus(
        "اتصال برقرار شد، اما فیلمی پیدا نشد.",
        "error"
      );
      return;
    }

    const popular = [...movies]
      .sort((a, b) =>
        (b.CommunityRating || 0) -
        (a.CommunityRating || 0)
      )
      .slice(0, 12);

    render("newestGrid", popular);

    setHero(popular[0]);

    setStatus(
      `اتصال موفق است — ${movies.length} فیلم دریافت شد.`,
      "ok"
    );

  } catch (error) {

    console.error(error);

    setStatus(
      "اتصال به Jellyfin انجام نشد. آدرس تونل را بررسی کنید.",
      "error"
    );
  }
}

// ------------------------------------------
// Open movie
// ------------------------------------------

function openMovie(id) {

  const item = movies.find(movie => movie.Id === id);

  if (!item) return;

  const params = new URLSearchParams({
    id: item.Id,
    name: item.Name || "",
    year: item.ProductionYear || "",
    rating: item.CommunityRating || ""
  });

  window.location.href =
    "player.html?" + params.toString();
}

// ------------------------------------------
// Search
// ------------------------------------------

const search = $("searchInput");

if (search) {

  search.addEventListener("input", event => {

    const query = event.target.value
      .trim()
      .toLowerCase();

    const filtered = query
      ? movies.filter(movie =>
          (movie.Name || "")
            .toLowerCase()
            .includes(query)
        ).slice(0, 24)

      : [...movies]
          .sort((a, b) =>
            (b.CommunityRating || 0) -
            (a.CommunityRating || 0)
          )
          .slice(0, 12);

    render("newestGrid", filtered);

  });
}

// ------------------------------------------
// Reload
// ------------------------------------------

const reload = $("reloadBtn");

if (reload) {
  reload.onclick = loadMovies;
}

// ------------------------------------------
// Start CineVerse
// ------------------------------------------

loadMovies();
