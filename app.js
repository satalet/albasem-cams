if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW fail', err));
}

// ==========================================
// 1. إعدادات FIREBASE الرسمية الخاصة بالباسم سات
// ==========================================
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
const streamsRef = db.ref('streams');

// ==========================================
// 2. تشفير وأمان لوحة التحكم (SHA-256)
// كلمة المرور الافتراضية: 123456
// ==========================================
const ADMIN_PASSWORD_HASH = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";
let isAdminAuthenticated = false;

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.prototype.map.call(new Uint8Array(buf), x => ('00' + x.toString(16)).slice(-2)).join('');
}

async function promptAdminLogin() {
  if (isAdminAuthenticated) {
    openAdminModal();
    return;
  }
  const pass = prompt("🔐 أدخل كلمة مرور لوحة تحكم الباسم سات:");
  if (!pass) return;

  const hashed = await sha256(pass);
  if (hashed === ADMIN_PASSWORD_HASH) {
    isAdminAuthenticated = true;
    alert("أهلاً بك يا أبو باسم في لوحة التحكم!");
    openAdminModal();
  } else {
    alert("❌ رمز الدخول غير صحيح!");
  }
}

// ==========================================
// 3. المزامنة المباشرة مع Realtime Database
// ==========================================
let streamsData = [];
let currentFilter = 'all';
let currentCols = 2;

function initRealtimeSync() {
  streamsRef.on('value', async (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      console.log("[*] قاعدة البيانات فارغة، جاري استيراد الكاميرات من streams.json...");
      await migrateLocalStreams();
      return;
    }

    streamsData = Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    }));

    setupFilters();
    renderCams();
    if (isAdminAuthenticated) renderAdminList();
  });
}

// استيراد أولي تلقائي من streams.json لأول مرة
async function migrateLocalStreams() {
  try {
    const res = await fetch('streams.json?v=' + Date.now());
    const local = await res.json();
    for (const item of local) {
      await streamsRef.push(item);
    }
  } catch (e) {
    console.error("Migration error:", e);
  }
}

// ==========================================
// 4. بناء الواجهة وشبكة الكاميرات
// ==========================================
function setupFilters() {
  const filterBox = document.getElementById('filter-buttons');
  const areas = ['all', ...new Set(streamsData.map(s => s.area))];
  
  filterBox.innerHTML = '';
  areas.forEach(area => {
    const btn = document.createElement('button');
    btn.className = `filter-chip px-3 py-1 rounded-full border border-slate-800 text-slate-300 hover:bg-slate-800 font-medium whitespace-nowrap transition text-xs ${area === currentFilter ? 'active-btn' : 'bg-slate-900'}`;
    btn.textContent = area === 'all' ? 'جميع الكاميرات' : area;
    btn.onclick = () => filterByArea(area);
    filterBox.appendChild(btn);
  });
}

function filterByArea(area) {
  currentFilter = area;
  setupFilters();
  renderCams();
}

