let activeModalHlsInstance = null;
// مراقبة وتسجيل الـ Service Worker لكسر الكاش وتثبيت PWA
let deferredPrompt = null;
const installBtn = document.getElementById('pwa-install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.classList.remove('hidden');
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        installBtn.classList.add('hidden');
      }
      deferredPrompt = null;
    } else {
      alert("لتثبيت التطبيق على جهازك:\nاضغط على خيارات المتصفح (⋮) ثم اختر 'إضافة إلى الشاشة الرئيسية' أو 'تثبيت التطبيق'");
    }
  });
}

window.addEventListener('appinstalled', () => {
  if (installBtn) installBtn.classList.add('hidden');
  deferredPrompt = null;
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.update();
  }).catch(err => console.log('SW fail', err));

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// 1. مفاتيح فايربيس الرسمية
const firebaseConfig = {
  apiKey: "AIzaSyD4U4DFTtO8zuqIlrJp19ji1ESptfuVr9E",
  authDomain: "albasem-cams.firebaseapp.com",
  databaseURL: "https://albasem-cams-default-rtdb.firebaseio.com",
  projectId: "albasem-cams",
  storageBucket: "albasem-cams.firebasestorage.app",
  messagingSenderId: "709503450740",
  appId: "1:709503450740:web:99ef78d47f7dc4fd3f5b21",
  measurementId: "G-6T1JFJ8MZ1"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const streamsRef = db.ref('streams');
const orderRef = db.ref('streams/_config_categories');

let currentUser = null;
let streamsData = [];

// استرجاع الفولدر المحفوظ تلقائياً من الرابط أو من ذاكرة الجلسة
function getSavedCategory() {
  if (window.location.hash) {
    const fromHash = decodeURIComponent(window.location.hash.substring(1)).trim();
    if (fromHash) return fromHash;
  }
  return sessionStorage.getItem('albasem_active_cat') || 'all';
}

let currentFilter = getSavedCategory();
let currentCols = 2;
let customCategoryOrder = [];

auth.onAuthStateChanged((user) => {
  currentUser = user;
  const authBtn = document.getElementById('auth-btn');
  const authText = document.getElementById('auth-btn-text');
  const adminBar = document.getElementById('admin-bar');

  if (user) {
    if (authBtn) {
      authBtn.classList.add('bg-emerald-600', 'text-white', 'border-emerald-500');
      authBtn.classList.remove('bg-slate-800/80', 'text-slate-300', 'border-slate-700');
    }
    if (authText) authText.textContent = "أبو باسم ✓";
    if (adminBar) adminBar.classList.remove('hidden');
  } else {
    if (authBtn) {
      authBtn.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-500');
      authBtn.classList.add('bg-slate-800/80', 'text-slate-300', 'border-slate-700');
    }
    if (authText) authText.textContent = "الإدارة";
    if (adminBar) adminBar.classList.add('hidden');
  }
  renderCams();
});

function handleAuthButtonClick() {
  if (currentUser) {
    alert("أهلاً بك يا أبو باسم! أنت في وضع الإدارة حالياً، وأزرار التعديل والحذف ظاهرة فوق كل كاميرا.");
  } else {
    document.getElementById('login-modal').classList.remove('hidden');
  }
}

function closeLoginModal() {
  document.getElementById('login-modal').classList.add('hidden');
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit-btn');

  btn.disabled = true;
  btn.textContent = "جاري الدخول...";

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    closeLoginModal();
  } catch (error) {
    alert("❌ فشل تسجيل الدخول: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "تسجيل الدخول";
  }
}

async function handleAdminLogout() {
  await auth.signOut();
  alert("تم تسجيل الخروج وإخفاء أزرار التحكم.");
}

function initRealtimeSync() {
  orderRef.on('value', (snap) => {
    customCategoryOrder = snap.val() || [];
    setupFilters();
  });

  streamsRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      streamsData = [];
      setupFilters();
      renderCams();
      return;
    }

    streamsData = Object.keys(data)
      .filter(key => !key.startsWith('_') && data[key] && data[key].title)
      .map(key => ({
        ...data[key],
        id: key
      }));

    // التأكد إذا كان الفولدر المحفوظ موجود فعلياً
    const availableAreas = ['all', ...new Set(streamsData.map(s => s.area))];
    if (!availableAreas.includes(currentFilter)) {
      currentFilter = 'all';
    }

    setupFilters();
    renderCams();
  });
}

