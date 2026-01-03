// ====== CONFIG ======
const TUMBLR_RSS_URLS = [
  "https://takuyakitano.tumblr.com/rss",
  "https://www.tumblr.com/blog/takuyakitano/rss"
];

// ====== BPM (light, just vibes) ======
const bpmEl = document.getElementById("bpm");

// Nice calm BPM drift
let base = 70;
let drift = 0;

function tickBpm(){
  if(!bpmEl) return;

  drift += (Math.random() - 0.5) * 0.35;
  drift = Math.max(-8, Math.min(10, drift));

  const noise = (Math.random() - 0.5) * 1.2;
  const bpm = Math.round(Math.max(58, Math.min(132, base + drift + noise)));

  bpmEl.textContent = bpm;
}

// ====== FEED helpers ======
const feedEl = document.getElementById("tumblrFeed");

async function fetchRaw(url){
  // Try direct first
  try{
    const r = await fetch(url, { cache: "no-store" });
    if(r.ok) return await r.text();
  }catch{}
  // Proxy fallback (CORS)
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const r2 = await fetch(proxied, { cache: "no-store" });
  if(!r2.ok) throw new Error("fetch failed");
  return await r2.text();
}

function textFromHtml(html){
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const t = (doc.body?.textContent || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

function imagesFromHtml(html){
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const imgs = Array.from(doc.images || [])
    .map(img => img.getAttribute("src"))
    .filter(Boolean);
  // De-dupe
  return Array.from(new Set(imgs));
}

function formatDate(pubDate){
  if(!pubDate) return "";
  const d = new Date(pubDate);
  if(Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function renderPosts(posts){
  if(!feedEl) return;

  feedEl.innerHTML = "";

  posts.forEach(p => {
    const a = document.createElement("a");
    a.className = "post";
    a.href = p.link || "#";
    a.target = "_blank";
    a.rel = "noreferrer";

    const meta = document.createElement("div");
    meta.className = "postMeta";

    const left = document.createElement("div");
    left.className = "postTitle";
    left.textContent = p.title || "post";

    const right = document.createElement("div");
    right.className = "postDate";
    right.textContent = p.date || "";

    meta.append(left, right);

    const body = document.createElement("div");
    body.className = "postBody";

    if(p.text){
      const t = document.createElement("div");
      t.className = "postText";
      t.textContent = p.text;
      body.appendChild(t);
    }

    if(p.images && p.images.length){
      const imgs = document.createElement("div");
      imgs.className = "postImages" + (p.images.length >= 2 ? " twoCol" : "");
      p.images.slice(0, 4).forEach(src => {
        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.alt = p.title || "Tumblr image";
        img.src = src;
        imgs.appendChild(img);
      });
      body.appendChild(imgs);
    }

    a.append(meta, body);
    feedEl.appendChild(a);
  });

  if(!posts.length){
    feedEl.textContent = "No posts yet.";
  }
}

async function loadTumblrFeed(){
  if(!feedEl) return;

  feedEl.textContent = "Loading…";

  let xml = "";
  let lastErr = null;

  for(const url of TUMBLR_RSS_URLS){
    try{
      xml = await fetchRaw(url);
      if(xml) break;
    }catch(e){
      lastErr = e;
    }
  }

  if(!xml){
    feedEl.textContent = "Unable to load Tumblr feed.";
    return;
  }

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const items = Array.from(doc.querySelectorAll("item")).slice(0, 12);

  const posts = items.map(item => {
    const title = item.querySelector("title")?.textContent?.trim() || "";
    const link = item.querySelector("link")?.textContent?.trim() || "";
    const pubDate = item.querySelector("pubDate")?.textContent?.trim() || "";
    const desc = item.querySelector("description")?.textContent || "";

    const images = imagesFromHtml(desc);
    const text = textFromHtml(desc);

    // Keep it readable: if it’s only an image post, don’t force text.
    const trimmedText = text.length > 400 ? (text.slice(0, 400) + "…") : text;

    return {
      title: title || "post",
      link,
      date: formatDate(pubDate),
      text: images.length && !trimmedText ? "" : trimmedText,
      images
    };
  });

  renderPosts(posts);
}

// ====== INIT ======
tickBpm();
setInterval(tickBpm, 900);

loadTumblrFeed().catch(() => {
  if(feedEl) feedEl.textContent = "Unable to load Tumblr feed.";
});
