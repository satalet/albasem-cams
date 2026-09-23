// كتم جميع شاشات الشبكة بشكل قاطع
function muteAllGridVideos() {
  document.querySelectorAll('#cams-grid video, #cams-grid audio').forEach(v => {
    try {
      v.muted = true;
      v.volume = 0;
      v.setAttribute('muted', '');
    } catch(e){}
  });
}
window.muteAllGridVideos = muteAllGridVideos;


// --- إدارة المفضلة وتثبيت الرفرش محلياً ---
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem('albasem_user_favs') || '[]');
  } catch(e) { return []; }
}

function toggleFavorite(id, e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  let favs = getFavorites();
  const strId = String(id);
  const exists = favs.includes(strId);
  if (exists) {
    favs = favs.filter(x => x !== strId);
  } else {
    favs.push(strId);
  }
  localStorage.setItem('albasem_user_favs', JSON.stringify(favs));

  if (currentFilter === 'FAVORITES') {
    renderCams();
  } else {
    document.querySelectorAll(`.fav-btn-${strId}`).forEach(btn => {
      const isNowFav = !exists;
      btn.innerHTML = `<i class="${isNowFav ? 'fa-solid text-amber-400' : 'fa-regular text-slate-400'} fa-star"></i>`;
      btn.title = isNowFav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة';
    });
  }
}


// قراءة وتثبيت الحالة عند فتح أو رفرش الصفحة
function getSavedNavigationState() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (hash) {
    const parts = hash.split('/');
    return { area: parts[0] || '', sub: parts[1] || 'all' };
  }
  const savedArea = localStorage.getItem('albasem_active_cat') || '';
  const savedSub = localStorage.getItem('albasem_active_sub') || 'all';
  return { area: savedArea, sub: savedSub };
}

function updateNavigationHistory(area, sub = 'all', push = true) {
  const hashStr = sub && sub !== 'all' ? `#${encodeURIComponent(area)}/${encodeURIComponent(sub)}` : `#${encodeURIComponent(area)}`;
  localStorage.setItem('albasem_active_cat', area);
  localStorage.setItem('albasem_active_sub', sub);

  if (push) {
    history.pushState({ area: area, sub: sub }, '', hashStr);
  } else {
    history.replaceState({ area: area, sub: sub }, '', hashStr);
  }
}


// ==================== محرك الفرز والترحيل المباشر من الشاشة ====================
window.isBulkSortActive = false;

