"use strict";

/* =========================================================
   CONFIG
========================================================= */

const YT_CHANNEL_ID = "UCuDJUj1szS87hLRjXQKnmaA";
const YT_CHANNEL_FALLBACK_URL = "https://www.youtube.com/@houseoftakuya";

const TUMBLR_BLOG = "takuyakitano";
const TUMBLR_PAGE_SIZE = 10;

const GOODREADS_PROFILE_URL = "https://www.goodreads.com/takuyakitano"; 

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

const statusElTop = document.getElementById("statusMsg");

const STATUS_ITEMS = [
  { mode: "says", text: "san q berry muchee..." },
  { mode: "is", text: "currently using the bathroom" },
  { mode: "is", text: "currently working out" },
  { mode: "is", text: "shopping for new clothes" },
  { mode: "is", text: "recording a new video" },
];

/* =========================================================
   UTILS
========================================================= */

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function randFloat(a, b) { return a + Math.random() * (b - a); }

function pad(n){ return String(n).padStart(2, "0"); }

function decodeXml(s){
  return String(s || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

function stripHtml(s){
  return String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  return d.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
}

function slugify(s){
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function deriveTitle(post, inner){
  const t1 = stripHtml(inner?.title || "");
  if(t1) return t1;
  const t2 = stripHtml(post?.title || "");
  if(t2) return t2;

  const bodyText = stripHtml(inner?.html || "");
  if(!bodyText) return "post";
  return bodyText.slice(0, 60);
}

function prettyHashForPost(postId, title){
  const slug = slugify(title) || "post";
  return `#/${slug}--${postId}`;
}

function parsePrettyHash(){
  const h = location.hash || "";
  const m = h.match(/^#\/.+--(\d+)$/);
  return m ? m[1] : null;
}

function getSiteBaseUrl(){
  const { origin, pathname } = window.location;
  const basePath = pathname.endsWith("/") ? pathname : pathname.replace(/\/[^\/]*$/, "/");
  return origin + basePath;
}

async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    return true;
  }catch{
    try{
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
    }catch{
      return false;
    }
  }
}

// --- TITLE EXTRACTION HELPER (Upgraded for Header Tags) ---
function extractTitleFromBody(html) {
  if (!html) return { title: null, body: html };

  const temp = document.createElement("div");
  temp.innerHTML = html;

  const firstEl = temp.firstElementChild;
  if (!firstEl) return { title: null, body: html };

  // Detects P tags AND Header tags which you are using for titles
  const validTags = ["P", "H1", "H2", "H3", "H4", "H5", "H6"];
  
  if (validTags.includes(firstEl.tagName)) {
    const text = firstEl.textContent.trim();
    if (!text) return { title: null, body: html };

    // Heuristics to reject bad titles
    const tooLong = text.length > 80;
    const hasLineBreaks = /\n/.test(text);
    const looksLikeList = /^[-•*]\s/.test(text);
    const tooManyDashes = (text.match(/\s-\s/g) || []).length >= 2;

    if (tooLong || hasLineBreaks || looksLikeList || tooManyDashes) {
      return { title: null, body: html };
    }

    // Accept as title and rip it out of the body
    firstEl.remove();

    return {
      title: text,
      body: temp.innerHTML.trim()
    };
  }

  return { title: null, body: html };
}

/* =========================================================
   TYPEWRITER (with micro-pauses)
========================================================= */

function isPunct(ch){
  return ch === "." || ch === "!" || ch === "?" || ch === "," ||
    ch === ";" || ch === ":" || ch === "…" || ch === "-";
}
function isSpace(ch){ return ch === " " || ch === "\n" || ch === "\t"; }

async function runTypewriter(el, items) {
  const leadEl = document.getElementById("statusLead");

  while (true) {
    for (const item of items) {
      if (leadEl) {
        leadEl.textContent = item.mode === "says" ? "says:" : "is";
      }

      const full = item.text;

      el.textContent = "";
      const thinkPause = () => (Math.random() < 0.12 ? 180 + Math.random() * 320 : 0);
      
      for (let i = 0; i < full.length; i++) {
        el.textContent += full[i];
        const ch = full[i];
        const base = 38 + Math.random() * 60; 
        const extra =
          ch === "." ? 180 + Math.random() * 220 :
          ch === "," ? 120 + Math.random() * 180 :
          ch === " " ? 0 :
          0;

        await sleep(base + extra + thinkPause());
      }

      await sleep(900 + Math.random() * 900);
      
      while (el.textContent.length) {
        el.textContent = el.textContent.slice(0, -1);
        const base = 20 + Math.random() * 45;
        await sleep(base + thinkPause());
      }

      await sleep(250 + Math.random() * 350);
    }
  }
}

/* =========================================================
   CLOCK / ONLINE / BPM
========================================================= */

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

function updateOnline(){
  const on = navigator.onLine;
  if(statusEl) statusEl.textContent = on ? "online" : "offline";
  if(!dot) return;
  dot.style.background = on ? "rgba(0,160,120,.70)" : "rgba(220,80,80,.70)";
  dot.style.boxShadow = on ? "0 0 18px rgba(0,160,120,.35)" : "0 0 18px rgba(220,80,80,.30)";
}

let bpmValue = 72;
let bpmVel = 0;
let drift = 0;
let lastTick = performance.now();

const SCHEDULE = {
  sleep:   { min: 35,  max: 45  }, 
  day:     { min: 60,  max: 80  }, 
  workout: { min: 120, max: 180 }  
};

function smoothstep(t){
  t = Math.max(0, Math.min(1, t));
  return t*t*(3 - 2*t);
}

function getDailyTargetParams(){
  const now = new Date();
  const h = now.getHours() + now.getMinutes()/60;

  const inWorkout = (h >= 20 && h < 21);
  const inSleep = (h >= 21 || h < 6);
  const inDay = (!inWorkout && !inSleep);

  let band = inWorkout ? SCHEDULE.workout : (inSleep ? SCHEDULE.sleep : SCHEDULE.day);
  let target = randFloat(band.min, band.max);

  if(h >= 19.5 && h < 20){
    const t = smoothstep((h - 19.5) / 0.5);
    const dayTarget = randFloat(SCHEDULE.day.min, SCHEDULE.day.max);
    const woTarget = randFloat(SCHEDULE.workout.min, SCHEDULE.workout.max);
    target = dayTarget + t * (woTarget - dayTarget);
  }

  if(h >= 21 && h < 21.5){
    const t = smoothstep((h - 21) / 0.5);
    const woTarget = randFloat(SCHEDULE.workout.min, SCHEDULE.workout.max);
    const slTarget = randFloat(SCHEDULE.sleep.min, SCHEDULE.sleep.max);
    target = woTarget + t * (slTarget - woTarget);
  }

  if(h >= 5.5 && h < 6){
    const t = smoothstep((h - 5.5) / 0.5);
    const slTarget = randFloat(SCHEDULE.sleep.min, SCHEDULE.sleep.max);
    const dayTarget = randFloat(SCHEDULE.day.min, SCHEDULE.day.max);
    target = slTarget + t * (dayTarget - slTarget);
  }

  let tau = 5;       
  let maxStep = 4.0; 

  if(inSleep){ tau = 42; maxStep = 1.1; } 
  if(inDay){ tau = 4; maxStep = 5.0; }    
  if(inWorkout){ tau = 2; maxStep = 10.0; } 

  return { target, tau, maxStep, inWorkout, inDay, inSleep };
}

function tickBpm(){
  if(!bpmEl) return;

  const nowT = performance.now();
  const dt = Math.min(0.2, Math.max(0.02, (nowT - lastTick) / 1000));
  lastTick = nowT;

  drift += (Math.random() - 0.5) * 0.5; 
  drift = Math.max(-6, Math.min(6, drift));

  const { target, tau, maxStep, inWorkout, inDay } = getDailyTargetParams();

  const scrollBoost = Math.min(6, window.scrollY / 180);
  
  const micro = (Math.random() - 0.5) * (inWorkout ? 6.0 : inDay ? 4.0 : 1.0);

  const desired = target + drift + scrollBoost + micro;

  const alpha = 1 - Math.exp(-dt / tau);
  let next = bpmValue + alpha * (desired - bpmValue);

  const maxDelta = maxStep * dt;
  const delta = next - bpmValue;
  if(delta > maxDelta) next = bpmValue + maxDelta;
  if(delta < -maxDelta) next = bpmValue - maxDelta;

  bpmVel = 0.85 * bpmVel + 0.15 * (next - bpmValue);
  bpmValue += bpmVel;

  bpmValue = Math.max(32, Math.min(190, bpmValue));

  const shown = Math.round(bpmValue);
  bpmEl.textContent = shown;

  if(dot){
    const pulse = 0.95 + (shown - 60) / 260;
    dot.style.transform = `scale(${pulse})`;
  }
}

/* =========================================================
   FETCH (CORS fallback)
========================================================= */

async function fetchRaw(url){
  try{
    const r = await fetch(url, { cache: "no-store" });
    if(r.ok) return await r.text();
  }catch{}
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const r2 = await fetch(proxied, { cache: "no-store" });
  if(!r2.ok) throw new Error("fetch failed");
  return await r2.text();
}

/* =========================================================
   LIGHTBOX (image zoom)
========================================================= */

function ensureLightbox(){
  let lb = document.getElementById("imgLightbox");
  if(lb) return lb;

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

  lb.addEventListener("click", (e) => { if(e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", (e) => { if(e.key === "Escape") closeLightbox(); });

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

/* =========================================================
   YOUTUBE (optional)
========================================================= */

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

function compactNumberString(s){
  const txt = String(s || "—").trim();
  if(/[KM]$/i.test(txt)) return txt;
  const n = Number(txt.replace(/[^\d.]/g, ""));
  if(!Number.isFinite(n)) return txt;
  if(n >= 1e6) return `${(n/1e6).toFixed(2).replace(/\.00$/,'')}M`;
  if(n >= 1e3) return `${(n/1e3).toFixed(2).replace(/\.00$/,'')}K`;
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

/* =========================================================
   TUMBLR (JSONP API)
========================================================= */

let tumblrStart = 0;
let tumblrTotal = null;
let tumblrLoading = false;
let currentTag = ""; 

function getActivePostId(){
  const qs = new URLSearchParams(location.search);
  const postFromQuery = qs.get("post");
  const postFromHash = parsePrettyHash();
  return postFromQuery || postFromHash;
}

function tumblrJsonUrl({ start, num, id, tag }){
  const base = `https://${TUMBLR_BLOG}.tumblr.com/api/read/json`;
  
  if(id) return `${base}?id=${encodeURIComponent(id)}`;

  let url = `${base}?num=${encodeURIComponent(num)}&start=${encodeURIComponent(start)}`;
  if(tag) url += `&tagged=${encodeURIComponent(tag)}`;
  return url;
}

function parseTumblrJsonp(text){
  let t = String(text || "").trim();
  t = t.replace(/^\s*var\s+tumblr_api_read\s*=\s*/i, "");
  t = t.replace(/;\s*$/, "");
  return JSON.parse(t);
}

function pickBestPhotoUrl(obj){
  const o = obj || {};
  const keys = Object.keys(o)
    .filter(k => /^photo-url-\d+$/i.test(k))
    .sort((a, b) => Number(b.split("-").pop()) - Number(a.split("-").pop()));
  for(const k of keys){
    if(o[k]) return o[k];
  }
  return null;
}

function buildPostInner(post){
  const type = post?.type || "";

  if(type === "regular"){
    const title = post["regular-title"] || "";
    const body = post["regular-body"] || "";
    return { title, html: sanitizeHtml(body) };
  }

  if(type === "photo"){
    const caption = post["photo-caption"] || "";
    const photos = Array.isArray(post.photos) ? post.photos : null;
    let html = "";

    if(photos && photos.length){
      html += `<div class="tumblrPhotoGrid">`;
      for(const p of photos){
        const src = pickBestPhotoUrl(p) || p["photo-url-500"] || p["photo-url-400"] || "";
        if(!src) continue;
        html += `<img src="${src}" alt="" loading="lazy" decoding="async" />`;
      }
      html += `</div>`;
    }else{
      const src = pickBestPhotoUrl(post);
      if(src) html += `<img src="${src}" alt="" loading="lazy" decoding="async" />`;
    }

    if(caption) html += `<div class="tumblrCaption">${sanitizeHtml(caption)}</div>`;
    return { title: "", html };
  }

  if(type === "quote"){
    const text = post["quote-text"] || "";
    const source = post["quote-source"] || "";
    let html = "";
    if(text) html += `<blockquote>${sanitizeHtml(text)}</blockquote>`;
    if(source) html += `<div class="tumblrCaption">${sanitizeHtml(source)}</div>`;
    return { title: "", html };
  }

  if(type === "link"){
    const text = post["link-text"] || post["regular-title"] || "Link";
    const url = post["link-url"] || "";
    const desc = post["link-description"] || "";
    let html = "";
    if(url) html += `<p><a href="${url}" target="_blank" rel="noreferrer">${sanitizeHtml(text)}</a></p>`;
    if(desc) html += `<div class="tumblrCaption">${sanitizeHtml(desc)}</div>`;
    return { title: "", html };
  }

  if(type === "chat"){
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

function buildNativeShareUrl(postId, title){
  const base = getSiteBaseUrl();
  return `${base}${prettyHashForPost(postId, title)}`;
}

function setDocumentTitleForSinglePost(titleText){
  const base = "KUYA";
  const t = String(titleText || "").trim();
  document.title = t ? `${t} — ${base}` : `${base} — post`;
}

function buildTumblrPostElement(p){
  const postId = String(p?.id || "");
  const inner = buildPostInner(p);
  
  let title = inner.title || null;
  let body = inner.html || "";

  if (!title) {
    const inferred = extractTitleFromBody(body);
    title = inferred.title;
    body = inferred.body;
  }
  
  const post = document.createElement("article");
  post.className = "tumblrPost";
  post.dataset.postId = postId;

  post.addEventListener("click", (e) => {
    if(e.target.tagName === "A" || e.target.tagName === "BUTTON" || e.target.tagName === "IMG") return;
    
    const feed = document.getElementById("tumblrFeed");
    if(feed && feed.classList.contains("grid-mode")){
      window.location.hash = prettyHashForPost(postId, title || deriveTitle(p, inner));
    }
  });

  const head = document.createElement("div");
  head.className = "tumblrHead";

  const left = document.createElement("div");
  left.className = "tumblrHeadLeft";

  // --- NEW: Title rendered as a link ABOVE the Meta ---
  if (title) {
    const t = document.createElement("a");
    t.className = "tumblrPostTitle";
    t.textContent = title;
    t.href = buildNativeShareUrl(postId, title || deriveTitle(p, inner));
    left.appendChild(t);
  }

  const meta = document.createElement("div");
  meta.className = "tumblrMeta";

  const dateEl = document.createElement("div");
  dateEl.className = "tumblrPostDate";
  dateEl.textContent = formatDate(p?.date_gmt || p?.date || "");
  meta.appendChild(dateEl);

  if (postId) {
    const shareBtn = document.createElement("button");
    shareBtn.className = "tumblrShareInline";
    shareBtn.type = "button";
    shareBtn.textContent = "share";
    shareBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const shareUrl = buildNativeShareUrl(postId, title || deriveTitle(p, inner));
      const ok = await copyToClipboard(shareUrl);
      if (ok) {
        const prev = shareBtn.textContent;
        shareBtn.textContent = "copied";
        setTimeout(() => (shareBtn.textContent = prev), 900);
      }
    });
    meta.appendChild(shareBtn);
  }

  if(meta.childNodes.length){
    left.appendChild(meta);
  }
  
  const hasHeadLeft = left.childNodes.length > 0 && (left.textContent || "").trim().length > 0;
  const hasHeadMeta = meta.childNodes.length > 0;
  if(hasHeadLeft || hasHeadMeta){
    head.appendChild(left);
    post.appendChild(head);
  }

  const bodyEl = document.createElement("div");
  bodyEl.className = "tumblrBody";
  bodyEl.innerHTML = body || "";
  bindZoomableImages(bodyEl);

  const hasBody = (bodyEl.textContent || "").trim().length > 0 || bodyEl.querySelector("img, video, audio, iframe");
  if(hasBody) post.appendChild(bodyEl);

  const tumblrUrl = p?.url_with_slug || p?.url || "";
  if(tumblrUrl){
    const signoff = document.createElement("div");
    signoff.className = "tumblrSignoff";
    signoff.appendChild(document.createTextNode("- "));
    const a = document.createElement("a");
    a.href = tumblrUrl;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = "takuya";
    signoff.appendChild(a);
    post.appendChild(signoff);
  }

  return post;
}

function renderTumblrPager(){
  if(!tumblrFeed) return;

  tumblrFeed.querySelectorAll(".tumblrPager").forEach(n => n.remove());
  if(getActivePostId()) return;

  const canForward = tumblrStart > 0;
  const canBack = (tumblrTotal == null) ? true : (tumblrStart + TUMBLR_PAGE_SIZE < tumblrTotal);

  if(!canForward && !canBack) return;

  const pager = document.createElement("div");
  pager.className = "tumblrPager";

  if(canForward){
    const forwardBtn = document.createElement("button");
    forwardBtn.type = "button";
    forwardBtn.textContent = "forward in time";
    forwardBtn.disabled = tumblrLoading;
    forwardBtn.addEventListener("click", () => {
      if(tumblrLoading) return;
      tumblrStart = Math.max(0, tumblrStart - TUMBLR_PAGE_SIZE);
      loadTumblrFeed().catch(() => {});
    });
    pager.appendChild(forwardBtn);
  }else{
    const spacer = document.createElement("div");
    spacer.className = "spacer";
    pager.appendChild(spacer);
  }

  const mid = document.createElement("div");
  mid.className = "spacer";
  pager.appendChild(mid);

  if(canBack){
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.textContent = "back in time";
    backBtn.disabled = tumblrLoading;
    backBtn.addEventListener("click", () => {
      if(tumblrLoading) return;
      tumblrStart = tumblrStart + TUMBLR_PAGE_SIZE;
      loadTumblrFeed().catch(() => {});
    });
    pager.appendChild(backBtn);
  }

  tumblrFeed.appendChild(pager);
}

async function loadTumblrFeed(){
  if(!tumblrFeed) return;
  if(tumblrLoading) return;

  tumblrLoading = true;
  const activePostId = getActivePostId();

  if (currentTag === "thoughts" && !activePostId) {
    tumblrFeed.classList.add("grid-mode");
  } else {
    tumblrFeed.classList.remove("grid-mode");
  }

  if (currentTag === "" && !activePostId) {
    document.body.classList.add("is-newest");
  } else {
    document.body.classList.remove("is-newest");
  }

  try{
    if(tumblrStart === 0) tumblrFeed.textContent = "Loading…";

    const url = tumblrJsonUrl({
      start: tumblrStart,
      num: TUMBLR_PAGE_SIZE,
      id: activePostId || null,
      tag: currentTag 
    });

    const raw = await fetchRaw(url);
    const data = parseTumblrJsonp(raw);

    tumblrTotal = Number.isFinite(Number(data?.posts_total)) ? Number(data.posts_total) : tumblrTotal;

    const posts = Array.isArray(data?.posts) ? data.posts : [];
    
    if(tumblrStart === 0) tumblrFeed.innerHTML = "";

    if(!posts.length){
      if(tumblrStart === 0) tumblrFeed.textContent = "No posts found in this collection.";
      return;
    }

    if(activePostId){
      const p = posts[0];
      const el = buildTumblrPostElement(p);
      tumblrFeed.appendChild(el);

      const inner = buildPostInner(p);
      setDocumentTitleForSinglePost(inner.title || deriveTitle(p, inner));
      return;
    }

    posts.forEach(p => tumblrFeed.appendChild(buildTumblrPostElement(p)));
    renderTumblrPager();
  }catch(e){
    console.error(e);
    tumblrFeed.textContent = "Unable to load feed.";
  }finally{
    tumblrLoading = false;
    renderTumblrPager();
  }
}

function onRouteChange(){
  tumblrStart = 0;
  loadTumblrFeed().catch(() => {});
}

/* =========================================================
   CATEGORY NAV & RANDOM LOGIC
========================================================= */

function setupCategoryNav(){
  const buttons = document.querySelectorAll(".catBtn");
  
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      
      if(btn.id === "randomBtn"){
         fetchRandomPost();
         return;
      }

      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      currentTag = btn.dataset.tag || "";
      
      tumblrStart = 0;
      tumblrTotal = null;
      
      history.pushState("", document.title, window.location.pathname + window.location.search);

      loadTumblrFeed();
    });
  });
}

async function fetchRandomPost(){
  if(tumblrLoading) return;
  tumblrFeed.textContent = "Rolling the dice...";
  
  const url = tumblrJsonUrl({ start:0, num:1 });
  try {
    const raw = await fetchRaw(url);
    const data = parseTumblrJsonp(raw);
    const total = Number(data.posts_total);
    
    if(!total) return;

    const randomStart = Math.floor(Math.random() * total);
    
    const randUrl = tumblrJsonUrl({ start: randomStart, num: 1 });
    const randRaw = await fetchRaw(randUrl);
    const randData = parseTumblrJsonp(randRaw);
    const post = randData.posts[0];
    
    if(post){
      window.location.hash = prettyHashForPost(post.id, post["regular-title"] || "random");
    }
  } catch(e) {
    tumblrFeed.textContent = "Failed to find a random memory.";
  }
}

/* =========================================================
   GOODREADS WIDGET LINK HIJACKER
========================================================= */

function hijackGoodreadsLinks() {
  const widget = document.querySelector(".goodreadsWidget");
  if (!widget) return;

  let attempts = 0;
  const interval = setInterval(() => {
    const links = widget.querySelectorAll("a");
    
    if (links.length > 0) {
      links.forEach(a => {
        a.href = GOODREADS_PROFILE_URL;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      });
      clearInterval(interval);
    }

    attempts++;
    if (attempts > 40) clearInterval(interval);
  }, 100);
}

/* =========================================================
   INIT
========================================================= */

function init(){
  if(yearEl) yearEl.textContent = new Date().getFullYear();

  updateClock();
  updateOnline();
  tickBpm();

  setInterval(updateClock, 1000 * 10);
  setInterval(tickBpm, 250);

  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);

  window.addEventListener("scroll", () => tickBpm(), { passive: true });

  window.addEventListener("hashchange", onRouteChange);
  window.addEventListener("popstate", onRouteChange);

  onRouteChange();

  loadLatest4FromRss().catch(() => {});
  loadSubs().catch(() => {});

  runTypewriter(statusElTop, STATUS_ITEMS).catch(() => {});

  hijackGoodreadsLinks();
  setupCategoryNav();
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", init);
}else{
  init();
}
