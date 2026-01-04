// app.js — FULL (Tumblr JSON API + pagination + lightbox zoom + hover date)
// Replace your entire app.js with this.

"use strict";

// ====== CONFIG ======
const YT_CHANNEL_ID = "UCuDJUj1szS87hLRjXQKnmaA";
const YT_CHANNEL_FALLBACK_URL = "https://www.youtube.com/@houseoftakuya";

// Tumblr blog name (no @, no URL)
const TUMBLR_BLOG = "takuyakitano";

// Tiny “open original” symbol (pick one: "#", "↗", "⌁", "⎋", "·", "⊹")
const POST_LINK_SYMBOL = "⌁";

// Pagination
const TUMBLR_PAGE_SIZE = 10; // how many posts per page

// If true, uses Tumblr JSON API (updates faster + better image data than RSS)
const TUMBLR_USE_JSON_API = true;

// ====== HUD ======
const bpmEl = document.getElementById("bpm");
const clockEl = document.getElementById("clock");
const tzEl = document.getElementById("tz");
const statusEl = document.getElementById("status");
const dot = document.querySelector(".dot");

// YouTube UI (Bento-style 2x2 grid)
const ytGrid = document.getElementById("ytGrid");
const ytSubs = document.getElementById("ytSubs");
const ytChannelName = document.getElementById("ytChannelName");
const ytCard = document.getElementById("ytCard");

// Tumblr UI
const tumblrFeed = document.getElementById("tumblrFeed");

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

// BPM behavior
let base = 72;
let drift = 0;
let bpm = base;

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

