import shutil
import re

shutil.copy('app.js', 'app.js.bak_lock')
with open('app.js', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Sync Locked Subs
if "window.iptvLockedSubs = [];" not in c:
    c = c.replace("window.iptvCustomSubs = [];", """window.iptvCustomSubs = [];
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
""", 1)

# 2. Update checkParentalAccess
old_access = """function checkParentalAccess(streamId, onAllowed) {
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
}"""

new_access = """function checkParentalAccess(streamId, onAllowed) {
  const stream = streamsData.find(s => s.id === streamId);
  if (!stream) {
    if (typeof onAllowed === 'function') onAllowed();
    return;
  }

  // 1. فحص الجلسة المؤقتة للقسم
  const streamSub = stream.subCategory || stream.category;
  if (window.activeUnlockedSub && streamSub === window.activeUnlockedSub) {
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
}"""
if old_access in c:
    c = c.replace(old_access, new_access, 1)

# 3. Add toggleCategoryLock
toggle_fn = """
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
"""
if 'function toggleCategoryLock' not in c:
    c = c.replace('function renderCategoryOrderList()', toggle_fn + '\nfunction renderCategoryOrderList()', 1)

# 4. Insert Lock Button in renderCategoryOrderList
c = re.sub(
    r'(<button\s+type="button"\s+onclick="renameCategory\([^>]+>)',
    r"""<button type="button" onclick="toggleCategoryLock('${cat.replace(/'/g, "\\'")}')" class="w-7 h-7 ${((window.iptvLockedSubs || []).includes(cat)) ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'} rounded flex items-center justify-center transition" title="${((window.iptvLockedSubs || []).includes(cat)) ? 'إلغاء قفل هذا القسم' : 'قفل هذا القسم بالكامل برمز 1415'}">
          <i class="fa-solid ${((window.iptvLockedSubs || []).includes(cat)) ? 'fa-lock text-amber-400' : 'fa-lock-open'} text-[10px]"></i>
        </button>\n        \1""",
    c, count=1
)

# 5. Modify subCategory buttons inside setupFilters
old_sub_btn = """      const sBtn = document.createElement('button');
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
      };"""

new_sub_btn = """      const sBtn = document.createElement('button');
      const isSubActive = sub === currentSubFilter;
      const isSubLocked = (window.iptvLockedSubs || []).includes(sub);
      sBtn.className = `flex-shrink-0 px-3 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${isSubActive ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' : (isSubLocked ? 'bg-amber-950/40 text-amber-300 border-amber-600/40 hover:bg-amber-900/50' : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:bg-slate-700')}`;
      sBtn.innerHTML = `${isSubLocked ? '<i class="fa-solid fa-lock text-[10px] text-amber-400"></i>' : ''}<span>${sub}</span>`;
      
      sBtn.onclick = () => {
        if (currentSubFilter !== sub) {
          if (isSubLocked && window.activeUnlockedSub !== sub) {
            showParentalPinModal(() => {
              window.activeUnlockedSub = sub;
              currentSubFilter = sub;
              window.iptvDisplayLimit = 40;
              setupFilters();
              renderCams();
            });
            return;
          }
          window.activeUnlockedSub = null;
          currentSubFilter = sub;
          window.iptvDisplayLimit = 40;
          setupFilters();
          renderCams();
        }
      };"""
if old_sub_btn in c:
    c = c.replace(old_sub_btn, new_sub_btn, 1)

# 6. Reset session when leaving the tab
c = re.sub(r'(currentSubFilter\s*=\s*\'\';)', r'\1\n        window.activeUnlockedSub = null;', c)
c = re.sub(r'(currentSubFilter\s*=\s*\'all\';)', r'\1\n  window.activeUnlockedSub = null;', c)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(c)
    
print("✅ تم تركيب نظام قفل الأقسام الذكي بالكامل بنجاح!")
