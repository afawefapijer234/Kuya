// ====== CONFIG ======
const TUMBLR_BLOG = "takuyakitano.tumblr.com";
const TUMBLR_PAGE_SIZE = 10;

// NOTE: Tumblr returns JSONP-ish JS like:  var tumblr_api_read = {...};
// We fetch as text and parse the object out.

const TUMBLR_API_URL = (start = 0, num = TUMBLR_PAGE_SIZE) =>
  `https://${TUMBLR_BLOG}/api/read/json?num=${num}&start=${start}`;

// ====== HUD (optional; safe if elements don't exist) ======
const bpmEl = document.getElementById("bpm");
const clockEl = document.getElementById("clock");
const tzEl = document.getElementById("tz");
const statusEl = document.getElementById("status");
const dot = document.querySelector(".dot");

function pad(n){ return String(n).padStart(2, "0"); }

function updateClock(){
  if(!clockEl) return;
  const d = new Date();
  clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  try{
    if(tzEl) tzEl.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  }catch{
    if(tzEl) tzEl.textContent = "local";
  }
}

let base = 72, drift = 0, bpm = base;

function tickBpm(){
  if(!bpmEl) return;

  drift += (Math.random() - 0.5) * 0.6;
  drift = Math.max(-10, Math.min(14, drift));

  const noise = (Math.random() - 0.5) * 2.4;
  const scroll = Math.min(8, (window.scrollY / 120));

  bpm = Math.round(base + drift + noise + scroll);
  bpm = Math.max(58, Math.min(132, bpm));

  bpmEl.textContent = bpm;

  if(dot){
    const pulse = 0.95 + (bpm - 60) / 260;
    dot.style.transform = `scale(${pulse})`;
  }
}

function updateOnline(){
  const on = navigator.onLine;
  if(statusEl) statusEl.textContent = on ? "online" : "offline";
  if(!dot) return;
  dot.style.background = on ? "rgba(0,160,120,.70)" : "rgba(220,80,80,.70)";
  dot.style.boxShadow = on ? "0 0 18px rgba(0,160,120,.35)" : "0 0 18px rgba(220,80,80,.30)";
}

// ====== FETCH HELPERS ======
async function fetchRaw(url){
  // Try direct fetch first; then proxy.
  try{
    const r = await fetch(url, { cache: "no-store" });
    if(r.ok) return await r.text();
  }catch{}

  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const r2 = await fetch(proxied, { cache: "no-store" });
  if(!r2.ok) throw new Error("fetch failed");
  return await r2.text();
}

function parseTumblrApiRead(raw){
  // raw looks like: "var tumblr_api_read = {...};"
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if(firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Could not parse Tumblr response");
  }
  const jsonLike = raw.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonLike);
}

function safeHtmlString(s){
  // Tumblr gives HTML bodies; keep as-is.
  return String(s || "");
}

