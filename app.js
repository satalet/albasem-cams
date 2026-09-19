// Albasem Sat - Core Player & Realtime Engine
const DB_URL = "https://albasem-cams-default-rtdb.firebaseio.com/streams.json";
const streamsContainer = document.getElementById("streams-container");
const categoryTabs = document.querySelectorAll(".cat-tab");

let allStreams = {};
let activeCategory = "جميع الكاميرات";
let expandedCard = null;

// تكبير وتصغير الكاميرا مع دعم كبسة الرجوع في الجوال
function toggleFullscreenStream(card) {
  if (card.classList.contains("is-fullscreen")) {
    closeFullscreenStream(true);
  } else {
    openFullscreenStream(card);
  }
}

function openFullscreenStream(card) {
  if (expandedCard && expandedCard !== card) {
    expandedCard.classList.remove("is-fullscreen");
  }
  card.classList.add("is-fullscreen");
  expandedCard = card;
  document.body.style.overflow = "hidden";
  history.pushState({ camFullscreen: true }, "");
}

function closeFullscreenStream(fromUserAction = false) {
  if (expandedCard) {
    expandedCard.classList.remove("is-fullscreen");
    expandedCard = null;
    document.body.style.overflow = "";
    if (fromUserAction && history.state && history.state.camFullscreen) {
      history.back();
    }
  }
}

// التقاط كبسة الرجوع في الجوال لمنع خروج التطبيق وتصغير الكاميرا بدلها
window.addEventListener("popstate", () => {
  if (expandedCard) {
    closeFullscreenStream(false);
  }
});

// تهيئة البث المباشر الذكي (3 محاولات فقط لمنع استهلاك المعالج)
function initHlsPlayer(videoEl, url, wrapperEl) {
  if (Hls.isSupported()) {
    const hls = new Hls({
      manifestLoadingMaxRetry: 3,
      manifestLoadingRetryDelay: 1000,
      levelLoadingMaxRetry: 3,
      fragLoadingMaxRetry: 3,
      fragLoadingRetryDelay: 1000,
      enableWorker: true,
      lowLatencyMode: true
    });

    let retryCount = 0;

    hls.loadSource(url);
    hls.attachMedia(videoEl);

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        retryCount++;
        if (retryCount >= 3) {
          hls.destroy();
          showOfflineOverlay(wrapperEl, () => {
            removeOfflineOverlay(wrapperEl);
            initHlsPlayer(videoEl, url, wrapperEl);
          });
        } else {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            hls.destroy();
            showOfflineOverlay(wrapperEl, () => {
              removeOfflineOverlay(wrapperEl);
              initHlsPlayer(videoEl, url, wrapperEl);
            });
          }
        }
      }
    });
  } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
    videoEl.src = url;
    let appleRetry = 0;
    videoEl.onerror = () => {
      appleRetry++;
      if (appleRetry >= 3) {
        showOfflineOverlay(wrapperEl, () => {
          removeOfflineOverlay(wrapperEl);
          videoEl.load();
        });
      }
    };
  }
}

function showOfflineOverlay(wrapperEl, retryCallback) {
  if (wrapperEl.querySelector(".stream-offline-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "stream-offline-overlay";
  overlay.innerHTML = `
    <span>⚠️ البث غير متوفر حالياً (تم إيقاف المحاولة لتوفير الإنترنت)</span>
    <button class="stream-retry-btn">🔄 إعادة المحاولة</button>
  `;
  overlay.querySelector(".stream-retry-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    retryCallback();
  });
  wrapperEl.appendChild(overlay);
}

function removeOfflineOverlay(wrapperEl) {
  const overlay = wrapperEl.querySelector(".stream-offline-overlay");
  if (overlay) overlay.remove();
}

// إنشاء بطاقة الكاميرا مع دعم النقر للتكبير
function createStreamCard(id, stream) {
  const card = document.createElement("div");
  card.className = "cam-card";
  card.dataset.id = id;

  const title = stream.title || "بث مباشر";
  const area = stream.area || "عام";
  const type = stream.type || "hls";
  const url = stream.url || "";

  card.innerHTML = `
    <div class="cam-header">
      <div class="cam-actions">
        <button class="btn-expand" title="تكبير / تصغير">⛶</button>
        <button class="btn-edit admin-only" title="تعديل">✏️</button>
        <button class="btn-delete admin-only" title="حذف">🗑️</button>
      </div>
      <div class="cam-meta">
        <span class="cam-area-badge">${area}</span>
        <span class="cam-title">${title}</span>
        <span class="cam-live-dot"></span>
      </div>
    </div>
    <div class="video-wrapper"></div>
  `;

  const wrapper = card.querySelector(".video-wrapper");

  if (type === "youtube") {
    wrapper.innerHTML = `<iframe src="${url}?autoplay=1&mute=1&playsinline=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  } else if (type === "image") {
    wrapper.innerHTML = `<img src="${url}" alt="${title}" loading="lazy">`;
  } else {
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.controls = true;
    wrapper.appendChild(video);
    initHlsPlayer(video, url, wrapper);
  }

  // التكبير عند لمس الكاميرا أو زر التكبير
  card.querySelector(".btn-expand").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFullscreenStream(card);
  });

  wrapper.addEventListener("click", () => {
    toggleFullscreenStream(card);
  });

  return card;
}

// جلب البثوث المباشرة وتحديث الواجهة
async function fetchStreams() {
  try {
    const res = await fetch(`${DB_URL}?v=${Date.now()}`);
    const data = await res.json();
    allStreams = data || {};
    renderStreams();
  } catch (e) {
    console.error("Error fetching streams:", e);
  }
}

function renderStreams() {
  if (!streamsContainer) return;
  streamsContainer.innerHTML = "";
  
  Object.keys(allStreams).forEach((id) => {
    const stream = allStreams[id];
    if (activeCategory === "جميع الكاميرات" || stream.area === activeCategory) {
      const card = createStreamCard(id, stream);
      streamsContainer.appendChild(card);
    }
  });

  // تحديث أزرار الإدارة إذا كان مسجل دخول
  if (window.checkAdminStatus) window.checkAdminStatus();
}

// تصنيفات الكاميرات
categoryTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    categoryTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeCategory = tab.innerText.trim();
    renderStreams();
  });
});

fetchStreams();
setInterval(fetchStreams, 30000);