// بناء الفلاتر وترتيبها مع تظليل الفولدر النشط
function setupFilters() {
  const filterBox = document.getElementById('filter-buttons');
  if (!filterBox) return;
  
  const rawAreas = [...new Set(streamsData.map(s => s.area))];

  rawAreas.sort((a, b) => {
    let indexA = customCategoryOrder.indexOf(a);
    let indexB = customCategoryOrder.indexOf(b);
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    return indexA - indexB;
  });

  const areas = ['all', ...rawAreas];
  
  filterBox.innerHTML = '';
  areas.forEach(area => {
    const btn = document.createElement('button');
    const isActive = area === currentFilter;
    btn.className = `filter-chip px-3 py-1 rounded-full border border-slate-800 text-slate-300 hover:bg-slate-800 font-medium whitespace-nowrap transition text-xs ${isActive ? 'active-btn' : 'bg-slate-900'}`;
    btn.textContent = area === 'all' ? 'جميع الكاميرات' : area;
    btn.onclick = () => filterByArea(area);
    filterBox.appendChild(btn);
  });
}

// تثبيت مكان الزبون وتحديث رابط الصفحة لحفظ الفولدر
function filterByArea(area) {
  currentFilter = area;
  sessionStorage.setItem('albasem_active_cat', area);
  if (area === 'all') {
    history.replaceState(null, '', window.location.pathname);
  } else {
    history.replaceState(null, '', '#' + encodeURIComponent(area));
  }
  setupFilters();
  renderCams();
}

window.addEventListener('hashchange', () => {
  const fromHash = getSavedCategory();
  if (fromHash !== currentFilter) {
    currentFilter = fromHash;
    setupFilters();
    renderCams();
  }
});

let tempCategoryOrder = [];

function openCategoryOrderModal() {
  const allAreas = [...new Set(streamsData.map(s => s.area))];
  tempCategoryOrder = customCategoryOrder.filter(a => allAreas.includes(a));
  allAreas.forEach(a => {
    if (!tempCategoryOrder.includes(a)) tempCategoryOrder.push(a);
  });

  renderCategoryOrderList();
  document.getElementById('category-order-modal').classList.remove('hidden');
}

function closeCategoryOrderModal() {
  document.getElementById('category-order-modal').classList.add('hidden');
}

function renderCategoryOrderList() {
  const listEl = document.getElementById('category-order-list');
  listEl.innerHTML = '';

  tempCategoryOrder.forEach((cat, idx) => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-xs';
    item.innerHTML = `
      <span class="font-bold text-slate-200 flex items-center gap-2">
        <span class="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center text-[10px]">${idx + 1}</span>
        ${cat}
      </span>
      <div class="flex items-center gap-1">
        <button onclick="moveCategory(${idx}, -1)" class="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center justify-center transition" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''} title="تقديم">
          <i class="fa-solid fa-arrow-up text-[10px]"></i>
        </button>
        <button onclick="moveCategory(${idx}, 1)" class="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center justify-center transition" ${idx === tempCategoryOrder.length - 1 ? 'disabled style="opacity:0.3"' : ''} title="تأخير">
          <i class="fa-solid fa-arrow-down text-[10px]"></i>
        </button>
      </div>
    `;
    listEl.appendChild(item);
  });
}

function moveCategory(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= tempCategoryOrder.length) return;
  const temp = tempCategoryOrder[index];
  tempCategoryOrder[index] = tempCategoryOrder[newIndex];
  tempCategoryOrder[newIndex] = temp;
  renderCategoryOrderList();
}

async function saveCategoryOrder() {
  if (!currentUser) {
    alert("يرجى تسجيل الدخول كمسؤول أولاً!");
    return;
  }
  try {
    await orderRef.set(tempCategoryOrder);
    customCategoryOrder = [...tempCategoryOrder];
    setupFilters();
    closeCategoryOrderModal();
    alert("✓ تم حفظ ترتيب الأقسام الجديد وتطبيقه للجميع بنجاح!");
  } catch (e) {
    alert("خطأ أثناء حفظ الترتيب: " + e.message);
  }
}

