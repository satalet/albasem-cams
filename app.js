var customCategoryOrder = [];
isOrderingIptvMode = false;

// تبديل حالة قفل القناة الفوري (الرقابة الأبوية 1415)
async function toggleStreamLock(streamId, e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  if (!currentUser) {
    alert("⚠️ يجب تسجيل الدخول كمسؤول أولاً!");
    return;
  }
  const stream = streamsData.find(s => s.id === streamId);
  if (!stream) return;

  const newStatus = !stream.isLocked;
  try {
    await db.ref('streams/' + streamId + '/isLocked').set(newStatus);
    stream.isLocked = newStatus;
    if (typeof renderStreams === 'function') {
      renderStreams();
    } else if (typeof applyFilters === 'function') {
      applyFilters();
    } else {
      location.reload();
    }
  } catch(err) {
    alert("خطأ أثناء تحديث حالة القفل: " + err.message);
  }
}


// --- محرك الرقابة الأبوية الذكي Al-Basem Parental Engine ---
function checkParentalAccess(streamId, onAllowed) {
  const stream = streamsData.find(s => s.id === streamId);
  if (!stream || !stream.isLocked) {
    onAllowed();
    return;
  }

  const isUnlocked = sessionStorage.getItem('albasem_parental_unlocked') === 'true';
  if (isUnlocked) {
    onAllowed();
    return;
  }

  showParentalPinModal(() => onAllowed());
}

function showParentalPinModal(onSuccess) {
  let modal = document.getElementById('parental-pin-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'parental-pin-modal';
    modal.className = 'fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-[#0f172a] border border-amber-500/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
        <div class="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-400 text-2xl">
          <i class="fa-solid fa-lock"></i>
        </div>
        <h3 class="text-base font-bold text-white mb-1">محتوى محمي بنظام الرقابة الأبوية</h3>
        <p class="text-xs text-slate-400 mb-4">أدخل رمز الأمان المعتمد (PIN) لفتح هذا المحتوى:</p>
        
        <input type="password" id="parental-pin-input" maxlength="10" placeholder="••••" class="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl p-3 text-center text-xl tracking-[0.5em] text-amber-400 font-mono outline-none mb-2">
        <div id="parental-pin-err" class="text-red-400 text-xs mb-3 hidden"></div>

        <div class="flex gap-2">
          <button id="parental-pin-submit" class="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition">تأكيد وفتح</button>
          <button id="parental-pin-cancel" class="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs transition">إلغاء</button>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-800">
          <button id="parental-change-pin-btn" class="text-[11px] text-slate-400 hover:text-amber-400 transition flex items-center justify-center gap-1 mx-auto">
            <i class="fa-solid fa-gear"></i> <span>تغيير رمز الأمان</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.remove('hidden');
  const input = document.getElementById('parental-pin-input');
  const errDiv = document.getElementById('parental-pin-err');
  input.value = '';
  errDiv.classList.add('hidden');
  input.focus();

  document.getElementById('parental-pin-cancel').onclick = () => {
    modal.classList.add('hidden');
  };

  const handleVerify = () => {
    const entered = input.value.trim();
    const currentPin = localStorage.getItem('albasem_custom_pin') || '1415';
    if (entered === currentPin) {
      sessionStorage.setItem('albasem_parental_unlocked', 'true');
      modal.classList.add('hidden');
      if (typeof onSuccess === 'function') onSuccess();
    } else {
      errDiv.textContent = '⚠️ رمز الأمان غير صحيح!';
      errDiv.classList.remove('hidden');
    }
  };

  document.getElementById('parental-pin-submit').onclick = handleVerify;
  input.onkeydown = (e) => { if (e.key === 'Enter') handleVerify(); };

  document.getElementById('parental-change-pin-btn').onclick = () => {
    modal.classList.add('hidden');
    showChangePinModal();
  };
}

function showChangePinModal() {
  let modal = document.getElementById('change-pin-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'change-pin-modal';
    modal.className = 'fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-[#0f172a] border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-right">
        <h3 class="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <i class="fa-solid fa-key text-amber-400"></i>
          <span>تغيير رمز الرقابة الأبوية</span>
        </h3>
        <p class="text-[11px] text-slate-400 mb-4 leading-relaxed">
          لتغيير الرمز، يجب إدخال الرمز المعتمد الحالي الذي تم استلامه من إدارة الباسم سات:
        </p>

        <div class="space-y-2.5 text-xs">
          <div>
            <label class="block text-slate-300 mb-1">الرمز الحالي (من الإدارة):</label>
            <input type="password" id="old-pin-input" placeholder="الرمز الحالي..." class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-amber-400">
          </div>
          <div>
            <label class="block text-slate-300 mb-1">الرمز الجديد:</label>
            <input type="password" id="new-pin-input" placeholder="أدخل 4 أرقام أو أكثر..." class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-amber-400">
          </div>
          <div>
            <label class="block text-slate-300 mb-1">تأكيد الرمز الجديد:</label>
            <input type="password" id="confirm-pin-input" placeholder="أعد إدخال الرمز الجديد..." class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-amber-400">
          </div>
        </div>

        <div id="change-pin-err" class="text-red-400 text-xs mt-2 hidden"></div>

        <div class="flex gap-2 mt-4">
          <button id="save-new-pin-btn" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs transition">حفظ الرمز</button>
          <button id="cancel-change-pin-btn" class="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-xs transition">إلغاء</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.remove('hidden');
  const oldIn = document.getElementById('old-pin-input');
  const newIn = document.getElementById('new-pin-input');
  const confIn = document.getElementById('confirm-pin-input');
  const errDiv = document.getElementById('change-pin-err');
  oldIn.value = ''; newIn.value = ''; confIn.value = '';
  errDiv.classList.add('hidden');

  document.getElementById('cancel-change-pin-btn').onclick = () => modal.classList.add('hidden');

  document.getElementById('save-new-pin-btn').onclick = () => {
    const curSaved = localStorage.getItem('albasem_custom_pin') || '1415';
    if (oldIn.value.trim() !== curSaved) {
      errDiv.textContent = '⚠️ الرمز الحالي غير صحيح! يرجى مراجعة إدارة الباسم سات.';
      errDiv.classList.remove('hidden');
      return;
    }
    const n = newIn.value.trim();
    const c = confIn.value.trim();
    if (!n || n.length < 4) {
      errDiv.textContent = '⚠️ يجب أن يتكون الرمز الجديد من 4 أرقام على الأقل.';
      errDiv.classList.remove('hidden');
      return;
    }
    if (n !== c) {
      errDiv.textContent = '⚠️ الرمز الجديد وتأكيد الرمز غير متطابقين!';
      errDiv.classList.remove('hidden');
      return;
    }
    localStorage.setItem('albasem_custom_pin', n);
    alert('✓ تم تغيير رمز الرقابة الأبوية بنجاح!');
    modal.classList.add('hidden');
  };
}


// --- محرك الفرز الذكي التلقائي لقنوات IPTV الباسم سات ---
const IPTV_AUTO_RULES = [
  { cat: 'أفلام ومسلسلات', patterns: [/movie/i, /cinema/i, /action/i, /drama/i, /series/i, /film/i, /aflam/i, /box\s*office/i, /osn/i, /netflix/i, /hbo/i, /fox/i, /سينما/i, /افلام/i, /أفلام/i, /مسلسل/i, /دراما/i, /اكشن/i, /حكايات/i, /سهرة/i] },
  { cat: 'إخبارية', patterns: [/news/i, /hadath/i, /al\s*jazeera/i, /al\s*arabiya/i, /bbc/i, /cnn/i, /sky/i, /euronews/i, /اخبار/i, /أخبار/i, /حدث/i, /الحدث/i, /الجزيرة/i, /العربية/i, /عاجل/i, /نيوز/i] },
  { cat: 'رياضة', patterns: [/sport/i, /bein/i, /kass/i, /ssc/i, /koora/i, /match/i, /liga/i, /wwe/i, /riyadi/i, /eurosport/i, /arena/i, /ontime/i, /سبورت/i, /رياض/i, /كورة/i, /كأس/i, /دوري/i, /مصارع/i] },
  { cat: 'إسلاميات', patterns: [/quran/i, /islam/i, /sunnah/i, /makkah/i, /madina/i, /huda/i, /iqraa/i, /قران/i, /قرآن/i, /اسلام/i, /إسلام/i, /سنة/i, /مكة/i, /مدين/i, /اقرا/i, /اقرأ/i, /الرسالة/i] },
  { cat: 'أطفال', patterns: [/kids/i, /cartoon/i, /disney/i, /spacetoon/i, /nickelodeon/i, /toons/i, /baby/i, /اطفال/i, /أطفال/i, /كرتون/i, /سبيستون/i, /طيور الجنة/i, /كراميش/i, /ماجد/i, /براعم/i] },
  { cat: 'وثائقي', patterns: [/doc/i, /documentary/i, /nat\s*geo/i, /geographic/i, /discovery/i, /history/i, /wild/i, /وثائق/i, /ناشونال/i, /جيوغرافيك/i, /ديسكفري/i, /استكشاف/i] },
  { cat: 'موسيقى', patterns: [/music/i, /song/i, /clip/i, /aghani/i, /tarab/i, /melody/i, /mtv/i, /موسيقى/i, /اغاني/i, /أغاني/i, /طرب/i, /كليب/i, /مزيكا/i, /روتانا/i] }
];

window.iptvDisplayLimit = 40;

function autoCategorizeStreams() {
  if (!Array.isArray(streamsData)) return;
  streamsData.forEach(s => {
    if (!s || s.area !== 'IPTV') return;
    const cur = s.category || s.subCategory;
    if (!cur || cur === 'مشكّل ومنوعات' || cur === 'غير مصنف') {
      const title = s.title || '';
      for (const rule of IPTV_AUTO_RULES) {
        if (rule.patterns.some(p => p.test(title))) {
          s.category = rule.cat;
          s.subCategory = rule.cat;
          break;
        }
      }
    }
  });
}


// --- محرك البحث الذكي والمرن للباسم سات ---
window.searchQuery = '';

function normalizeArabic(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ً-ٟ]/g, '')
    .replace(/[^a-z0-9؀-ۿ]/g, '')
    .trim();
}

