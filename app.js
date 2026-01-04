"use strict";

/* =========================================================
   CONFIG
========================================================= */

// YouTube (optional)
const YT_CHANNEL_ID = "UCuDJUj1szS87hLRjXQKnmaA";
const YT_CHANNEL_FALLBACK_URL = "https://www.youtube.com/@houseoftakuya";

// Tumblr
const TUMBLR_BLOG = "takuyakitano";
const TUMBLR_PAGE_SIZE = 10;

/* =========================================================
   DOM HOOKS
========================================================= */

const bpmEl = document.getElementById("bpm");
const clockEl = document.getElementById("clock");
const tzEl = document.getElementById("tz");
const statusEl = document.getElementById("status");
const dot = document.querySelector(".dot");

const ytGrid = document.getElementById("ytGrid");
const ytSubs = document.getElementById("ytSubs");
const ytChannelName = document.getElementById("ytChannelName");
const ytCard = document.getElementById("ytCard");

const tumblrFeed = document.getElementById("tumblrFeed");
const yearEl = document.getElementById("year");

// ====== STATUS TYPEWRITER ======
const statusElTop = document.getElementById("statusMsg");

const STATUS_ITEMS = [
  { mode: "says", text: "san q berry muchee..." },
  { mode: "is", text: "currently using the bathroom" },
  { mode: "is", text: "currently working out" },
  { mode: "is", text: "shopping for new clothes" },
  { mode: "is", text: "recording a new video" },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const rand = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

function isPunct(ch) {
  return ch === "." || ch === "!" || ch === "?" || ch === "," ||
    ch === ";" || ch === ":" || ch === "…" || ch === "-";
}
function isSpace(ch) {
  return ch === " " || ch === "\n" || ch === "\t";
}

async function runTypewriter(el, items) {
  if (!el || !items?.length) return;

  const reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    const first = items[0];
    el.textContent = first.mode === "says" ? `says: ${first.text}` : `is ${first.text}`;
    return;
  }

  // base speeds
  const typeMin = 55;
  const typeMax = 95;
  const eraseMin = 28;
  const eraseMax = 55;
  const holdMin = 2200;
  const holdMax = 3800;
  const gapMin = 450;
  const gapMax = 800;

  // "thinking" pauses
  const microPauseChance = 0.07;
  const microPauseMsMin = 90;
  const microPauseMsMax = 220;

  const commaPauseMin = 140;
  const commaPauseMax = 260;

  const punctPauseMin = 220;
  const punctPauseMax = 520;

  const spacePauseChance = 0.06;
  const spacePauseMin = 60;
  const spacePauseMax = 140;
  let i = 0;

  while (true) {
    const item = items[i % items.length];
    const full = item.mode === "says"
      ? `says: ${item.text}`
      : `is ${item.text}`;
     
    el.textContent = "";

    // type
      const ch = full[c];
      el.textContent += ch;

      let delay = rand(typeMin, typeMax);

      if (ch === ",") {
        delay += rand(commaPauseMin, commaPauseMax);
      } else if (isPunct(ch)) {
        delay += rand(punctPauseMin, punctPauseMax);
      } else if (isSpace(ch) && Math.random() < spacePauseChance) {
        delay += rand(spacePauseMin, spacePauseMax);
      } else if (Math.random() < microPauseChance) {
        delay += rand(microPauseMsMin, microPauseMsMax);
      }

      await sleep(delay);
    }

    // hold
    await sleep(rand(holdMin, holdMax));

    // erase
    for (let c = full.length; c >= 0; c--) {
      const ch = full[c - 1] || "";
      el.textContent = full.slice(0, c);

      let delay = rand(eraseMin, eraseMax);
      if (isPunct(ch)) delay += rand(40, 120);

      await sleep(delay);
    }

    await sleep(rand(gapMin, gapMax));
    i++;
  }
}

/* =========================================================
   SMALL UTILS
========================================================= */

function pad(n) {
  return String(n).padStart(2, "0");
}

