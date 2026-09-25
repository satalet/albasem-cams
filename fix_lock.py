import re
import shutil

shutil.copy('app.js', 'app.js.bak_fix')
with open('app.js', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. إضافة حارس إغلاق المودال العام لمنع تصفير القسم
if "window._modalJustClosed" not in c:
    c = "window._modalJustClosed = false;\n" + c

# 2. تفعيل الحارس داخل closeModal عند إغلاق أو تصغير المشغل
close_target = "modal.classList.add('hidden');"
close_patch = """modal.classList.add('hidden');
    window._modalJustClosed = true;
    setTimeout(() => { window._modalJustClosed = false; }, 600);"""

if close_target in c and "window._modalJustClosed = true;" not in c:
    c = c.replace(close_target, close_patch, 1)

# 3. حماية مستمعات popstate من إعادة التوجيه عند إغلاق الفيديو
c = re.sub(
    r"(window\.addEventListener\(['\"]popstate['\"],\s*(?:\([^\)]*\)|e)?\s*=>\s*\{)",
    r"\1\n  if (window._modalJustClosed) { window._modalJustClosed = false; return; }",
    c
)

# 4. تحديث أزرار التفريعات لتثبيت مكانك بالرابط والذاكرة بدقة
old_sbtn_block = """      sBtn.onclick = () => {
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

new_sbtn_block = """      sBtn.onclick = () => {
        if (currentSubFilter !== sub) {
          if (isSubLocked && window.activeUnlockedSub !== sub) {
            showParentalPinModal(() => {
              window.activeUnlockedSub = sub;
              currentSubFilter = sub;
              window.iptvDisplayLimit = 40;
              localStorage.setItem('albasem_active_sub', sub);
              if (typeof updateNavigationHistory === 'function') {
                updateNavigationHistory(currentFilter || 'IPTV', sub);
              }
              setupFilters();
              renderCams();
            });
            return;
          }
          window.activeUnlockedSub = null;
          currentSubFilter = sub;
          window.iptvDisplayLimit = 40;
          localStorage.setItem('albasem_active_sub', sub);
          if (typeof updateNavigationHistory === 'function') {
            updateNavigationHistory(currentFilter || 'IPTV', sub);
          }
          setupFilters();
          renderCams();
        }
      };"""

if old_sbtn_block in c:
    c = c.replace(old_sbtn_block, new_sbtn_block, 1)

# 5. تعزيز فحص الجلسة المفتوحة لكافة محطات التفريع المعروض
c = c.replace(
    "if (window.activeUnlockedSub && streamSub === window.activeUnlockedSub) {",
    "if (window.activeUnlockedSub && (streamSub === window.activeUnlockedSub || currentSubFilter === window.activeUnlockedSub)) {",
    1
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("✅ تم تعديل كود app.js وتثبيت جلسة القسم بنجاح!")
