#!/usr/bin/env python3
import json
import re
import sys
import subprocess
import getpass
from urllib.parse import urlparse, parse_qs

try:
    import requests
except ImportError:
    print("[!] مكتبة requests غير موجودة، جاري تثبيتها...")
    subprocess.run([sys.executable, "-m", "pip", "install", "requests"])
    import requests

FIREBASE_API_KEY = "AIzaSyD4U4DFTtO8zuqIlrJp19ji1ESptfuVr9E"
DB_URL = "https://albasem-cams-default-rtdb.firebaseio.com/streams.json"

def get_firebase_token():
    """تسجيل الدخول تلقائياً بالحساب الآمن للحصول على توكن الصلاحية"""
    print("[*] جاري المصادقة الأمنية مع Firebase...")
    email = "satalet@gmail.com"
    password = getpass.getpass(f"أدخل كلمة مرور الحساب ({email}): ")
    
    auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    payload = {
        "email": email,
        "password": password,
        "returnSecureToken": True
    }
    
    try:
        res = requests.post(auth_url, json=payload)
        data = res.json()
        if "idToken" in data:
            print("[✓] تم تسجيل الدخول بنجاح وصلاحيات الكتابة مفعّلة!")
            return data["idToken"]
        else:
            print(f"[-] فشل تسجيل الدخول: {data.get('error', {}).get('message', 'خطأ غير معروف')}")
            sys.exit(1)
    except Exception as e:
        print(f"[-] خطأ في الاتصال بخدمة المصادقة: {e}")
        sys.exit(1)

def parse_youtube_url(url):
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

def main():
    print("=" * 55)
    print("      أداة الباسم سات الذكية | إضافة ونشر البثوث")
    print("=" * 55)

    # 1. إدخال الرابط
    url = input("\n[?] ادخل رابط البث (YouTube / HLS .m3u8 / Image): ").strip()
    if not url:
        print("[-] لم يتم إدخال رابط!")
        return

    # 2. تخمين النوع تلقائياً
    cam_type = "youtube" if ("youtube.com" in url or "youtu.be" in url) else ("hls" if ".m3u8" in url else "image")
    print(f"[*] النوع المكتشف تلقائياً: [{cam_type}]")

    if cam_type == "youtube":
        vid_id = parse_youtube_url(url)
        if vid_id:
            url = f"https://www.youtube-nocookie.com/embed/{vid_id}"

    # 3. باقي التفاصيل
    title = input("[?] ادخل اسم/عنوان الكاميرا (مثلاً: جولة نابلسية): ").strip() or "كاميرا مباشرة"
    area = input("[?] ادخل المنطقة / الفهرس (مثلاً: نابلس، القدس، كفر عقب): ").strip() or "عام"

    new_cam = {
        "title": title,
        "area": area,
        "type": cam_type,
        "url": url,
        "category": "سير",
        "status": "active"
    }

    # 4. الحصول على التوكن والرفع المباشر لـ Firebase
    token = get_firebase_token()
    push_url = f"{DB_URL}?auth={token}"

    print("[*] جاري رفع البث إلى سيرفر Firebase المباشر...")
    res = requests.post(push_url, json=new_cam)

    if res.status_code == 200:
        print(f"\n[🚀] تم نشر الكاميرا بنجاح وظهرت فوراً على جميع أجهزة الزبائن!")
    else:
        print(f"\n[-] فشل النشر بواسطة السيرفر: {res.text}")

if __name__ == "__main__":
    main()
