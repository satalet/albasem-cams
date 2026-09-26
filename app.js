// ==========================================
// نظام البنر التلفزيوني الذكي وإيماءات السحب (TV OSD & Reels Gestures)
// ==========================================
var _osdHideTimer = null;
var _headerHideTimer = null;
window._lastOsdShowTime = 0;

function showChannelOSD(stream, channelNum, totalCount, isStillLoading = true) {
  window._lastOsdShowTime = Date.now();
  const osd = document.getElementById('tv-channel-osd');
  if (!osd || !stream) return;

  const numEl = document.getElementById('osd-channel-num');
  const titleEl = document.getElementById('osd-channel-title');
  const areaEl = document.getElementById('osd-channel-area');
  const counterEl = document.getElementById('osd-channel-counter');
  const statusEl = document.getElementById('osd-channel-status');

  if (numEl) numEl.textContent = String(channelNum).padStart(2, '0');
  if (titleEl) titleEl.textContent = stream.title || 'بث مباشر';
  if (areaEl) areaEl.textContent = stream.area || 'IPTV';
  if (counterEl) counterEl.textContent = '(' + channelNum + ' / ' + totalCount + ')';
  
  if (statusEl) {
    if (isStillLoading) {
      statusEl.className = 'flex items-center gap-1.5 text-xs text-amber-400 mt-1';
      statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span><span>جاري فتح القناة...</span>';
    } else {
      statusEl.className = 'flex items-center gap-1.5 text-xs text-emerald-400 mt-1 font-bold';
      statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>بث حي ومباشر</span>';
    }
  }

  osd.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
  osd.style.opacity = '1';
  osd.style.transform = 'translateY(0)';
  osd.style.pointerEvents = 'auto';

  toggleHeaderBar(true);

  if (_osdHideTimer) clearTimeout(_osdHideTimer);
  // أثناء التحميل يظل البنر ظاهراً 8 ثوانٍ ليبقى اسم القناة واضحاً
  const displayDuration = isStillLoading ? 8000 : 3500;
  _osdHideTimer = setTimeout(() => {
    hideChannelOSD();
  }, displayDuration);

  resetHeaderAutoHide();
}

function hideChannelOSD() {
  const osd = document.getElementById('tv-channel-osd');
  if (osd) {
    osd.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
    osd.style.opacity = '0';
    osd.style.transform = 'translateY(24px)';
    osd.style.pointerEvents = 'none';
  }
}

function toggleHeaderBar(show) {
  const header = document.getElementById('modal-header-bar');
  if (!header) return;
  header.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
  if (show) {
    header.style.opacity = '1';
    header.style.transform = 'translateY(0)';
    header.style.pointerEvents = 'auto';
  } else {
    header.style.opacity = '0';
    header.style.transform = 'translateY(-100%)';
    header.style.pointerEvents = 'none';
  }
}

function resetHeaderAutoHide() {
  if (_headerHideTimer) clearTimeout(_headerHideTimer);
  _headerHideTimer = setTimeout(() => {
    toggleHeaderBar(false);
  }, 3200);
}

function markTvOsdLive() {
  const osd = document.getElementById('tv-channel-osd');
  const statusEl = document.getElementById('osd-channel-status');
  if (statusEl) {
    statusEl.className = 'flex items-center gap-1.5 text-xs text-emerald-400 mt-1 font-bold';
    statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>بث حي ومباشر</span>';
  }
  if (osd) {
    osd.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
    osd.style.opacity = '1';
    osd.style.transform = 'translateY(0)';
  }
  if (_osdHideTimer) clearTimeout(_osdHideTimer);
  _osdHideTimer = setTimeout(() => {
    hideChannelOSD();
  }, 2500);
}
window.markTvOsdLive = markTvOsdLive;

// لمس أو نقر الشاشة يُظهر الشريط والبنر معاً
document.addEventListener('click', (e) => {
  const modal = document.getElementById('cam-modal');
  if (!modal || modal.classList.contains('hidden')) return;
  if (e.target.closest('#modal-header-bar') || e.target.closest('#tv-channel-osd')) return;

  if (Date.now() - (window._lastOsdShowTime || 0) < 600) return;

  const header = document.getElementById('modal-header-bar');
  const isHidden = header && (header.style.opacity === '0' || header.classList.contains('opacity-0'));
  if (isHidden) {
    toggleHeaderBar(true);
    resetHeaderAutoHide();
    const curId = window.currentModalStreamId;
    const list = window.activeCategoryStreams || (typeof streamsData !== 'undefined' ? streamsData : []);
    const curStream = list.find(s => s.id === curId);
    if (curStream) {
      const idx = list.findIndex(s => s.id === curId);
      showChannelOSD(curStream, idx !== -1 ? idx + 1 : 1, list.length || 1, false);
    }
  } else {
    toggleHeaderBar(false);
    hideChannelOSD();
  }
});

// إيماءات السحب العمودي الاحترافية للجوال (Vertical Reels/TikTok Swipe)
let touchStartY = 0;
let touchStartX = 0;
let touchStartTime = 0;
let isSwiping = false;