function renderCams() {
  const grid = document.getElementById('cams-grid');
  grid.innerHTML = '';

  const filtered = currentFilter === 'all' 
    ? streamsData 
    : streamsData.filter(s => s.area === currentFilter);

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 text-xs">لا توجد كاميرات في هذا القسم حالياً.</div>`;
    return;
  }

  filtered.forEach(stream => {
    const card = document.createElement('div');
    card.className = 'bg-[#0f172a] border border-slate-800/90 rounded-xl overflow-hidden shadow-xl flex flex-col transition hover:border-slate-700';

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

    const feedContainer = document.createElement('div');
    feedContainer.className = 'ratio-16-9 bg-black relative flex items-center justify-center overflow-hidden';

    if (stream.type === 'youtube') {
      let ytUrl = stream.url;
      if (!ytUrl.includes('/embed/')) {
        const idMatch = ytUrl.match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/);
        if (idMatch) ytUrl = `https://www.youtube-nocookie.com/embed/${idMatch[1]}`;
      }
      feedContainer.innerHTML = `
        <iframe class="w-full h-full border-0" 
          src="${ytUrl}?autoplay=1&mute=1&controls=1&rel=0" 
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
      setInterval(() => { img.src = stream.url + '?t=' + Date.now(); }, 10000);
      feedContainer.appendChild(img);
    }

    card.innerHTML = header;
    card.appendChild(feedContainer);
    grid.appendChild(card);
  });
}

// ==========================================
// 5. إدارة الكاميرات (إضافة، تعديل، حذف)
// ==========================================
function openAdminModal() {
  document.getElementById('admin-modal').classList.remove('hidden');
  renderAdminList();
}

function closeAdminModal() {
  document.getElementById('admin-modal').classList.add('hidden');
  resetForm();
}

function renderAdminList() {
  const container = document.getElementById('admin-cams-list');
  container.innerHTML = '';

  streamsData.forEach(stream => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between p-2.5 bg-[#0a0e17] border border-slate-800 rounded-lg text-xs';
    item.innerHTML = `
      <div class="truncate mr-2">
        <div class="font-bold text-white truncate">${stream.title}</div>
        <div class="text-[10px] text-slate-400 font-mono truncate">${stream.area} • [${stream.type}]</div>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <button onclick="editStream('${stream.id}')" class="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2 py-1 rounded transition text-[11px]">
          تعديل
        </button>
        <button onclick="deleteStream('${stream.id}')" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-2 py-1 rounded transition text-[11px]">
          حذف
        </button>
      </div>
    `;
    container.appendChild(item);
  });
}

async function handleSaveStream(e) {
  e.preventDefault();
  const streamId = document.getElementById('form-stream-id').value;
  const payload = {
    title: document.getElementById('cam-title-input').value.trim(),
    area: document.getElementById('cam-area-input').value.trim(),
    type: document.getElementById('cam-type-input').value,
    category: document.getElementById('cam-cat-input').value.trim() || 'سير',
    url: document.getElementById('cam-url-input').value.trim(),
    status: 'active'
  };

  try {
    if (streamId) {
      await db.ref('streams/' + streamId).update(payload);
      alert("✓ تم حفظ تعديل الكاميرا بنجاح!");
    } else {
      await streamsRef.push(payload);
      alert("✓ تم إضافة الكاميرا ونشرها فوراً على أجهزة الجميع!");
    }
    resetForm();
  } catch (err) {
    alert("خطأ أثناء الحفظ في Firebase: " + err.message);
  }
}

function editStream(id) {
  const stream = streamsData.find(s => s.id === id);
  if (!stream) return;

  document.getElementById('form-stream-id').value = stream.id;
  document.getElementById('cam-title-input').value = stream.title;
  document.getElementById('cam-area-input').value = stream.area;
  document.getElementById('cam-type-input').value = stream.type;
  document.getElementById('cam-cat-input').value = stream.category || 'سير';
  document.getElementById('cam-url-input').value = stream.url;

  document.getElementById('form-title').textContent = "✏️ تعديل الكاميرا";
  document.getElementById('form-submit-btn').textContent = "حفظ التعديلات";
  document.getElementById('form-cancel-btn').classList.remove('hidden');
}

function resetForm() {
  document.getElementById('form-stream-id').value = '';
  document.getElementById('cam-form').reset();
  document.getElementById('form-title').textContent = "➕ إضافة كاميرا جديدة";
  document.getElementById('form-submit-btn').textContent = "حفظ ونشر فوراً";
  document.getElementById('form-cancel-btn').classList.add('hidden');
}

async function deleteStream(id) {
  if (!confirm("هل أنت متأكد من حذف هذه الكاميرا نهائياً؟")) return;
  try {
    await db.ref('streams/' + id).remove();
    alert("✓ تم حذف الكاميرا فوراً.");
  } catch (err) {
    alert("خطأ أثناء الحذف: " + err.message);
  }
}

// ==========================================
// 6. التحكم بالشاشات والمودال
// ==========================================
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
    modalBox.innerHTML = `<iframe class="w-full h-full border-0" src="${ytUrl}?autoplay=1&mute=1" allowfullscreen></iframe>`;
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

window.onload = initRealtimeSync;
