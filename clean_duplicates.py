import requests
import json
import os
import re

print("=" * 60)
print("🔍 أداة الباسم سات | تنظيف وفلترة الروابط والقنوات المكررة")
print("=" * 60)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_BASE = "https://albasem-cams-default-rtdb.firebaseio.com"

# 1. جلب المفتاح من albasem_gui.py
api_key = ""
gui_path = os.path.join(BASE_DIR, "albasem_gui.py")
if os.path.exists(gui_path):
    with open(gui_path, "r", encoding="utf-8") as f:
        m = re.search(r'FIREBASE_API_KEY\s*=\s*["\']([^"\']+)["\']', f.read())
        if m:
            api_key = m.group(1)

# إذا لم يجده، نبحث بـ admin-users.html
if not api_key:
    for fname in ["admin-users.html", "app.js"]:
        fpath = os.path.join(BASE_DIR, fname)
        if os.path.exists(fpath):
            with open(fpath, "r", encoding="utf-8") as f:
                m = re.search(r'apiKey:\s*["\']([^"\']+)["\']', f.read())
                if m:
                    api_key = m.group(1)
                    break

# 2. جلب الحساب من config.json
email = ""
password = ""
config_path = os.path.join(BASE_DIR, "config.json")
if os.path.exists(config_path):
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            email = cfg.get("email", "")
            password = cfg.get("password", "")
    except Exception:
        pass

# 3. توليد توكن المصادقة (Auth Token)
id_token = None
if api_key and email and password:
    auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}"
    payload = {"email": email, "password": password, "returnSecureToken": True}
    try:
        res = requests.post(auth_url, json=payload, timeout=8)
        id_token = res.json().get("idToken")
        if id_token:
            print("🔑 تم تسجيل الدخول للمشرف وتوليد تصريح الحذف بنجاح!")
        else:
            print(f"⚠️ فشل توليد التوكن: {res.text}")
    except Exception as e:
        print(f"⚠️ خطأ أثناء الاتصال بسيرفر المصادقة: {e}")
else:
    print(f"⚠️ نقص في البيانات: api_key={bool(api_key)}, email={bool(email)}, password={bool(password)}")

auth_param = f"?auth={id_token}" if id_token else ""

# 4. جلب القنوات
node_name = "streams"
resp = requests.get(f"{DB_BASE}/{node_name}.json{auth_param}")
data = resp.json()

if not data or not isinstance(data, dict):
    print("❌ لم يتم العثور على قنوات مسجلة.")
    exit()

# 5. استخراج الأقسام
areas = set()
for key, item in data.items():
    if isinstance(item, dict) and 'area' in item:
        areas.add(item.get('area', 'عام'))

print("\n📋 الأقسام المتوفرة في المنصة:")
areas_list = sorted(list(areas))
for idx, a in enumerate(areas_list, 1):
    print(f"  [{idx}] {a}")
print(f"  [0] فحص وتنظيف جميع الأقسام دفعة واحدة")

choice = input("\n👉 اختر رقم القسم المراد تنظيفه: ").strip()

target_area = None
if choice != '0':
    try:
        target_idx = int(choice) - 1
        if 0 <= target_idx < len(areas_list):
            target_area = areas_list[target_idx]
            print(f"\n🎯 تم اختيار القسم: [{target_area}]")
        else:
            print("❌ اختيار غير صحيح.")
            exit()
    except ValueError:
        print("❌ إدخال غير صالح.")
        exit()
else:
    print("\n🎯 سيتم فحص وتنظيف التكرار في جميع الأقسام.")

# 6. كشف التكرار 100%
seen_urls = {}
duplicates = []

for key, item in data.items():
    if not isinstance(item, dict):
        continue
    
    item_area = item.get('area', '')
    if target_area and item_area != target_area:
        continue

    stream_url = (item.get('streamUrl') or item.get('url') or '').strip()
    if not stream_url:
        continue

    match_key = stream_url.lower()

    if match_key in seen_urls:
        duplicates.append({
            'key': key,
            'title': item.get('title', 'بدون اسم'),
            'url': stream_url,
            'original_title': seen_urls[match_key].get('title', '')
        })
    else:
        seen_urls[match_key] = item

total_dups = len(duplicates)
print(f"\n📊 نتيجة الفحص: تم العثور على ({total_dups}) قناة مكررة بروابط متطابقة 100%.")

if total_dups == 0:
    print("✨ هذا القسم نظيف تماماً ولا توجد به أي روابط مكررة!")
    exit()

print("\nنماذج من القنوات المكررة التي سيتم حذفها:")
for d in duplicates[:5]:
    print(f"   ✖ مكرر: [{d['title']}] -> الأصل المحفوظ: [{d['original_title']}]")

confirm = input(f"\n⚠️ هل تريد بالتأكيد حذف ({total_dups}) قناة مكررة من فايربيس؟ (y/n): ").strip().lower()
if confirm != 'y':
    print("تم إلغاء العملية.")
    exit()

# 7. حذف المكررات مع التوكن
print("\n🚀 جاري حذف القنوات المكررة الآن...")
deleted_count = 0
for d in duplicates:
    del_res = requests.delete(f"{DB_BASE}/{node_name}/{d['key']}.json{auth_param}")
    if del_res.status_code == 200:
        deleted_count += 1
        print(f" ✔ تم حذف: {d['title']}")
    else:
        print(f" ❌ فشل حذف ({del_res.status_code}): {d['title']}")

print(f"\n🎉 تمت العملية بنجاح! تم تنظيف ({deleted_count}) قناة مكررة بالكامل.")