function formatDate(dateString){
  // dateString like: "2026-01-03 12:34:56 GMT"
  const d = new Date(dateString);
  if(Number.isNaN(d.getTime())) return "";
  // keep it subtle; your CSS will hide unless hover
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ====== TUMBLR FEED ======
const tumblrFeed = document.getElementById("tumblrFeed");

// Optional: if you have a wrapper; if not, we'll make pager above the feed
let tumblrPager = document.getElementById("tumblrPager");

let tumblrStart = 0;
let tumblrTotal = null;
let tumblrLoading = false;

function ensureTumblrPager(){
  if(!tumblrFeed) return;

  if(!tumblrPager){
    tumblrPager = document.createElement("div");
    tumblrPager.id = "tumblrPager";
    tumblrPager.className = "tumblrPager";
    tumblrFeed.parentElement?.insertBefore(tumblrPager, tumblrFeed);
  }

  tumblrPager.innerHTML = "";

  const left = document.createElement("button");
  left.type = "button";
  left.className = "tumblrNav";
  left.id = "tumblrBack";
  left.textContent = "Back in time";
  left.disabled = tumblrStart <= 0 || tumblrLoading;

  const right = document.createElement("button");
  right.type = "button";
  right.className = "tumblrNav";
  right.id = "tumblrForward";
  right.textContent = "Forward in time";
  right.disabled = tumblrLoading || (tumblrTotal != null && tumblrStart + TUMBLR_PAGE_SIZE >= tumblrTotal);

  const meta = document.createElement("div");
  meta.className = "tumblrPagerMeta";
  const shownFrom = tumblrTotal == null ? tumblrStart + 1 : Math.min(tumblrStart + 1, tumblrTotal);
  const shownTo = tumblrTotal == null ? tumblrStart + TUMBLR_PAGE_SIZE : Math.min(tumblrStart + TUMBLR_PAGE_SIZE, tumblrTotal);
  meta.textContent = tumblrTotal == null ? `Showing ${shownFrom}–${shownTo}` : `Showing ${shownFrom}–${shownTo} of ${tumblrTotal}`;

  left.addEventListener("click", async () => {
    if(tumblrStart <= 0) return;
    tumblrStart = Math.max(0, tumblrStart - TUMBLR_PAGE_SIZE);
    await loadTumblrPage({ scrollTop: true });
  });

  right.addEventListener("click", async () => {
    tumblrStart = tumblrStart + TUMBLR_PAGE_SIZE;
    await loadTumblrPage({ scrollTop: true });
  });

  tumblrPager.append(left, meta, right);
}

function getPostBodyHtml(post){
  // Tumblr’s api/read/json fields vary by type
  // Text posts often: "regular-body" or "body"
  // Photo posts often: "photo-caption" (HTML)
  if(post["regular-body"]) return safeHtmlString(post["regular-body"]);
  if(post["body"]) return safeHtmlString(post["body"]);
  if(post["photo-caption"]) return safeHtmlString(post["photo-caption"]);
  if(post["caption"]) return safeHtmlString(post["caption"]);
  if(post["quote-text"]) return `<blockquote>${safeHtmlString(post["quote-text"])}</blockquote>`;
  if(post["link-description"]) return safeHtmlString(post["link-description"]);
  return "";
}

function getPostTitleHtml(post){
  // Many types carry "regular-title" or "title"
  const t = post["regular-title"] || post["title"] || "";
  if(!t) return "";
  // Titles are plain text in this endpoint; keep simple
  return `<strong>${String(t)}</strong>`;
}

function getPhotoUrls(post){
  // api/read/json photo posts can include:
  // - "photo-url-1280", "photo-url-500" etc (single photo)
  // - "photos" array (multiple), each may have "photo-url-1280" etc
  const urls = [];

  if(post.type === "photo"){
    // Multiple photos
    if(Array.isArray(post.photos)){
      for(const ph of post.photos){
        const u =
          ph["photo-url-1280"] ||
          ph["photo-url-500"] ||
          ph["photo-url-400"] ||
          ph["photo-url-250"] ||
          ph["photo-url-100"];
        if(u) urls.push(String(u));
      }
    }
    // Single photo fallback
    const single =
      post["photo-url-1280"] ||
      post["photo-url-500"] ||
      post["photo-url-400"] ||
      post["photo-url-250"] ||
      post["photo-url-100"];
    if(single && !urls.length) urls.push(String(single));
  }

  return urls;
}

function buildPostEl(post){
  const postUrl = post.url || post["url-with-slug"] || `https://${TUMBLR_BLOG}`;

  const wrap = document.createElement("article");
  wrap.className = "tumblrPost";
  wrap.dataset.postUrl = postUrl;

  // header (no link)
  const header = document.createElement("div");
  header.className = "tumblrPostHeader";

  const title = document.createElement("div");
  title.className = "tumblrPostTitle";
  const titleHtml = getPostTitleHtml(post);
  title.innerHTML = titleHtml || "";

  const date = document.createElement("div");
  date.className = "tumblrPostDate";
  date.textContent = formatDate(post.date);
  // (CSS handles hide-on-idle, show-on-hover)

  header.append(title, date);

  // body
  const body = document.createElement("div");
  body.className = "tumblrPostBody";

  const bodyHtml = getPostBodyHtml(post);
  body.innerHTML = bodyHtml || "";

  // photos (click-to-zoom)
  const photos = getPhotoUrls(post);
  let media = null;
  if(photos.length){
    media = document.createElement("div");
    media.className = "tumblrPostMedia";
    for(const url of photos){
      const img = document.createElement("img");
      img.className = "tumblrImg";
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = post["regular-title"] || post["title"] || "Tumblr image";
      img.src = url;
      img.addEventListener("click", () => openImageModal(url));
      media.appendChild(img);
    }
  }

  // footer action: minimal symbol instead of big button
  const footer = document.createElement("div");
  footer.className = "tumblrPostFooter";

  const open = document.createElement("a");
  open.className = "tumblrOpen";
  open.href = postUrl;
  open.target = "_blank";
  open.rel = "noreferrer";
  // this is the minimal “#” vibe you referenced — it’s just a character, not a Tumblr thing
  open.textContent = "#";
  open.title = "Open on Tumblr";
  open.setAttribute("aria-label", "Open on Tumblr");

  footer.appendChild(open);

  wrap.append(header, body);
  if(media) wrap.appendChild(media);
  wrap.appendChild(footer);

  return wrap;
}

async function loadTumblrPage({ scrollTop = false } = {}){
  if(!tumblrFeed || tumblrLoading) return;
  tumblrLoading = true;
  ensureTumblrPager();

  try{
    tumblrFeed.setAttribute("aria-busy", "true");
    tumblrFeed.textContent = "Loading…";

    const raw = await fetchRaw(TUMBLR_API_URL(tumblrStart, TUMBLR_PAGE_SIZE));
    const data = parseTumblrApiRead(raw);

    tumblrTotal = typeof data?.posts_total === "number" ? data.posts_total : null;
    const posts = Array.isArray(data?.posts) ? data.posts : [];

    tumblrFeed.innerHTML = "";

    if(!posts.length){
      tumblrFeed.textContent = "No posts yet.";
    }else{
      for(const post of posts){
        tumblrFeed.appendChild(buildPostEl(post));
      }
    }

    if(scrollTop){
      tumblrFeed.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }catch(err){
    tumblrFeed.textContent = "Unable to load Tumblr feed.";
    // console.log(err);
  }finally{
    tumblrFeed.removeAttribute("aria-busy");
    tumblrLoading = false;
    ensureTumblrPager();
  }
}

// ====== IMAGE MODAL (click-to-zoom) ======
let modalEl = null;
let modalImg = null;

function ensureImageModal(){
  if(modalEl) return;

  modalEl = document.createElement("div");
  modalEl.className = "imgModal";
  modalEl.setAttribute("aria-hidden", "true");

  const scrim = document.createElement("div");
  scrim.className = "imgModalScrim";

  const inner = document.createElement("div");
  inner.className = "imgModalInner";

  modalImg = document.createElement("img");
  modalImg.className = "imgModalImg";
  modalImg.alt = "";

  inner.appendChild(modalImg);
  modalEl.append(scrim, inner);
  document.body.appendChild(modalEl);

  const close = () => closeImageModal();

  scrim.addEventListener("click", close);
  modalEl.addEventListener("click", (e) => {
    // clicking the image itself shouldn't close; only outside / scrim
    if(e.target === modalEl) close();
  });

  window.addEventListener("keydown", (e) => {
    if(e.key === "Escape") close();
  });
}

function openImageModal(src){
  ensureImageModal();
  if(!modalEl || !modalImg) return;

  modalImg.src = src;
  modalEl.classList.add("open");
  modalEl.setAttribute("aria-hidden", "false");

  // lock scroll
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

function closeImageModal(){
  if(!modalEl) return;
  modalEl.classList.remove("open");
  modalEl.setAttribute("aria-hidden", "true");
  if(modalImg) modalImg.src = "";

  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

// ====== INIT ======
const yearEl = document.getElementById("year");
if(yearEl) yearEl.textContent = new Date().getFullYear();

updateClock();
updateOnline();
tickBpm();

setInterval(updateClock, 1000 * 10);
setInterval(tickBpm, 850);

window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);
window.addEventListener("scroll", () => tickBpm());

// Tumblr loads
loadTumblrPage().catch(() => {});
