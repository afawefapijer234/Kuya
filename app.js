// ====== CONFIG ======
const YT_CHANNEL_ID = "UCuDJUj1szS87hLRjXQKnmaA";
const YT_CHANNEL_FALLBACK_URL = "https://www.youtube.com/@houseoftakuya";

// Tumblr blog name (no @, no URL)
const TUMBLR_BLOG = "takuyakitano";

// Tiny “open original” symbol (pick one: "#", "↗", "⌁", "⎋", "·", "⊹")
const POST_LINK_SYMBOL = "#";

// How many Tumblr posts to render
const TUMBLR_LIMIT = 12;

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

// Extract first match between tags (supports multiline)
function xmlFirstBetween(xml, startTag, endTag){
  const s = xml.indexOf(startTag);
  if(s === -1) return "";
  const e = xml.indexOf(endTag, s + startTag.length);
  if(e === -1) return "";
  return xml.slice(s + startTag.length, e);
}

async function fetchRaw(url){
  // Try direct first
  try{
    const r = await fetch(url, { cache: "no-store" });
    if(r.ok) return await r.text();
  }catch{}

  // Proxy fallback
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

  // Minimal styles injected so you don't have to touch styles.css
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
      max-width: min(1100px, 96vw);
      max-height: 90vh;
      width: fit-content;
      height: fit-content;
      display: grid;
      gap: 10px;
      justify-items: end;
    }
    #imgLightbox img{
      max-width: min(1100px, 96vw);
      max-height: 86vh;
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

  // click backdrop closes (but clicking image shouldn’t)
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

// Make any images inside container zoomable
function bindZoomableImages(container){
  const imgs = container.querySelectorAll("img");
  imgs.forEach((im) => {
    // don’t double-bind
    if(im.dataset.zoomBound === "1") return;
    im.dataset.zoomBound = "1";

    im.style.cursor = "zoom-in";
    im.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Prefer highest res tumblr images if possible (often in srcset)
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

// ====== TUMBLR FEED (FULL CONTENT + FORMATTING + IMAGE ZOOM) ======
function tumblrRssCandidates(){
  // Tumblr RSS can be slow to update; these are the most reliable formats to try.
  return [
    `https://${TUMBLR_BLOG}.tumblr.com/rss`,
    `https://www.tumblr.com/${TUMBLR_BLOG}/rss`,
    `https://www.tumblr.com/blog/${TUMBLR_BLOG}/rss`,
  ];
}

function normalizeTumblrHtml(html){
  let out = sanitizeHtml(decodeXml(html || ""));

  // Tumblr sometimes provides relative links or weird tracking params;
  // we’ll leave links alone but ensure images behave nicely.
  return out;
}

async function loadTumblrFeed(){
  if(!tumblrFeed) return;

  tumblrFeed.textContent = "Loading…";

  try{
    let xml = "";
    let lastErr = null;

    for(const url of tumblrRssCandidates()){
      try{
        xml = await fetchRaw(url);
        if(xml && xml.includes("<item>")) break;
      }catch(e){
        lastErr = e;
      }
    }

    if(!xml || !xml.includes("<item>")){
      throw lastErr || new Error("Tumblr RSS not available");
    }

    const items = xml.split("<item>").slice(1).map(s => "<item>" + s);

    tumblrFeed.innerHTML = "";

    const picked = items.slice(0, TUMBLR_LIMIT).map((itemXml) => {
      const title = decodeXml((itemXml.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
      const link = decodeXml((itemXml.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "");
      const pubDate = decodeXml((itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "");

      // Prefer content:encoded when available; else fallback to description
      let content = "";
      const encoded = (itemXml.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/) || [])[1];
      if(encoded != null){
        content = encoded;
      }else{
        const descCdata = (itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || [])[1];
        if(descCdata != null) content = descCdata;
        else content = (itemXml.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || "";
      }

      return {
        title: title.trim(),
        link: link.trim(),
        pubDate: pubDate.trim(),
        html: normalizeTumblrHtml(content),
      };
    });

    if(!picked.length){
      tumblrFeed.textContent = "No posts yet.";
      return;
    }

    picked.forEach(({ title, link, pubDate, html }) => {
      const post = document.createElement("article");
      post.className = "tumblrPost";

      const head = document.createElement("div");
      head.className = "tumblrHead";

      const left = document.createElement("div");
      left.className = "tumblrHeadLeft";

      const t = document.createElement("div");
      t.className = "tumblrPostTitle";
      t.textContent = title || "";

      const d = document.createElement("div");
      d.className = "tumblrPostDate";
      d.textContent = formatDate(pubDate);

      // If there’s no title, still keep spacing clean
      if(title) left.appendChild(t);
      left.appendChild(d);

      // Small link button (NOT whole post clickable)
      const open = document.createElement("a");
      open.className = "tumblrOpen";
      open.href = link || "#";
      open.target = "_blank";
      open.rel = "noreferrer";
      open.setAttribute("aria-label", "Open on Tumblr");
      open.title = "Open on Tumblr";
      open.textContent = POST_LINK_SYMBOL;

      head.appendChild(left);
      head.appendChild(open);

      const body = document.createElement("div");
      body.className = "tumblrBody";
      body.innerHTML = html || "";

      // After injecting HTML, bind lightbox to images
      bindZoomableImages(body);

      post.appendChild(head);
      post.appendChild(body);
      tumblrFeed.appendChild(post);
    });

    // Inject minimal styles for new classes if your CSS doesn't have them yet
    injectTumblrUiStylesIfMissing();
  }catch(e){
    tumblrFeed.textContent = "Unable to load Tumblr feed.";
  }
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
    }
    .tumblrPostTitle{
      font-weight: 600;
      letter-spacing: .01em;
    }
    .tumblrPostDate{
      opacity: .55;
      font-size: .95em;
      white-space: nowrap;
    }
    .tumblrOpen{
      text-decoration: none;
      opacity: .55;
      font-weight: 600;
      border: 1px solid rgba(0,0,0,.14);
      border-radius: 999px;
      padding: 4px 10px;
      line-height: 1;
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
    /* if tumblr gives multiple images side-by-side as floats, this helps */
    .tumblrBody figure, .tumblrBody div, .tumblrBody span{
      max-width: 100%;
    }
  `;
  document.head.appendChild(style);
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

// Loads
loadLatest4FromRss().catch(() => {});
loadSubs().catch(() => {});
loadTumblrFeed().catch(() => {});