function launchHlsStream(container, url, isModal = false) {
  // إذا لم يكن في وضع التكبير، نلغي أي صوت مسبق نهائياً
  if (!isModal) {
    container.querySelectorAll('video, audio').forEach(el => {
      try { el.muted = true; el.pause(); } catch(e){}
    });
  }
  container.innerHTML = '';
  
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'absolute inset-0 bg-slate-950/80 flex items-center justify-center pointer-events-none z-10 transition-opacity duration-300';
  loadingIndicator.innerHTML = `
    <div class="flex flex-col items-center gap-2">
      <span class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
      <span class="text-[10px] text-slate-400 font-medium">${isModal ? 'جاري فتح البث الحي المباشر...' : 'جاري التقاط المشهد الحي...'}</span>
    </div>
  `;
  container.appendChild(loadingIndicator);

  const video = document.createElement('video');
  video.className = isModal ? 'w-full h-full object-contain' : 'absolute inset-0 w-full h-full object-cover';
  video.autoplay = true;
  video.controls = isModal;
  video.playsInline = true;
  video.muted = isModal ? false : true;
  if (isModal) video.volume = 1.0;
  container.appendChild(video);

  let isPlaying = false;
  let hlsInstance = null;

  const showOfflineBox = () => {
    if (loadingIndicator) loadingIndicator.remove();
    if (hlsInstance) {
      try { hlsInstance.destroy(); } catch(e){}
    }
    video.pause();
    video.removeAttribute('src');
    try { video.load(); } catch(e){}

    container.innerHTML = `
      <div class="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 text-center z-20" onclick="event.stopPropagation()">
        <i class="fa-solid fa-circle-exclamation text-amber-400 text-2xl mb-1.5"></i>
        <span class="text-slate-200 text-xs font-bold mb-1">البث متوقف حالياً</span>
        <span class="text-slate-400 text-[10px] mb-3">تم إيقاف المحاولات لتوفير الإنترنت والبطارية</span>
        <button class="retry-single-btn bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] font-bold px-4 py-1.5 rounded-lg transition shadow-lg flex items-center gap-1.5">
          <i class="fa-solid fa-rotate-right"></i> تشغيل يدوي
        </button>
      </div>
    `;

    const retryBtn = container.querySelector('.retry-single-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        launchHlsStream(container, url, isModal);
      });
    }
  };

  const safetyTimer = setTimeout(() => {
    if (!isPlaying && (video.currentTime === 0 || video.paused || video.readyState < 2)) {
      showOfflineBox();
    }
  }, 14000);

  const onStreamReady = () => {
    if (isPlaying) return;
    isPlaying = true;
    clearTimeout(safetyTimer);
    if (loadingIndicator) loadingIndicator.remove();

    if (!isModal) {
      setTimeout(() => {
        if (!video.paused) {
          video.pause();
        }
      }, 800);
    }
  };

  video.addEventListener('playing', onStreamReady);
  video.addEventListener('timeupdate', () => {
    if (video.currentTime > 0.2) onStreamReady();
  });

  if (Hls.isSupported()) {
    const hls = new Hls(isModal ? {} : { maxBufferLength: 1, maxMaxBufferLength: 2 }, {
      manifestLoadingMaxRetry: 3,
      manifestLoadingRetryDelay: 1500,
      levelLoadingMaxRetry: 3,
      fragLoadingMaxRetry: 3,
      fragLoadingRetryDelay: 1500,
      enableWorker: true,
      lowLatencyMode: true
    });
    hlsInstance = hls;

    let retryCount = 0;
    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        retryCount++;
        if (retryCount >= 3) {
          clearTimeout(safetyTimer);
          showOfflineBox();
        } else {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            clearTimeout(safetyTimer);
            showOfflineBox();
          }
        }
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.onerror = () => {
      clearTimeout(safetyTimer);
      showOfflineBox();
    };
  }

  if (isModal) {
    const p = video.play();
    if (p !== undefined) {
      p.catch(() => {
        video.muted = true;
        video.play();
      });
    }
  }
}

