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

// ====== YOUTUBE: auto latest 4 via RSS (no API key) ======
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

async function loadLatest4FromRss(){
  if(!ytGrid) return;

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`;
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;

  const res = await fetch(proxied, { cache: "no-store" });
  if(!res.ok) throw new Error("RSS fetch failed");
  const xml = await res.text();

  // Channel name (if present)
  const name = xmlAllBetween(xml, "<name>", "</name>")[0];
  if(name && ytChannelName) ytChannelName.textContent = decodeXml(name);

  // Latest 4 video IDs + titles (feed is newest-first)
  const ids = xmlAllBetween(xml, "<yt:videoId>", "</yt:videoId>").slice(0, 4);
  const titlesRaw = xmlAllBetween(xml, "<title>", "</title>").slice(0, 4).map(decodeXml);

  if(!ids.length) throw new Error("No videos found");

  // Make big card go to channel (grid tiles go to videos)
  if(ytCard) ytCard.href = YT_CHANNEL_FALLBACK_URL;

  ytGrid.innerHTML = "";

  ids.forEach((id, idx) => {
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;
    const thumbUrl = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const title = titlesRaw[idx] || "YouTube video";

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
  const url = `https://img.shields.io/youtube/channel/subscribers/${YT_CHANNEL_ID}.json`;
  const res = await fetch(url);
  if(!res.ok) return;
  const data = await res.json();
  const v = data?.value || data?.message || "—";
  ytSubs.textContent = compactNumberString(v);
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
