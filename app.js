
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
  
  const rawAreas = [...new Set(streamsData.map(s => s.area))].filter(Boolean);
  if (!currentFilter || currentFilter === 'all' || !rawAreas.includes(currentFilter)) {
    // اختيار أول مجلد كاميرات فعلي بدلاً من عرض كل شيء
    currentFilter = rawAreas.find(a => a !== 'IPTV') || rawAreas[0] || '';
    sessionStorage.setItem('albasem_active_cat', currentFilter);
  }

  rawAreas.sort((a, b) => {
    let indexA = customCategoryOrder.indexOf(a);
    let indexB = customCategoryOrder.indexOf(b);
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    return indexA - indexB;
  });

  const areas = rawAreas;
  
  filterBox.innerHTML = '';
  areas.forEach(area => {
    const btn = document.createElement('button');
    const isActive = area === currentFilter;
    btn.className = `filter-chip px-3 py-1 rounded-full border border-slate-800 text-slate-300 hover:bg-slate-800 font-medium whitespace-nowrap transition text-xs ${isActive ? 'active-btn' : 'bg-slate-900'}`;
    btn.textContent = area === 'all' ? 'جميع الكاميرات' : (area === 'IPTV' ? '📺 IPTV - قنوات فضائية' : area);
    btn.onclick = () => filterByArea(area);
    filterBox.appendChild(btn);
  });

  // إضافة أو إخفاء شريط الفلترة الفرعية لـ IPTV
  let subBox = document.getElementById('iptv-sub-filters');
  if (!subBox) {
    subBox = document.createElement('div');
    subBox.id = 'iptv-sub-filters';
    subBox.className = 'mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar';
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
      sBtn.className = `px-2.5 py-0.5 rounded-lg border text-[11px] font-semibold transition ${isSubActive ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:bg-slate-700'}`;
      sBtn.textContent = sub === 'all' ? 'الكل 🌐' : sub;
      sBtn.onclick = () => {
        currentSubFilter = sub;
        setupFilters();
        renderCams();
      };
      subBox.appendChild(sBtn);
    });
  } else {
    subBox.classList.add('hidden');
  }
}

// تثبيت مكان الزبون وتحديث رابط الصفحة لحفظ الفولدر
function filterByArea(area) {
  currentFilter = area;
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
  if (!isModal && !isIptv) {
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
      <span class="text-[10px] text-slate-400 font-medium">${(isModal || isIptv) ? 'جاري فتح البث الحي المباشر...' : 'جاري التقاط المشهد الحي...'}</span>
    </div>
  `;
  container.appendChild(loadingIndicator);

  const video = document.createElement('video');
  video.className = (isModal || isIptv) ? 'w-full h-full object-contain' : 'absolute inset-0 w-full h-full object-cover';
  video.autoplay = true;
  video.controls = (isModal || isIptv);
  video.playsInline = true;
  video.muted = isModal ? false : (isIptv ? false : true);
  if (isModal || isIptv) video.volume = 1.0;
  
  if (!isModal && !isIptv) {
    video.preload = "metadata";
    container.addEventListener('mouseenter', () => { video.play().catch(()=>{}); });
    container.addEventListener('mouseleave', () => { video.pause(); });
  }

  container.appendChild(video);

  let isPlaying = false;
  let hlsInstance = null;
  let usedProxy = false;
  const PROXY_BASE = "https://albasem-proxy.satalet.workers.dev/?url=";

  const showOfflineBox = () => {
    if (loadingIndicator) loadingIndicator.remove();
    if (hlsInstance) {
      try { hlsInstance.destroy(); } catch(e){}
    }
    video.pause();
    video.removeAttribute('src');
    try { video.load(); } catch(e){}

    container.innerHTML = `
      <div class="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-3 text-center z-20" onclick="event.stopPropagation()">
        <i class="fa-solid fa-triangle-exclamation text-amber-400 text-xl mb-1"></i>
        <span class="text-slate-200 text-xs font-bold mb-0.5">تعذر العرض المباشر</span>
        <span class="text-slate-400 text-[10px] mb-2.5">سيرفر القناة يفرض قيود حماية أو تشفير خاص</span>
        
        <div class="flex items-center gap-1.5 flex-wrap justify-center">
          <button class="retry-single-btn bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded transition flex items-center gap-1">
            <i class="fa-solid fa-rotate-right"></i> إعادة المحاولة
          </button>
          <button class="ext-play-btn bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded transition flex items-center gap-1">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> مشغل خارجي
          </button>
          <button class="copy-url-btn bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded transition" title="نسخ رابط البث لبرنامج VLC">
            <i class="fa-solid fa-copy"></i> VLC
          </button>
        </div>
      </div>
    `;

    const retryBtn = container.querySelector('.retry-single-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        launchHlsStream(container, url, isModal, isIptv);
      });
    }

    const extBtn = container.querySelector('.ext-play-btn');
    if (extBtn) {
      extBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(`https://hlsplayer.net/embed?url=${encodeURIComponent(url)}`, '_blank', 'width=800,height=500');
      });
    }

    const copyBtn = container.querySelector('.copy-url-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(url);
        copyBtn.innerHTML = '<i class="fa-solid fa-check text-emerald-400"></i> تم النسخ';
        setTimeout(() => { copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> VLC'; }, 2000);
      });
    }
  };

  let safetyTimer = setTimeout(() => {
    if (!isPlaying && (video.currentTime === 0 || video.paused || video.readyState < 2)) {
      if (!usedProxy && isIptv) {
        tryFallbackProxy();
      } else {
        showOfflineBox();
      }
    }
  }, 9000);

  const onStreamReady = () => {
    if (isPlaying) return;
    isPlaying = true;
    clearTimeout(safetyTimer);
    if (loadingIndicator) loadingIndicator.remove();

    if (!isModal && !isIptv) {
      setTimeout(() => {
        if (!video.paused) video.pause();
      }, 800);
    }
  };

  video.addEventListener('playing', () => {
    onStreamReady();
    document.querySelectorAll('video').forEach(otherVid => {
      if (otherVid !== video && !otherVid.paused) {
        try { otherVid.pause(); } catch(e){}
      }
    });
  });

  video.addEventListener('timeupdate', () => {
    if (video.currentTime > 0.2) onStreamReady();
  });

  function startHlsEngine(streamUrl) {
    if (hlsInstance) {
      try { hlsInstance.destroy(); } catch(e){}
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        manifestLoadingMaxRetry: 2,
        levelLoadingMaxRetry: 2
      });
      hlsInstance = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(()=>{});
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          if (!usedProxy && isIptv) {
            tryFallbackProxy();
          } else {
            clearTimeout(safetyTimer);
            showOfflineBox();
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(()=>{});
        });
      });
    }
  }

  function tryFallbackProxy() {
    usedProxy = true;
    console.log("⚡ جاري التحويل التلقائي للوسيط السحابي (Cloudflare Fallback):", url);
    const proxyStreamUrl = PROXY_BASE + encodeURIComponent(url);
    startHlsEngine(proxyStreamUrl);
  }

  // إذا كان الرابط http عادي، يمر عبر الوسيط لحل مشكلة المحتوى المختلط
  if (url.startsWith('http://') && isIptv) {
    usedProxy = true;
    startHlsEngine(PROXY_BASE + encodeURIComponent(url));
  } else {
    // تشغيل مباشر لحفظ رصيد Cloudflare
    startHlsEngine(url);
  }
}