function matchesSmartSearch(title, query) {
  const cleanTitle = normalizeArabic(title);
  const cleanQuery = normalizeArabic(query);
  if (!cleanQuery) return true;
  if (cleanTitle.includes(cleanQuery)) return true;

  if (cleanQuery.length >= 3) {
    for (let i = 0; i <= cleanQuery.length - 3; i++) {
      const sub = cleanQuery.substr(i, 3);
      if (cleanTitle.includes(sub)) return true;
    }
  }
  return false;
}

function setupSearchBar() {
  if (document.getElementById('global-search-container')) return;
  const filterBox = document.getElementById('filter-buttons');
  if (!filterBox || !filterBox.parentElement) return;

  const searchDiv = document.createElement('div');
  searchDiv.id = 'global-search-container';
  searchDiv.className = 'w-full mb-3 px-1';
  searchDiv.innerHTML = `
    <div class="relative w-full">
      <span class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
        <i class="fa-solid fa-magnifying-glass text-xs"></i>
      </span>
      <input type="text" id="global-search-input" placeholder="🔍 ابحث عن أي قناة أو كاميرا بالاسم..." 
        class="w-full bg-[#0f172a] text-slate-100 text-xs rounded-xl pr-9 pl-9 py-2.5 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-500 transition shadow-inner">
      <button id="clear-search-btn" class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 hover:text-rose-400 hidden transition">
        <i class="fa-solid fa-xmark text-sm"></i>
      </button>
    </div>
  `;
  filterBox.parentElement.insertBefore(searchDiv, filterBox);

  const sInput = document.getElementById('global-search-input');
  const cBtn = document.getElementById('clear-search-btn');

  sInput.addEventListener('input', (e) => {
    window.searchQuery = e.target.value.trim();
    if (window.searchQuery.length > 0) {
      cBtn.classList.remove('hidden');
    } else {
      cBtn.classList.add('hidden');
    }
    renderCams();
      if (typeof populateTargetAreas === 'function') populateTargetAreas();
  });

  cBtn.addEventListener('click', () => {
    sInput.value = '';
    window.searchQuery = '';
    cBtn.classList.add('hidden');
    renderCams();
      if (typeof populateTargetAreas === 'function') populateTargetAreas();
  });
}

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


// ==================== وظائف التحديد والترحيل الجماعي والفردي ====================
window.selectAllBulk = function(select) {
    const checkboxes = document.querySelectorAll('.bulk-stream-chk');
    checkboxes.forEach(cb => {
        cb.checked = !!select;
    });
    window.updateBulkSelectedCount();
};

window.updateBulkSelectedCount = function() {
    const checked = document.querySelectorAll('.bulk-stream-chk:checked');
    const countLbl = document.getElementById('bulkSelectedCount');
    if (countLbl) {
        countLbl.innerText = checked.length;
    }
};

function getActiveSelectedIds() {
    const checkboxes = document.querySelectorAll('.bulk-stream-chk:checked');
    return Array.from(checkboxes).map(cb => cb.value).filter(Boolean);
}

