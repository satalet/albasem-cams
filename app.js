// مراقبة التحديث التلقائي للـ Service Worker لكسر الكاش ذاتياً
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    // فحص دوري عند فتح الصفحة
    reg.update();
  }).catch(err => console.log('SW fail', err));

  // أول ما الـ Service Worker يتحدث، حدّث الصفحة فوراً على أجهزة الجميع
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

let currentUser = null;
let streamsData = [];
let currentFilter = 'all';
let currentCols = 2;

// مراقبة الدخول والخروج مع حفظ الجلسة
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

// 2. المزامنة الحية مع Firebase
function initRealtimeSync() {
  streamsRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    streamsData = Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    }));

    setupFilters();
    renderCams();
  });
}

// 3. بناء شبكة الكاميرات وأزرار التحكم المباشرة
function setupFilters() {
  const filterBox = document.getElementById('filter-buttons');
  if (!filterBox) return;
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
  if (!grid) return;
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

    // أزرار التحكم المباشرة (فقط لأبو باسم)
    const adminActions = currentUser ? `
      <div class="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-2">
        <button onclick="openEditModal('${stream.id}')" class="bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white px-2 py-0.5 rounded text-[11px] transition" title="تعديل">
          <i class="fa-solid fa-pen-to-square"></i> تعديل
        </button>
        <button onclick="deleteStream('${stream.id}', '${stream.title}')" class="bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white px-2 py-0.5 rounded text-[11px] transition" title="حذف">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    ` : '';

    const header = `
      <div class="px-3 py-2 bg-[#121c33] border-b border-slate-800/80 flex justify-between items-center text-xs">
        <div class="flex items-center gap-2 truncate">
          <span class="w-2 h-2 rounded-full ${stream.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
          <span class="font-bold text-slate-200 truncate">${stream.title}</span>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          ${adminActions}
          <span class="bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded text-[10px] border border-slate-700/50">${stream.area}</span>
          <button onclick="openModal('${stream.id}')" class="text-slate-400 hover:text-emerald-400 p-1 transition" title="تكبير الكاميرا">
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

// 4. نوافذ الإضافة والتعديل
function openAddModal() {
  document.getElementById('edit-stream-id').value = '';
  document.getElementById('edit-form').reset();
  document.getElementById('edit-modal-title').textContent = "➕ إضافة كاميرا جديدة";
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

  document.getElementById('edit-modal-title').textContent = "✏️ تعديل بيانات الكاميرا";
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
      await db.ref('streams/' + streamId).update(payload);
      alert("✓ تم حفظ التعديل بنجاح!");
    } else {
      await streamsRef.push(payload);
      alert("✓ تم إضافة الكاميرا ونشرها فوراً!");
    }
    closeEditModal();
  } catch (err) {
    alert("خطأ أثناء الحفظ: " + err.message);
  }
}

async function deleteStream(id, title) {
  if (!confirm(`هل أنت متأكد من حذف كاميرا "${title}" نهائياً من الموقع؟`)) return;
  if (!currentUser) return;

  try {
    await db.ref('streams/' + id).remove();
    alert("✓ تم حذف الكاميرا فوراً.");
  } catch (err) {
    alert("خطأ: " + err.message);
  }
}

// 5. التحكم بالشاشات والمودال
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
