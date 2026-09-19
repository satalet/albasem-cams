// تسجيل خدمة التطبيق PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Registration failed', err));
}

// دعم زر تثبيت التطبيق
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) {
    installBtn.classList.remove('hidden');
    installBtn.classList.add('flex');
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          installBtn.classList.add('hidden');
        }
        deferredPrompt = null;
      }
    });
  }
});

let streamsData = [];
let currentFilter = 'all';
let currentCols = 2;

// تحميل بيانات الكاميرات من streams.json
async function initDashboard() {
  try {
    const res = await fetch('streams.json?v=' + Date.now());
    streamsData = await res.json();
    setupFilters();
    renderCams();
  } catch (error) {
    console.error('تعذر قراءة ملف streams.json:', error);
  }
}

// بناء أزرار الفلترة تلقائياً حسب المناطق
function setupFilters() {
  const filterBox = document.getElementById('filter-buttons');
  const areas = ['all', ...new Set(streamsData.map(s => s.area))];
  
  filterBox.innerHTML = '';
  areas.forEach(area => {
    const btn = document.createElement('button');
    btn.className = `filter-chip px-3 py-1 rounded-full border border-slate-800 text-slate-300 hover:bg-slate-800 font-medium whitespace-nowrap transition text-xs ${area === currentFilter ? 'active-btn' : 'bg-slate-900'}`;
    btn.textContent = area === 'all' ? 'جميع المناطق' : area;
    btn.onclick = () => filterByArea(area);
    filterBox.appendChild(btn);
  });
}

function filterByArea(area) {
  currentFilter = area;
  setupFilters();
  renderCams();
}

// عرض الكاميرات في الشبكة
function renderCams() {
  const grid = document.getElementById('cams-grid');
  grid.innerHTML = '';

  const filtered = currentFilter === 'all' 
    ? streamsData 
    : streamsData.filter(s => s.area === currentFilter);

  filtered.forEach(stream => {
    const card = document.createElement('div');
    card.className = 'bg-[#0f172a] border border-slate-800/90 rounded-xl overflow-hidden shadow-xl flex flex-col transition hover:border-slate-700';

    // الرأس العلوي للكارت
    const header = `
      <div class="px-3 py-2 bg-[#121c33] border-b border-slate-800/80 flex justify-between items-center text-xs">
        <div class="flex items-center gap-2 truncate">
          <span class="w-2 h-2 rounded-full ${stream.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
          <span class="font-bold text-slate-200 truncate">${stream.title}</span>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded text-[10px] border border-slate-700/50">${stream.area}</span>
          <button onclick="openModal('${stream.id}')" class="text-slate-400 hover:text-emerald-400 transition" title="تكبير الكاميرا">
            <i class="fa-solid fa-expand"></i>
          </button>
        </div>
      </div>
    `;

    // جسم الكاميرا حسب النوع
    const feedContainer = document.createElement('div');
    feedContainer.className = 'ratio-16-9 bg-black relative flex items-center justify-center overflow-hidden';

    if (stream.type === 'youtube') {
      feedContainer.innerHTML = `
        <iframe class="w-full h-full border-0" 
          src="${stream.url}?autoplay=1&mute=1&controls=1&rel=0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      `;
    } else if (stream.type === 'hls') {
      const video = document.createElement('video');
      video.className = 'w-full h-full object-cover';
      video.autoplay = true;
      video.muted = true;
      video.controls = true;
      video.playsInline = true;

      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(stream.url);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = stream.url;
      }
      feedContainer.appendChild(video);
    } else if (stream.type === 'image') {
      const img = document.createElement('img');
      img.src = stream.url + '?t=' + Date.now();
      img.className = 'w-full h-full object-cover';
      
      // تحديث الصورة كل 10 ثواني
      setInterval(() => {
        img.src = stream.url + '?t=' + Date.now();
      }, 10000);

      feedContainer.appendChild(img);
    }

    card.innerHTML = header;
    card.appendChild(feedContainer);
    grid.appendChild(card);
  });
}

// التحكم بتقسيم الشاشات
function changeLayout(cols) {
  currentCols = cols;
  const grid = document.getElementById('cams-grid');
  
  ['btn-grid-1', 'btn-grid-2', 'btn-grid-3'].forEach(id => {
    document.getElementById(id).classList.remove('active-btn');
  });
  document.getElementById(`btn-grid-${cols}`).classList.add('active-btn');

  grid.className = 'grid gap-4';
  if (cols === 1) grid.classList.add('grid-cols-1');
  if (cols === 2) grid.classList.add('grid-cols-1', 'md:grid-cols-2');
  if (cols === 3) grid.classList.add('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
}

// نافذة التكبير (Modal)
function openModal(streamId) {
  const stream = streamsData.find(s => s.id === streamId);
  if (!stream) return;

  document.getElementById('modal-title').textContent = stream.title + ' - ' + stream.area;
  const modalBox = document.getElementById('modal-content');
  modalBox.innerHTML = '';

  if (stream.type === 'youtube') {
    modalBox.innerHTML = `<iframe class="w-full h-full border-0" src="${stream.url}?autoplay=1&mute=1" allowfullscreen></iframe>`;
  } else if (stream.type === 'hls') {
    const video = document.createElement('video');
    video.className = 'w-full h-full';
    video.autoplay = true;
    video.controls = true;
    video.muted = true;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(stream.url);
      hls.attachMedia(video);
    } else {
      video.src = stream.url;
    }
    modalBox.appendChild(video);
  } else if (stream.type === 'image') {
    modalBox.innerHTML = `<img src="${stream.url}?t=${Date.now()}" class="w-full h-full object-contain">`;
  }

  document.getElementById('cam-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-content').innerHTML = '';
  document.getElementById('cam-modal').classList.add('hidden');
}

window.onload = initDashboard;