function populateTargetAreas() {
    const sel = document.getElementById('bulkTargetArea');
    if (!sel) return;

    const currentVal = sel.value;
    let opts = '<option value="" style="background-color:#0f172a; color:#94a3b8;">-- 📍 اختر وجهة الترحيل من هنا --</option>';

    // 1. سحب تفريعات IPTV (من الفايربيس + الكروت + الأزرار)
    const defaultSubs = ['أفلام ومسلسلات', 'إخبارية', 'رياضة', 'إسلاميات', 'أطفال', 'وثائقي', 'موسيقى', 'مشكّل ومنوعات'];
    const customSubs = (window.iptvCustomSubs && Array.isArray(window.iptvCustomSubs)) ? window.iptvCustomSubs : [];
    const streamSubs = (typeof streamsData !== 'undefined' && Array.isArray(streamsData))
        ? streamsData.filter(s => s && s.area === 'IPTV').map(s => s.subCategory || s.category).filter(Boolean)
        : [];
    const domSubs = Array.from(document.querySelectorAll('#iptv-sub-tabs button, .sub-filter-btn'))
        .map(b => b.textContent.trim().replace(/^[📺📁\s]+/, ''))
        .filter(t => t && t !== 'الكل' && !t.includes('إدارة'));

    const allSubs = [...new Set([...defaultSubs, ...customSubs, ...streamSubs, ...domSubs])].filter(Boolean);
    if (allSubs.length > 0) {
        opts += '<optgroup label="📺 تفريعات IPTV الفرعية" style="background-color:#0b1329; color:#34d399; font-weight:bold;">';
        allSubs.forEach(sub => {
            const isSel = (currentVal === `SUB:${sub}`) ? 'selected' : '';
            opts += `<option value="SUB:${sub}" ${isSel} style="background-color:#1e293b; color:#ffffff; font-weight:bold; padding:4px;">📺 تفريع: ${sub}</option>`;
        });
        opts += '</optgroup>';
    }

    // 2. سحب الأقسام العامة (من الفايربيس + الكروت + أزرار التبويبات)
    const catsOrder = (typeof customCategoryOrder !== 'undefined' && Array.isArray(customCategoryOrder)) ? customCategoryOrder : [];
    const streamsAreas = (typeof streamsData !== 'undefined' && Array.isArray(streamsData)) ? streamsData.map(s => s && s.area).filter(Boolean) : [];
    const domAreas = Array.from(document.querySelectorAll('#filter-buttons button, .filter-btn'))
        .map(b => b.textContent.trim().replace(/^[📺📁\s]+/, ''))
        .filter(t => t && t !== 'الكل' && t !== 'المفضلة' && !t.includes('ترتيب'));

    const allMain = [...new Set([...catsOrder, ...streamsAreas, ...domAreas])].filter(a => a && a !== 'all' && a !== 'FAVORITES');
    if (allMain.length > 0) {
        opts += '<optgroup label="📁 الأقسام العامة" style="background-color:#0b1329; color:#60a5fa; font-weight:bold;">';
        allMain.forEach(area => {
            const isSel = (currentVal === `AREA:${area}`) ? 'selected' : '';
            opts += `<option value="AREA:${area}" ${isSel} style="background-color:#1e293b; color:#ffffff; font-weight:bold; padding:4px;">📁 قسم: ${area}</option>`;
        });
        opts += '</optgroup>';
    }

    // 3. خيار الكتابة باليد
    opts += '<optgroup label="✏️ خيارات إضافية" style="background-color:#0b1329; color:#fbbf24; font-weight:bold;">';
    opts += '<option value="__NEW_CUSTOM__" style="background-color:#1e293b; color:#38bdf8; font-weight:bold; padding:4px;">➕ كتابة وجهة جديدة باليد...</option>';
    opts += '</optgroup>';

    sel.innerHTML = opts;

    sel.onchange = function() {
        if (this.value === '__NEW_CUSTOM__') {
            const isNowIptv = (typeof currentFilter !== 'undefined' && currentFilter === 'IPTV');
            const promptMsg = isNowIptv
                ? 'أدخل اسم تصنيف IPTV الجديد لنقل القنوات المحددة إليه:'
                : 'أدخل اسم القسم العام الجديد لنقل القنوات المحددة إليه:';
            const userEntered = prompt(promptMsg);
            if (userEntered && userEntered.trim()) {
                const clean = userEntered.trim();
                const newOptVal = isNowIptv ? ('SUB:' + clean) : ('AREA:' + clean);
                const opt = document.createElement('option');
                opt.value = newOptVal;
                opt.textContent = (isNowIptv ? '📺 تفريع جديد: ' : '📁 قسم جديد: ') + clean;
                opt.selected = true;
                opt.style.backgroundColor = '#1e293b';
                opt.style.color = '#ffffff';
                sel.appendChild(opt);
                sel.value = newOptVal;
            } else {
                sel.value = '';
            }
        }
    };
}


window.executeBulkLock = async function(lockStatus) {
    if (!currentUser) return alert("يرجى تسجيل الدخول كمسؤول أولاً!");
    const selectedIds = getActiveSelectedIds();
    if (!selectedIds || selectedIds.length === 0) {
        return alert("⚠️ يرجى تحديد قناة واحدة على الأقل بالضغط على مربع [تحديد] الأخضر!");
    }

    const actionText = lockStatus ? "قفل" : "فك قفل";
    if (!confirm(`هل أنت متأكد من ${actionText} (${selectedIds.length}) قناة محددة؟`)) return;

    const updates = {};
    selectedIds.forEach(id => {
        updates[`streams/${id}/isLocked`] = !!lockStatus;
        const s = streamsData.find(item => item && item.id === id);
        if (s) s.isLocked = !!lockStatus;
    });

    try {
        await db.ref().update(updates);
        alert(`✅ تم ${actionText} (${selectedIds.length}) قناة بنجاح!`);
        if (typeof renderCams === 'function') renderCams();
    } catch(err) {
        alert("خطأ أثناء العملية: " + err.message);
    }
};

window.toggleSubcategoryLock = async function(subName) {
    if (!currentUser) return alert("يرجى تسجيل الدخول كمسؤول أولاً!");
    const subStreams = streamsData.filter(s => s && s.area === 'IPTV' && (s.subCategory === subName || s.category === subName));
    if (!subStreams.length) return alert("لا توجد قنوات في هذا التفريع!");

    const allLocked = subStreams.every(s => s.isLocked);
    const targetStatus = !allLocked;
    const msg = targetStatus
        ? `هل تريد قفل جميع قنوات تفريع [${subName}] (${subStreams.length} قناة) برمز 1415؟`
        : `هل تريد فك قفل جميع قنوات تفريع [${subName}] (${subStreams.length} قناة)؟`;

    if (!confirm(msg)) return;

    const updates = {};
    subStreams.forEach(s => {
        updates[`streams/${s.id}/isLocked`] = targetStatus;
        s.isLocked = targetStatus;
    });

    try {
        await db.ref().update(updates);
        alert(`✅ تم ${targetStatus ? 'قفل' : 'فك قفل'} تفريع [${subName}] بالكامل!`);
        if (typeof renderCategoryOrderList === 'function') renderCategoryOrderList();
        if (typeof renderCams === 'function') renderCams();
    } catch(err) {
        alert("خطأ أثناء تحديث القفل: " + err.message);
    }
};