function renderCams() {
  const grid = document.getElementById('cams-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = currentFilter === 'all' 
    ? streamsData 
    : streamsData.filter(s => s.area === currentFilter);

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-16 text-center text-slate-500 text-xs">لا توجد قنوات معروضة حالياً في هذا القسم.</div>`;
    return;
  }

  filtered.forEach(stream => {
    const card = document.createElement('div');
    card.className = 'bg-[#0f172a] border border-slate-800/90 rounded-xl overflow-hidden shadow-xl flex flex-col transition hover:border-slate-700';

    const adminActions = currentUser ? `
      <div class="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-2" onclick="event.stopPropagation()">
        <button onclick="openEditModal('${stream.id}')" class="bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white px-2 py-0.5 rounded text-[11px] transition" title="تعديل">
          <i class="fa-solid fa-pen-to-square"></i> تعديل
        </button>
        <button onclick="deleteStream('${stream.id}', '${stream.title}')" class="bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white px-2 py-0.5 rounded text-[11px] transition" title="حذف">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    ` : '';

    const header = `
      <div onclick="openModal('${stream.id}')" class="px-3 py-2 bg-[#121c33] border-b border-slate-800/80 flex justify-between items-center text-xs cursor-pointer hover:bg-slate-800/60 transition select-none">
        <div class="flex items-center gap-2 truncate">
          <span class="w-2 h-2 rounded-full ${stream.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
          <span class="font-bold text-slate-200 truncate hover:text-emerald-400 transition">${stream.title}</span>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          ${adminActions}
          <span class="bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded text-[10px] border border-slate-700/50">${stream.area}</span>
          <button onclick="event.stopPropagation(); openModal('${stream.id}')" class="text-slate-400 hover:text-emerald-400 p-1 transition" title="تكبير وتشغيل البث">
            <i class="fa-solid fa-play text-[10px] ml-1"></i> <i class="fa-solid fa-expand"></i>
          </button>
        </div>
      </div>
    `;

    const feedContainer = document.createElement('div');
    feedContainer.className = 'w-full aspect-video bg-black relative flex items-center justify-center overflow-hidden cursor-pointer group';
    feedContainer.onclick = () => openModal(stream.id);

    if (stream.type === 'youtube') {
      let ytUrl = stream.url;
      let vidId = '';
      const idMatch = ytUrl.match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/);
      if (idMatch) vidId = idMatch[1];

      const thumbUrl = vidId 
        ? `https://img.youtube.com/vi/${vidId}/hqdefault.jpg` 
        : './icons/icon-ios.png';

      feedContainer.innerHTML = `
        <img src="${thumbUrl}" alt="${stream.title}" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500">
        <div class="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition flex items-center justify-center">
          <div class="w-12 h-12 rounded-full bg-emerald-600/90 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition">
            <i class="fa-solid fa-play text-lg ml-0.5"></i>
          </div>
        </div>
        <div class="absolute bottom-2 right-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span> يوتيوب مباشر
        </div>
      `;
    } else if (stream.type === 'hls') {
      launchHlsStream(feedContainer, stream.url, false);
    } else if (stream.type === 'image') {
      const img = document.createElement('img');
      img.src = stream.url + '?t=' + Date.now();
      img.className = 'absolute inset-0 w-full h-full object-cover';
      feedContainer.appendChild(img);
    }

    card.innerHTML = header;
    card.appendChild(feedContainer);
    grid.appendChild(card);
  });
}

function openAddModal() {
  document.getElementById('edit-stream-id').value = '';
  document.getElementById('edit-form').reset();
  document.getElementById('edit-modal-title').textContent = "➕ إضافة بث جديد";
  document.getElementById('edit-save-btn').textContent = "حفظ ونشر فوراً";
  document.getElementById('edit-modal').classList.remove('hidden');
}

