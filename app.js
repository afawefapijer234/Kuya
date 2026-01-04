// ====== CONFIG ======
const YT_CHANNEL_ID = "UCuDJUj1szS87hLRjXQKnmaA";
const YT_CHANNEL_FALLBACK_URL = "https://www.youtube.com/@houseoftakuya";

// Your Tumblr RSS (this is the one you want)
const TUMBLR_RSS_URL = "https://takuyakitano.tumblr.com/rss";

// ====== HUD ======
const bpmEl = document.getElementById("bpm");
const clockEl = document.getElementById("clock");
const tzEl = document.getElementById("tz");
const statusEl = document.getElementById("status");
const dot = document.querySelector(".dot");

// YouTube UI (optional — won’t run if elements aren’t on the page)
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

// ====== XML helpers ======
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

function decodeXml(s){
  return String(s || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

// ====== fetch helper ======
async function fetchRaw(url){
  // Try direct fetch first, fallback to AllOrigins.
  try{
    const r = await fetch(url, { cache: "no-store" });
    if(r.ok) return await r.text();
  }catch{}
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const r2 = await fetch(proxied, { cache: "no-store" });
  if(!r2.ok) throw new Error("fetch failed");
  return await r2.text();
}

// ====== YOUTUBE: latest 4 via RSS (fast, no duration checks) ======
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
    if(!altLink.includes("/watch?v=")) continue; // skips /shorts/

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

// ====== TUMBLR: full posts + keep formatting + not whole-card link ======
const TUMBLR_ALLOWED_TAGS = new Set([
  "P","BR","HR","DIV","SPAN",
  "B","STRONG","I","EM","U","S","CODE","PRE",
  "BLOCKQUOTE",
  "UL","OL","LI",
  "A",
  "IMG",
  "H1","H2","H3","H4"
]);

function sanitizeTumblrHtml(html){
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");

  // remove dangerous nodes outright
  doc.querySelectorAll("script, style, iframe, object, embed, form, input, button, textarea, select").forEach(n => n.remove());

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null);
  const toUnwrap = [];
  while(walker.nextNode()){
    const el = walker.currentNode;
    const tag = el.tagName;

    // unwrap disallowed tags (keep children)
    if(!TUMBLR_ALLOWED_TAGS.has(tag)){
      toUnwrap.push(el);
      continue;
    }

    // strip all on* handlers + risky attrs
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const val = attr.value || "";

      if(name.startsWith("on")) el.removeAttribute(attr.name);
      if(name === "style") el.removeAttribute("style");
      if(name === "srcset") el.removeAttribute("srcset");
      if(name === "data-src") el.removeAttribute("data-src");
      if(name === "data-orig-file") el.removeAttribute("data-orig-file");
      if(name === "id") el.removeAttribute("id");
      if(name === "class") el.removeAttribute("class");
      if(name === "width") el.removeAttribute("width");
      if(name === "height") el.removeAttribute("height");

      if((name === "href" || name === "src") && /^\s*javascript:/i.test(val)) el.removeAttribute(attr.name);
    });

    // Links should open in new tab, but only if user clicks the link itself
    if(tag === "A"){
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }

    // Images: lazy + keep src
    if(tag === "IMG"){
      el.setAttribute("loading", "lazy");
      el.setAttribute("decoding", "async");
      const src = el.getAttribute("src") || "";
      if(!src) toUnwrap.push(el);
    }
  }

  // unwrap nodes we don't want to keep
  toUnwrap.forEach(el => {
    const parent = el.parentNode;
    if(!parent) return;
    while(el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });

  return doc.body.innerHTML.trim();
}

function formatDate(pubDate){
  if(!pubDate) return "";
  const d = new Date(pubDate);
  if(Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

async function loadTumblrFeed(){
  if(!tumblrFeed) return;

  tumblrFeed.textContent = "Loading…";

  try{
    const xml = await fetchRaw(TUMBLR_RSS_URL);

    const items = xml
      .split("<item>")
      .slice(1)
      .map(s => "<item>" + s)
      .slice(0, 20); // show more if you want

    const posts = items.map((item) => {
      const title = decodeXml((item.match(/<title>([^<]*)<\/title>/) || [])[1] || "");
      const link = decodeXml((item.match(/<link>([^<]+)<\/link>/) || [])[1] || TUMBLR_RSS_URL);
      const pubDate = decodeXml((item.match(/<pubDate>([^<]+)<\/pubDate>/) || [])[1] || "");
      const descriptionRaw = decodeXml((item.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || "");

      // IMPORTANT: no truncation — full HTML (sanitized)
      const html = sanitizeTumblrHtml(descriptionRaw);

      return { title, link, pubDate, html };
    });

    tumblrFeed.innerHTML = "";

    if(!posts.length){
      tumblrFeed.textContent = "No posts yet.";
      return;
    }

    posts.forEach(({ title, link, pubDate, html }) => {
      const post = document.createElement("article");
      post.className = "tumblrItem";

      const head = document.createElement("header");
      head.className = "tumblrHead";

      const titleEl = document.createElement("div");
      titleEl.className = "tumblrTitle";
      titleEl.textContent = title || "Post";

      const dateEl = document.createElement("div");
      dateEl.className = "tumblrMeta";
      dateEl.textContent = formatDate(pubDate) || "Tumblr";

      head.append(titleEl, dateEl);

      const body = document.createElement("div");
      body.className = "tumblrBody";
      // keeps bold/italics/lists/images/etc (sanitized)
      body.innerHTML = html || "";

      const foot = document.createElement("footer");
      foot.className = "tumblrFoot";

      // IMPORTANT: post itself is NOT a link — only this button is
      const btn = document.createElement("a");
      btn.className = "tumblrOpen";
      btn.href = link;
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";
      btn.textContent = "Open on Tumblr";

      foot.appendChild(btn);

      post.append(head, body, foot);
      tumblrFeed.appendChild(post);
    });
  }catch{
    tumblrFeed.textContent = "Unable to load Tumblr feed.";
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

// Loads (safe: each function no-ops if elements don’t exist)
loadLatest4FromRss().catch(() => {});
loadSubs().catch(() => {});
loadTumblrFeed().catch(() => {});