window.executeBulkMove = async function() {
    if (!currentUser) return alert("يرجى تسجيل الدخول كمسؤول أولاً!");

    const selectedIds = getActiveSelectedIds();
    if (!selectedIds || selectedIds.length === 0) {
        return alert('⚠️ يرجى تحديد قناة واحدة على الأقل بالضغط على مربع [تحديد] الأخضر!');
    }

    const sel = document.getElementById('bulkTargetArea');
    let target = sel ? sel.value : '';

    // إذا لم يختر وجهة من القائمة، نفتح له نافذة إدخال فورية بدلاً من التعليق
    if (!target) {
        const isIptv = (typeof currentFilter !== 'undefined' && currentFilter === 'IPTV');
        const askMsg = isIptv
            ? `لم تختر وجهة من القائمة!\nأدخل اسم تفريع IPTV لترحيل (${selectedIds.length}) قناة إليه (مثال: أفلام ومسلسلات، رياضة...):`
            : `لم تختر وجهة من القائمة!\nأدخل اسم القسم العام لترحيل (${selectedIds.length}) قناة إليه:`;
        const typed = prompt(askMsg);
        if (!typed || !typed.trim()) return;
        const cleanTyped = typed.trim();
        target = isIptv ? ('SUB:' + cleanTyped) : ('AREA:' + cleanTyped);
    } else if (target === '__NEW_CUSTOM__') {
        const isIptv = (typeof currentFilter !== 'undefined' && currentFilter === 'IPTV');
        const userEntered = prompt(isIptv ? 'اكتب اسم تفريع IPTV الجديد:' : 'اكتب اسم القسم الجديد:');
        if (!userEntered || !userEntered.trim()) return;
        target = isIptv ? ('SUB:' + userEntered.trim()) : ('AREA:' + userEntered.trim());
    }

    let destTitle = target;
    const updates = {};

    if (target.startsWith('SUB:')) {
        const subName = target.replace('SUB:', '');
        destTitle = 'تفريع IPTV: [' + subName + ']';
        if (!confirm(`هل أنت متأكد من ترحيل (${selectedIds.length}) قنوات إلى ${destTitle}؟`)) return;

        try {
            const snap = await db.ref('streams/_config_iptv_subs').once('value');
            let subs = snap.val() || [];
            if (!Array.isArray(subs)) subs = Object.values(subs);
            if (!subs.includes(subName)) {
                subs.push(subName);
                updates['streams/_config_iptv_subs'] = subs;
            }
        } catch(e){}

        selectedIds.forEach(id => {
            updates[`streams/${id}/area`] = 'IPTV';
            updates[`streams/${id}/subCategory`] = subName;
            updates[`streams/${id}/category`] = subName;
            const item = streamsData.find(s => s && s.id === id);
            if (item) {
                item.area = 'IPTV';
                item.subCategory = subName;
                item.category = subName;
            }
        });
    } else {
        const areaName = target.replace('AREA:', '');
        destTitle = 'قسم [' + areaName + ']';
        if (!confirm(`هل أنت متأكد من ترحيل (${selectedIds.length}) قنوات إلى ${destTitle}؟`)) return;

        try {
            const snap = await db.ref('streams/_config_categories').once('value');
            let cats = snap.val() || [];
            if (!Array.isArray(cats)) cats = Object.values(cats);
            if (!cats.includes(areaName)) {
                cats.push(areaName);
                updates['streams/_config_categories'] = cats;
            }
        } catch(e){}

        selectedIds.forEach(id => {
            updates[`streams/${id}/area`] = areaName;
            const item = streamsData.find(s => s && s.id === id);
            if (item) item.area = areaName;
        });
    }

    try {
        await db.ref().update(updates);
        alert(`✅ تم بنجاح ترحيل ${selectedIds.length} قناة إلى ${destTitle}!`);
        if (typeof selectAllBulk === 'function') selectAllBulk(false);
        if (typeof setupFilters === 'function') setupFilters();
        if (typeof setupIptvSubTabs === 'function') setupIptvSubTabs();
        if (typeof renderCams === 'function') renderCams();
    } catch(err) {
        alert('خطأ أثناء الترحيل: ' + err.message);
    }
};

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
    const isIptv = (typeof currentFilter !== 'undefined' && currentFilter === 'IPTV');
    let promptMsg = isIptv 
        ? '📺 أدخل اسم التصنيف الفرعي الجديد لقنوات IPTV (مثلاً: مسلسلات تركية، أطفال، أفلام 4K):'
        : '📁 أدخل اسم القسم الرئيسي الجديد (مثلاً: طولكرم، جنين، منوعات):';
    
    const catName = prompt(promptMsg);
    if (!catName || !catName.trim()) return;
    const cleanName = catName.trim();

    try {
        if (isIptv) {
            const snap = await db.ref('streams/_config_iptv_subs').once('value');
            let subs = snap.val() || [];
            if (!Array.isArray(subs)) subs = Object.values(subs);
            if (subs.includes(cleanName)) return alert('⚠️ هذا التصنيف موجود بالفعل داخل IPTV!');
            subs.push(cleanName);
            await db.ref('streams/_config_iptv_subs').set(subs);
            alert(`✅ تم إنشاء تصنيف IPTV الجديد [${cleanName}] بنجاح وهو متاح الآن بالشريط والفرز!`);
        } else {
            // حفظ مباشر بالفايربيس الأصلي streams/_config_categories
            const snap = await orderRef.once('value');
            let cats = snap.val() || [];
            if (!Array.isArray(cats)) cats = Object.values(cats);
            const streamAreas = (typeof streamsData !== 'undefined' && Array.isArray(streamsData)) ? streamsData.map(s => s.area).filter(Boolean) : [];
            cats = [...new Set([...cats, ...streamAreas])];
            if (cats.includes(cleanName)) return alert('⚠️ هذا القسم موجود بالفعل!');
            cats.push(cleanName);
            await orderRef.set(cats);
            customCategoryOrder = cats;
            alert(`✅ تم إنشاء قسم [${cleanName}] وحفظه في الفايربيس بنجاح!`);
        }
        setupFilters();
        populateTargetAreas();
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
// مزامنة تفريعات IPTV المخصصة مع الفايربيس
window.iptvCustomSubs = [];
db.ref('streams/_config_iptv_subs').on('value', snap => {
    const val = snap.val();
    window.iptvCustomSubs = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
    if (typeof setupFilters === 'function') setupFilters();
    if (typeof populateTargetAreas === 'function') populateTargetAreas();
});


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
customCategoryOrder = [];

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
      if (typeof populateTargetAreas === 'function') populateTargetAreas();
  });
}

