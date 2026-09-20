#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
محرك الباسم سات الذكي للفحص والإنعاش التلقائي للبثوث
Albasem Sat - Autonomous Stream Health Checker & Healer
"""

import os
import sys
import json
import re
import urllib.request
import urllib.error

FIREBASE_URL = "https://albasem-cams-default-rtdb.firebaseio.com/streams"
API_KEY = "AIzaSyD4U4DFTtO8zuqIlrJp19ji1ESptfuVr9E"

# مصادر بديلة وسيرفرات جاهزة للقنوات الحساسة
KNOWN_FALLBACKS = {
    "سما نابلس": "https://streaming.zaytonatube.com:8081/nb/nb/tracks-v1a1/mono.m3u8",
    "إذاعة وتلفزيون القرآن الكريم (نابلس)": "https://htvint.mada.ps/shababquran/index.m3u8",
    "تلفزيون شباب FM (سيرفر 1 - رئيسي)": "https://streaming.zaytonatube.com:8081/ShababFM/shabab/index.m3u8"
}

def get_admin_token(email, password):
    auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
    auth_data = json.dumps({"email": email, "password": password, "returnSecureToken": True}).encode('utf-8')
    req = urllib.request.Request(auth_url, data=auth_data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        return res.get('idToken')

def fetch_streams():
    req = urllib.request.Request(f"{FIREBASE_URL}.json", headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    if not data:
        return {}
    return {k: v for k, v in data.items() if not k.startswith('_') and isinstance(v, dict) and v.get('title')}

def check_stream_health(stream):
    stype = stream.get('type', 'hls')
    url = stream.get('url', '').strip()

    if not url:
        return False, "رابط فارغ"

    if stype == 'youtube':
        vid_match = re.search(r'(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})', url)
        if vid_match:
            vid = vid_match.group(1)
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid}&format=json"
            try:
                req = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=6) as r:
                    if r.status == 200:
                        return True, "شغال 100% (YouTube Live)"
            except Exception as e:
                return False, f"يوتيوب غير متاح ({e})"
        return True, "يوتيوب مباشر"

    elif stype == 'hls':
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "*/*"
                }
            )
            with urllib.request.urlopen(req, timeout=7) as resp:
                if resp.status == 200:
                    return True, "بث حي مستقر (HLS 200 OK)"
                return False, f"رمز الاستجابة: {resp.status}"
        except urllib.error.HTTPError as e:
            return False, f"توقف البث (HTTP {e.code})"
        except Exception as e:
            return False, f"خطأ اتصال ({str(e)[:30]})"

    return True, "غير محدد"

def update_stream_in_firebase(stream_id, new_url, token):
    db_url = f"{FIREBASE_URL}/{stream_id}.json?auth={token}"
    payload = json.dumps({"url": new_url, "status": "active"}).encode('utf-8')
    req = urllib.request.Request(db_url, data=payload, headers={"Content-Type": "application/json"}, method="PATCH")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status == 200

def main():
    print("=" * 70)
    print("🚀 محرك الباسم سات الذكي للفحص الذاتي الشامل")
    print("=" * 70)

    email = os.environ.get("ADMIN_EMAIL")
    password = os.environ.get("ADMIN_PASSWORD")

    token = None
    if email and password:
        try:
            token = get_admin_token(email, password)
            print("🔐 تم تسجيل دخول الإدارة والحصول على توكن الصلاحيات السحابية بنجاح.")
        except Exception as e:
            print(f"⚠️ تعذر توثيق حساب الإدارة: {e}")

    streams = fetch_streams()
    print(f"📡 جاري فحص {len(streams)} قناة...\n")

    healthy = 0
    healed = 0

    for sid, stream in streams.items():
        title = stream.get('title', 'بدون عنوان')
        area = stream.get('area', 'عام')
        is_ok, reason = check_stream_health(stream)

        if is_ok:
            healthy += 1
            print(f"🟢 [شغال]  {title:<35} | {reason}")
        else:
            print(f"🔴 [متوقف] {title:<35} | {reason}")
            # إذا توفر رابط بديل معتمد وتوفر توكن التعديل، قم بالإنعاش التلقائي فوراً
            if title in KNOWN_FALLBACKS and token:
                fallback_url = KNOWN_FALLBACKS[title]
                print(f"   🩹 جاري محاولة الإنعاش التلقائي للرابط المعتمد...")
                try:
                    if update_stream_in_firebase(sid, fallback_url, token):
                        print(f"   🟢 تم إنعاش قناة [{title}] وتحديث فايربيس بنجاح!")
                        healed += 1
                    else:
                        print("   ❌ فشل تحديث فايربيس.")
                except Exception as ex:
                    print(f"   ❌ خطأ أثناء الإنعاش: {ex}")

    print("\n" + "=" * 70)
    print(f"📊 التقرير النهائي: {healthy} شغال | {healed} تم إنعاشها تلقائياً.")
    print("=" * 70)

if __name__ == "__main__":
    main()
