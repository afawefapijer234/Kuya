// ====== CONFIG ======
const YT_CHANNEL_ID = "UCuDJUj1szS87hLRjXQKnmaA";
const YT_CHANNEL_FALLBACK_URL = "https://www.youtube.com/@houseoftakuya";

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

// ====== YOUTUBE: auto latest 4 via RSS (no API key), filter out Shorts fast ======
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

// Escaped XML entities minimal decode
function decodeXml(s){
  return String(s || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

async function fetchRaw(url){
  // Try direct fetch first (some environments allow it),
  // fallback to AllOrigins proxy.
  try{
    const r = await fetch(url, { cache: "no-store" });
    if(r.ok) return await r.text();
  }catch{}
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const r2 = await fetch(proxied, { cache: "no-store" });
  if(!r2.ok) throw new Error("fetch failed");
  return await r2.text();
}

async function loadLatest4FromRss(){
  if(!ytGrid) return;

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`;
  const xml = await fetchRaw(feedUrl);

  // Channel name (if present)
  const name = xmlAllBetween(xml, "<name>", "</name>")[0];
  if(name && ytChannelName) ytChannelName.textContent = decodeXml(name);

  // Split into entry blocks
  const entries = xml.split("<entry>").slice(1).map(s => "<entry>" + s);

  // Filter out Shorts by requiring the alternate link to be watch?v= (most reliable cheap signal)
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

  // Fallback: if parsing fails for some reason, just show first 4 IDs
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

// YouTube loads
loadLatest4FromRss().catch(() => {});
loadSubs().catch(() => {});