document.addEventListener('touchstart', (e) => {
  const modal = document.getElementById('cam-modal');
  if (!modal || modal.classList.contains('hidden')) return;
  if (e.touches.length === 1) {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    touchStartTime = Date.now();
    isSwiping = true;
  }
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  const modal = document.getElementById('cam-modal');
  if (!modal || modal.classList.contains('hidden') || !isSwiping) return;
  
  const currentY = e.touches[0].clientY;
  const currentX = e.touches[0].clientX;
  const diffY = currentY - touchStartY;
  const diffX = currentX - touchStartX;

  if (Math.abs(diffY) > Math.abs(diffX) && e.cancelable) {
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('touchend', (e) => {
  const modal = document.getElementById('cam-modal');
  if (!modal || modal.classList.contains('hidden') || !isSwiping) return;
  isSwiping = false;

  if (e.changedTouches.length === 1) {
    const diffY = e.changedTouches[0].clientY - touchStartY;
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffTime = Date.now() - touchStartTime;

    if (diffTime < 600 && Math.abs(diffY) > 35 && Math.abs(diffY) > Math.abs(diffX) * 1.1) {
      if (diffY < 0) {
        navigateStream(1);  // سحب لأعلى -> القناة التالية
      } else {
        navigateStream(-1); // سحب لأسفل -> القناة السابقة
      }
    }
  }
}, { passive: true });

window.isStreamAllowedForSubscriber = function(stream) {
  if (typeof currentUser !== 'undefined' && currentUser) return true;
  try {
    const rawSub = localStorage.getItem('albasem_subscriber');
    if (!rawSub) return true;
    const sub = JSON.parse(rawSub);
    if (!sub || sub.status === 'blocked') return false;

    const allowedAreas = sub.allowedAreas || ['all'];
    if (!allowedAreas.includes('all') && !allowedAreas.includes(stream.area)) {
      return false;
    }

    if (stream.area === 'IPTV') {
      const allowedSubs = sub.allowedIptvSubs || ['all'];
      if (!allowedSubs.includes('all')) {
        const streamSub = stream.subCategory || stream.category || 'مشكّل ومنوعات';
        if (!allowedSubs.includes(streamSub)) return false;
      }
    }
    return true;
  } catch(e) {
    return true;
  }
};


// ==================== نظام الماستر كود اليومي وحماية الرقابة الأبوية ====================
window.iptvDefaultPin = '1415';

function getDailyMasterPin() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}${mm}77`;
}

window._modalJustClosed = false;
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
  // تشغيل بنر الرسيفر وتحديث رقم واسم القناة فوراً
  window.currentModalStreamId = streamId;
    let _chNum = 1;
    let _totalCh = 1;
    if (window.activeCategoryStreams && window.activeCategoryStreams.length > 0) {
      const fIdx = window.activeCategoryStreams.findIndex(s => s.id === streamId);
      if (fIdx !== -1) _chNum = fIdx + 1;
      _totalCh = window.activeCategoryStreams.length;
    }
    if (typeof showChannelOSD === 'function') {
      showChannelOSD(stream, _chNum, _totalCh);
    }
  if (!window.activeCategoryStreams || window.activeCategoryStreams.length === 0) {
    window.activeCategoryStreams = streamsData.filter(s => s.area === stream.area);
  }
  const _cIdx = window.activeCategoryStreams.findIndex(s => s.id === streamId);
  const _cTot = window.activeCategoryStreams.length;
  if (typeof showTvOsd === 'function') {
    showTvOsd(stream, _cIdx, _cTot);
  }
  if (typeof resetControlsTimer === 'function') {
    resetControlsTimer();
  }


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
  if (!stream) {
    if (typeof onAllowed === 'function') onAllowed();
    return;
  }

  // 1. فحص الجلسة المؤقتة للقسم
  const streamSub = stream.subCategory || stream.category;
  if (window.activeUnlockedSub && (streamSub === window.activeUnlockedSub || currentSubFilter === window.activeUnlockedSub)) {
    if (typeof onAllowed === 'function') onAllowed();
    return;
  }

  // 2. فحص قفل المحطة الفردية
  if (!stream.isLocked) {
    if (typeof onAllowed === 'function') onAllowed();
    return;
  }

  showParentalPinModal(() => {
    if (typeof onAllowed === 'function') onAllowed();
  });
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
    window._modalJustClosed = true;
    setTimeout(() => { window._modalJustClosed = false; }, 600);
  };

  const handleVerify = () => {
    const entered = input.value.trim();
    const defaultPin = window.iptvDefaultPin || '1415';
    const currentPin = localStorage.getItem('albasem_custom_pin') || defaultPin;
    const masterPin = typeof getDailyMasterPin === 'function' ? getDailyMasterPin() : '';
    if (entered === currentPin || (masterPin && entered === masterPin)) {
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
    const defaultPin = window.iptvDefaultPin || '1415';
    const curSaved = localStorage.getItem('albasem_custom_pin') || defaultPin;
    const masterPin = typeof getDailyMasterPin === 'function' ? getDailyMasterPin() : '';
    const oldEntered = oldIn.value.trim();
    if (oldEntered !== curSaved && (!masterPin || oldEntered !== masterPin)) {
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

// تعبئة قائمة وجهة الترحيل الذكية المتوافقة مع المجلدات وفروعها
function populateTargetAreas() {
    const sel = document.getElementById('bulkTargetArea');
    if (!sel) return;

    const currentVal = sel.value;
    const cur = (typeof currentFilter !== 'undefined') ? currentFilter : 'LOCAL';
    const folderNames = {
        'LOCAL': 'قنوات محلية',
        'ARABIC': 'قنوات عربية',
        'FOREIGN': 'قنوات أجنبية',
        'IPTV': 'IPTV'
    };

    let opts = '<option value="" style="background-color:#0f172a; color:#94a3b8;">-- 📍 اختر وجهة الترحيل من هنا --</option>';

    // 1. فروع المجلد المفتوح حالياً في الصدارة
    if (cur !== 'FAVORITES') {
        const curSubs = (typeof getDynamicSubCategories === 'function') ? getDynamicSubCategories(cur) : [];
        const curTitle = folderNames[cur] || cur;
        opts += `<optgroup label="⭐ فروع المجلد الحالي (${curTitle})" style="background-color:#0b1329; color:#38bdf8; font-weight:bold;">`;
        curSubs.forEach(sub => {
            const val = `${cur}:${sub}`;
            const isSel = (currentVal === val) ? 'selected' : '';
            opts += `<option value="${val}" ${isSel} style="background-color:#1e293b; color:#ffffff; font-weight:bold; padding:4px;">📍 إلى فرع: ${sub}</option>`;
        });
        opts += '</optgroup>';
    }

    // 2. فروع المجلدات الأخرى (لتسهيل الترحيل بين المجلدات)
    ['LOCAL', 'ARABIC', 'FOREIGN', 'IPTV'].forEach(fId => {
        if (fId === cur) return;
        const fSubs = (typeof getDynamicSubCategories === 'function') ? getDynamicSubCategories(fId) : [];
        const fTitle = folderNames[fId] || fId;
        opts += `<optgroup label="📁 ${fTitle}" style="background-color:#0b1329; color:#94a3b8; font-weight:bold;">`;
        fSubs.forEach(sub => {
            const val = `${fId}:${sub}`;
            const isSel = (currentVal === val) ? 'selected' : '';
            opts += `<option value="${val}" ${isSel} style="background-color:#1e293b; color:#ffffff; padding:4px;">${fTitle} > ${sub}</option>`;
        });
        opts += '</optgroup>';
    });

    // 3. كتابة فرع جديد يدوياً
    opts += '<optgroup label="✏️ خيارات إضافية" style="background-color:#0b1329; color:#fbbf24; font-weight:bold;">';
    opts += '<option value="__NEW_CUSTOM__" style="background-color:#1e293b; color:#38bdf8; font-weight:bold; padding:4px;">➕ إنشاء فرع جديد باليد...</option>';
    opts += '</optgroup>';

    sel.innerHTML = opts;

    sel.onchange = function() {
        if (this.value === '__NEW_CUSTOM__') {
            this.value = '';
            window.addNewCategoryDirect();
        }
    };
}

// تنفيذ الترحيل الفعلي في الفايربيس مع تحديث الفروع
window.executeBulkMove = async function() {
    if (!currentUser) return alert("يرجى تسجيل الدخول كمسؤول أولاً!");

    const selectedIds = (typeof getActiveSelectedIds === 'function') ? getActiveSelectedIds() : [];
    if (!selectedIds || selectedIds.length === 0) {
        return alert('⚠️ يرجى تحديد قناة واحدة على الأقل بالضغط على مربع [تحديد] الأخضر!');
    }

    const sel = document.getElementById('bulkTargetArea');
    let target = sel ? sel.value : '';

    const cur = (typeof currentFilter !== 'undefined') ? currentFilter : 'LOCAL';
    const folderNames = {
        'LOCAL': 'قنوات محلية',
        'ARABIC': 'قنوات عربية',
        'FOREIGN': 'قنوات أجنبية',
        'IPTV': 'IPTV'
    };

    let targetFolder = cur;
    let targetSub = '';

    if (!target || target === '__NEW_CUSTOM__') {
        const askMsg = (cur === 'LOCAL')
            ? `لم تختر وجهة من القائمة!\nأدخل اسم الفرع المحلي لترحيل (${selectedIds.length}) قناة إليه (مثال: نابلس، جنين، القدس...):`
            : (cur === 'ARABIC')
            ? `لم تختر وجهة من القائمة!\nأدخل اسم الفرع العربي لترحيل (${selectedIds.length}) قناة إليه (مثال: قنوات فلسطين، إخبارية...):`
            : (cur === 'FOREIGN')
            ? `لم تختر وجهة من القائمة!\nأدخل اسم الفرع الأجنبي لترحيل (${selectedIds.length}) قناة إليه:`
            : `لم تختر وجهة من القائمة!\nأدخل اسم تصنيف IPTV لترحيل (${selectedIds.length}) قناة إليه:`;

        const typed = prompt(askMsg);
        if (!typed || !typed.trim()) return;
        targetSub = typed.trim();
        targetFolder = cur;
    } else if (target.includes(':')) {
        const parts = target.split(':');
        targetFolder = parts[0];
        targetSub = parts.slice(1).join(':').trim();
    } else if (target.startsWith('SUB:')) {
        targetFolder = 'IPTV';
        targetSub = target.replace('SUB:', '').trim();
    } else if (target.startsWith('AREA:')) {
        targetFolder = 'LOCAL';
        targetSub = target.replace('AREA:', '').trim();
    } else {
        targetSub = target.trim();
    }

    const folderTitle = folderNames[targetFolder] || targetFolder;
    const destTitle = `${folderTitle} > [${targetSub}]`;

    if (!confirm(`هل أنت متأكد من ترحيل (${selectedIds.length}) قنوات إلى ${destTitle}؟`)) return;

    const updates = {};
    const canonicalArea = folderNames[targetFolder] || targetFolder;

    // حفظ الفرع الجديد في إعدادات الفايربيس إن لم يكن موجوداً
    try {
        let configKey = 'streams/_config_local_subs';
        if (targetFolder === 'LOCAL') configKey = 'streams/_config_local_subs';
        else if (targetFolder === 'ARABIC') configKey = 'streams/_config_arabic_subs';
        else if (targetFolder === 'FOREIGN') configKey = 'streams/_config_foreign_subs';
        else if (targetFolder === 'IPTV') configKey = 'streams/_config_iptv_subs';

        const snap = await db.ref(configKey).once('value');
        let subs = snap.val() || [];
        if (!Array.isArray(subs)) subs = Object.values(subs);
        if (!subs.includes(targetSub)) {
            subs.push(targetSub);
            updates[configKey] = subs;
        }

        if (targetFolder === 'LOCAL') {
            const cSnap = await db.ref('streams/_config_categories').once('value');
            let legacyCats = cSnap.val() || [];
            if (!Array.isArray(legacyCats)) legacyCats = Object.values(legacyCats);
            if (!legacyCats.includes(targetSub)) {
                legacyCats.push(targetSub);
                updates['streams/_config_categories'] = legacyCats;
            }
        }
    } catch(e){}

    // تحديث بيانات كل قناة محددة
    selectedIds.forEach(id => {
        updates[`streams/${id}/area`] = canonicalArea;
        updates[`streams/${id}/subCategory`] = targetSub;
        updates[`streams/${id}/category`] = targetSub;

        const item = (typeof streamsData !== 'undefined' && Array.isArray(streamsData)) ? streamsData.find(s => s && s.id === id) : null;
        if (item) {
            item.area = canonicalArea;
            item.subCategory = targetSub;
            item.category = targetSub;
        }
    });

    try {
        await db.ref().update(updates);
        alert(`✅ تم بنجاح ترحيل ${selectedIds.length} قناة إلى ${destTitle}!`);
        if (typeof selectAllBulk === 'function') selectAllBulk(false);
        if (typeof setupFilters === 'function') setupFilters();
        if (typeof populateTargetAreas === 'function') populateTargetAreas();
        if (typeof renderCams === 'function') renderCams();
    } catch(err) {
        alert('خطأ أثناء الترحيل: ' + err.message);
    }
};

// إنشاء فرع جديد ذكي حسب المجلد المفتوح حالياً
window.addNewCategoryDirect = async function() {
    if (!currentUser) return alert("يرجى تسجيل الدخول كمسؤول أولاً!");

    const cur = (typeof currentFilter !== 'undefined') ? currentFilter : 'LOCAL';
    let promptMsg = '';
    let targetFolder = cur;

    if (cur === 'LOCAL') {
        promptMsg = '📍 أدخل اسم الفرع المحلي الجديد (مثلاً: نابلس، جنين، القدس، رام الله، الخليل، طولكرم):';
    } else if (cur === 'ARABIC') {
        promptMsg = '🌍 أدخل اسم الفرع العربي الجديد (مثلاً: قنوات فلسطين، قنوات إخبارية، قنوات مصرية):';
    } else if (cur === 'FOREIGN') {
        promptMsg = '🌐 أدخل اسم الفرع الأجنبي الجديد (مثلاً: أخبار دولية، رياضة عالمية، وثائقيات):';
    } else if (cur === 'IPTV') {
        promptMsg = '📺 أدخل اسم التصنيف الفرعي الجديد لقنوات IPTV (مثلاً: مسلسلات تركية، أطفال، أفلام 4K):';
    } else {
        promptMsg = '📁 أدخل اسم الفرع الجديد:';
        targetFolder = 'LOCAL';
    }

    const catName = prompt(promptMsg);
    if (!catName || !catName.trim()) return;
    const cleanName = catName.trim();

    try {
        let configKey = 'streams/_config_local_subs';

        if (targetFolder === 'LOCAL') {
            configKey = 'streams/_config_local_subs';
        } else if (targetFolder === 'ARABIC') {
            configKey = 'streams/_config_arabic_subs';
        } else if (targetFolder === 'FOREIGN') {
            configKey = 'streams/_config_foreign_subs';
        } else if (targetFolder === 'IPTV') {
            configKey = 'streams/_config_iptv_subs';
        }

        const snap = await db.ref(configKey).once('value');
        let subs = snap.val() || [];
        if (!Array.isArray(subs)) subs = Object.values(subs);

        if (subs.includes(cleanName)) {
            return alert(`⚠️ هذا الفرع [${cleanName}] موجود بالفعل!`);
        }

        subs.push(cleanName);
        await db.ref(configKey).set(subs);

        if (targetFolder === 'LOCAL') {
            try {
                const cSnap = await db.ref('streams/_config_categories').once('value');
                let legacyCats = cSnap.val() || [];
                if (!Array.isArray(legacyCats)) legacyCats = Object.values(legacyCats);
                if (!legacyCats.includes(cleanName)) {
                    legacyCats.push(cleanName);
                    await db.ref('streams/_config_categories').set(legacyCats);
                }
            } catch(e){}
        }

        alert(`✅ تم إنشاء فرع [${cleanName}] بنجاح وحفظه في الفايربيس!`);
        if (typeof setupFilters === 'function') setupFilters();
        if (typeof populateTargetAreas === 'function') populateTargetAreas();
    } catch(e) {
        alert('حدث خطأ أثناء الإنشاء: ' + e.message);
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
window.iptvLockedSubs = [];
window.activeUnlockedSub = null;

db.ref('streams/_config_locked_subs').on('value', snap => {
    const val = snap.val();
    window.iptvLockedSubs = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
    if (typeof setupFilters === 'function') setupFilters();
    if (typeof renderCategoryOrderList === 'function' && document.getElementById('category-order-modal') && !document.getElementById('category-order-modal').classList.contains('hidden')) {
        renderCategoryOrderList();
    }
});

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
// ==========================================
// نظام المجلدات الذكي والتفرعات العمودية (Mobile Dynamic Folders)
// ==========================================
const MAIN_FOLDERS = [
  { id: 'FAVORITES', title: 'المفضلة', icon: 'fa-star text-amber-400' },
  { id: 'LOCAL', title: 'قنوات محلية', icon: 'fa-location-dot text-rose-400' },
  { id: 'ARABIC', title: 'قنوات عربية', icon: 'fa-earth-africa text-emerald-400' },
  { id: 'FOREIGN', title: 'قنوات أجنبية', icon: 'fa-globe text-sky-400' },
  { id: 'IPTV', title: 'IPTV', icon: 'fa-tv text-purple-400' }
];

function getDynamicSubCategories(folderId) {
  if (!Array.isArray(streamsData)) return [];
  
  if (folderId === 'LOCAL') {
    const localStreams = streamsData.filter(s => {
      if (!s || !s.area) return false;
      const a = s.area.trim();
      return a !== 'IPTV' && a !== 'قنوات عربية' && a !== 'قنوات أجنبية';
    });
    const customLocal = (window.localCustomSubs && Array.isArray(window.localCustomSubs)) ? window.localCustomSubs : [];
    const legacyCats = (window.customCategoryOrder && Array.isArray(window.customCategoryOrder)) ? window.customCategoryOrder : [];
    const streamCities = localStreams.map(s => (s.subCategory || s.category || s.area || '').trim()).filter(Boolean);
    const all = [...new Set([...customLocal, ...legacyCats, ...streamCities])].filter(s => s && !['all', 'FAVORITES', 'LOCAL', 'قنوات محلية', 'IPTV', 'قنوات عربية', 'قنوات عربيه', 'قنوات أجنبية'].includes(s));
    return all.sort((a, b) => a.localeCompare('ar'));
  }
  
  if (folderId === 'ARABIC') {
    const arabStreams = streamsData.filter(s => s && (s.area === 'قنوات عربية' || s.category === 'قنوات عربية'));
    const customArab = (window.arabicCustomSubs && Array.isArray(window.arabicCustomSubs)) ? window.arabicCustomSubs : [];
    const streamSubs = arabStreams.map(s => (s.subCategory || s.category || '').trim()).filter(Boolean);
    const all = [...new Set([...customArab, ...streamSubs])].filter(s => s && s !== 'قنوات عربية' && s !== 'all' && s !== 'ARABIC');
    return all.sort((a, b) => a.localeCompare('ar'));
  }

  if (folderId === 'FOREIGN') {
    const forStreams = streamsData.filter(s => s && (s.area === 'قنوات أجنبية' || s.category === 'قنوات أجنبية'));
    const customFor = (window.foreignCustomSubs && Array.isArray(window.foreignCustomSubs)) ? window.foreignCustomSubs : [];
    const streamSubs = forStreams.map(s => (s.subCategory || s.category || '').trim()).filter(Boolean);
    const all = [...new Set([...customFor, ...streamSubs])].filter(s => s && s !== 'قنوات أجنبية' && s !== 'all' && s !== 'FOREIGN');
    return all.sort((a, b) => a.localeCompare('ar'));
  }

  if (folderId === 'IPTV') {
    const iptvStreams = streamsData.filter(s => s && s.area === 'IPTV');
    const defaultSubs = ['أفلام ومسلسلات', 'إخبارية', 'رياضة', 'إسلاميات', 'أطفال', 'وثائقي', 'موسيقى', 'مشكّل ومنوعات'];
    const customSubs = (window.iptvCustomSubs && Array.isArray(window.iptvCustomSubs)) ? window.iptvCustomSubs : [];
    const streamSubs = iptvStreams.map(s => (s.category || s.subCategory || 'مشكّل ومنوعات').trim());
    let subs = [...new Set([...defaultSubs, ...customSubs, ...streamSubs])].filter(Boolean);
    
    try {
      const _rawSub = localStorage.getItem('albasem_subscriber');
      if (_rawSub && (!window.currentUser)) {
        const _sub = JSON.parse(_rawSub);
        if (_sub && _sub.allowedIptvSubs && !_sub.allowedIptvSubs.includes('all')) {
          subs = subs.filter(subName => _sub.allowedIptvSubs.includes(subName));
        }
      }
    } catch(e){}
    
    const SUB_ORDER = ['أفلام ومسلسلات', 'إخبارية', 'رياضة', 'إسلاميات', 'أطفال', 'وثائقي', 'موسيقى', 'مشكّل ومنوعات'];
    subs.sort((a, b) => {
      let ia = SUB_ORDER.indexOf(a);
      let ib = SUB_ORDER.indexOf(b);
      if (ia === -1) ia = 999;
      if (ib === -1) ib = 999;
      return ia - ib;
    });
    return subs;
  }

  return [];
}

// دوال درج التفرعات العائم التفاعلي (Floating Bottom Sheet Drawer)
function closeSubCategoryDrawer() {
  const drawer = document.getElementById('subcat-floating-drawer');
  if (drawer) {
    drawer.classList.add('opacity-0', 'pointer-events-none');
    const sheet = drawer.querySelector('#subcat-drawer-sheet');
    if (sheet) sheet.classList.add('translate-y-full');
    setTimeout(() => { drawer.classList.add('hidden'); }, 280);
  }
}
window.closeSubCategoryDrawer = closeSubCategoryDrawer;

function openSubCategoryDrawer() {
  const drawer = document.getElementById('subcat-floating-drawer');
  if (drawer) {
    drawer.classList.remove('hidden', 'pointer-events-none');
    void drawer.offsetWidth;
    drawer.classList.remove('opacity-0');
    const sheet = drawer.querySelector('#subcat-drawer-sheet');
    if (sheet) sheet.classList.remove('translate-y-full');
  }
}
window.openSubCategoryDrawer = openSubCategoryDrawer;

function toggleSubCategoryDrawer() {
  const drawer = document.getElementById('subcat-floating-drawer');
  if (!drawer || drawer.classList.contains('hidden') || drawer.classList.contains('opacity-0')) {
    openSubCategoryDrawer();
  } else {
    closeSubCategoryDrawer();
  }
}
window.toggleSubCategoryDrawer = toggleSubCategoryDrawer;

function setupFilters() {
  const filterBox = document.getElementById('filter-buttons');
  if (!filterBox) return;

  setupSearchBar();
  if (typeof autoCategorizeStreams === 'function') autoCategorizeStreams();

  const validFolders = ['FAVORITES', 'LOCAL', 'ARABIC', 'FOREIGN', 'IPTV'];
  const savedCat = localStorage.getItem('albasem_active_cat');
  if (!currentFilter || !validFolders.includes(currentFilter)) {
    if (savedCat && validFolders.includes(savedCat)) {
      currentFilter = savedCat;
    } else {
      currentFilter = 'LOCAL';
      localStorage.setItem('albasem_active_cat', 'LOCAL');
    }
  }

  filterBox.className = "flex flex-col w-full gap-2";
  filterBox.innerHTML = '';

  // 1. الشريط العلوي الرئيسي (صف واحد ملموم ومريح للعين)
  const mainBar = document.createElement('div');
  mainBar.className = "grid grid-cols-5 gap-1 sm:gap-2 w-full bg-slate-900/90 p-1 sm:p-1.5 rounded-2xl border border-slate-800 shadow-xl select-none";

  MAIN_FOLDERS.forEach(folder => {
    const isAct = currentFilter === folder.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `flex flex-col items-center justify-center py-2 px-1 rounded-xl transition duration-200 text-center ${
      isAct 
        ? 'bg-gradient-to-b from-sky-500 to-sky-600 text-white font-black shadow-lg shadow-sky-500/25 scale-[1.02]' 
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-semibold'
    }`;
    
    btn.innerHTML = `
      <i class="fa-solid ${folder.icon} text-base sm:text-lg mb-1"></i>
      <span class="text-[10px] sm:text-xs leading-tight truncate w-full">${folder.title}</span>
    `;

    btn.onclick = () => {
      if (currentFilter !== folder.id) {
        currentFilter = folder.id;
        currentSubFilter = 'all';
        window.activeUnlockedSub = null;
        window.iptvDisplayLimit = 40;
        localStorage.setItem('albasem_active_cat', folder.id);
        localStorage.setItem('albasem_active_sub', 'all');
        setupFilters();
        renderCams();
        if (folder.id !== 'FAVORITES') {
          setTimeout(() => { openSubCategoryDrawer(); }, 60);
        }
      } else {
        if (folder.id !== 'FAVORITES') {
          toggleSubCategoryDrawer();
        }
      }
    };

    mainBar.appendChild(btn);
  });
  filterBox.appendChild(mainBar);

  // إزالة أي درج قديم من الصفحة لضمان النظافة
  const oldDrawer = document.getElementById('subcat-floating-drawer');
  if (oldDrawer) oldDrawer.remove();

  // 2. سطر المسار النحيف (Breadcrumb Strip) والدرج التفاعلي للمجلدات الفرعية
  if (currentFilter !== 'FAVORITES') {
    const subCategories = getDynamicSubCategories(currentFilter);
    const curFolderObj = MAIN_FOLDERS.find(f => f.id === currentFilter);
    const activeSubTitle = (!currentSubFilter || currentSubFilter === 'all') ? 'عرض الكل' : currentSubFilter;

    // شريط مسار مضغوط (سطر واحد لا يشغل مساحة أبداً)
    const breadcrumb = document.createElement('div');
    breadcrumb.className = "w-full flex items-center justify-between bg-slate-900/80 border border-slate-800/90 rounded-xl px-3 py-2 text-xs select-none shadow-md cursor-pointer hover:bg-slate-800/70 transition";
    breadcrumb.onclick = () => openSubCategoryDrawer();
    breadcrumb.innerHTML = `
      <div class="flex items-center gap-2 truncate">
        <span class="text-sky-400 font-bold flex items-center gap-1.5 shrink-0">
          <i class="fa-solid ${curFolderObj ? curFolderObj.icon : ''} text-[11px]"></i>
          <span>${curFolderObj ? curFolderObj.title : ''}</span>
        </span>
        <span class="text-slate-600 font-mono">/</span>
        <span class="text-sky-200 font-semibold truncate bg-sky-950/60 text-[11px] px-2.5 py-0.5 rounded-lg border border-sky-800/50">${activeSubTitle}</span>
      </div>
      <div class="flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0 font-medium bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60">
        <span>تغيير القسم</span>
        <i class="fa-solid fa-chevron-down text-[9px] text-sky-400"></i>
      </div>
    `;
    filterBox.appendChild(breadcrumb);

    // 3. بناء درج التفرعات العائم (Floating Bottom Sheet Drawer)
    const drawer = document.createElement('div');
    drawer.id = 'subcat-floating-drawer';
    drawer.className = "fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm transition-opacity duration-300 hidden opacity-0 flex flex-col justify-end select-none";
    
    drawer.onclick = (e) => {
      if (e.target === drawer) closeSubCategoryDrawer();
    };

    const sheet = document.createElement('div');
    sheet.id = 'subcat-drawer-sheet';
    sheet.className = "w-full max-h-[80vh] bg-slate-900 border-t border-slate-700/80 rounded-t-3xl p-4 flex flex-col gap-3 shadow-2xl transition-transform duration-300 transform translate-y-full";

    sheet.innerHTML = `
      <div class="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-1"></div>
      <div class="flex items-center justify-between pb-2 border-b border-slate-800">
        <div class="flex items-center gap-2">
          <i class="fa-solid ${curFolderObj ? curFolderObj.icon : ''} text-base text-sky-400"></i>
          <h3 class="font-bold text-sm sm:text-base text-white">تفرعات ${curFolderObj ? curFolderObj.title : ''}</h3>
          <span class="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">${subCategories.length + 1} خيارات</span>
        </div>
        <button type="button" onclick="closeSubCategoryDrawer()" class="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition">
          <i class="fa-solid fa-xmark text-sm"></i>
        </button>
      </div>
    `;

    const scrollList = document.createElement('div');
    scrollList.className = "flex flex-col gap-2 overflow-y-auto max-h-[58vh] pr-1 pb-4";

    // زر "عرض الكل"
    const isAllActive = !currentSubFilter || currentSubFilter === 'all';
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `w-full py-3 px-3.5 rounded-xl border text-sm font-bold transition flex items-center justify-between ${
      isAllActive
        ? 'bg-sky-600/30 border-sky-500 text-sky-300 shadow-md ring-1 ring-sky-500/50'
        : 'bg-slate-800/80 border-slate-700/60 text-slate-200 hover:bg-slate-800'
    }`;
    allBtn.innerHTML = `
      <div class="flex items-center gap-2.5">
        <i class="fa-solid fa-layer-group text-sky-400"></i>
        <span>عرض الكل (${curFolderObj ? curFolderObj.title : ''})</span>
      </div>
      <i class="fa-solid ${isAllActive ? 'fa-check text-sky-400' : 'fa-chevron-left text-slate-500'} text-xs"></i>
    `;
    allBtn.onclick = () => {
      currentSubFilter = 'all';
      window.activeUnlockedSub = null;
      window.iptvDisplayLimit = 40;
      localStorage.setItem('albasem_active_sub', 'all');
      closeSubCategoryDrawer();
      setupFilters();
      renderCams();
    };
    scrollList.appendChild(allBtn);

    // إضافة التفرعات الفردية
    subCategories.forEach(sub => {
      const isSubActive = currentSubFilter === sub;
      const isSubLocked = (window.iptvLockedSubs || []).includes(sub);
      const sBtn = document.createElement('button');
      sBtn.type = 'button';
      sBtn.className = `w-full py-3 px-3.5 rounded-xl border text-sm font-semibold transition flex items-center justify-between ${
        isSubActive
          ? 'bg-sky-600/30 border-sky-500 text-sky-300 shadow-md ring-1 ring-sky-500/50'
          : (isSubLocked ? 'bg-amber-950/30 border-amber-600/30 text-amber-200 hover:bg-amber-900/40' : 'bg-slate-800/80 border-slate-700/60 text-slate-200 hover:bg-slate-800')
      }`;

      sBtn.innerHTML = `
        <div class="flex items-center gap-2.5 truncate">
          <i class="fa-solid ${isSubLocked ? 'fa-lock text-amber-400' : 'fa-folder text-sky-400'} text-xs"></i>
          <span class="truncate">${sub}</span>
        </div>
        <i class="fa-solid ${isSubActive ? 'fa-check text-sky-400' : 'fa-chevron-left text-slate-500'} text-xs"></i>
      `;

      sBtn.onclick = () => {
        if (isSubLocked && window.activeUnlockedSub !== sub) {
          showParentalPinModal(() => {
            window.activeUnlockedSub = sub;
            currentSubFilter = sub;
            window.iptvDisplayLimit = 40;
            localStorage.setItem('albasem_active_sub', sub);
            closeSubCategoryDrawer();
            setupFilters();
            renderCams();
          });
          return;
        }
        window.activeUnlockedSub = null;
        currentSubFilter = sub;
        window.iptvDisplayLimit = 40;
        localStorage.setItem('albasem_active_sub', sub);
        closeSubCategoryDrawer();
        setupFilters();
        renderCams();
      };

      scrollList.appendChild(sBtn);
    });

    sheet.appendChild(scrollList);
    drawer.appendChild(sheet);
    document.body.appendChild(drawer);
  }
}


function filterByArea(area) {
  currentFilter = area; localStorage.setItem('albasem_active_cat', area);
  currentSubFilter = 'all';
  window.activeUnlockedSub = null;
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
  const modalEl = document.getElementById('category-order-modal');
  if (!modalEl) return;

  const titleEl = modalEl.querySelector('h3');
  const descEl = modalEl.querySelector('p');
  const pinAdminIn = document.getElementById('admin-default-pin-input');
  if (pinAdminIn) pinAdminIn.value = window.iptvDefaultPin || '1415';

  const cur = (typeof currentFilter !== 'undefined') ? currentFilter : 'LOCAL';
  const folderTitles = {
    'LOCAL': 'فروع القنوات المحلية',
    'ARABIC': 'فروع القنوات العربية',
    'FOREIGN': 'فروع القنوات الأجنبية',
    'IPTV': 'تفريعات IPTV'
  };

  const fTitle = folderTitles[cur] || 'الفروع';
  if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-folder-tree text-emerald-400"></i> إدارة وترتيب: ${fTitle}`;
  if (descEl) descEl.textContent = 'يمكنك إعادة تسمية أي فرع، حذفه، أو إعادة ترتيب الفروع لهذا القسم';

  // جلب الفروع الخاصة بالمجلد النشط فقط
  tempCategoryOrder = (typeof getDynamicSubCategories === 'function') ? [...getDynamicSubCategories(cur)] : [];

  renderCategoryOrderList();
  modalEl.classList.remove('hidden');
}

async function saveCategoryOrder() {
  const pinAdminIn = document.getElementById('admin-default-pin-input');
  if (pinAdminIn && pinAdminIn.value.trim() && pinAdminIn.value.trim().length >= 4) {
    const newDefPin = pinAdminIn.value.trim();
    try {
      await db.ref('streams/_config_default_pin').set(newDefPin);
      window.iptvDefaultPin = newDefPin;
    } catch(err) { console.error('Error saving default pin:', err); }
  }
  if (!currentUser) return alert("يرجى تسجيل الدخول كمسؤول أولاً!");

  const cur = (typeof currentFilter !== 'undefined') ? currentFilter : 'LOCAL';
  let configKey = 'streams/_config_local_subs';
  if (cur === 'LOCAL') configKey = 'streams/_config_local_subs';
  else if (cur === 'ARABIC') configKey = 'streams/_config_arabic_subs';
  else if (cur === 'FOREIGN') configKey = 'streams/_config_foreign_subs';
  else if (cur === 'IPTV') configKey = 'streams/_config_iptv_subs';

  try {
    await db.ref(configKey).set(tempCategoryOrder);

    if (cur === 'LOCAL') {
      window.localCustomSubs = [...tempCategoryOrder];
      try {
        await db.ref('streams/_config_categories').set(tempCategoryOrder);
        window.customCategoryOrder = [...tempCategoryOrder];
      } catch(e){}
    } else if (cur === 'ARABIC') {
      window.arabicCustomSubs = [...tempCategoryOrder];
    } else if (cur === 'FOREIGN') {
      window.foreignCustomSubs = [...tempCategoryOrder];
    } else if (cur === 'IPTV') {
      window.iptvCustomSubs = [...tempCategoryOrder];
      if (typeof setupIptvSubTabs === 'function') setupIptvSubTabs();
    }

    alert(`✅ تم حفظ ترتيب ${folderTitles[cur] || 'الفروع'} بنجاح!`);
    if (typeof setupFilters === 'function') setupFilters();
    if (typeof populateTargetAreas === 'function') populateTargetAreas();
    closeCategoryOrderModal();
  } catch(err) {
    alert("خطأ أثناء الحفظ: " + err.message);
  }
}

function closeCategoryOrderModal() {
  const modalEl = document.getElementById('category-order-modal');
  if (modalEl) modalEl.classList.add('hidden');
}


async function toggleCategoryLock(catName) {
  if (!currentUser) return alert('⚠️ يجب تسجيل الدخول كمسؤول أولاً!');
  let locked = window.iptvLockedSubs ? [...window.iptvLockedSubs] : [];
  const isNowLocked = !locked.includes(catName);
  if (isNowLocked) {
    locked.push(catName);
  } else {
    locked = locked.filter(c => c !== catName);
  }
  try {
    await db.ref('streams/_config_locked_subs').set(locked);
    window.iptvLockedSubs = locked;
    renderCategoryOrderList();
    if (typeof setupFilters === 'function') setupFilters();
  } catch(err) {
    alert('حدث خطأ أثناء حفظ القفل: ' + err.message);
  }
}
window.toggleCategoryLock = toggleCategoryLock;

function renderCategoryOrderList() {
  const listEl = document.getElementById('category-order-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const cur = (typeof currentFilter !== 'undefined') ? currentFilter : 'LOCAL';

  tempCategoryOrder.forEach((cat, idx) => {
    let streamCount = 0;
    if (typeof streamsData !== 'undefined' && Array.isArray(streamsData)) {
      if (cur === 'IPTV') {
        streamCount = streamsData.filter(s => s && s.area === 'IPTV' && ((s.subCategory || '').trim() === cat || (s.category || '').trim() === cat)).length;
      } else if (cur === 'LOCAL') {
        streamCount = streamsData.filter(s => {
          if (!s || !s.area) return false;
          const a = s.area.trim();
          if (['IPTV', 'قنوات عربية', 'قنوات أجنبية'].includes(a)) return false;
          const sub = (s.subCategory || s.category || s.area || '').trim();
          return sub === cat || a === cat;
        }).length;
      } else if (cur === 'ARABIC') {
        streamCount = streamsData.filter(s => s && (s.area === 'قنوات عربية' || s.category === 'قنوات عربية') && (s.subCategory || s.category || '').trim() === cat).length;
      } else if (cur === 'FOREIGN') {
        streamCount = streamsData.filter(s => s && (s.area === 'قنوات أجنبية' || s.category === 'قنوات أجنبية') && (s.subCategory || s.category || '').trim() === cat).length;
      } else {
        streamCount = streamsData.filter(s => s && s.area === cat).length;
      }
    }

    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-slate-900 border border-slate-800/80 px-3 py-2 rounded-lg text-xs hover:border-slate-700 transition-colors';
    item.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[10px] shrink-0">${idx + 1}</span>
        <span class="font-bold text-slate-200">${cat}</span>
        <span class="text-[10px] bg-slate-800/60 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700/40">(${streamCount} قناة)</span>
      </div>
      <div class="flex items-center gap-1">
        <button onclick="moveCategory(${idx}, -1)" class="p-1 hover:text-amber-400 text-slate-400 transition-colors" title="تحريك لأعلى"><i class="fa-solid fa-arrow-up text-[10px]"></i></button>
        <button onclick="moveCategory(${idx}, 1)" class="p-1 hover:text-amber-400 text-slate-400 transition-colors" title="تحريك لأسفل"><i class="fa-solid fa-arrow-down text-[10px]"></i></button>
        <button onclick="renameCategory('${cat.replace(/'/g, "\\'")}')" class="p-1 hover:text-blue-400 text-slate-400 transition-colors" title="إعادة تسمية"><i class="fa-solid fa-pen text-[10px]"></i></button>
        <button onclick="deleteCategory('${cat.replace(/'/g, "\\'")}')" class="p-1 hover:text-rose-400 text-slate-400 transition-colors" title="حذف"><i class="fa-solid fa-trash text-[10px]"></i></button>
      </div>
    `;
    listEl.appendChild(item);
  });
}

async function renameCategory(oldName) {
  if (!currentUser) return alert("يرجى تسجيل الدخول كمسؤول أولاً!");
  const newName = prompt(`أدخل الاسم الجديد للفرع بدلاً من "${oldName}":`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  const cleanNewName = newName.trim();

  const cur = (typeof currentFilter !== 'undefined') ? currentFilter : 'LOCAL';
  const updates = {};

  // تحديث القنوات المرتبطة
  if (typeof streamsData !== 'undefined' && Array.isArray(streamsData)) {
    streamsData.forEach(s => {
      if (!s) return;
      let match = false;
      if (cur === 'IPTV' && s.area === 'IPTV' && ((s.subCategory || '').trim() === oldName || (s.category || '').trim() === oldName)) match = true;
      else if (cur === 'LOCAL' && !['IPTV', 'قنوات عربية', 'قنوات أجنبية'].includes((s.area || '').trim())) {
        if ((s.subCategory || s.category || s.area || '').trim() === oldName) match = true;
      } else if (cur === 'ARABIC' && (s.area === 'قنوات عربية' || s.category === 'قنوات عربية') && (s.subCategory || s.category || '').trim() === oldName) match = true;
      else if (cur === 'FOREIGN' && (s.area === 'قنوات أجنبية' || s.category === 'قنوات أجنبية') && (s.subCategory || s.category || '').trim() === oldName) match = true;

      if (match) {
        updates[`streams/${s.id}/subCategory`] = cleanNewName;
        updates[`streams/${s.id}/category`] = cleanNewName;
        s.subCategory = cleanNewName;
        s.category = cleanNewName;
      }
    });
  }

  // تحديث الترتيب والمفاتيح بالفايربيس
  tempCategoryOrder = tempCategoryOrder.map(c => c === oldName ? cleanNewName : c);

  let configKey = 'streams/_config_local_subs';
  if (cur === 'LOCAL') {
    configKey = 'streams/_config_local_subs';
    window.localCustomSubs = [...tempCategoryOrder];
    updates['streams/_config_categories'] = tempCategoryOrder;
  } else if (cur === 'ARABIC') {
    configKey = 'streams/_config_arabic_subs';
    window.arabicCustomSubs = [...tempCategoryOrder];
  } else if (cur === 'FOREIGN') {
    configKey = 'streams/_config_foreign_subs';
    window.foreignCustomSubs = [...tempCategoryOrder];
  } else if (cur === 'IPTV') {
    configKey = 'streams/_config_iptv_subs';
    window.iptvCustomSubs = [...tempCategoryOrder];
  }
  updates[configKey] = tempCategoryOrder;

  try {
    await db.ref().update(updates);
    renderCategoryOrderList();
    if (typeof setupFilters === 'function') setupFilters();
    if (typeof populateTargetAreas === 'function') populateTargetAreas();
    if (typeof renderCams === 'function') renderCams();
    alert(`✅ تم تعديل اسم الفرع إلى "${cleanNewName}" بنجاح!`);
  } catch(e) {
    alert("خطأ أثناء إعادة التسمية: " + e.message);
  }
}

async function deleteCategory(catName) {
  if (!currentUser) return alert("يرجى تسجيل الدخول كمسؤول أولاً!");

  const cur = (typeof currentFilter !== 'undefined') ? currentFilter : 'LOCAL';
  let targets = [];

  if (typeof streamsData !== 'undefined' && Array.isArray(streamsData)) {
    if (cur === 'IPTV') {
      targets = streamsData.filter(s => s && s.area === 'IPTV' && ((s.subCategory || '').trim() === catName || (s.category || '').trim() === catName));
    } else if (cur === 'LOCAL') {
      targets = streamsData.filter(s => {
        if (!s || !s.area) return false;
        const a = s.area.trim();
        if (['IPTV', 'قنوات عربية', 'قنوات أجنبية'].includes(a)) return false;
        return (s.subCategory || s.category || s.area || '').trim() === catName;
      });
    } else if (cur === 'ARABIC') {
      targets = streamsData.filter(s => s && (s.area === 'قنوات عربية' || s.category === 'قنوات عربية') && (s.subCategory || s.category || '').trim() === catName);
    } else if (cur === 'FOREIGN') {
      targets = streamsData.filter(s => s && (s.area === 'قنوات أجنبية' || s.category === 'قنوات أجنبية') && (s.subCategory || s.category || '').trim() === catName);
    }
  }

  const confirmMsg = targets.length > 0
    ? `⚠️ تحذير: هل أنت متأكد من حذف فرع "${catName}"؟\nسيتم حذف (${targets.length}) قناة تابعة له نهائياً!`
    : `هل تريد إزالة فرع "${catName}" الفارغ نهائياً من القائمة؟`;

  if (!confirm(confirmMsg)) return;

  const updates = {};
  targets.forEach(s => {
    updates[`streams/${s.id}`] = null;
  });

  tempCategoryOrder = tempCategoryOrder.filter(c => c !== catName);

  // حذف كامل من كل مصادر التخزين بالفايربيس والمصفوفات الحالية
  if (cur === 'LOCAL') {
    window.localCustomSubs = (window.localCustomSubs || []).filter(c => c !== catName);
    window.customCategoryOrder = (window.customCategoryOrder || []).filter(c => c !== catName);
    updates['streams/_config_local_subs'] = tempCategoryOrder;
    updates['streams/_config_categories'] = tempCategoryOrder;
  } else if (cur === 'ARABIC') {
    window.arabicCustomSubs = (window.arabicCustomSubs || []).filter(c => c !== catName);
    updates['streams/_config_arabic_subs'] = tempCategoryOrder;
  } else if (cur === 'FOREIGN') {
    window.foreignCustomSubs = (window.foreignCustomSubs || []).filter(c => c !== catName);
    updates['streams/_config_foreign_subs'] = tempCategoryOrder;
  } else if (cur === 'IPTV') {
    window.iptvCustomSubs = (window.iptvCustomSubs || []).filter(c => c !== catName);
    updates['streams/_config_iptv_subs'] = tempCategoryOrder;
  }

  try {
    await db.ref().update(updates);
    renderCategoryOrderList();
    if (typeof setupFilters === 'function') setupFilters();
    if (typeof populateTargetAreas === 'function') populateTargetAreas();
    if (typeof renderCams === 'function') renderCams();
    alert(`✅ تم حذف فرع "${catName}" نهائياً من الفايربيس!`);
  } catch(e) {
    alert("خطأ أثناء حذف الفرع: " + e.message);
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
  const pinAdminIn = document.getElementById('admin-default-pin-input');
  if (pinAdminIn && pinAdminIn.value.trim() && pinAdminIn.value.trim().length >= 4) {
    const newDefPin = pinAdminIn.value.trim();
    try {
      await db.ref('streams/_config_default_pin').set(newDefPin);
      window.iptvDefaultPin = newDefPin;
    } catch(err) { console.error('Error saving default pin:', err); }
  }
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
    filtered = streamsData.filter(s => matchesSmartSearch(s.title || '', window.searchQuery) && isStreamAllowedForSubscriber(s));
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
    filtered = streamsData.filter(s => favs.includes(String(s.id)) && isStreamAllowedForSubscriber(s));
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
  } else if (currentFilter === 'LOCAL') {
    filtered = streamsData.filter(s => {
      if (!s || !s.area) return false;
      const a = s.area.trim();
      return a !== 'IPTV' && a !== 'قنوات عربية' && a !== 'قنوات أجنبية';
    });
    if (currentSubFilter && currentSubFilter !== 'all') {
      filtered = filtered.filter(s => {
        const sub = (s.subCategory || s.category || s.area || '').trim();
        return sub === currentSubFilter || s.area === currentSubFilter;
      });
    }
  } else if (currentFilter === 'ARABIC') {
    filtered = streamsData.filter(s => s && (s.area === 'قنوات عربية' || s.category === 'قنوات عربية'));
    if (currentSubFilter && currentSubFilter !== 'all') {
      filtered = filtered.filter(s => (s.subCategory || s.category || '').trim() === currentSubFilter);
    }
  } else if (currentFilter === 'FOREIGN') {
    filtered = streamsData.filter(s => s && (s.area === 'قنوات أجنبية' || s.category === 'قنوات أجنبية'));
    if (currentSubFilter && currentSubFilter !== 'all') {
      filtered = filtered.filter(s => (s.subCategory || s.category || '').trim() === currentSubFilter);
    }
  } else if (currentFilter === 'IPTV') {
    filtered = streamsData.filter(s => s && s.area === 'IPTV');
    if (currentSubFilter && currentSubFilter !== 'all') {
      filtered = filtered.filter(s => (s.category === currentSubFilter || s.subCategory === currentSubFilter || (currentSubFilter === 'مشكّل ومنوعات' && !s.category && !s.subCategory)));
    }
  } else {
    filtered = streamsData.filter(s => s.area === currentFilter);
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
  window.activeCategoryStreams = filtered;

    // حماية معالج ورام الجوال عبر العرض السلس
  const totalMatches = filtered.length;
  const isLimited = totalMatches > window.iptvDisplayLimit;
  const displayList = isLimited ? filtered.slice(0, window.iptvDisplayLimit) : filtered;

  displayList.forEach((stream, idx) => {
      const channelNum = idx + 1;
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
          <span class="inline-flex items-center justify-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-black px-1.5 py-0.5 rounded shadow-sm flex-shrink-0" title="رقم القناة في هذا القسم">#${channelNum}</span>
          <span class="w-2 h-2 rounded-full ${stream.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'} flex-shrink-0"></span>
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
  window.currentModalStreamId = streamId;
  const navCounter = document.getElementById('modal-nav-counter');
  if (navCounter && window.activeCategoryStreams) {
    const curIdx = window.activeCategoryStreams.findIndex(s => s.id === streamId);
    if (curIdx !== -1) {
      navCounter.textContent = `قناة ${curIdx + 1} / ${window.activeCategoryStreams.length}`;
      navCounter.classList.remove('hidden');
    } else {
      navCounter.classList.add('hidden');
    }
  }
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
    if (vid) {
      vid.addEventListener('playing', () => { if (typeof markTvOsdLive === 'function') markTvOsdLive(); }, { once: true });
      vid.addEventListener('canplay', () => { if (typeof markTvOsdLive === 'function') markTvOsdLive(); }, { once: true });
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
  if (window._modalJustClosed) { window._modalJustClosed = false; return; }
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
  if (window._modalJustClosed) { window._modalJustClosed = false; return; }
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


if (typeof db !== 'undefined') {
  db.ref('streams/_config_default_pin').on('value', snap => {
    const val = snap.val();
    if (val && String(val).trim().length >= 4) {
      window.iptvDefaultPin = String(val).trim();
    } else {
      window.iptvDefaultPin = '1415';
    }
  });
}


// ==========================================
// ميزة تقليب القنوات الذكي (Channel Zapping)
// ==========================================
function navigateStream(dir) {
  const list = window.activeCategoryStreams;
  if (!list || list.length <= 1) return;

  let curIdx = list.findIndex(s => s.id === window.currentModalStreamId);
  if (curIdx === -1) curIdx = 0;

  let nextIdx = curIdx + dir;
  if (nextIdx >= list.length) nextIdx = 0;       // دوران تلقائي للبداية
  if (nextIdx < 0) nextIdx = list.length - 1;   // دوران تلقائي للنهاية

  const nextStream = list[nextIdx];
  if (nextStream) {
    if (typeof showChannelOSD === 'function') {
      showChannelOSD(nextStream, nextIdx + 1, list.length, true);
    }
    openModal(nextStream.id);
  }
}

// دعم أسهم الكيبورد (فوق/تحت ويمين/يسار) للتنقل زي الريموت
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('cam-modal');
  if (!modal || modal.classList.contains('hidden')) return;

  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    navigateStream(1);  // القناة التالية
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    navigateStream(-1); // القناة السابقة
  }
});

// دعم سحب الشاشة باللمس عمودياً (Swipe Up / Down) زي الريلز والفيسبوك
(function initSwipeNavigation() {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  document.addEventListener('touchstart', (e) => {
    const modal = document.getElementById('cam-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const modal = document.getElementById('cam-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    if (e.changedTouches.length === 1) {
      const diffX = e.changedTouches[0].clientX - touchStartX;
      const diffY = e.changedTouches[0].clientY - touchStartY;
      const diffTime = Date.now() - touchStartTime;

      // فحص أن الحركة عمودية وسريعة (Swipe Up/Down)
      if (diffTime < 550 && Math.abs(diffY) > 45 && Math.abs(diffY) > Math.abs(diffX) * 1.2) {
        if (diffY < 0) {
          navigateStream(1);  // سحب لفوق -> القناة التالية
        } else {
          navigateStream(-1); // سحب لتحت -> القناة السابقة
        }
      }
    }
  }, { passive: true });
})();
