// ====== CONFIG (SET THESE) ======
const YT_CHANNEL_ID = "UCuDJUj1szS87hLRjXQKnmaA";
const YT_LATEST_VIDEO_URL = "https://www.youtube.com/watch?v=YOUR_VIDEO_ID";
const YT_CHANNEL_NAME_FALLBACK = "TAKUYA";

// ====== EXISTING HUD ======
const bpmEl = document.getElementById("bpm");
const clockEl = document.getElementById("clock");
const tzEl = document.getElementById("tz");
const statusEl = document.getElementById("status");
const dot = document.querySelector(".dot");

// (sparkline might not exist now — safe-guard it)
const bars = Array.from(document.querySelectorAll(".sparkline span"));

function pad(n){ return String(n).padStart(2, "0"); }

function updateClock(){
  if(!clockEl) return;
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes();
  clockEl.textContent = `${pad(h)}:${pad(m)}`;
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

  // if sparkline exists, animate it
  if(bars.length){
    bars.forEach((b) => {
      const v = Math.max(0.25, Math.min(1.1, (bpm - 55) / 70 + (Math.random() - 0.5) * 0.35));
      const h = 6 + Math.round(v * 12);
      b.style.height = `${h}px`;
      b.style.opacity = `${0.45 + v * 0.35}`;
    });
  }

  // pulse online dot slightly with bpm
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

// ====== YOUTUBE (thumbnail + title via oEmbed, subs via Shields JSON) ======
const ytThumb = document.getElementById("ytThumb");
const ytTitle = document.getElementById("ytTitle");
const ytSubs = document.getElementById("ytSubs");
const ytChannelName = document.getElementById("ytChannelName");
const ytCard = document.getElementById("ytCard");

function compactNumberString(s){
  // Shields often returns like "2.53K" already. If it's "2530", compact it.
  const n = Number(String(s).replace(/[^\d.]/g, ""));
  if(!Number.isFinite(n)) return String(s);
  if(n >= 1e6) return `${(n/1e6).toFixed(2).replace(/\.00$/,'')}M`;
  if(n >= 1e3) return `${(n/1e3).toFixed(2).replace(/\.00$/,'')}K`;
  return String(n);
}

async function loadYouTube(){
  if(ytChannelName) ytChannelName.textContent = YT_CHANNEL_NAME_FALLBACK;

  // 1) Thumbnail + title from oEmbed
  try{
    if(YT_LATEST_VIDEO_URL && ytThumb && ytTitle){
      const oembed = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(YT_LATEST_VIDEO_URL)}`;
      const res = await fetch(oembed);
      if(res.ok){
        const data = await res.json();
        if(data?.thumbnail_url) ytThumb.src = data.thumbnail_url;
        if(data?.title) ytTitle.textContent = data.title;
        if(data?.author_name && ytChannelName) ytChannelName.textContent = data.author_name;
      }
      // Make tile click go to the latest video (feels like Bento)
      if(ytCard) ytCard.href = YT_LATEST_VIDEO_URL;
    }
  }catch(e){
    // ignore
  }

  // 2) Subscriber count from shields JSON (no API key)
  try{
    if(YT_CHANNEL_ID && ytSubs){
      const url = `https://img.shields.io/youtube/channel/subscribers/${YT_CHANNEL_ID}.json`;
      const res = await fetch(url);
      if(res.ok){
        const data = await res.json();
        const v = data?.value || data?.message || "—";
        ytSubs.textContent = compactNumberString(v);
      }
    }
  }catch(e){
    // ignore
  }
}

// ====== INIT ======
const yearEl = document.getElementById("year");
if(yearEl) yearEl.textContent = new Date().getFullYear();

updateClock();
updateOnline();
tickBpm();
loadYouTube();

setInterval(updateClock, 1000 * 10);
setInterval(tickBpm, 850);

window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);
window.addEventListener("scroll", () => tickBpm());
