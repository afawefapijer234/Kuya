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

let baseBpm = 72;
let drift = 0;

function tickBpm() {
  if (!bpmEl) return;

  drift += (Math.random() - 0.5) * 0.6;
  drift = Math.max(-10, Math.min(14, drift));

  const noise = (Math.random() - 0.5) * 2.4;
  const scroll = Math.min(8, window.scrollY / 120);

  let bpm = Math.round(baseBpm + drift + noise + scroll);
  bpm = Math.max(58, Math.min(132, bpm));

  bpmEl.textContent = bpm;

  if (dot) {
    const pulse = 0.95 + (bpm - 60) / 260;
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

const SINGLE_POST_ID = getQueryParam("post");

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
  if (!SINGLE_POST_ID) return;
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
      const link = buildNativePostLink(p.id);
      const ok = await copyToClipboard(link);
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
  if (SINGLE_POST_ID) return;

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

  const topAnchor = tumblrFeed.getBoundingClientRect().top + window.scrollY;

  try {
    tumblrFeed.textContent = "Loading…";

    const url = tumblrJsonUrl({
      start: tumblrStart,
      num: TUMBLR_PAGE_SIZE,
      id: SINGLE_POST_ID || null,
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

    if (SINGLE_POST_ID) {
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

loadLatest4FromRss().catch(() => {});
loadSubs().catch(() => {});
loadTumblrFeed().catch(() => {});