// بناء الفلاتر وترتيبها مع تظليل الفولدر النشط
function setupFilters() {
  const filterBox = document.getElementById('filter-buttons');
  if (!filterBox) return;

  setupSearchBar();
  autoCategorizeStreams();

  filterBox.className = "flex items-center gap-2 overflow-x-auto no-scrollbar py-1 flex-nowrap w-full";

  const rawAreas = [...new Set([...(customCategoryOrder || []), ...streamsData.map(s => s.area)])].filter(Boolean);
  rawAreas.sort((a, b) => {
    let indexA = customCategoryOrder.indexOf(a);
    let indexB = customCategoryOrder.indexOf(b);
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    return indexA - indexB;
  });

  const savedCat = localStorage.getItem('albasem_active_cat');
  if (!currentFilter) {
    if (savedCat && (savedCat === 'FAVORITES' || rawAreas.includes(savedCat))) {
      currentFilter = savedCat;
    } else {
      currentFilter = rawAreas.includes('نابلس') ? 'نابلس' : (rawAreas.find(a => a !== 'IPTV') || rawAreas[0] || '');
      localStorage.setItem('albasem_active_cat', currentFilter);
    }
  }

  filterBox.innerHTML = '';

  // زر المفضلة
  const favBtn = document.createElement('button');
  const isFavActive = currentFilter === 'FAVORITES';
  favBtn.className = `filter-chip flex-shrink-0 px-3.5 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap transition shadow-sm flex items-center gap-1.5 ${isFavActive ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/30' : 'bg-slate-900/90 text-amber-400 border-amber-500/30 hover:bg-slate-800'}`;
  favBtn.innerHTML = `<i class="fa-solid fa-star"></i> <span>المفضلة</span>`;
  favBtn.onclick = () => {
    currentFilter = 'FAVORITES';
    currentSubFilter = '';
    window.iptvDisplayLimit = 40;
    localStorage.setItem('albasem_active_cat', 'FAVORITES');
    setupFilters();
    renderCams();
  };
  filterBox.appendChild(favBtn);

  // باقي الأقسام
  rawAreas.forEach(area => {
    const btn = document.createElement('button');
    const isActive = area === currentFilter;
    btn.className = `filter-chip flex-shrink-0 px-3.5 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition shadow-sm ${isActive ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/50' : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:bg-slate-800'}`;
    btn.textContent = area === 'IPTV' ? '📺 IPTV - قنوات فضائية' : area;
    btn.onclick = () => {
      if (currentFilter !== area) {
        currentFilter = area;
        currentSubFilter = '';
        window.iptvDisplayLimit = 40;
        localStorage.setItem('albasem_active_cat', area);
        setupFilters();
        renderCams();
      }
    };
    filterBox.appendChild(btn);
  });

  // شريط تفريعات IPTV المنظم
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
    const defaultSubs = ['أفلام ومسلسلات', 'إخبارية', 'رياضة', 'إسلاميات', 'أطفال', 'وثائقي', 'موسيقى', 'مشكّل ومنوعات'];
    const customSubs = (window.iptvCustomSubs && Array.isArray(window.iptvCustomSubs)) ? window.iptvCustomSubs : [];
    const rawSubCats = [...new Set([...defaultSubs, ...customSubs, ...iptvStreams.map(s => s.category || s.subCategory)])].filter(Boolean);
    
    // الترتيب الأنيق للتفريعات
    const SUB_ORDER = ['أفلام ومسلسلات', 'إخبارية', 'رياضة', 'إسلاميات', 'أطفال', 'وثائقي', 'موسيقى', 'مشكّل ومنوعات'];
    rawSubCats.sort((a, b) => {
      let ia = SUB_ORDER.indexOf(a);
      let ib = SUB_ORDER.indexOf(b);
      if (ia === -1) ia = 999;
      if (ib === -1) ib = 999;
      return ia - ib;
    });

    if (!currentSubFilter || currentSubFilter === 'all' || !rawSubCats.includes(currentSubFilter)) {
      currentSubFilter = rawSubCats[0] || 'مشكّل ومنوعات';
    }

    subBox.innerHTML = '';
    rawSubCats.forEach(sub => {
      const sBtn = document.createElement('button');
      const isSubActive = sub === currentSubFilter;
      sBtn.className = `flex-shrink-0 px-3 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition ${isSubActive ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:bg-slate-700'}`;
      sBtn.textContent = sub;
      sBtn.onclick = () => {
        if (currentSubFilter !== sub) {
          currentSubFilter = sub;
          window.iptvDisplayLimit = 40;
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


// ==================== إدارة وتعديل الأقسام وتفريعات IPTV ====================
function openCategoryOrderModal() {
  isOrderingIptvMode = (typeof currentFilter !== 'undefined' && currentFilter === 'IPTV');
  const modalEl = document.getElementById('category-order-modal');
  if (!modalEl) return;

  const titleEl = modalEl.querySelector('h3');
  const descEl = modalEl.querySelector('p');

  if (isOrderingIptvMode) {
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-tv text-emerald-400"></i> إدارة وتعديل تفريعات IPTV';
    if (descEl) descEl.textContent = 'يمكنك إعادة تسمية أي تفريع، حذفه، أو إعادة ترتيب تفريعات IPTV';

    const defaultSubs = ['أفلام ومسلسلات', 'إخبارية', 'رياضة', 'إسلاميات', 'أطفال', 'وثائقي', 'موسيقى', 'مشكّل ومنوعات'];
    const customSubs = (window.iptvCustomSubs && Array.isArray(window.iptvCustomSubs)) ? window.iptvCustomSubs : [];
    const streamSubs = (typeof streamsData !== 'undefined' && Array.isArray(streamsData))
      ? streamsData.filter(s => s && s.area === 'IPTV').map(s => s.subCategory || s.category).filter(Boolean)
      : [];
    tempCategoryOrder = [...new Set([...defaultSubs, ...customSubs, ...streamSubs])];
  } else {
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-arrow-down-up-across-line text-emerald-400"></i> ترتيب أولويات الأقسام';
    if (descEl) descEl.textContent = 'اسحب أو رتّب الأقسام لتظهر أولاً بوجه الزوار عند فتح المنصة';

    const allAreas = [...new Set(((typeof streamsData !== 'undefined' && Array.isArray(streamsData)) ? streamsData : []).map(s => s.area))].filter(Boolean);
    const savedOrder = (typeof customCategoryOrder !== 'undefined' && Array.isArray(customCategoryOrder)) ? customCategoryOrder : [];
    tempCategoryOrder = savedOrder.filter(a => allAreas.includes(a));
    allAreas.forEach(a => {
      if (!tempCategoryOrder.includes(a)) tempCategoryOrder.push(a);
    });
  }

  renderCategoryOrderList();
  modalEl.classList.remove('hidden');
}

function closeCategoryOrderModal() {
  const modalEl = document.getElementById('category-order-modal');
  if (modalEl) modalEl.classList.add('hidden');
}

function renderCategoryOrderList() {
  const listEl = document.getElementById('category-order-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  tempCategoryOrder.forEach((cat, idx) => {
    let streamCount = 0;
    if (typeof streamsData !== 'undefined' && Array.isArray(streamsData)) {
      if (isOrderingIptvMode) {
        streamCount = streamsData.filter(s => s && s.area === 'IPTV' && (s.subCategory === cat || s.category === cat)).length;
      } else {
        streamCount = streamsData.filter(s => s && s.area === cat).length;
      }
    }

    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-xs gap-2';
    item.innerHTML = `
      <div class="flex items-center gap-2 overflow-hidden">
        <span class="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center text-[10px] shrink-0 font-bold">${idx + 1}</span>
        <span class="font-bold text-slate-200 truncate">${cat}</span>
        <span class="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">(${streamCount} قناة)</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button type="button" onclick="renameCategory('${cat.replace(/'/g, "\\'")}')" class="w-7 h-7 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded flex items-center justify-center transition" title="إعادة تسمية">
          <i class="fa-solid fa-pen text-[10px]"></i>
        </button>
        <button type="button" onclick="deleteCategory('${cat.replace(/'/g, "\\'")}')" class="w-7 h-7 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded flex items-center justify-center transition" title="حذف">
          <i class="fa-solid fa-trash text-[10px]"></i>
        </button>
        <button type="button" onclick="moveCategory(${idx}, -1)" class="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center justify-center transition" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''} title="تقديم">
          <i class="fa-solid fa-arrow-up text-[10px]"></i>
        </button>
        <button type="button" onclick="moveCategory(${idx}, 1)" class="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center justify-center transition" ${idx === tempCategoryOrder.length - 1 ? 'disabled style="opacity:0.3"' : ''} title="تأخير">
          <i class="fa-solid fa-arrow-down text-[10px]"></i>
        </button>
      </div>
    `;
    listEl.appendChild(item);
  });
}

async function renameCategory(oldName) {
  if (!currentUser) return alert("يرجى تسجيل الدخول كمسؤول أولاً!");
  const typeTitle = isOrderingIptvMode ? `تفريع IPTV "${oldName}"` : `قسم "${oldName}"`;
  const newName = prompt(`أدخل الاسم الجديد لـ ${typeTitle}:`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;

  const cleanNewName = newName.trim();
  if (tempCategoryOrder.includes(cleanNewName)) return alert(`⚠️ الاسم "${cleanNewName}" موجود بالفعل!`);

  try {
    if (isOrderingIptvMode) {
      const targets = streamsData.filter(s => s && s.area === 'IPTV' && (s.subCategory === oldName || s.category === oldName));
      if (!confirm(`هل أنت متأكد من تغيير اسم تفريع [${oldName}] إلى [${cleanNewName}]؟\nسيتم تحديث (${targets.length}) قناة تابعة له.`)) return;

      const updates = {};
      targets.forEach(s => {
        updates[`streams/${s.id}/subCategory`] = cleanNewName;
        updates[`streams/${s.id}/category`] = cleanNewName;
        s.subCategory = cleanNewName;
        s.category = cleanNewName;
      });

      const snap = await db.ref('streams/_config_iptv_subs').once('value');
      let subs = snap.val() || [];
      if (!Array.isArray(subs)) subs = Object.values(subs);
      subs = subs.map(s => s === oldName ? cleanNewName : s);
      if (!subs.includes(cleanNewName)) subs.push(cleanNewName);
      updates['streams/_config_iptv_subs'] = subs;

      await db.ref().update(updates);
      window.iptvCustomSubs = subs;
      tempCategoryOrder = tempCategoryOrder.map(c => c === oldName ? cleanNewName : c);
      renderCategoryOrderList();
      if (typeof setupIptvSubTabs === 'function') setupIptvSubTabs();
      if (typeof renderCams === 'function') renderCams();
      alert(`✅ تم تغيير اسم تفريع IPTV إلى [${cleanNewName}] وتحديث قنواته بنجاح!`);
    } else {
      const targets = streamsData.filter(s => s && s.area === oldName);
      if (!confirm(`هل أنت متأكد من تغيير اسم قسم "${oldName}" إلى "${cleanNewName}"؟\nسيتم تحديث (${targets.length}) قناة تابعة له.`)) return;

      const updates = {};
      targets.forEach(s => {
        updates[`streams/${s.id}/area`] = cleanNewName;
        s.area = cleanNewName;
      });

      tempCategoryOrder = tempCategoryOrder.map(c => c === oldName ? cleanNewName : c);
      customCategoryOrder = customCategoryOrder.map(c => c === oldName ? cleanNewName : c);
      updates['streams/_config_categories'] = tempCategoryOrder;

      await db.ref().update(updates);
      renderCategoryOrderList();
      if (typeof setupFilters === 'function') setupFilters();
      if (typeof renderCams === 'function') renderCams();
      alert(`✅ تم تغيير اسم القسم إلى [${cleanNewName}] وتحديث قنواته بنجاح!`);
    }
  } catch(e) {
    alert("خطأ أثناء إعادة التسمية: " + e.message);
  }
}

async function deleteCategory(catName) {
  if (!currentUser) return alert("يرجى تسجيل الدخول كمسؤول أولاً!");

  try {
    if (isOrderingIptvMode) {
      const targets = streamsData.filter(s => s && s.area === 'IPTV' && (s.subCategory === catName || s.category === catName));
      const confirmMsg = targets.length > 0
        ? `⚠️ تحذير: هل أنت متأكد من حذف تفريع IPTV [${catName}] نهائياً؟\nسيتم حذف (${targets.length}) قناة تابعة له من المنصة!`
        : `هل أنت متأكد من إزالة تفريع IPTV [${catName}] الفارغ نهائياً؟`;

      if (!confirm(confirmMsg)) return;

      const updates = {};
      targets.forEach(s => {
        updates[`streams/${s.id}`] = null;
      });

      const snap = await db.ref('streams/_config_iptv_subs').once('value');
      let subs = snap.val() || [];
      if (!Array.isArray(subs)) subs = Object.values(subs);
      subs = subs.filter(s => s !== catName);
      updates['streams/_config_iptv_subs'] = subs;

      await db.ref().update(updates);
      window.iptvCustomSubs = subs;
      tempCategoryOrder = tempCategoryOrder.filter(c => c !== catName);
      renderCategoryOrderList();
      if (typeof setupIptvSubTabs === 'function') setupIptvSubTabs();
      if (typeof renderCams === 'function') renderCams();
      alert(`✅ تم حذف تفريع IPTV [${catName}] بنجاح!`);
    } else {
      const targets = streamsData.filter(s => s && s.area === catName);
      const confirmMsg = targets.length > 0
        ? `⚠️ تحذير: هل أنت متأكد من حذف قسم "${catName}"؟\nسيتم حذف (${targets.length}) قناة تابعة له نهائياً!`
        : `هل تريد إزالة قسم "${catName}" الفارغ من القائمة؟`;

      if (!confirm(confirmMsg)) return;

      const updates = {};
      targets.forEach(s => {
        updates[`streams/${s.id}`] = null;
      });

      tempCategoryOrder = tempCategoryOrder.filter(c => c !== catName);
      customCategoryOrder = customCategoryOrder.filter(c => c !== catName);
      updates['streams/_config_categories'] = tempCategoryOrder;

      await db.ref().update(updates);
      renderCategoryOrderList();
      if (typeof setupFilters === 'function') setupFilters();
      if (typeof renderCams === 'function') renderCams();
      alert(`✅ تم حذف قسم "${catName}" بنجاح!`);
    }
  } catch(e) {
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
  if (!currentUser) return alert("يرجى تسجيل الدخول كمسؤول أولاً!");
  try {
    if (isOrderingIptvMode) {
      await db.ref('streams/_config_iptv_subs').set(tempCategoryOrder);
      window.iptvCustomSubs = [...tempCategoryOrder];
      if (typeof setupIptvSubTabs === 'function') setupIptvSubTabs();
      alert("✅ تم حفظ ترتيب تفريعات IPTV بنجاح!");
    } else {
      await db.ref('streams/_config_categories').set(tempCategoryOrder);
      customCategoryOrder = [...tempCategoryOrder];
      if (typeof setupFilters === 'function') setupFilters();
      alert("✅ تم حفظ ترتيب الأقسام بنجاح!");
    }
    closeCategoryOrderModal();
  } catch(e) {
    alert("خطأ أثناء حفظ الترتيب: " + e.message);
  }
}



function launchHlsStream(container, url, isModal = false, isIptv = false) {
  // فحص مباشر: إذا كان الرابط ملف فيديو عادي mp4
  const isDirectMp4 = url.toLowerCase().includes('.mp4') || (!url.toLowerCase().includes('.m3u8') && !url.includes('manifest'));
  if (isDirectMp4 && !url.includes('youtube') && !url.includes('youtu.be')) {
    container.innerHTML = '';
    const video = document.createElement('video');
    video.className = (isModal || isIptv) ? 'w-full h-full object-contain' : 'absolute inset-0 w-full h-full object-cover';
    video.src = url;
    video.controls = isModal;
    video.autoplay = true;
    video.playsInline = true;
    video.loop = true;
    if (isModal) {
      video.muted = false;
      video.volume = 1.0;
    } else {
      video.muted = true;
      video.volume = 0;
      video.setAttribute('muted', '');
      video.style.pointerEvents = 'none';
    }
    container.appendChild(video);
    video.play().catch(() => { video.muted = true; video.play().catch(()=>{}); });
    return video;
  }
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
  video.controls = isModal;
  video.playsInline = true;
  if (isModal) {
    video.muted = false;
    video.volume = 1.0;
  } else {
    video.muted = true;
    video.volume = 0;
    video.setAttribute('muted', '');
    video.style.pointerEvents = 'none';
  }
  
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
        
        <div class="flex items-center justify-center">
            <button class="retry-single-btn bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-lg flex items-center gap-1.5 active:scale-95">
              <i class="fa-solid fa-rotate-right"></i> إعادة المحاولة
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
  }, 16000);

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

  video.addEventListener('loadeddata', onStreamReady);
  video.addEventListener('canplay', onStreamReady);
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
          liveSyncDuration: 30,            // وسادة أمان صريحة 30 ثانية خلف البث الحي لمنع السقوط
          liveMaxLatencyDuration: 60,      // أقصى حد للتأخير المسموح
          liveDurationInfinity: true,      // بث حي لا نهائي ومنع جدار الـ 44 ثانية
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          backBufferLength: 30,
          manifestLoadingMaxRetry: 8,
          levelLoadingMaxRetry: 8,
          fragLoadingMaxRetry: 12,
          fragLoadingRetryDelay: 1000,
          nudgeMaxRetry: 10,              // دفش البث تلقائياً لو علق فريم بدون توقف
          nudgeOffset: 0.2
        });
        hlsInstance = hls;
        video._hls = hls;
        if (isModal) window.activeModalHlsInstance = hls;

        let networkRecoveryAttempts = 0;
        let mediaRecoveryAttempts = 0;

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {
            video.muted = true;
            video.play().catch(()=>{});
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          // التعامل الذكي مع تعليق الكاش المؤقت بدون استسلام
          if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
            hls.startLoad();
            return;
          }

          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (networkRecoveryAttempts < 10) {
                  networkRecoveryAttempts++;
                  setTimeout(() => { try { hls.startLoad(); } catch(e){} }, 800);
                  return;
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                if (mediaRecoveryAttempts < 6) {
                  mediaRecoveryAttempts++;
                  try {
                    if (mediaRecoveryAttempts % 2 === 0) hls.swapAudioCodec();
                    hls.recoverMediaError();
                  } catch(e){}
                  return;
                }
                break;
              default:
                break;
            }

            if (!usedProxy && isIptv) {
              tryFallbackProxy();
            } else {
              // مهلة أمان إضافية قبل إعلان تعذر العرض
              clearTimeout(safetyTimer);
              safetyTimer = setTimeout(() => {
                showOfflineBox();
              }, 4000);
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
  return video;
}

function renderCams() {
  const grid = document.getElementById('cams-grid');
  if (!grid) return;
  grid.innerHTML = '';

  let filtered = [];
  if (window.searchQuery && window.searchQuery.length > 0) {
    filtered = streamsData.filter(s => matchesSmartSearch(s.title || '', window.searchQuery));
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
          <div class="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 text-lg mb-1">
            <i class="fa-solid fa-magnifying-glass"></i>
          </div>
          <span class="font-bold text-slate-200 text-sm">لم نجد قنوات تطابق: "${window.searchQuery}"</span>
          <span class="text-slate-500 text-[11px]">جرب كتابة أحرف أقل أو جزء من اسم القناة.</span>
        </div>`;
      return;
    }
  } else if (currentFilter === 'FAVORITES') {
    const favs = getFavorites();
    filtered = streamsData.filter(s => favs.includes(String(s.id)));
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
          <div class="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl mb-1 shadow-inner">
            <i class="fa-regular fa-star"></i>
          </div>
          <span class="font-bold text-slate-200 text-sm">قائمة المفضلة فارغة حالياً</span>
          <span class="text-slate-500 text-[11px] max-w-xs leading-relaxed">اضغط على أيقونة النجمة (⭐) الموجودة على أي قناة لحفظها هنا والرجوع إليها بسرعة.</span>
        </div>`;
      return;
    }
  } else if (currentFilter === 'all') {
    filtered = streamsData.filter(s => s.area !== 'IPTV');
  } else {
    filtered = streamsData.filter(s => s.area === currentFilter);
  }

  if (currentFilter === 'IPTV' && currentSubFilter !== 'all') {
    filtered = filtered.filter(s => (s.category === currentSubFilter || s.subCategory === currentSubFilter || (currentSubFilter === 'مشكّل ومنوعات' && !s.category && !s.subCategory)));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-16 text-center text-slate-500 text-xs">لا توجد قنوات معروضة حالياً في هذا القسم.</div>`;
    return;
  }

  filtered.sort((a, b) => {
    const orderA = a.order !== undefined ? Number(a.order) : 9999;
    const orderB = b.order !== undefined ? Number(b.order) : 9999;
    return orderA - orderB;
  });

    // حماية معالج ورام الجوال عبر العرض السلس
  const totalMatches = filtered.length;
  const isLimited = totalMatches > window.iptvDisplayLimit;
  const displayList = isLimited ? filtered.slice(0, window.iptvDisplayLimit) : filtered;

  displayList.forEach(stream => {
    const card = document.createElement('div');
    card.className = 'bg-[#0f172a] border border-slate-800/90 rounded-xl overflow-hidden shadow-xl flex flex-col transition hover:border-slate-700 cursor-pointer active:border-slate-600';
    card.onclick = (e) => {
      if (!e.target.closest('button, input, label, a, select')) {
        openModal(stream.id);
      }
    };

    const adminActions = currentUser ? `
      <div class="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-2" onclick="event.stopPropagation()">
        <label class="bulk-chk-label ${window.isBulkSortActive ? 'inline-flex' : 'hidden'} items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-1.5 py-0.5 rounded cursor-pointer select-none">
          <input type="checkbox" class="bulk-stream-chk accent-emerald-500 cursor-pointer w-3.5 h-3.5" value="${stream.id}" onchange="updateBulkSelectedCount()" ${(window.selectedBulkStreams && window.selectedBulkStreams.has(stream.id)) ? 'checked' : ''}>
          <span>تحديد</span>
        </label>
                  <button onclick="openEditModal('${stream.id}')" class="bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white px-2 py-0.5 rounded text-[11px] transition" title="تعديل">
            <i class="fa-solid fa-pen-to-square"></i> تعديل
          </button>
          <button onclick="toggleStreamLock('${stream.id}', event)" class="${stream.isLocked ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20' : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950'} px-2 py-0.5 rounded text-[11px] transition flex items-center gap-1" title="${stream.isLocked ? 'فك قفل الرقابة الأبوية' : 'قفل فوري برمز 1415'}">
            <i class="fa-solid ${stream.isLocked ? 'fa-lock' : 'fa-lock-open'}"></i>
            <span>${stream.isLocked ? 'مقفلة' : 'قفل'}</span>
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
          <span class="font-bold text-slate-200 truncate hover:text-emerald-400 transition">${stream.title}</span>${stream.isLocked ? '<span class="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 flex-shrink-0"><i class="fa-solid fa-lock text-[9px]"></i> مقفل</span>' : ''}
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          ${adminActions}
          <button onclick="toggleFavorite('${stream.id}', event)" class="fav-btn fav-btn-${stream.id} p-1 rounded hover:bg-slate-800 transition" title="المفضلة">
            <i class="${getFavorites().includes(String(stream.id)) ? 'fa-solid text-amber-400' : 'fa-regular text-slate-400'} fa-star"></i>
          </button>
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
          openModal(stream.id);
        };
      } else {
        launchHlsStream(feedContainer, stream.url, false, false);
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

  if (isLimited) {
    const moreDiv = document.createElement('div');
    moreDiv.className = 'col-span-full py-4 text-center';
    moreDiv.innerHTML = `
      <button id="load-more-cams-btn" class="px-5 py-2.5 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition shadow-lg flex items-center justify-center gap-2 mx-auto">
        <i class="fa-solid fa-angles-down"></i>
        <span>عرض المزيد من القنوات (عرض ${displayList.length} من أصل ${totalMatches})</span>
      </button>
    `;
    grid.appendChild(moreDiv);
    document.getElementById('load-more-cams-btn').onclick = () => {
      window.iptvDisplayLimit += 40;
      renderCams();
    };
  }
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
  document.getElementById('edit-title').value = stream.title || '';
  document.getElementById('edit-area').value = stream.area || '';
  document.getElementById('edit-type').value = stream.type || 'hls';
  document.getElementById('edit-url').value = stream.url || '';
  const lockEl = document.getElementById('edit-is-locked');
  if (lockEl) lockEl.checked = !!stream.isLocked;

  // تعبئة قائمة تفريعات IPTV
  const subSelect = document.getElementById('edit-subcategory');
  if (subSelect) {
    const defaultSubs = ['أفلام ومسلسلات', 'إخبارية', 'رياضة', 'إسلاميات', 'أطفال', 'وثائقي', 'موسيقى', 'مشكّل ومنوعات'];
    const customSubs = (window.iptvCustomSubs && Array.isArray(window.iptvCustomSubs)) ? window.iptvCustomSubs : [];
    const allSubs = [...new Set([...defaultSubs, ...customSubs])];
    
    let currentSub = stream.subCategory || stream.category || 'مشكّل ومنوعات';
    if (!allSubs.includes(currentSub)) allSubs.push(currentSub);

    subSelect.innerHTML = allSubs.map(s => `<option value="${s}" ${s === currentSub ? 'selected' : ''}>${s}</option>`).join('');
  }

  const subWrapper = document.getElementById('edit-subcat-wrapper');
  if (subWrapper) {
    subWrapper.style.display = (stream.area === 'IPTV') ? 'block' : 'none';
  }

  const areaInput = document.getElementById('edit-area');
  if (areaInput) {
    areaInput.oninput = function() {
      if (subWrapper) subWrapper.style.display = (this.value.trim() === 'IPTV') ? 'block' : 'none';
    };
  }

  document.getElementById('edit-modal-title').textContent = "✏️ تعديل بيانات القناة ونقلها";
  document.getElementById('edit-save-btn').textContent = "حفظ التعديلات ونقل القناة";
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

async function handleSaveStream(e) {
  e.preventDefault();
  if (!currentUser) return alert("يرجى تسجيل الدخول كمسؤول أولاً!");

  const streamId = document.getElementById('edit-stream-id').value;
  const areaVal = document.getElementById('edit-area').value.trim();
  const subCatSelect = document.getElementById('edit-subcategory');
  const chosenSubCat = (areaVal === 'IPTV' && subCatSelect) ? subCatSelect.value.trim() : '';

  const payload = {
    title: document.getElementById('edit-title').value.trim(),
    area: areaVal,
    type: document.getElementById('edit-type').value,
    url: document.getElementById('edit-url').value.trim(),
    category: chosenSubCat || areaVal,
    subCategory: chosenSubCat || areaVal,
    status: 'active'
  };

  const lockEl = document.getElementById('edit-is-locked');
  if (lockEl) payload.isLocked = lockEl.checked;

  try {
    if (streamId) {
      await db.ref('streams/' + streamId).update(payload);
      const idx = streamsData.findIndex(s => s.id === streamId);
      if (idx !== -1) Object.assign(streamsData[idx], payload);
      alert("✅ تم حفظ تعديل القناة ونقلها بنجاح!");
    } else {
      const newRef = await streamsRef.push(payload);
      payload.id = newRef.key;
      streamsData.push(payload);
      alert("✅ تم إضافة البث ونشره بنجاح!");
    }
    closeEditModal();
    if (typeof setupFilters === 'function') setupFilters();
    if (typeof setupIptvSubTabs === 'function') setupIptvSubTabs();
    if (typeof renderCams === 'function') renderCams();
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
  // فحص الرقابة الأبوية قبل تشغيل المشغل
  if (!window._parentalBypass) {
    checkParentalAccess(streamId, () => {
      window._parentalBypass = true;
      openModal(streamId);
      window._parentalBypass = false;
    });
    return;
  }
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
