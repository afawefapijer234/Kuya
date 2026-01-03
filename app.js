// Minimal “futuristic HUD” behavior:
// - BPM gently fluctuates (base + noise)
// - sparkline animates
// - online/offline indicator
// - clock updates

const bpmEl = document.getElementById("bpm");
const clockEl = document.getElementById("clock");
const tzEl = document.getElementById("tz");
const statusEl = document.getElementById("status");
const dot = document.querySelector(".dot");
const bars = Array.from(document.querySelectorAll(".sparkline span"));

function pad(n){ return String(n).padStart(2, "0"); }

function updateClock(){
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes();
  clockEl.textContent = `${pad(h)}:${pad(m)}`;
  try{
    tzEl.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  }catch{
    tzEl.textContent = "local";
  }
}

// BPM: pick a nice “resting” base and add drift.
// Add a tiny scroll influence so it feels alive.
let base = 72;
let drift = 0;
let bpm = base;

function tickBpm(){
  // drift slowly wanders
  drift += (Math.random() - 0.5) * 0.6;
  drift = Math.max(-10, Math.min(14, drift));

  // small noise
  const noise = (Math.random() - 0.5) * 2.4;

  // scroll influence (0..8ish)
  const scroll = Math.min(8, (window.scrollY / 120));

  bpm = Math.round(base + drift + noise + scroll);

  // clamp for taste
  bpm = Math.max(58, Math.min(132, bpm));

  bpmEl.textContent = bpm;

  // sparkline bars
  bars.forEach((b, i) => {
    const v = Math.max(0.25, Math.min(1.1, (bpm - 55) / 70 + (Math.random() - 0.5) * 0.35));
    const h = 6 + Math.round(v * 12);
    b.style.height = `${h}px`;
    b.style.opacity = `${0.45 + v * 0.35}`;
  });

  // subtle pulse on dot (feels “heartbeat”)
  const pulse = 0.9 + (bpm - 60) / 200;
  dot.style.transform = `scale(${pulse})`;
}

function updateOnline(){
  const on = navigator.onLine;
  statusEl.textContent = on ? "online" : "offline";
  dot.style.background = on ? "rgba(80,255,210,.75)" : "rgba(255,120,120,.75)";
  dot.style.boxShadow = on ? "0 0 18px rgba(80,255,210,.6)" : "0 0 18px rgba(255,120,120,.55)";
}

// init
document.getElementById("year").textContent = new Date().getFullYear();
updateClock();
updateOnline();
tickBpm();

// loops
setInterval(updateClock, 1000 * 10);
setInterval(tickBpm, 850);

// events
window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);
window.addEventListener("scroll", () => {
  // slight immediate response
  tickBpm();
});
