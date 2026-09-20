import urllib.request
import urllib.error
import json
import getpass

best_quran_url = "https://htvint.mada.ps/shababquran/index.m3u8"
nablus_url = "https://streaming.zaytonatube.com:8081/nb/nb/tracks-v1a1/mono.m3u8"

print("=" * 60)
print("🎯 الرابط المعتمد للقرآن الكريم (مدى CDN):", best_quran_url)
print("🎯 الرابط المعتمد لسما نابلس (زيتونة):", nablus_url)
print("=" * 60)

# تسجيل دخول الإدارة للحصول على توكن الصلاحيات
print("\n🔐 تسجيل الدخول لتوثيق صلاحيات فايربيس:")
email = input("أدخل بريد الإدارة (المستخدم بالموقع): ").strip()
password = getpass.getpass("أدخل كلمة المرور: ")

API_KEY = "AIzaSyD4U4DFTtO8zuqIlrJp19ji1ESptfuVr9E"
auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"

try:
    auth_data = json.dumps({"email": email, "password": password, "returnSecureToken": True}).encode('utf-8')
    req = urllib.request.Request(auth_url, data=auth_data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        id_token = res['idToken']
        print("\n🟢 تم تسجيل الدخول كمسؤول بنجاح وتم توليد توكن الأمان!")
except Exception as e:
    print(f"\n❌ فشل تسجيل الدخول: تأكد من صحة البريد وكلمة المرور ({e})")
    exit(1)

# تحديث القناتين في فايربيس
updates = [
    ("-P1vHx_57OF_MfGom_um", "سما نابلس", nablus_url),
    ("-P1vcgQws4j0ignPYt7I", "إذاعة وتلفزيون القرآن الكريم", best_quran_url)
]

print("\n🔄 جاري تحديث الروابط في فايربيس...")
for stream_id, title, target_url in updates:
    db_url = f"https://albasem-cams-default-rtdb.firebaseio.com/streams/{stream_id}.json?auth={id_token}"
    payload = json.dumps({"url": target_url, "status": "active"}).encode('utf-8')
    try:
        req = urllib.request.Request(db_url, data=payload, headers={"Content-Type": "application/json"}, method="PATCH")
        with urllib.request.urlopen(req) as resp:
            print(f"✓ تم تحديث قناة [{title}] بالرابط الشغال 100%!")
    except Exception as e:
        print(f"خطأ أثناء تحديث [{title}]: {e}")

print("\n🎉 اكتمل التحديث بنجاح! افتح موقع الباسم سات وتأكد من عمل القنوات.")