function openEditModal(id) {
  const stream = streamsData.find(s => s.id === id);
  if (!stream) return;

  document.getElementById('edit-stream-id').value = stream.id;
  document.getElementById('edit-title').value = stream.title;
  document.getElementById('edit-area').value = stream.area;
  document.getElementById('edit-type').value = stream.type;
  document.getElementById('edit-url').value = stream.url;

  document.getElementById('edit-modal-title').textContent = "✏️ تعديل بيانات القناة";
  document.getElementById('edit-save-btn').textContent = "حفظ التعديلات";
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

async function handleSaveStream(e) {
  e.preventDefault();
  if (!currentUser) return;

  const streamId = document.getElementById('edit-stream-id').value;
  const payload = {
    title: document.getElementById('edit-title').value.trim(),
    area: document.getElementById('edit-area').value.trim(),
    type: document.getElementById('edit-type').value,
    url: document.getElementById('edit-url').value.trim(),
    category: 'سير',
    status: 'active'
  };

  try {
    if (streamId) {
      await db.ref('streams/' + streamId).set(payload);
      alert("✓ تم حفظ التعديل بنجاح!");
    } else {
      await streamsRef.push(payload);
      alert("✓ تم إضافة البث ونشره فوراً!");
    }
    closeEditModal();
  } catch (err) {
    alert("خطأ أثناء الحفظ: " + err.message);
  }
}

async function deleteStream(id, title) {
  if (!confirm(`هل أنت متأكد من حذف بث "${title}" نهائياً من الموقع؟`)) return;
  if (!currentUser) {
    alert("⚠️ يجب تسجيل الدخول كمسؤول أولاً!");
    return;
  }

  try {
    await db.ref('streams/' + id).remove();
    alert("✓ تم حذف البث من السيرفر بنجاح!");
  } catch (err) {
    alert("خطأ أثناء الحذف: " + err.message);
  }
}

function changeLayout(cols) {
  currentCols = cols;
  const grid = document.getElementById('cams-grid');
  if (!grid) return;
  ['btn-grid-1', 'btn-grid-2', 'btn-grid-3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active-btn');
  });
  const activeBtn = document.getElementById(`btn-grid-${cols}`);
  if (activeBtn) activeBtn.classList.add('active-btn');

  grid.className = 'grid gap-4';
  if (cols === 1) grid.classList.add('grid-cols-1');
  if (cols === 2) grid.classList.add('grid-cols-1', 'md:grid-cols-2');
  if (cols === 3) grid.classList.add('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
}

function openModal(streamId) {
  const stream = streamsData.find(s => s.id === streamId);
  if (!stream) return;
  document.getElementById('modal-title').textContent = stream.title + ' - ' + stream.area;
  const modalBox = document.getElementById('modal-content');
  modalBox.innerHTML = '';

  if (stream.type === 'youtube') {
    let ytUrl = stream.url;
    if (!ytUrl.includes('/embed/')) {
      const idMatch = ytUrl.match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/);
      if (idMatch) ytUrl = `https://www.youtube-nocookie.com/embed/${idMatch[1]}`;
    }
    modalBox.innerHTML = `<iframe class="w-full h-full border-0" src="${ytUrl}?autoplay=1&mute=0&controls=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  } else if (stream.type === 'hls') {
    const vid = launchHlsStream(modalBox, stream.url, true);
    if (window.Hls && Hls.isSupported() && vid && vid._hls) {
      activeModalHlsInstance = vid._hls;
    }
  } else if (stream.type === 'image') {
    modalBox.innerHTML = `<img src="${stream.url}?t=${Date.now()}" class="w-full h-full object-contain">`;
  }

  document.getElementById('cam-modal').classList.remove('hidden');
  history.pushState({ modalOpen: true }, "");
}

function closeModal(fromHistory = false) {
  const modal = document.getElementById('cam-modal');
  if (modal && !modal.classList.contains('hidden')) {
    // 1. تدمير مشغل HLS النشط بالكامل من الذاكرة
    if (activeModalHlsInstance) {
      try {
        activeModalHlsInstance.stopLoad();
        activeModalHlsInstance.detachMedia();
        activeModalHlsInstance.destroy();
      } catch(e){}
      activeModalHlsInstance = null;
    }

    // 2. كتم وإيقاف وتفريغ أي عنصر فيديو داخل المودال
    const videos = modal.querySelectorAll('video');
    videos.forEach(v => {
      try {
        v.muted = true;
        v.pause();
        if (v._hls) {
          try { v._hls.destroy(); } catch(e){}
        }
        v.removeAttribute('src');
        v.load();
      } catch(e){}
    });

    // 3. مسح وتفريغ أي iframe أو مشغل تماماً
    const modalBox = document.getElementById('modal-content');
    if (modalBox) modalBox.innerHTML = '';

    modal.classList.add('hidden');

    if (!fromHistory && history.state && history.state.modalOpen) {
      history.back();
    }
  }
}

window.addEventListener('popstate', () => {
  closeModal(true);
});

window.onload = initRealtimeSync;