function renderCams() {
  const grid = document.getElementById('cams-grid');
  if (!grid) return;
  grid.innerHTML = '';

  let filtered = currentFilter === 'all' 
    ? streamsData.filter(s => s.area !== 'IPTV') 
    : streamsData.filter(s => s.area === currentFilter);

  if (currentFilter === 'IPTV' && currentSubFilter !== 'all') {
    filtered = filtered.filter(s => (s.category === currentSubFilter || s.subCategory === currentSubFilter));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-16 text-center text-slate-500 text-xs">لا توجد قنوات معروضة حالياً في هذا القسم.</div>`;
    return;
  }

  filtered.forEach(stream => {
    const card = document.createElement('div');
    card.className = 'bg-[#0f172a] border border-slate-800/90 rounded-xl overflow-hidden shadow-xl flex flex-col transition hover:border-slate-700';

    const adminActions = currentUser ? `
      <div class="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-2" onclick="event.stopPropagation()">
        <label class="bulk-chk-label ${window.isBulkSortActive ? 'inline-flex' : 'hidden'} items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-1.5 py-0.5 rounded cursor-pointer select-none">
          <input type="checkbox" class="bulk-stream-chk accent-emerald-500 cursor-pointer w-3.5 h-3.5" value="${stream.id}" onchange="updateBulkSelectedCount()" ${(window.selectedBulkStreams && window.selectedBulkStreams.has(stream.id)) ? 'checked' : ''}>
          <span>تحديد</span>
        </label>
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
      if (stream.area === 'IPTV') {
        const logoHtml = stream.logo ? `<img src="${stream.logo}" alt="${stream.title}" class="max-h-16 max-w-[70%] object-contain drop-shadow mb-2">` : `<i class="fa-solid fa-tv text-4xl text-slate-500 mb-2"></i>`;
        feedContainer.innerHTML = `
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-3 text-center">
            ${logoHtml}
            <div class="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg transition transform group-hover:scale-105">
              <i class="fa-solid fa-play text-[9px]"></i> تشغيل البث
            </div>
            <span class="text-[10px] text-slate-400 mt-1.5">${stream.category || stream.subCategory || 'بث مباشر'}</span>
          </div>
        `;
        feedContainer.onclick = (e) => {
          e.stopPropagation();
          feedContainer.innerHTML = '';
          launchHlsStream(feedContainer, stream.url, false, true);
        };
      } else {
        launchHlsStream(feedContainer, stream.url, false, true);
      }
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
    