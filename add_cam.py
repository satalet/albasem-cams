#!/usr/bin/env python3
import json
import re
import sys
import subprocess
import time
from urllib.parse import urlparse, parse_qs

try:
    import requests
except ImportError:
    print("[!] مكتبة requests مش نازلة، جاري تثبيتها...")
    subprocess.run([sys.executable, "-m", "pip", "install", "requests"])
    import requests

def parse_youtube_url(url):
    """استخراج كود البث من أي صيغة رابط يوتيوب"""
    parsed = urlparse(url)
    if 'youtube.com' in parsed.netloc:
        if '/embed/' in parsed.path:
            return parsed.path.split('/embed/')[1].split('?')[0]
        query = parse_qs(parsed.query)
        if 'v' in query:
            return query['v'][0]
    elif 'youtu.be' in parsed.netloc:
        return parsed.path.strip('/')
    return None

def check_link(url, cam_type):
    """فحص صحة واستجابة الرابط"""
    print(f"\n[*] جاري فحص الرابط والتأكد من استجابته...")
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        if cam_type == "youtube":
            video_id = parse_youtube_url(url)
            if not video_id:
                print("[-] تحذير: تعذر استخراج كود فيديو يوتيوب من الرابط!")
                return False, url
            check_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            res = requests.get(check_url, timeout=5)
            if res.status_code == 200:
                print("[+] فيديو/بث يوتيوب شغال وموجود مية بالمية!")
                return True, f"https://www.youtube-nocookie.com/embed/{video_id}"
            else:
                print("[!] الرابط غير متاح أو البث مقفل.")
                return False, url
        else:
            res = requests.head(url, headers=headers, timeout=6, allow_redirects=True)
            if res.status_code in [200, 206, 301, 302]:
                print(f"[+] الرابط شغال تمام (Status: {res.status_code})")
                return True, url
            else:
                # محاولة طلب GET خفيف
                res = requests.get(url, headers=headers, stream=True, timeout=6)
                if res.status_code == 200:
                    print(f"[+] الرابط شغال تمام (Status: 200)")
                    return True, url
                print(f"[-] تحذير: السيرفر رجّع كود {res.status_code}")
                return False, url
    except Exception as e:
        print(f"[-] تعذر الاتصال بالرابط: {e}")
        return False, url

def bump_sw_version():
    """تحديث رقم الإصدار في sw.js لكسر الكاش فوراً"""
    new_ver = f"v{int(time.time())}"
    try:
        with open("sw.js", "r", encoding="utf-8") as f:
            content = f.read()
        updated = re.sub(r"const CACHE_VERSION = '.*?';", f"const CACHE_VERSION = '{new_ver}';", content)
        with open("sw.js", "w", encoding="utf-8") as f:
            f.write(updated)
        print(f"[+] تم تحديث كود الكاش في sw.js إلى: {new_ver}")
    except Exception as e:
        print(f"[-] خطأ في تحديث sw.js: {e}")

def main():
    print("=" * 55)
    print("      أداة الباسم سات | إضافة وفحص الكاميرات الحية")
    print("=" * 55)

    # 1. إدخال الرابط
    url = input("\n[?] ادخل رابط البث (YouTube / HLS .m3u8 / Image): ").strip()
    if not url:
        print("[-] لم يتم إدخال رابط!")
        return

    # 2. تخمين النوع تلقائياً
    cam_type = "youtube" if ("youtube.com" in url or "youtu.be" in url) else ("hls" if ".m3u8" in url else "image")
    print(f"[*] النوع المكتشف تلقائياً: [{cam_type}]")
    
    # 3. فحص الرابط
    is_valid, final_url = check_link(url, cam_type)
    if not is_valid:
        choice = input("[?] الرابط أعطى تحذيراً. هل تريد إضافته على أي حال؟ (y/N): ").lower()
        if choice != 'y':
            print("[x] تم إلغاء العملية.")
            return

    # 4. باقي البيانات
    title = input("\n[?] ادخل عنوان/اسم الكاميرا: ").strip() or "كاميرا مباشرة"
    
    # قراءة المناطق الحالية لاقتراحها
    with open("streams.json", "r", encoding="utf-8") as f:
        streams = json.load(f)
    
    existing_areas = list(set(s.get("area") for s in streams if s.get("area")))
    print(f"[*] المناطق المسجلة حالياً: {', '.join(existing_areas)}")
    area = input(f"[?] ادخل المنطقة/الفهرس (مثلاً: كفر عقب، الرام، القدس): ").strip() or "عام"
    category = input("[?] ادخل التصنيف (سير / طقس / معالم / مباشر) [افتراضي: سير]: ").strip() or "سير"

    # تجهيز الكائن الجديد
    cam_id = f"cam-{int(time.time())}"
    new_cam = {
        "id": cam_id,
        "title": title,
        "area": area,
        "category": category,
        "type": cam_type,
        "url": final_url,
        "status": "active"
    }

    streams.append(new_cam)
    with open("streams.json", "w", encoding="utf-8") as f:
        json.dump(streams, f, ensure_ascii=False, indent=2)

    print(f"\n[✓] تم حفظ الكاميرا بنجاح في streams.json")

    # 5. كسر كاش التلفونات
    bump_sw_version()

    # 6. المزامنة والرفع على GitHub
    auto_push = input("\n[?] هل تريد الرفع والمزامنة على GitHub الآن تلقائياً؟ (Y/n): ").lower()
    if auto_push != 'n':
        print("[*] جاري الرفع على GitHub...")
        subprocess.run(["git", "add", "streams.json", "sw.js", "index.html"])
        commit_msg = f"إضافة كاميرا: {title} ({area}) وتحديث الكاش"
        subprocess.run(["git", "commit", "-m", commit_msg])
        subprocess.run(["git", "push", "origin", "main"])
        print("\n[🚀] تم الرفع بنجاح! الموقع والتطبيق على التلفونات تحدثوا فوراً.")

if __name__ == "__main__":
    main()
