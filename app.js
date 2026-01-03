// ====== CONFIG ======
const YT_CHANNEL_ID = "UCuDJUj1szS87hLRjXQKnmaA";

// ====== HUD ======
const bpmEl = document.getElementById("bpm");
const clockEl = document.getElementById("clock");
const tzEl = document.getElementById("tz");
const statusEl = document.getElementById("status");
const dot = document.querySelector(".dot");

// YouTube UI
const ytThumb = document.getElementById("ytThumb");
const ytTitle = document.getElementById("ytTitle");
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

// ====== YOUTUBE: auto latest via RSS (no API key) ======
function xmlTextBetween(xml, startTag, endTag){
  const s = xml.indexOf(startTag);
  if(s === -1) return null;
  const e = xml.indexOf(endTag, s + startTag.length);
  if(e === -1) return null;
  return xml.slice(s + startTag.length, e).trim();
}

// Escaped XML entities minimal decode
function decodeXml(s){
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

async function loadLatestFromRss(){
  // YouTube channel feed format
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`;
  // CORS proxy
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;

  const res = await fetch(proxied, { cache: "no-store" });
  if(!res.ok) throw new Error("RSS fetch failed");
  const xml = await res.text();

  // First <entry> is newest; grab its videoId + title
  const entryStart = xml.indexOf("<entry>");
  const entryEnd = xml.indexOf("</entry>", entryStart);
  const entry = (entryStart !== -1 && entryEnd !== -1) ? xml.slice(entryStart, entryEnd) : xml;

  const videoId = xmlTextBetween(entry, "<yt:videoId>", "</yt:videoId>");
  const titleRaw = xmlTextBetween(entry, "<title>", "</title>");
  const title = titleRaw ? decodeXml(titleRaw) : null;

  if(!videoId) throw new Error("No videoId found");

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  if(ytThumb) ytThumb.src = thumbUrl;
  if(ytTitle) ytTitle.textContent = title || "Latest video";
  if(ytCard) ytCard.href = videoUrl;
}

// ====== SUBSCRIBERS (no API key) via Shields JSON ======
function compactNumberString(s){
  // Shields often returns like "2.53K" already
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
loadLatestFromRss().catch(() => {
  // If proxy ever dies, at least don't break the page
  if(ytTitle && ytTitle.textContent === "—") ytTitle.textContent = "Latest video";
});
loadSubs().catch(() => {});
