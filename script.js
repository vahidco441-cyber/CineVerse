```javascript
// CineVerse V8 - GitHub + Jellyfin
// GitHub test video + Jellyfin library

const $ = (id) => document.getElementById(id);

let movies = [];
let currentHero = null;

const GITHUB_VIDEO =
"https://raw.githubusercontent.com/vahidco441-cyber/CineVerse/main/videos/_WqVViW3eCuSla7E.mp4";

const githubMovie = {
  Id: "github-test-video",
  Name: "فیلم آزمایشی",
  ProductionYear: "2026",
  CommunityRating: null,
  Overview: "فیلم آزمایشی CineVerse از GitHub",
  IsGitHub: true,
  VideoUrl: GITHUB_VIDEO
};

function jellyfin(path) {
  const clean = path.startsWith("/") ? path : "/" + path;
  const base = window.CINEVERSE_CONFIG?.proxyBase || "/jellyfin";
  return base + clean;
}

function imageUrl(item) {
  if (!item || !item.Id || item.IsGitHub) return "";
  return jellyfin(
    `/Items/${encodeURIComponent(item.Id)}/Images/Primary?fillWidth=500&quality=90`
  );
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m]));
}

function card(item) {
  const rating = item.CommunityRating
    ? Number(item.CommunityRating).toFixed(1)
    : "—";

  const year = item.ProductionYear || "—";
  const bg = imageUrl(item);

  const posterStyle = bg
    ? `background-image:url('${bg}')`
    : "background:linear-gradient(145deg,#252525,#090909)";

  return `
    <article class="movie-card"
      data-id="${esc(item.Id)}"
      data-github="${item.IsGitHub ? "true" : "false"}">

      <div class="poster" style="${posterStyle}">
        <div class="rating">★ ${rating}</div>
      </div>

      <div class="card-info">
        <div class="card-title">${esc(item.Name)}</div>
        <div class="card-meta">${esc(year)}</div>
      </div>

    </article>
  `;
}

function render(id, list) {
  const el = $(id);
  if (!el) return;

  el.innerHTML = list.length
    ? list.map(card).join("")
    : `<div class="empty">فیلمی برای نمایش پیدا نشد.</div>`;

  el.querySelectorAll(".movie-card").forEach(c => {
    c.onclick = () => {
      openMovie(c.dataset.id, c.dataset.github === "true");
    };
  });
}

function setStatus(text, type = "") {
  const el = $("status");
  if (!el) return;

  el.textContent = text;
  el.className = "status " + type;
}

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
      throw new Error("Jellyfin HTTP " + response.status);
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

  setStatus("در حال دریافت فیلم‌ها...");

  let jellyfinMovies = [];

  try {
    jellyfinMovies = await loadAllMovies();
  } catch (e) {
    console.error("Jellyfin:", e);
  }

  // Combine Jellyfin movies and GitHub test movie
  movies = [...jellyfinMovies, githubMovie];

  const popular = [...movies]
    .sort((a, b) =>
      (b.CommunityRating || 0) - (a.CommunityRating || 0)
    )
    .slice(0, 12);

  render("popularGrid", popular);

  if (jellyfinMovies.length > 0) {
    setHero(popular[0]);

    setStatus(
      `اتصال موفق است — ${jellyfinMovies.length} فیلم Jellyfin و ۱ فیلم GitHub`,
      "ok"
    );
  } else {
    setHero(githubMovie);

    setStatus(
      "فیلم آزمایشی GitHub آماده نمایش است.",
      "ok"
    );
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
        item.CommunityRating
          ? Number(item.CommunityRating).toFixed(1)
          : "—"
      }`;
  }

  if (overview) {
    overview.textContent = item.Overview || "";
  }

  const bg = imageUrl(item);

  if (hero && bg) {
    hero.style.backgroundImage =
      `linear-gradient(90deg,#050505 8%,rgba(5,5,5,.76) 42%,rgba(5,5,5,.25) 100%),url("${bg}")`;
  }
}

function openMovie(id, isGitHub = false) {
  const item = movies.find(x => x.Id === id);
  if (!item) return;

  currentHero = item;
  setHero(item);

  if (isGitHub || item.IsGitHub) {
    const params = new URLSearchParams({
      video: item.VideoUrl,
      name: item.Name,
      year: item.ProductionYear
    });

    window.location.href = "player.html?" + params.toString();
    return;
  }

  window.location.href =
    `player.html?id=${encodeURIComponent(item.Id)}`;
}

const reload = $("reloadBtn");
if (reload) reload.onclick = loadMovies;

const search = $("searchInput");

if (search) {
  search.addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();

    const filtered = q
      ? movies.filter(x =>
          (x.Name || "").toLowerCase().includes(q)
        ).slice(0, 24)
      : [...movies]
          .sort((a, b) =>
            (b.CommunityRating || 0) - (a.CommunityRating || 0)
          )
          .slice(0, 12);

    render("popularGrid", filtered);
  });
}

loadMovies();
```