window.toggleBulkSortMode = function() {
    window.isBulkSortActive = !window.isBulkSortActive;
    const bar = document.getElementById('bulkActionBar');
    if (bar) {
        if (window.isBulkSortActive) bar.classList.remove('hidden');
        else bar.classList.add('hidden');
    }
    document.querySelectorAll('.bulk-chk-label').forEach(el => {
        if (window.isBulkSortActive) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
    populateTargetAreas();
    window.updateBulkSelectedCount();
};

function populateTargetAreas() {
    const sel = document.getElementById('bulkTargetArea');
    if (!sel) return;
    let list = [];
    document.querySelectorAll('#filter-buttons button').forEach(b => {
        const t = b.textContent.trim();
        if (t && t !== 'جميع الكاميرات' && !list.includes(t)) list.push(t);
    });
    if (typeof streamsData !== 'undefined' && Array.isArray(streamsData)) {
        streamsData.forEach(s => {
            if (s.area && !list.includes(s.area)) list.push(s.area);
        });
    }
    const cur = typeof currentFilter !== 'undefined' ? currentFilter : 'عام';
    const valid = list.filter(c => c !== cur);
    sel.innerHTML = valid.map(c => `<option value="${c}">${c}</option>`).join('');
    if (valid.length === 0) sel.innerHTML = '<option value="">(لا يوجد أقسام أخرى)</option>';
}

// دالة جلب المعرّفات المحددة فعلياً من الشاشة بدون تخزين وسيط
function getActiveSelectedIds() {
    const checkboxes = document.querySelectorAll('.bulk-stream-chk:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

window.updateBulkSelectedCount = function() {
    const ids = getActiveSelectedIds();
    const countLbl = document.getElementById('bulkSelectedCount');
    if (countLbl) countLbl.innerText = ids.length;
};

window.selectAllBulk = function(select) {
    document.querySelectorAll('.bulk-stream-chk').forEach(cb => {
        cb.checked = select;
    });
    window.updateBulkSelectedCount();
};

// تنفيذ الترحيل الجماعي بقراءة الـ DOM المباشرة
window.executeBulkMove = async function() {
    const selectedIds = getActiveSelectedIds();
    if (selectedIds.length === 0) return alert('⚠️ يرجى تحديد قناة واحدة على الأقل بالضغط على المربع الأخضر!');
    const target = document.getElementById('bulkTargetArea').value;
    if (!target) return alert('⚠️ يرجى اختيار القسم المستهدف أولاً!');

    if (!confirm(`هل أنت متأكد من ترحيل (${selectedIds.length}) قنوات إلى قسم [${target}]؟`)) return;

    try {
        const updates = {};
        selectedIds.forEach(id => {
            updates[`streams/${id}/area`] = target;
        });
        await db.ref().update(updates);
        alert(`✅ تم بنجاح ترحيل ${selectedIds.length} قناة إلى قسم [${target}]!`);
        window.selectAllBulk(false);
    } catch(err) {
        alert('خطأ أثناء الترحيل: ' + err.message);
    }
};

// تنفيذ الحذف الجماعي بقراءة الـ DOM المباشرة
window.executeBulkDelete = async function() {
    const selectedIds = getActiveSelectedIds();
    if (selectedIds.length === 0) return alert('⚠️ يرجى تحديد القنوات المراد حذفها أولاً!');
    if (!confirm(`⚠️ تحذير: هل أنت متأكد من حذف (${selectedIds.length}) قنوات نهائياً من الموقع؟`)) return;

    try {
        const updates = {};
        selectedIds.forEach(id => {
            updates[`streams/${id}`] = null;
        });
        await db.ref().update(updates);
        alert(`🗑️ تم بنجاح حذف ${selectedIds.length} قناة من السيرفر!`);
        window.selectAllBulk(false);
    } catch(err) {
        alert('خطأ أثناء الحذف: ' + err.message);
    }
};

window.addNewCategoryDirect = async function() {
    const catName = prompt('أدخل اسم القسم الجديد (مثلاً: أطفال، مسلسلات، رياضة):');
    if (!catName || !catName.trim()) return;
    const cleanName = catName.trim();

    try {
        const snap = await db.ref('categories').once('value');
        let cats = snap.val() || [];
        if (!Array.isArray(cats)) cats = Object.values(cats);
        if (cats.includes(cleanName)) return alert('⚠️ هذا القسم موجود بالفعل!');

        cats.push(cleanName);
        await db.ref('categories').set(cats);
        alert(`✅ تم إنشاء قسم [${cleanName}] بنجاح وهو فارغ الآن ومتاح للترحيل!`);
        location.reload();
    } catch(e) {
        alert('حدث خطأ: ' + e.message);
    }
};





// الاستماع اللحظي لرقم الفيرجن عبر الفايربيس لتخطي كاش CDN
if (window.firebaseDb) {
    let localVersion = localStorage.getItem('albasem_cached_ver');
    window.firebaseDb.ref('app_version').on('value', snap => {
        const data = snap.val();
        if (data && data.version) {
            if (!localVersion) {
                localStorage.setItem('albasem_cached_ver', data.version);
            } else if (localVersion !== data.version) {
                console.log('🔄 تحديث جديد للمنصة:', data.version);
                localStorage.setItem('albasem_cached_ver', data.version);
                // إعادة تحميل الصفحة مع تجاوز الكاش
                window.location.reload(true);
            }
        }
    });
}


// ==================== إضافة قسم مستقل ومزامنة الأقسام ====================
function setupDirectCategoryCreation() {
    const btn = document.getElementById('addNewCatDirectBtn');
    if (!btn) return;
    
    btn.onclick = async () => {
        const catName = prompt('أدخل اسم القسم الجديد (مثلاً: أطفال، مسلسلات، رياضة):');
        if (!catName || !catName.trim()) return;
        const cleanName = catName.trim();

        // جلب الأقسام الحالية
        let currentCats = window.categoriesList || ['عام'];
        if (currentCats.includes(cleanName)) {
            alert('⚠️ هذا القسم موجود بالفعل!');
            return;
        }

        currentCats.push(cleanName);
        try {
            if (window.firebaseDb) {
                await window.firebaseDb.ref('categories').set(currentCats);
            }
            alert(`✅ تم إنشاء قسم [${cleanName}] بنجاح وهو فارغ الآن وجاهز لترحيل القنوات إليه!`);
            
            // تحديث الواجهة والتبويبات فوراً
            window.categoriesList = currentCats;
            if (typeof renderTabs === 'function') renderTabs();
            if (typeof updateBulkBarUI === 'function') updateBulkBarUI();
            if (typeof switchTab === 'function') switchTab(cleanName);
        } catch (e) {
            alert('حدث خطأ أثناء حفظ القسم: ' + e.message);
        }
    };
}

// مزامنة الأقسام المستقلة تلقائياً من الفايربيس
if (window.firebaseDb) {
    window.firebaseDb.ref('categories').on('value', snap => {
        const val = snap.val();
        if (val && Array.isArray(val)) {
            window.categoriesList = val;
            if (typeof renderTabs === 'function') renderTabs();
            if (typeof updateBulkBarUI === 'function') updateBulkBarUI();
        }
    });
}

document.addEventListener('DOMContentLoaded', setupDirectCategoryCreation);


// ==================== نظام التحديد، الترحيل، والحذف الجماعي ====================
let selectedCamKeys = new Set();

function updateBulkBarUI() {
    const bar = document.getElementById('bulkActionBar');
    const countLbl = document.getElementById('bulkSelectedCount');
    const targetSelect = document.getElementById('bulkTargetArea');
    if (!bar || !countLbl) return;

    if (window.isAdminMode) {
        bar.style.display = 'flex';
        countLbl.innerText = selectedCamKeys.size;
        
        // تعبئة الأقسام المتاحة للترحيل
        if (targetSelect && window.categoriesList) {
            const currentArea = window.currentTab || 'عام';
            targetSelect.innerHTML = window.categoriesList
                .filter(cat => cat !== currentArea && cat !== 'جميع الكاميرات')
                .map(cat => `<option value="${cat}">${cat}</option>`).join('');
        }
        
        // إظهار مربعات الاختيار في كروت القسم الحالي
        document.querySelectorAll('.card-checkbox-container').forEach(el => el.style.display = 'block');
    } else {
        bar.style.display = 'none';
        selectedCamKeys.clear();
        document.querySelectorAll('.card-checkbox-container').forEach(el => el.style.display = 'none');
    }
}

// تبديل اختيار كرت محدد
window.toggleSelectCard = function(key, isChecked) {
    if (isChecked) {
        selectedCamKeys.add(key);
    } else {
        selectedCamKeys.delete(key);
    }
    const countLbl = document.getElementById('bulkSelectedCount');
    if (countLbl) countLbl.innerText = selectedCamKeys.size;
};

// تهيئة أزرار الشريط الجماعي
function setupBulkActionListeners() {
    const selectAllBtn = document.getElementById('bulkSelectAllBtn');
    const deselectBtn = document.getElementById('bulkDeselectBtn');
    const moveBtn = document.getElementById('bulkMoveBtn');
    const deleteBtn = document.getElementById('bulkDeleteBtn');

    if (selectAllBtn) {
        selectAllBtn.onclick = () => {
            document.querySelectorAll('.card-checkbox-container input[type="checkbox"]').forEach(cb => {
                cb.checked = true;
                selectedCamKeys.add(cb.dataset.key);
            });
            updateBulkBarUI();
        };
    }

    if (deselectBtn) {
        deselectBtn.onclick = () => {
            document.querySelectorAll('.card-checkbox-container input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
            selectedCamKeys.clear();
            updateBulkBarUI();
        };
    }

    if (moveBtn) {
        moveBtn.onclick = async () => {
            if (selectedCamKeys.size === 0) {
                alert('يرجى تحديد قناة واحدة على الأقل لترحيلها!');
                return;
            }
            const target = document.getElementById('bulkTargetArea').value;
            if (!target) {
                alert('يرجى اختيار القسم المستهدف أولاً!');
                return;
            }
            if (confirm(`هل أنت متأكد من نقل (${selectedCamKeys.size}) قنوات إلى قسم [${target}]؟`)) {
                try {
                    const updates = {};
                    selectedCamKeys.forEach(k => {
                        updates[`cameras/${k}/area`] = target;
                    });
                    await window.firebaseDb.ref().update(updates);
                    alert(`✅ تم بنجاح ترحيل ${selectedCamKeys.size} قناة إلى قسم [${target}]!`);
                    selectedCamKeys.clear();
                    updateBulkBarUI();
                } catch (e) {
                    alert('خطأ أثناء الترحيل: ' + e.message);
                }
            }
        };
    }

    if (deleteBtn) {
        deleteBtn.onclick = async () => {
            if (selectedCamKeys.size === 0) {
                alert('يرجى تحديد القنوات المراد حذفها أولاً!');
                return;
            }
            if (confirm(`⚠️ تحذير: هل أنت متأكد من حذف (${selectedCamKeys.size}) قنوات نهائياً من هذا القسم؟`)) {
                try {
                    const updates = {};
                    selectedCamKeys.forEach(k => {
                        updates[`cameras/${k}`] = null;
                    });
                    await window.firebaseDb.ref().update(updates);
                    alert(`🗑️ تم حذف ${selectedCamKeys.size} قناة بنجاح!`);
                    selectedCamKeys.clear();
                    updateBulkBarUI();
                } catch (e) {
                    alert('خطأ أثناء الحذف: ' + e.message);
                }
            }
        };
    }
}

document.addEventListener('DOMContentLoaded', setupBulkActionListeners);

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
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim();
  if (hash) {
    return hash.split('/')[0];
  }
  return localStorage.getItem('albasem_active_cat') || sessionStorage.getItem('albasem_active_cat') || 'IPTV';
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
    const availableAreas = [...new Set(streamsData.map(s => s.area))].filter(Boolean);
    const savedArea = getSavedCategory();
    if (savedArea && availableAreas.includes(savedArea)) {
      currentFilter = savedArea;
    } else if (!availableAreas.includes(currentFilter)) {
      currentFilter = availableAreas.find(a => a !== 'IPTV') || availableAreas[0] || 'IPTV';
    }
    const hashParts = decodeURIComponent(window.location.hash.replace(/^#/, '')).split('/');
    if (hashParts[1]) {
      currentSubFilter = hashParts[1];
    } else {
      currentSubFilter = localStorage.getItem('albasem_active_sub') || 'all';
    }

    setupFilters();
    renderCams();
  });
}

// بناء الفلاتر وترتيبها مع تظليل الفولدر النشط
function setupFilters() {
  const filterBox = document.getElementById('filter-buttons');
  if (!filterBox) return;

  filterBox.className = "flex items-center gap-2 overflow-x-auto no-scrollbar py-1 flex-nowrap w-full";

  const rawAreas = [...new Set(streamsData.map(s => s.area))].filter(Boolean);
  rawAreas.sort((a, b) => {
    let indexA = customCategoryOrder.indexOf(a);
    let indexB = customCategoryOrder.indexOf(b);
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    return indexA - indexB;
  });

  // قفل الرفرش الصارم: استعادة آخر قسم تم فتحه دائماً
  const savedCat = localStorage.getItem('albasem_active_cat');
  if (!currentFilter) {
    if (savedCat && (rawAreas.includes(savedCat) || savedCat === 'FAVORITES')) {
      currentFilter = savedCat;
    } else {
      currentFilter = rawAreas[0] || '';
      localStorage.setItem('albasem_active_cat', currentFilter);
    }
  }

  filterBox.innerHTML = '';

  // 1. زر المفضلة الذهبي الدائم في أول الشريط
  const favBtn = document.createElement('button');
  const isFavActive = currentFilter === 'FAVORITES';
  favBtn.className = `filter-chip flex-shrink-0 px-3.5 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap transition shadow-sm flex items-center gap-1.5 ${isFavActive ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/30' : 'bg-slate-900/90 text-amber-400 border-amber-500/30 hover:bg-slate-800'}`;
  favBtn.innerHTML = `<i class="fa-solid fa-star"></i> <span>المفضلة</span>`;
  favBtn.onclick = () => {
    currentFilter = 'FAVORITES';
    currentSubFilter = 'all';
    localStorage.setItem('albasem_active_cat', 'FAVORITES');
    setupFilters();
    renderCams();
  };
  filterBox.appendChild(favBtn);
  rawAreas.forEach(area => {
    const btn = document.createElement('button');
    const isActive = area === currentFilter;
    btn.className = `filter-chip flex-shrink-0 px-3.5 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition shadow-sm ${isActive ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/50' : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:bg-slate-800'}`;
    btn.textContent = area === 'IPTV' ? '📺 IPTV - قنوات فضائية' : area;
    btn.onclick = () => {
      if (currentFilter !== area) {
        currentFilter = area; localStorage.setItem('albasem_active_cat', area);
        currentSubFilter = 'all';
        updateNavigationHistory(area, 'all', true);
        setupFilters();
        renderCams();
      }
    };
    filterBox.appendChild(btn);
  });

  // شريط التصنيفات الفرعية لـ IPTV (سحب أفقي ناعم بسطر واحد)
  let subBox = document.getElementById('iptv-sub-filters');
  if (!subBox) {
    subBox = document.createElement('div');
    subBox.id = 'iptv-sub-filters';
    subBox.className = 'mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar flex-nowrap w-full';
    filterBox.parentElement.appendChild(subBox);
  }

  if (currentFilter === 'IPTV') {
    subBox.classList.remove('hidden');
    const iptvStreams = streamsData.filter(s => s.area === 'IPTV');
    const rawSubCats = [...new Set(iptvStreams.map(s => s.category || s.subCategory || 'مشكّل ومنوعات'))];
    const subCats = ['all', ...rawSubCats];

    subBox.innerHTML = '';
    subCats.forEach(sub => {
      const sBtn = document.createElement('button');
      const isSubActive = sub === currentSubFilter;
      sBtn.className = `flex-shrink-0 px-3 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition ${isSubActive ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:bg-slate-700'}`;
      sBtn.textContent = sub === 'all' ? 'الكل 🌐' : sub;
      sBtn.onclick = () => {
        if (currentSubFilter !== sub) {
          currentSubFilter = sub;
          updateNavigationHistory(currentFilter, sub, true);
          setupFilters();
          renderCams();
        }
      };
      subBox.appendChild(sBtn);
    });
  } else {
    subBox.classList.add('hidden');
  }
}

// تثبيت مكان الزبون وتحديث رابط الصفحة لحفظ الفولدر
function filterByArea(area) {
  currentFilter = area; localStorage.setItem('albasem_active_cat', area);
  currentSubFilter = 'all';
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
    const streamCount = streamsData.filter(s => s.area === cat).length;
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-xs gap-2';
    item.innerHTML = `
      <div class="flex items-center gap-2 overflow-hidden">
        <span class="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center text-[10px] shrink-0">${idx + 1}</span>
        <span class="font-bold text-slate-200 truncate">${cat}</span>
        <span class="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">(${streamCount})</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button onclick="renameCategory('${cat.replace(/'/g, "\'")}')" class="w-7 h-7 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded flex items-center justify-center transition" title="إعادة تسمية القسم">
          <i class="fa-solid fa-pen text-[10px]"></i>
        </button>
        <button onclick="deleteCategory('${cat.replace(/'/g, "\'")}')" class="w-7 h-7 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded flex items-center justify-center transition" title="حذف القسم بالكامل">
          <i class="fa-solid fa-trash text-[10px]"></i>
        </button>
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

async function renameCategory(oldName) {
  if (!currentUser) {
    alert("يرجى تسجيل الدخول كمسؤول أولاً!");
    return;
  }
  const newName = prompt(`أدخل الاسم الجديد لقسم "${oldName}":`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;

  const cleanNewName = newName.trim();
  if (tempCategoryOrder.includes(cleanNewName)) {
    alert(`القسم "${cleanNewName}" موجود بالفعل!`);
    return;
  }

  const targets = streamsData.filter(s => s.area === oldName);
  if (!confirm(`هل أنت متأكد من تغيير اسم قسم "${oldName}" إلى "${cleanNewName}"؟
سيتم تحديث (${targets.length}) قناة تابعة له.`)) return;

  try {
    const rootRef = orderRef.root;
    const updatePromises = targets.map(s => rootRef.child(`streams/${s.id}/area`).set(cleanNewName));
    await Promise.all(updatePromises);

    targets.forEach(s => s.area = cleanNewName);
    tempCategoryOrder = tempCategoryOrder.map(c => c === oldName ? cleanNewName : c);
    customCategoryOrder = customCategoryOrder.map(c => c === oldName ? cleanNewName : c);
    await orderRef.set(tempCategoryOrder);

    renderCategoryOrderList();
    setupFilters();
    renderCams();
    alert(`✓ تم تغيير اسم القسم إلى "${cleanNewName}" وتحديث قنواته بنجاح!`);
  } catch (e) {
    alert("خطأ أثناء إعادة تسمية القسم: " + e.message);
  }
}

async function deleteCategory(catName) {
  if (!currentUser) {
    alert("يرجى تسجيل الدخول كمسؤول أولاً!");
    return;
  }

  const targets = streamsData.filter(s => s.area === catName);
  const confirmMsg = targets.length > 0
    ? `⚠️ تحذير أمان: هل أنت متأكد تماماً من حذف قسم "${catName}"؟

سيتم حذف جميع القنوات والبثوث التابعة له وعددهم (${targets.length} قناة) نهائياً من المنصة!`
    : `هل تريد إزالة قسم "${catName}" الفارغ من القائمة؟`;

  if (!confirm(confirmMsg)) return;

  try {
    const rootRef = orderRef.root;
    const deletePromises = targets.map(s => rootRef.child(`streams/${s.id}`).remove());
    await Promise.all(deletePromises);

    tempCategoryOrder = tempCategoryOrder.filter(c => c !== catName);
    customCategoryOrder = customCategoryOrder.filter(c => c !== catName);
    await orderRef.set(tempCategoryOrder);

    renderCategoryOrderList();
    setupFilters();
    renderCams();
    alert(`✓ تم حذف قسم "${catName}" وجميع قنواته بنجاح!`);
  } catch (e) {
    alert("خطأ أثناء حذف القسم: " + e.message);
  }
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

function launchHlsStream(container, url, isModal = false, isIptv = false) {
  if (!url) return null;
  const isDirectMp4 = url.toLowerCase().includes('.mp4') || (!url.toLowerCase().includes('.m3u8') && !url.includes('manifest') && !url.includes('youtu'));
  if (isDirectMp4) {
    container.innerHTML = '';
    const v = document.createElement('video');
    v.className = isModal ? 'w-full h-full object-contain' : 'absolute inset-0 w-full h-full object-cover';
    v.src = url;
    v.controls = isModal;
    v.autoplay = true;
    v.loop = true;
    v.playsInline = true;
    container.appendChild(v);
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    return v;
  }

  container.innerHTML = '';
  const video = document.createElement('video');
  video.className = (isModal || isIptv) ? 'w-full h-full object-contain' : 'absolute inset-0 w-full h-full object-cover';
  video.autoplay = true;
  video.muted = !isModal;
  video.controls = (isModal || isIptv);
  video.playsInline = true;
  container.appendChild(video);

  const PROXY_BASE = 'https://albasem-cors-proxy.albasem-sat.workers.dev/?url=';
  let usedProxy = false;
  let mediaRecoveryCount = 0;
  let networkRecoveryCount = 0;

  function startHlsEngine(streamUrl) {
    if (window.Hls && Hls.isSupported()) {
      if (video._hls) video._hls.destroy();
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 25000,
        manifestLoadingMaxRetry: 8,
        levelLoadingTimeOut: 25000,
        levelLoadingMaxRetry: 8,
        fragLoadingTimeOut: 25000,
        fragLoadingMaxRetry: 8
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (!data.fatal) return;

        // 1. إنعاش تلقائي فوري عند تذبذب وتقطيع الفريمات في البث الحي
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (mediaRecoveryCount < 4) {
            mediaRecoveryCount++;
            console.warn('⚠️ إنعاش وسائط البث تلقائياً رقم:', mediaRecoveryCount);
            hls.recoverMediaError();
            return;
          } else if (mediaRecoveryCount === 4) {
            mediaRecoveryCount++;
            hls.swapAudioCodec();
            hls.recoverMediaError();
            return;
          }
        }

        // 2. إعادة جلب أجزاء البث في حال بطء النت المؤقت
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (networkRecoveryCount < 4) {
            networkRecoveryCount++;
            console.warn('⚠️ إعادة الاتصال بالبث رقم:', networkRecoveryCount);
            hls.startLoad();
            return;
          }
        }

        // 3. التحويل التلقائي للبروكسي في حال وجود جدار ناري أو حظر
        if (!usedProxy) {
          usedProxy = true;
          console.warn('⚡ جاري التحويل التلقائي للوسيط السحابي لمنع انقطاع القناة...');
          startHlsEngine(PROXY_BASE + encodeURIComponent(url));
        } else if (isModal) {
          const errBox = document.getElementById('modal-error');
          if (errBox) errBox.classList.remove('hidden');
        }
      });

      video._hls = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
      });
      video.addEventListener('error', () => {
        if (!usedProxy) {
          usedProxy = true;
          video.src = PROXY_BASE + encodeURIComponent(url);
        } else if (isModal) {
          const errBox = document.getElementById('modal-error');
          if (errBox) errBox.classList.remove('hidden');
        }
      });
    }
  }

  const isHttps = window.location.protocol === 'https:';
  const needsProxy = (url.startsWith('http://') && (isIptv || isHttps)) || isIptv;
  if (needsProxy) {
    usedProxy = true;
    startHlsEngine(PROXY_BASE + encodeURIComponent(url));
  } else {
    startHlsEngine(url);
  }

  return video;
}


function openModal(streamId) {
  // إعدام فوري لأي صوت أو مشغل سابق بالكامل
  if (window.activeModalHlsInstance) {
    try {
      window.activeModalHlsInstance.stopLoad();
      window.activeModalHlsInstance.detachMedia();
      window.activeModalHlsInstance.destroy();
    } catch(e){}
    window.activeModalHlsInstance = null;
  }
  const prevModalBox = document.getElementById('modal-content');
  if (prevModalBox) {
    prevModalBox.querySelectorAll('video, audio').forEach(v => {
      try {
        if (v._hls) { v._hls.stopLoad(); v._hls.destroy(); }
        v.pause();
        v.muted = true;
        v.src = '';
        v.removeAttribute('src');
        v.load();
      } catch(e){}
    });
    prevModalBox.querySelectorAll('iframe').forEach(ifr => {
      try { ifr.src = 'about:blank'; } catch(e){}
    });
    prevModalBox.innerHTML = '';
  }
  if (typeof muteAllGridVideos === 'function') muteAllGridVideos();
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
    const isIptvModal = stream.area === 'IPTV' || (stream.url && stream.url.startsWith('http://'));
    const vid = launchHlsStream(modalBox, stream.url, true, isIptvModal);
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
    if (modalBox) {
      modalBox.querySelectorAll('video, audio, iframe').forEach(m => {
        try {
          m.pause?.();
          m.muted = true;
          m.src = '';
          m.removeAttribute('src');
          m.load?.();
        } catch(e){}
      });
      modalBox.innerHTML = '';
    }
    if (typeof muteAllGridVideos === 'function') muteAllGridVideos();

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


    // --- تفعيل الشريط الأفقي لأزرار الإدارة وإخفاء شريط الفرز ---
    function applyAdminHorizontalRibbon() {
        document.querySelectorAll('button').forEach(btn => {
            const txt = btn.textContent || "";
            if (txt.includes('إضافة بث') || txt.includes('خروج') || txt.includes('قسم جديد') || txt.includes('فرز وترحيل')) {
                const parent = btn.parentElement;
                if (parent && parent.tagName !== 'BODY') {
                    parent.style.setProperty('display', 'flex', 'important');
                    parent.style.setProperty('flex-direction', 'row', 'important');
                    parent.style.setProperty('flex-wrap', 'nowrap', 'important');
                    parent.style.setProperty('overflow-x', 'auto', 'important');
                    parent.style.setProperty('overflow-y', 'hidden', 'important');
                    parent.style.setProperty('gap', '8px', 'important');
                    parent.style.setProperty('scrollbar-width', 'none', 'important');
                    parent.style.setProperty('box-sizing', 'border-box', 'important');
                    btn.style.setProperty('flex', '0 0 auto', 'important');
                    btn.style.setProperty('white-space', 'nowrap', 'important');
                }
            }
        });

        // إخفاء شريط الفرز السفلي افتراضياً
        document.querySelectorAll('div, footer, section').forEach(el => {
            const t = el.textContent || "";
            if (t.includes('تحديد الكل') && t.includes('ترحيل للقسم') && !el.hasAttribute('data-batch-managed')) {
                el.style.setProperty('display', 'none', 'important');
                el.setAttribute('data-batch-container', 'true');
            }
        });
    }

    // تشغيل الضبط فور تحميل الصفحة وبشكل متكرر لضمان الثبات
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyAdminHorizontalRibbon);
    } else {
        applyAdminHorizontalRibbon();
    }
    setInterval(applyAdminHorizontalRibbon, 1000);
    

// معالجة زر الرجوع الفيزيائي / إيماءات الهاتف خطوة بخطوة
window.addEventListener('popstate', (e) => {
  // 1. إذا كان المودال مفتوحاً، أغلقه أولاً دون مغادرة القسم
  const modal = document.getElementById('cam-modal');
  if (modal && !modal.classList.contains('hidden')) {
    if (typeof closeModal === 'function') closeModal();
    return;
  }

  // 2. الرجوع التدريجي حسب الرابط والذاكرة
  const state = getSavedNavigationState();
  if (state.area && (state.area !== currentFilter || state.sub !== currentSubFilter)) {
    currentFilter = state.area;
    currentSubFilter = state.sub;
    setupFilters();
    renderCams();
  }
});


// --- نظام ترتيب قنوات القسم الحالي ---
let tempStreamOrderList = [];

function openStreamOrderModal() {
  const targetTitle = document.getElementById('stream-order-target-name');
  if (targetTitle) {
    targetTitle.textContent = currentFilter + (currentFilter === 'IPTV' && currentSubFilter !== 'all' ? ` (${currentSubFilter})` : '');
  }

  let list = streamsData.filter(s => s.area === currentFilter);
  if (currentFilter === 'IPTV' && currentSubFilter !== 'all') {
    list = list.filter(s => (s.category === currentSubFilter || s.subCategory === currentSubFilter));
  }

  tempStreamOrderList = [...list].sort((a, b) => {
    const oA = a.order !== undefined ? Number(a.order) : 9999;
    const oB = b.order !== undefined ? Number(b.order) : 9999;
    return oA - oB;
  });

  renderStreamOrderList();
  document.getElementById('stream-order-modal').classList.remove('hidden');
}

function closeStreamOrderModal() {
  document.getElementById('stream-order-modal').classList.add('hidden');
}

function renderStreamOrderList() {
  const container = document.getElementById('stream-order-list');
  if (!container) return;
  container.innerHTML = '';

  if (tempStreamOrderList.length === 0) {
    container.innerHTML = '<div class="text-center text-slate-500 py-6 text-xs">لا توجد قنوات في هذا القسم حالياً.</div>';
    return;
  }

  tempStreamOrderList.forEach((stream, idx) => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-slate-950 border border-slate-800/80 px-2.5 py-1.5 rounded-lg text-xs gap-2';
    item.innerHTML = `
      <div class="flex items-center gap-2 overflow-hidden">
        <span class="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[10px] shrink-0">${idx + 1}</span>
        <span class="font-bold text-slate-200 truncate">${stream.name || 'بدون اسم'}</span>
        ${stream.category ? `<span class="text-[9px] text-slate-400 bg-slate-900 border border-slate-800 px-1 rounded shrink-0">${stream.category}</span>` : ''}
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button onclick="makeStreamFirst(${idx})" class="px-2 py-0.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded text-[10px] font-bold transition flex items-center gap-1" title="نقل إلى أول القائمة">
          <i class="fa-solid fa-star text-[9px]"></i> <span>بالصدر</span>
        </button>
        <button onclick="moveStreamItem(${idx}, -1)" class="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center justify-center transition" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''} title="تقديم">
          <i class="fa-solid fa-arrow-up text-[10px]"></i>
        </button>
        <button onclick="moveStreamItem(${idx}, 1)" class="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center justify-center transition" ${idx === tempStreamOrderList.length - 1 ? 'disabled style="opacity:0.3"' : ''} title="تأخير">
          <i class="fa-solid fa-arrow-down text-[10px]"></i>
        </button>
      </div>
    `;
    container.appendChild(item);
  });
}

function moveStreamItem(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= tempStreamOrderList.length) return;
  const item = tempStreamOrderList.splice(index, 1)[0];
  tempStreamOrderList.splice(targetIndex, 0, item);
  renderStreamOrderList();
}

function makeStreamFirst(index) {
  if (index === 0) return;
  const item = tempStreamOrderList.splice(index, 1)[0];
  tempStreamOrderList.unshift(item);
  renderStreamOrderList();
}

async function saveStreamOrder() {
  if (!tempStreamOrderList.length) return closeStreamOrderModal();

  const updates = {};
  tempStreamOrderList.forEach((stream, idx) => {
    stream.order = idx + 1;
    updates[`streams/${stream.id}/order`] = idx + 1;
  });

  try {
    await db.ref().update(updates);
    renderCams();
    closeStreamOrderModal();
    alert('✅ تم حفظ ترتيب القنوات بنجاح!');
  } catch(e) {
    alert('حدث خطأ أثناء الحفظ: ' + e.message);
  }
}


// إغلاق المودال وكتم الصوت عند لمس الخلفية المعتمة خارج الإطار
document.addEventListener('DOMContentLoaded', () => {
  const modalContainer = document.getElementById('cam-modal');
  if (modalContainer) {
    modalContainer.addEventListener('click', (e) => {
      if (e.target === modalContainer) {
        closeModal();
      }
    });
  }
});