// ====== SHARED HELPERS ======
function decodeXml(s){
  return String(s || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

async function fetchRaw(url){
  // Try direct first
  try{
    const r = await fetch(url, { cache: "no-store" });
    if(r.ok) return await r.text();
  }catch{}

  // Proxy fallback (GitHub Pages + most static hosts need this for CORS)
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const r2 = await fetch(proxied, { cache: "no-store" });
  if(!r2.ok) throw new Error("fetch failed");
  return await r2.text();
}

// basic safety: strip script tags + inline event handlers
function sanitizeHtml(html){
  let out = String(html || "");
  out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/\son\w+="[^"]*"/gi, "");
  out = out.replace(/\son\w+='[^']*'/gi, "");
  return out;
}

function formatDate(pubDate){
  if(!pubDate) return "";
  const d = new Date(pubDate);
  if(Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ====== LIGHTBOX (IMAGE ZOOM) ======
function ensureLightbox(){
  let lb = document.getElementById("imgLightbox");
  if(lb) return lb;

  const style = document.createElement("style");
  style.textContent = `
    #imgLightbox{
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      background: rgba(0,0,0,.72);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      padding: 24px;
    }
    #imgLightbox.open{ display: flex; }
    #imgLightbox .lbInner{
      max-width: min(1200px, 96vw);
      max-height: 92vh;
      width: fit-content;
      height: fit-content;
      display: grid;
      gap: 10px;
      justify-items: end;
    }
    #imgLightbox img{
      max-width: min(1200px, 96vw);
      max-height: 88vh;
      border-radius: 14px;
      box-shadow: 0 20px 60px rgba(0,0,0,.35);
      background: rgba(255,255,255,.04);
    }
    #imgLightbox button{
      border: 0;
      border-radius: 999px;
      padding: 8px 12px;
      cursor: pointer;
      background: rgba(255,255,255,.14);
      color: rgba(255,255,255,.92);
      font: inherit;
    }
    #imgLightbox button:hover{ background: rgba(255,255,255,.20); }
  `;
  document.head.appendChild(style);

  lb = document.createElement("div");
  lb.id = "imgLightbox";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");

  const inner = document.createElement("div");
  inner.className = "lbInner";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => closeLightbox());

  const img = document.createElement("img");
  img.alt = "";

  inner.appendChild(closeBtn);
  inner.appendChild(img);
  lb.appendChild(inner);

  lb.addEventListener("click", (e) => {
    if(e.target === lb) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeLightbox();
  });

  document.body.appendChild(lb);
  return lb;
}

function openLightbox(src, alt){
  const lb = ensureLightbox();
  const img = lb.querySelector("img");
  img.src = src;
  img.alt = alt || "";
  lb.classList.add("open");
}

function closeLightbox(){
  const lb = document.getElementById("imgLightbox");
  if(!lb) return;
  const img = lb.querySelector("img");
  if(img) img.src = "";
  lb.classList.remove("open");
}

function bindZoomableImages(container){
  const imgs = container.querySelectorAll("img");
  imgs.forEach((im) => {
    if(im.dataset.zoomBound === "1") return;
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

// ====== YOUTUBE: latest 4 via RSS (no API key), skip Shorts cheaply ======
function xmlAllBetween(xml, startTag, endTag){
  const out = [];
  let i = 0;
  while(true){
    const s = xml.indexOf(startTag, i);
    if(s === -1) break;
    const e = xml.indexOf(endTag, s + startTag.length);
    if(e === -1) break;
    out.push(xml.slice(s + startTag.length, e).trim());
    i = e + endTag.length;
  }
  return out;
}

async function loadLatest4FromRss(){
  if(!ytGrid) return;

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`;
  const xml = await fetchRaw(feedUrl);

  const name = xmlAllBetween(xml, "<name>", "</name>")[0];
  if(name && ytChannelName) ytChannelName.textContent = decodeXml(name);

  const entries = xml.split("<entry>").slice(1).map(s => "<entry>" + s);

  const picked = [];
  for(const entry of entries){
    const altLink = (entry.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/) || [])[1] || "";
    if(!altLink.includes("/watch?v=")) continue;

    const id = (entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const titleRaw = (entry.match(/<title>([^<]+)<\/title>/) || [])[1];
    if(!id) continue;

    picked.push({ id, title: decodeXml(titleRaw || "YouTube video") });
    if(picked.length >= 4) break;
  }

  if(!picked.length){
    const idsAll = xmlAllBetween(xml, "<yt:videoId>", "</yt:videoId>").slice(0, 4);
    const titlesAll = xmlAllBetween(xml, "<title>", "</title>").slice(0, 4).map(decodeXml);
    idsAll.forEach((id, i) => picked.push({ id, title: titlesAll[i] || "YouTube video" }));
  }

  if(ytCard) ytCard.href = YT_CHANNEL_FALLBACK_URL;

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

// ====== SUBSCRIBERS (no API key) via Shields JSON ======
function compactNumberString(s){
  const txt = String(s || "—").trim();
  if(/[KM]$/i.test(txt)) return txt;
  const n = Number(txt.replace(/[^\d.]/g, ""));
  if(!Number.isFinite(n)) return txt;
  if(n >= 1e6) return `${(n/1e6).toFixed(2).replace(/\.00$/,"")}M`;
  if(n >= 1e3) return `${(n/1e3).toFixed(2).replace(/\.00$/,"")}K`;
  return String(n);
}

async function loadSubs(){
  if(!ytSubs) return;
  try{
    const url = `https://img.shields.io/youtube/channel/subscribers/${YT_CHANNEL_ID}.json`;
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) return;
    const data = await res.json();
    const v = data?.value || data?.message || "—";
    ytSubs.textContent = compactNumberString(v);
  }catch{}
}

// ====== TUMBLR FEED (JSON API + FULL CONTENT + FORMATTING + IMAGE ZOOM + BOTTOM PAGER) ======
let tumblrStart = 0;
let tumblrTotal = null; // filled after first load
let tumblrLoading = false;

function tumblrJsonUrl({ start, num }){
  // JSONP endpoint (fastest + contains photo URLs). We parse the JS.
  return `https://${TUMBLR_BLOG}.tumblr.com/api/read/json?num=${encodeURIComponent(num)}&start=${encodeURIComponent(start)}`;
}

function parseTumblrJsonp(text){
  // Typical: "var tumblr_api_read = {...};"
  let t = String(text || "").trim();

  // Strip leading "var tumblr_api_read ="
  t = t.replace(/^\s*var\s+tumblr_api_read\s*=\s*/i, "");

  // Strip trailing ";" (and sometimes trailing whitespace)
  t = t.replace(/;\s*$/,"");

  // Sometimes there are extra JS comments; this keeps it simple.
  // At this point it should be valid JSON.
  return JSON.parse(t);
}

function pickBestPhotoUrl(post){
  // Old API gives multiple sizes: photo-url-1280, photo-url-500, etc.
  const keys = Object.keys(post || {});
  const urlKeys = keys
    .filter(k => /^photo-url-\d+$/i.test(k))
    .sort((a,b) => Number(b.split("-").pop()) - Number(a.split("-").pop()));
  for(const k of urlKeys){
    if(post[k]) return post[k];
  }
  return null;
}

function buildPostInnerHtml(post){
  const type = post?.type || "";

  // Text
  if(type === "regular"){
    const title = post["regular-title"] || "";
    const body = post["regular-body"] || "";
    return {
      title,
      html: sanitizeHtml(body)
    };
  }

  // Photo
  if(type === "photo"){
    const caption = post["photo-caption"] || "";
    // photos array exists for multi-photo
    const photos = Array.isArray(post.photos) ? post.photos : null;

    let html = "";

    if(photos && photos.length){
      // Photos often have photo-url-1280 inside each photo object
      html += `<div class="tumblrPhotoGrid">`;
      for(const p of photos){
        const src = pickBestPhotoUrl(p) || p["photo-url-500"] || p["photo-url-400"] || "";
        if(!src) continue;
        html += `<img src="${src}" alt="" loading="lazy" decoding="async" />`;
      }
      html += `</div>`;
    }else{
      const src = pickBestPhotoUrl(post);
      if(src){
        html += `<img src="${src}" alt="" loading="lazy" decoding="async" />`;
      }
    }

    if(caption){
      html += `<div class="tumblrCaption">${sanitizeHtml(caption)}</div>`;
    }

    return {
      title: "",
      html
    };
  }

  // Quote
  if(type === "quote"){
    const text = post["quote-text"] || "";
    const source = post["quote-source"] || "";
    let html = "";
    if(text) html += `<blockquote>${sanitizeHtml(text)}</blockquote>`;
    if(source) html += `<div class="tumblrCaption">${sanitizeHtml(source)}</div>`;
    return { title: "", html };
  }

  // Link
  if(type === "link"){
    const text = post["link-text"] || post["regular-title"] || "Link";
    const url = post["link-url"] || "";
    const desc = post["link-description"] || "";
    let html = "";
    if(url){
      html += `<p><a href="${url}" target="_blank" rel="noreferrer">${sanitizeHtml(text)}</a></p>`;
    }
    if(desc) html += `<div class="tumblrCaption">${sanitizeHtml(desc)}</div>`;
    return { title: "", html };
  }

  // Chat
  if(type === "chat"){
    const title = post["chat-title"] || "";
    const body = post["chat-body"] || "";
    return { title, html: sanitizeHtml(body) };
  }

  // Audio / Video / Answer fallback (just show caption/body if any)
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

function injectTumblrUiStylesIfMissing(){
  if(document.getElementById("tumblrUiStyles")) return;

  const style = document.createElement("style");
  style.id = "tumblrUiStyles";
  style.textContent = `
    .tumblrPost{
      padding: 18px 0;
      border-top: 1px solid rgba(0,0,0,.08);
    }
    .tumblrPost:first-child{ border-top: 0; }

    .tumblrHead{
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }
    .tumblrHeadLeft{
      display: flex;
      align-items: baseline;
      gap: 14px;
      flex-wrap: wrap;
      min-width: 0;
    }
    .tumblrPostTitle{
      font-weight: 600;
      letter-spacing: .01em;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    /* date hidden unless hover on the post */
    .tumblrPostDate{
      opacity: 0;
      font-size: .95em;
      white-space: nowrap;
      transition: opacity .18s ease;
    }
    .tumblrPost:hover .tumblrPostDate{ opacity: .55; }

    /* tiny open symbol button */
    .tumblrOpen{
      text-decoration: none;
      opacity: .55;
      font-weight: 600;
      border: 1px solid rgba(0,0,0,.14);
      border-radius: 999px;
      padding: 4px 10px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      flex: 0 0 auto;
    }
    .tumblrOpen:hover{ opacity: .9; }

    .tumblrBody{
      line-height: 1.55;
    }
    .tumblrBody p{ margin: 0 0 10px; }
    .tumblrBody a{ text-decoration: underline; }
    .tumblrBody img{
      max-width: 100%;
      height: auto;
      border-radius: 14px;
      display: block;
      margin: 12px 0;
    }
    .tumblrBody blockquote{
      margin: 10px 0;
      padding: 0 0 0 14px;
      border-left: 2px solid rgba(0,0,0,.18);
      opacity: .95;
    }
    .tumblrCaption{
      opacity: .92;
    }

    /* multi-photo layout */
    .tumblrPhotoGrid{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    @media (max-width: 640px){
      .tumblrPhotoGrid{ grid-template-columns: 1fr; }
    }

    /* bottom pager like “back in time / forward in time” */
    .tumblrPager{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 0 4px;
      border-top: 1px solid rgba(0,0,0,.08);
      margin-top: 8px;
    }
    .tumblrPager .spacer{ flex: 1; }
    .tumblrPager button{
      border: 1px solid rgba(0,0,0,.14);
      background: transparent;
      border-radius: 999px;
      padding: 8px 12px;
      cursor: pointer;
      font: inherit;
      opacity: .75;
    }
    .tumblrPager button:hover{ opacity: 1; }
    .tumblrPager button:disabled{
      opacity: .35;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);
}

function renderTumblrPager(){
  if(!tumblrFeed) return;

  // remove existing pager
  tumblrFeed.querySelectorAll(".tumblrPager").forEach(n => n.remove());

  // Only show pager if we know there are more posts in either direction
  const canForward = tumblrStart > 0;
  const canBack = (tumblrTotal == null)
    ? true // unknown total; allow “back in time” unless API says otherwise later
    : (tumblrStart + TUMBLR_PAGE_SIZE) < tumblrTotal;

  // If neither direction exists, show nothing
  if(!canForward && !canBack) return;

  const pager = document.createElement("div");
  pager.className = "tumblrPager";

  const forwardBtn = document.createElement("button");
  forwardBtn.type = "button";
  forwardBtn.textContent = "forward in time";
  forwardBtn.disabled = !canForward || tumblrLoading;
  forwardBtn.addEventListener("click", () => {
    if(tumblrLoading) return;
    tumblrStart = Math.max(0, tumblrStart - TUMBLR_PAGE_SIZE);
    loadTumblrFeed().catch(() => {});
  });

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.textContent = "back in time";
  backBtn.disabled = !canBack || tumblrLoading;
  backBtn.addEventListener("click", () => {
    if(tumblrLoading) return;
    tumblrStart = tumblrStart + TUMBLR_PAGE_SIZE;
    loadTumblrFeed().catch(() => {});
  });

  const spacer = document.createElement("div");
  spacer.className = "spacer";

  // Layout: forward (newer) left, back (older) right
  pager.appendChild(forwardBtn);
  pager.appendChild(spacer);
  pager.appendChild(backBtn);

  tumblrFeed.appendChild(pager);
}

async function loadTumblrFeed(){
  if(!tumblrFeed) return;

  injectTumblrUiStylesIfMissing();

  if(tumblrLoading) return;
  tumblrLoading = true;

  // Keep scroll position stable-ish on pagination
  const topAnchor = tumblrFeed.getBoundingClientRect().top + window.scrollY;

  try{
    tumblrFeed.textContent = "Loading…";

    const url = tumblrJsonUrl({ start: tumblrStart, num: TUMBLR_PAGE_SIZE });
    const raw = await fetchRaw(url);
    const data = parseTumblrJsonp(raw);

    tumblrTotal = Number.isFinite(Number(data?.posts_total)) ? Number(data.posts_total) : tumblrTotal;

    const posts = Array.isArray(data?.posts) ? data.posts : [];
    tumblrFeed.innerHTML = "";

    if(!posts.length){
      tumblrFeed.textContent = "No posts yet.";
      tumblrLoading = false;
      return;
    }

    posts.forEach((p) => {
      const post = document.createElement("article");
      post.className = "tumblrPost";

      const head = document.createElement("div");
      head.className = "tumblrHead";

      const left = document.createElement("div");
      left.className = "tumblrHeadLeft";

      const d = document.createElement("div");
      d.className = "tumblrPostDate";
      d.textContent = formatDate(p?.date_gmt || p?.date || "");

      const inner = buildPostInnerHtml(p);

      // Title only if present
      if(inner.title){
        const t = document.createElement("div");
        t.className = "tumblrPostTitle";
        t.textContent = inner.title;
        left.appendChild(t);
      }

      // date always present (but hidden until hover)
      left.appendChild(d);

      // Small open symbol button (NOT whole post clickable)
      const open = document.createElement("a");
      open.className = "tumblrOpen";
      open.href = p?.url || p?.url_with_slug || "#";
      open.target = "_blank";
      open.rel = "noreferrer";
      open.setAttribute("aria-label", "Open on Tumblr");
      open.title = "Open on Tumblr";
      open.textContent = POST_LINK_SYMBOL;

      head.appendChild(left);
      // Only show open button if we actually have a URL
      if(open.href && open.href !== "#") head.appendChild(open);

      const body = document.createElement("div");
      body.className = "tumblrBody";
      body.innerHTML = inner.html || "";

      // Zoom bind on images inside body
      bindZoomableImages(body);

      post.appendChild(head);

      // Only append body if it has anything meaningful
      const hasBody = (body.textContent || "").trim().length > 0 || body.querySelector("img, video, audio, iframe");
      if(hasBody) post.appendChild(body);

      tumblrFeed.appendChild(post);
    });

    renderTumblrPager();

    // keep view near the top of feed when paging
    const newTop = tumblrFeed.getBoundingClientRect().top + window.scrollY;
    const delta = newTop - topAnchor;
    window.scrollTo({ top: window.scrollY + delta, behavior: "instant" });
  }catch(e){
    tumblrFeed.textContent = "Unable to load Tumblr feed.";
  }finally{
    tumblrLoading = false;
    // Update pager disabled state
    renderTumblrPager();
  }
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

// Loads (only run what exists on the page)
loadLatest4FromRss().catch(() => {});
loadSubs().catch(() => {});
loadTumblrFeed().catch(() => {});