function decodeXml(s) {
  return String(s || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

function sanitizeHtml(html) {
  let out = String(html || "");
  out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/\son\w+="[^"]*"/gi, "");
  out = out.replace(/\son\w+='[^']*'/gi, "");
  return out;
}

function formatDate(pubDate) {
  if (!pubDate) return "";
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getQueryParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

function stripHtml(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function deriveTitle(post) {
  const t = stripHtml(post?.title || "");
  if (t) return t;

  const bodyText = stripHtml(post?.html || post?.description || post?.body || "");
  if (!bodyText) return "post";
  return bodyText.slice(0, 60);
}

function prettyHashForPost(post) {
  const title = deriveTitle(post);
  const slug = slugify(title) || "post";
  return `#/${slug}--${post.id}`;
}

function parsePrettyHash() {
  const h = location.hash || "";
  const m = h.match(/^#\/.*--(\d+)$/);
  return m ? m[1] : null;
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function prettyHashForPost({ id, title }) {
  const slug = slugify(title) || "post";
  return `#/${slug}--${id}`;
}

function parsePrettyHash() {
  const h = location.hash || "";
  const m = h.match(/^#\/.+--(\d+)$/);
  return m ? m[1] : null;
}

function getSiteBaseUrl() {
  const { origin, pathname } = window.location;
  const basePath = pathname.endsWith("/") ? pathname : pathname.replace(/\/[^\/]*$/, "/");
  return origin + basePath;
}

/* =========================================================
   CLOCK / ONLINE / BPM
========================================================= */

function updateClock() {
  if (!clockEl) return;
  const d = new Date();
  clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  try {
    if (tzEl) tzEl.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  } catch {
    if (tzEl) tzEl.textContent = "local";
  }
}

function updateOnline() {
  const on = navigator.onLine;
  if (statusEl) statusEl.textContent = on ? "online" : "offline";

  if (!dot) return;
  dot.style.background = on ? "rgba(0,160,120,.70)" : "rgba(220,80,80,.70)";
  dot.style.boxShadow = on ? "0 0 18px rgba(0,160,120,.35)" : "0 0 18px rgba(220,80,80,.30)";
}

// ===== HEART-RHYTHM BPM MODEL =====
let bpmValue = 72;           // displayed bpm (stateful)
let bpmVel = 0;              // velocity for smoother movement (optional)
let drift = 0;               // slow wander
let lastTick = performance.now();

// schedule targets (you can tune these)
const SCHEDULE = {
  sleep:   { min: 35, max: 45 },   // 9pm–6am target band
  day:     { min: 60, max: 80 },   // 6am–8pm target band
  workout: { min:120, max:180 }    // 8pm–9pm target band
};

// helper
function randBetween(a, b){ return a + Math.random() * (b - a); }

// smoothstep for soft transitions
function smoothstep(t){
  t = Math.max(0, Math.min(1, t));
  return t*t*(3 - 2*t);
}

// returns target bpm + model params based on local time
function getDailyTargetParams(){
  const now = new Date();
  const h = now.getHours() + now.getMinutes()/60;

  // phases:
  // workout: 20–21
  // sleep: 21–6
  // day: 6–20
  const inWorkout = (h >= 20 && h < 21);
  const inSleep = (h >= 21 || h < 6);
  const inDay = (!inWorkout && !inSleep);

  // base target from band
  let band = inWorkout ? SCHEDULE.workout : (inSleep ? SCHEDULE.sleep : SCHEDULE.day);
  let target = randBetween(band.min, band.max);

  // transition windows (soft ramps)
  // 19.5–20: ramp up into workout
  // 21–21.5: ramp down after workout into sleep
  // 5.5–6: ramp up from sleep into day
  // 20–21 already handled by workout band; we shape edges:

  // ramp into workout
  if (h >= 19.5 && h < 20) {
    const t = smoothstep((h - 19.5) / 0.5); // 0..1 over 30 min
    const dayTarget = randBetween(SCHEDULE.day.min, SCHEDULE.day.max);
    const workoutTarget = randBetween(SCHEDULE.workout.min, SCHEDULE.workout.max);
    target = dayTarget + t * (workoutTarget - dayTarget);
  }

  // ramp down after workout into sleep
  if (h >= 21 && h < 21.5) {
    const t = smoothstep((h - 21) / 0.5);
    const workoutTarget = randBetween(SCHEDULE.workout.min, SCHEDULE.workout.max);
    const sleepTarget = randBetween(SCHEDULE.sleep.min, SCHEDULE.sleep.max);
    target = workoutTarget + t * (sleepTarget - workoutTarget);
  }

  // ramp up from sleep into day
  if (h >= 5.5 && h < 6) {
    const t = smoothstep((h - 5.5) / 0.5);
    const sleepTarget = randBetween(SCHEDULE.sleep.min, SCHEDULE.sleep.max);
    const dayTarget = randBetween(SCHEDULE.day.min, SCHEDULE.day.max);
    target = sleepTarget + t * (dayTarget - sleepTarget);
  }

  // smoothing + realism knobs by phase
  // "tau" = how quickly it follows target (seconds). Larger = slower.
  // "maxStep" = cap on bpm change per second (realistic ramp speed).
  let tau = 18;        // default follow speed
  let maxStep = 3.0;   // bpm/sec cap

  if (inSleep) { tau = 40; maxStep = 1.2; }
  if (inDay) { tau = 18; maxStep = 2.4; }
  if (inWorkout) { tau = 8; maxStep = 6.0; }

  return { target, tau, maxStep, inSleep, inDay, inWorkout };
}

function tickBpm(){
  if (!bpmEl) return;

  const nowT = performance.now();
  const dt = Math.min(0.2, Math.max(0.02, (nowT - lastTick) / 1000)); // seconds
  lastTick = nowT;

  // slow wander (keeps it from feeling robotic)
  drift += (Math.random() - 0.5) * 0.12;
  drift = Math.max(-6, Math.min(6, drift));

  const { target, tau, maxStep, inSleep, inDay, inWorkout } = getDailyTargetParams();

  // scroll adds a tiny real bump (optional)
  const scrollBoost = Math.min(6, window.scrollY / 180);

  // micro-noise (heartbeat variability)
  const micro = (Math.random() - 0.5) * (inWorkout ? 4.0 : inDay ? 2.0 : 1.0);

  // desired target with drift + scroll
  const desired = target + drift + scrollBoost + micro;

  // smooth following (first-order low-pass)
  const alpha = 1 - Math.exp(-dt / tau);         // follow rate based on tau
  let next = bpmValue + alpha * (desired - bpmValue);

  // cap rate of change to avoid jumps (real heart can't teleport)
  const maxDelta = maxStep * dt;
  const delta = next - bpmValue;
  if (delta > maxDelta) next = bpmValue + maxDelta;
  if (delta < -maxDelta) next = bpmValue - maxDelta;

  // optional extra smoothing using a little velocity (makes ramps feel organic)
  bpmVel = 0.85 * bpmVel + 0.15 * (next - bpmValue);
  bpmValue += bpmVel;

  // clamp to absolute believable ranges
  bpmValue = Math.max(32, Math.min(190, bpmValue));

  const shown = Math.round(bpmValue);
  bpmEl.textContent = shown;

  if (dot) {
    const pulse = 0.95 + (shown - 60) / 260;
    dot.style.transform = `scale(${pulse})`;
  }
}

/* =========================================================
   FETCH HELPERS
========================================================= */

async function fetchRaw(url) {
  // direct first
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) return await r.text();
  } catch {}

  // CORS fallback (github pages often needs this)
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const r2 = await fetch(proxied, { cache: "no-store" });
  if (!r2.ok) throw new Error("fetch failed");
  return await r2.text();
}

/* =========================================================
   LIGHTBOX (IMAGE ZOOM)
========================================================= */

function ensureLightbox() {
  let lb = document.getElementById("imgLightbox");
  if (lb) return lb;

  lb = document.createElement("div");
  lb.id = "imgLightbox";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");

  const inner = document.createElement("div");
  inner.className = "lbInner";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "lbClose";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", closeLightbox);

  const img = document.createElement("img");
  img.alt = "";

  inner.appendChild(closeBtn);
  inner.appendChild(img);
  lb.appendChild(inner);

  lb.addEventListener("click", (e) => {
    if (e.target === lb) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });

  document.body.appendChild(lb);
  return lb;
}

function openLightbox(src, alt) {
  const lb = ensureLightbox();
  const img = lb.querySelector("img");
  img.src = src;
  img.alt = alt || "";
  lb.classList.add("open");
}

function closeLightbox() {
  const lb = document.getElementById("imgLightbox");
  if (!lb) return;
  const img = lb.querySelector("img");
  if (img) img.src = "";
  lb.classList.remove("open");
}

function bindZoomableImages(container) {
  const imgs = container.querySelectorAll("img");
  imgs.forEach((im) => {
    if (im.dataset.zoomBound === "1") return;
    im.dataset.zoomBound = "1";
    im.style.cursor = "zoom-in";
    im.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const src = im.currentSrc || im.src;
      openLightbox(src, im.alt || "");
    });
  });
}

/* =========================================================
   YOUTUBE (optional)
========================================================= */

function xmlAllBetween(xml, startTag, endTag) {
  const out = [];
  let i = 0;
  while (true) {
    const s = xml.indexOf(startTag, i);
    if (s === -1) break;
    const e = xml.indexOf(endTag, s + startTag.length);
    if (e === -1) break;
    out.push(xml.slice(s + startTag.length, e).trim());
    i = e + endTag.length;
  }
  return out;
}

async function loadLatest4FromRss() {
  if (!ytGrid) return;

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`;
  const xml = await fetchRaw(feedUrl);

  const name = xmlAllBetween(xml, "<name>", "</name>")[0];
  if (name && ytChannelName) ytChannelName.textContent = decodeXml(name);

  const entries = xml.split("<entry>").slice(1).map((s) => "<entry>" + s);
  const picked = [];

  for (const entry of entries) {
    const altLink = (entry.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/) || [])[1] || "";
    if (!altLink.includes("/watch?v=")) continue;

    const id = (entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const titleRaw = (entry.match(/<title>([^<]+)<\/title>/) || [])[1];
    if (!id) continue;

    picked.push({ id, title: decodeXml(titleRaw || "YouTube video") });
    if (picked.length >= 4) break;
  }

  if (!picked.length) {
    const idsAll = xmlAllBetween(xml, "<yt:videoId>", "</yt:videoId>").slice(0, 4);
    const titlesAll = xmlAllBetween(xml, "<title>", "</title>").slice(0, 4).map(decodeXml);
    idsAll.forEach((id, i) => picked.push({ id, title: titlesAll[i] || "YouTube video" }));
  }

  if (ytCard) ytCard.href = YT_CHANNEL_FALLBACK_URL;

  ytGrid.innerHTML = "";
  picked.forEach(({ id, title }) => {
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;
    const thumbUrl = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

    const a = document.createElement("a");
    a.className = "ytItem";
    a.href = videoUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = title;
    a.setAttribute("aria-label", title);

    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = title;
    img.src = thumbUrl;

    a.appendChild(img);
    ytGrid.appendChild(a);
  });
}

function compactNumberString(s) {
  const txt = String(s || "—").trim();
  if (/[KM]$/i.test(txt)) return txt;
  const n = Number(txt.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return txt;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2).replace(/\.00$/, "")}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2).replace(/\.00$/, "")}K`;
  return String(n);
}

async function loadSubs() {
  if (!ytSubs) return;
  try {
    const url = `https://img.shields.io/youtube/channel/subscribers/${YT_CHANNEL_ID}.json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const v = data?.value || data?.message || "—";
    ytSubs.textContent = compactNumberString(v);
  } catch {}
}

/* =========================================================
   TUMBLR (JSONP API)
========================================================= */

let tumblrStart = 0;
let tumblrTotal = null;
let tumblrLoading = false;
let currentRouteId = null;

function getActivePostId() {
  const qs = new URLSearchParams(location.search);
  const postFromQuery = qs.get("post");
  const postFromHash = parsePrettyHash();
  return postFromQuery || postFromHash;
}

function applyRoute() {
  if (tumblrLoading) return;
  const activeId = getActivePostId();
  if (activeId === currentRouteId) return;
  currentRouteId = activeId;
  tumblrStart = 0;
  loadTumblrFeed().catch(() => {});
}

function tumblrJsonUrl({ start, num, id }) {
  const base = `https://${TUMBLR_BLOG}.tumblr.com/api/read/json`;
  if (id) return `${base}?id=${encodeURIComponent(id)}`;
  return `${base}?num=${encodeURIComponent(num)}&start=${encodeURIComponent(start)}`;
}

function parseTumblrJsonp(text) {
  let t = String(text || "").trim();
  t = t.replace(/^\s*var\s+tumblr_api_read\s*=\s*/i, "");
  t = t.replace(/;\s*$/, "");
  return JSON.parse(t);
}

function pickBestPhotoUrl(obj) {
  const o = obj || {};
  const urlKeys = Object.keys(o)
    .filter((k) => /^photo-url-\d+$/i.test(k))
    .sort((a, b) => Number(b.split("-").pop()) - Number(a.split("-").pop()));
  for (const k of urlKeys) {
    if (o[k]) return o[k];
  }
  return null;
}

function buildPostInnerHtml(post) {
  const type = post?.type || "";

  if (type === "regular") {
    const title = post["regular-title"] || "";
    const body = post["regular-body"] || "";
    return { title, html: sanitizeHtml(body) };
  }

  if (type === "photo") {
    const caption = post["photo-caption"] || "";
    const photos = Array.isArray(post.photos) ? post.photos : null;
    let html = "";

    if (photos && photos.length) {
      html += `<div class="tumblrPhotoGrid">`;
      for (const p of photos) {
        const src = pickBestPhotoUrl(p) || p["photo-url-500"] || p["photo-url-400"] || "";
        if (!src) continue;
        html += `<img src="${src}" alt="" loading="lazy" decoding="async" />`;
      }
      html += `</div>`;
    } else {
      const src = pickBestPhotoUrl(post);
      if (src) html += `<img src="${src}" alt="" loading="lazy" decoding="async" />`;
    }

    if (caption) html += `<div class="tumblrCaption">${sanitizeHtml(caption)}</div>`;
    return { title: "", html };
  }

  if (type === "quote") {
    const text = post["quote-text"] || "";
    const source = post["quote-source"] || "";
    let html = "";
    if (text) html += `<blockquote>${sanitizeHtml(text)}</blockquote>`;
    if (source) html += `<div class="tumblrCaption">${sanitizeHtml(source)}</div>`;
    return { title: "", html };
  }

  if (type === "link") {
    const text = post["link-text"] || post["regular-title"] || "Link";
    const url = post["link-url"] || "";
    const desc = post["link-description"] || "";
    let html = "";
    if (url) html += `<p><a href="${url}" target="_blank" rel="noreferrer">${sanitizeHtml(text)}</a></p>`;
    if (desc) html += `<div class="tumblrCaption">${sanitizeHtml(desc)}</div>`;
    return { title: "", html };
  }

  if (type === "chat") {
    const title = post["chat-title"] || "";
    const body = post["chat-body"] || "";
    return { title, html: sanitizeHtml(body) };
  }

  const fallbackTitle = post["regular-title"] || post["chat-title"] || "";
  const fallbackBody =
    post["regular-body"] ||
    post["photo-caption"] ||
    post["video-caption"] ||
    post["audio-caption"] ||
    post["answer-answer"] ||
    post["answer-question"] ||
    "";
  return { title: fallbackTitle, html: sanitizeHtml(fallbackBody) };
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function buildNativePostLink(postId) {
  const base = getSiteBaseUrl();
  const u = new URL(base);
  u.searchParams.set("post", String(postId));
  return u.toString();
}

function setDocumentTitleForSinglePost(titleText) {
  if (!getActivePostId()) return;
  const base = "KUYA";
  const t = String(titleText || "").trim();
  document.title = t ? `${t} — ${base}` : `${base} — post`;
}

function buildTumblrPostElement(p) {
  const post = document.createElement("article");
  post.className = "tumblrPost";
  post.dataset.postId = String(p?.id || "");

  const inner = buildPostInnerHtml(p);

  // HEAD
  const head = document.createElement("div");
  head.className = "tumblrHead";

  const left = document.createElement("div");
  left.className = "tumblrHeadLeft";

  if (inner.title) {
    const t = document.createElement("div");
    t.className = "tumblrPostTitle";
    t.textContent = inner.title;
    left.appendChild(t);
  }

  const right = document.createElement("div");
  right.className = "tumblrHeadRight";

  // Share inline
  if (p?.id) {
    const shareBtn = document.createElement("button");
    shareBtn.className = "tumblrShareInline";
    shareBtn.type = "button";
    shareBtn.title = "Copy link";
    shareBtn.setAttribute("aria-label", "Copy link");
    shareBtn.textContent = "share";

    shareBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const shareUrl = `${location.origin}${location.pathname}${prettyHashForPost({
        id: p.id,
        title: inner.title,
        html: inner.html,
      })}`;
      const ok = await copyToClipboard(shareUrl);
      if (ok) {
        const prev = shareBtn.textContent;
        shareBtn.textContent = "copied";
        setTimeout(() => (shareBtn.textContent = prev), 900);
      }
    });

    right.appendChild(shareBtn);
  }

  // Date (hover reveal)
  const d = document.createElement("div");
  d.className = "tumblrPostDate";
  d.textContent = formatDate(p?.date_gmt || p?.date || "");
  right.appendChild(d);

  head.appendChild(left);
  head.appendChild(right);

  // BODY
  const body = document.createElement("div");
  body.className = "tumblrBody";
  body.innerHTML = inner.html || "";
  bindZoomableImages(body);

  // SIGNOFF centered: "- takuya" (link)
  const signoff = document.createElement("div");
  signoff.className = "tumblrSignoff";

  const tumblrUrl = p?.url_with_slug || p?.url || "";
  if (tumblrUrl) {
    signoff.appendChild(document.createTextNode("- "));
    const a = document.createElement("a");
    a.href = tumblrUrl;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = "takuya";
    signoff.appendChild(a);
  }

  // Compose
  post.appendChild(head);

  const hasBody =
    (body.textContent || "").trim().length > 0 || body.querySelector("img, video, audio, iframe");
  if (hasBody) post.appendChild(body);
  if (tumblrUrl) post.appendChild(signoff);

  return post;
}

function renderTumblrPager() {
  if (!tumblrFeed) return;

  tumblrFeed.querySelectorAll(".tumblrPager").forEach((n) => n.remove());
  if (getActivePostId()) return;

  const canForward = tumblrStart > 0;
  const canBack =
    tumblrTotal == null ? true : tumblrStart + TUMBLR_PAGE_SIZE < tumblrTotal;

  // if neither exists, show nothing
  if (!canForward && !canBack) return;

  const pager = document.createElement("div");
  pager.className = "tumblrPager";

  if (canForward) {
    const forwardBtn = document.createElement("button");
    forwardBtn.type = "button";
    forwardBtn.textContent = "forward in time";
    forwardBtn.disabled = tumblrLoading;
    forwardBtn.addEventListener("click", () => {
      if (tumblrLoading) return;
      tumblrStart = Math.max(0, tumblrStart - TUMBLR_PAGE_SIZE);
      loadTumblrFeed().catch(() => {});
    });
    pager.appendChild(forwardBtn);
  } else {
    const spacerLeft = document.createElement("div");
    spacerLeft.className = "spacer";
    pager.appendChild(spacerLeft);
  }

  const midSpacer = document.createElement("div");
  midSpacer.className = "spacer";
  pager.appendChild(midSpacer);

  if (canBack) {
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.textContent = "back in time";
    backBtn.disabled = tumblrLoading;
    backBtn.addEventListener("click", () => {
      if (tumblrLoading) return;
      tumblrStart = tumblrStart + TUMBLR_PAGE_SIZE;
      loadTumblrFeed().catch(() => {});
    });
    pager.appendChild(backBtn);
  }

  tumblrFeed.appendChild(pager);
}

async function loadTumblrFeed() {
  if (!tumblrFeed) return;
  if (tumblrLoading) return;

  tumblrLoading = true;
const activePostId = getActivePostId();

  const topAnchor = tumblrFeed.getBoundingClientRect().top + window.scrollY;

  try {
    tumblrFeed.textContent = "Loading…";

    const url = tumblrJsonUrl({
      start: tumblrStart,
      num: TUMBLR_PAGE_SIZE,
      id: activePostId || null,
    });

    const raw = await fetchRaw(url);
    const data = parseTumblrJsonp(raw);

    tumblrTotal = Number.isFinite(Number(data?.posts_total))
      ? Number(data.posts_total)
      : tumblrTotal;

    const posts = Array.isArray(data?.posts) ? data.posts : [];

    tumblrFeed.innerHTML = "";

    if (!posts.length) {
      tumblrFeed.textContent = "No posts yet.";
      return;
    }

    if (activePostId) {
      const p = posts[0];
      const el = buildTumblrPostElement(p);
      tumblrFeed.appendChild(el);

      const inner = buildPostInnerHtml(p);
      setDocumentTitleForSinglePost(inner.title || "");

      window.scrollTo({ top: Math.max(0, topAnchor - 24), behavior: "instant" });
      return;
    }

    posts.forEach((p) => tumblrFeed.appendChild(buildTumblrPostElement(p)));
    renderTumblrPager();

    const newTop = tumblrFeed.getBoundingClientRect().top + window.scrollY;
    const delta = newTop - topAnchor;
    window.scrollTo({ top: window.scrollY + delta, behavior: "instant" });
  } catch (e) {
    tumblrFeed.textContent = "Unable to load Tumblr feed.";
  } finally {
    tumblrLoading = false;
    renderTumblrPager();
    applyRoute();
  }
}

/* =========================================================
   INIT
========================================================= */

if (yearEl) yearEl.textContent = new Date().getFullYear();

updateClock();
updateOnline();
tickBpm();

setInterval(updateClock, 1000 * 10);
setInterval(tickBpm, 850);

window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);
window.addEventListener("scroll", () => tickBpm());
window.addEventListener("hashchange", applyRoute);
window.addEventListener("popstate", applyRoute);

loadLatest4FromRss().catch(() => {});
loadSubs().catch(() => {});
loadTumblrFeed().catch(() => {});

runTypewriter(statusElTop, STATUS_ITEMS);
