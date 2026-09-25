import re
import shutil

# نسخ احتياطي للملفات
shutil.copy('app.js', 'app.js.bak_pin')
shutil.copy('index.html', 'index.html.bak_pin')

# 1. تعديل index.html لإضافة حقل الرمز الافتراضي في نافذة الإدارة
with open('index.html', 'r', encoding='utf-8') as f:
    h = f.read()

pin_box_html = """      <!-- قسم ضبط رمز الرقابة الأبوية الافتراضي (للمسؤول) -->
      <div class="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
        <div class="text-right">
          <div class="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <i class="fa-solid fa-key text-[11px]"></i> رمز الرقابة الأبوية الافتراضي العام:
          </div>
          <div class="text-[10px] text-slate-400">الرمز الأساسي المعتمد لجميع الزبائن الجدد</div>
        </div>
        <div class="flex items-center gap-2">
          <input type="text" id="admin-default-pin-input" maxlength="10" placeholder="1415" class="w-24 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-md px-2 py-1 text-center text-xs font-mono font-bold text-amber-300 outline-none">
        </div>
      </div>
"""

if 'id="admin-default-pin-input"' not in h:
    target_btn = '<div class="flex items-center justify-end gap-2 pt-4 border-t border-slate-800 mt-4">'
    if target_btn in h:
        h = h.replace(target_btn, pin_box_html + "\n      " + target_btn, 1)
        with open('index.html', 'w', encoding='utf-8') as f:
            f.write(h)
        print("✓ تم إضافة حقل تعديل الرمز في index.html")

# 2. تعديل app.js
with open('app.js', 'r', encoding='utf-8') as f:
    c = f.read()

# إضافة دالة الماستر اليومي والمتغير العام
master_code = """
// ==================== نظام الماستر كود اليومي وحماية الرقابة الأبوية ====================
window.iptvDefaultPin = '1415';

function getDailyMasterPin() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}${mm}77`;
}
"""

if "function getDailyMasterPin()" not in c:
    c = master_code + "\n" + c

# مستمع مزامنة الرمز الافتراضي من الفايربيس لايف
fb_listener = """
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
"""
if "streams/_config_default_pin" not in c:
    c = c + "\n" + fb_listener

# تحديث فحص الرمز في showParentalPinModal ليدعم الرمز الماستر والرمز الافتراضي
old_verify = """    const entered = input.value.trim();
    const currentPin = localStorage.getItem('albasem_custom_pin') || '1415';
    if (entered === currentPin) {"""

new_verify = """    const entered = input.value.trim();
    const defaultPin = window.iptvDefaultPin || '1415';
    const currentPin = localStorage.getItem('albasem_custom_pin') || defaultPin;
    const masterPin = typeof getDailyMasterPin === 'function' ? getDailyMasterPin() : '';
    if (entered === currentPin || (masterPin && entered === masterPin)) {"""

c = c.replace(old_verify, new_verify, 1)

# تحديث نافذة تغيير الرمز لتقبل كود الماستر كرمز قديم وتحديث طول الخانات
c = re.sub(r'id="old-pin-input"\s+maxlength="\d+"', 'id="old-pin-input" maxlength="10"', c)
c = re.sub(r'id="parental-pin-input"\s+maxlength="\d+"', 'id="parental-pin-input" maxlength="10"', c)

old_change = """    const curSaved = localStorage.getItem('albasem_custom_pin') || '1415';
    if (oldIn.value.trim() !== curSaved) {"""

new_change = """    const defaultPin = window.iptvDefaultPin || '1415';
    const curSaved = localStorage.getItem('albasem_custom_pin') || defaultPin;
    const masterPin = typeof getDailyMasterPin === 'function' ? getDailyMasterPin() : '';
    const oldEntered = oldIn.value.trim();
    if (oldEntered !== curSaved && (!masterPin || oldEntered !== masterPin)) {"""

c = c.replace(old_change, new_change, 1)

# تعبئة حقل الرمز الافتراضي عند فتح المودال
open_target = "const descEl = modalEl.querySelector('p');"
open_patch = """const descEl = modalEl.querySelector('p');
  const pinAdminIn = document.getElementById('admin-default-pin-input');
  if (pinAdminIn) pinAdminIn.value = window.iptvDefaultPin || '1415';"""

if open_target in c and "admin-default-pin-input" not in c:
    c = c.replace(open_target, open_patch, 1)

# حفظ الرمز الافتراضي عند الضغط على حفظ في saveCategoryOrder
save_target = "async function saveCategoryOrder() {"
save_patch = """async function saveCategoryOrder() {
  const pinAdminIn = document.getElementById('admin-default-pin-input');
  if (pinAdminIn && pinAdminIn.value.trim() && pinAdminIn.value.trim().length >= 4) {
    const newDefPin = pinAdminIn.value.trim();
    try {
      await db.ref('streams/_config_default_pin').set(newDefPin);
      window.iptvDefaultPin = newDefPin;
    } catch(err) { console.error('Error saving default pin:', err); }
  }"""

c = c.replace(save_target, save_patch, 1)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("✓ تم تحديث app.js بنجاح تام!")
