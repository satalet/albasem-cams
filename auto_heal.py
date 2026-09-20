#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
محرك الباسم سات الذكي للإنعاش السحابي التلقائي (الاسم + الرابط)
Albasem Sat - Autonomous Cloud Auto-Heal & Sniffer Engine
"""

import os
import sys
import json
import re
import asyncio
import urllib.request
import urllib.error

FIREBASE_URL = "https://albasem-cams-default-rtdb.firebaseio.com/streams"
API_KEY = "AIzaSyD4U4DFTtO8zuqIlrJp19ji1ESptfuVr9E"
CONFIG_FILE = "/home/kali/albasem-cams/config.json"

# مصادر احتياطية في حال تعذر فتح الصفحة
KNOWN_FALLBACKS = {
    "إذاعة وتلفزيون القرآن الكريم (نابلس)": ("إذاعة وتلفزيون القرآن الكريم", "https://htvint.mada.ps/shababquran/index.m3u8"),
    "تلفزيون شباب FM (سيرفر 1 - رئيسي)": ("تلفزيون شباب FM", "https://streaming.zaytonatube.com:8081/ShababFM/shabab/index.m3u8"),
    "سما نابلس": ("جولة نابلسية 2", "https://streaming.zaytonatube.com:8081/nb/nb/tracks-v1a1/mono.m3u8")
}

# روابط مصادر افتراضية للقنوات التي لا تملك source_url مسجل
DEFAULT_SOURCES = {
    "-P1vHx_57OF_MfGom_um": "https://nablusmix.live/channel/40",
    "-P1v9AE8ENv9y8MvmyNm": "https://nablusmix.live/channel/38",
    "-P1vNoy1UKgtW9bP0nfC": "https://nablusmix.live/channel/37",
    "-P1vcgQws4j0ignPYt7I": "https://shababfm.ps/shabab-tv-ar/"
}

def get_admin_token():
    email = os.environ.get("ADMIN_EMAIL")
    password = os.environ.get("ADMIN_PASSWORD")

    # في حال التشغيل المحلي على كالي وقراءة config.json
    if (not email or not password) and os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
                email = cfg.get("email")
                password = cfg.get("password")
        except:
            pass

    if not email or not password:
        return None

    auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
    auth_data = json.dumps({"email": email, "password": password, "returnSecureToken": True}).encode('utf-8')
    req = urllib.request.Request(auth_url, data=auth_data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            return res.get('idToken')
    except Exception as e:
        print(f"⚠️ تعذر توثيق حساب الإدارة: {e}")
        return None

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
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "*/*"}
            )
            with urllib.request.urlopen(req, timeout=7) as resp:
                if resp.status == 200:
                    return True, "بث حي مستقر (HLS 200 OK)"
                return False, f"رمز الاستجابة: {resp.status}"
        except urllib.error.HTTPError as e:
            return False, f"توقف البث (HTTP {e.code})"
        except Exception as e:
            return False, f"خطأ اتصال ({str(e)[:25]})"

    return True, "غير محدد"

async def sniff_source(target_url):
    """فتح صفحة المصدر واستخراج الاسم الرسمي والرابط الحي معاً"""
    from playwright.async_api import async_playwright
    captured = []
    official_title = None

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")
            page.on("response", lambda r: captured.append(r.url) if ".m3u8" in r.url else None)

            await page.goto(target_url, timeout=30000, wait_until="domcontentloaded")
            await asyncio.sleep(3)

            # استخراج الاسم الرسمي من الصفحة
            official_title = await page.evaluate('''() => {
                const h1 = document.querySelector('h1');
                if (h1 && h1.innerText.trim()) return h1.innerText.trim();
                const b = document.querySelector('.channel-title, .stream-title, h2');
                if (b && b.innerText.trim()) return b.innerText.trim();
                let t = document.title || '';
                return t.replace(/NABLUS LIVE|نابلس مباشر|بث حي|مباشر|شباب FM|-|\\|/gi, '').trim() || null;
            }''')

            # الضغط التلقائي على زر التحديث إن وجد
            r_btn = page.locator("button:has-text('تحديث البث'), a:has-text('تحديث البث')")
            if await r_btn.count() > 0:
                await r_btn.first.click()
                await asyncio.sleep(4)

            await browser.close()
    except Exception as e:
        print(f"   ⚠️ خطأ أثناء تشغيل القناص السحابي: {e}")

    valid_url = None
    for u in set(captured):
        if "mono.m3u8" in u or "index.m3u8" in u or "playlist.m3u8" in u:
            valid_url = u
            break
    if not valid_url and captured:
        valid_url = captured[0]

    return official_title, valid_url

def update_firebase_stream(stream_id, new_title, new_url, token):
    db_url = f"{FIREBASE_URL}/{stream_id}.json?auth={token}"
    payload = {"status": "active"}
    if new_url:
        payload["url"] = new_url
    if new_title:
        payload["title"] = new_title

    req = urllib.request.Request(db_url, data=json.dumps(payload).encode('utf-8'), headers={"Content-Type": "application/json"}, method="PATCH")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status == 200

async def main():
    print("=" * 70)
    print("🚀 محرك الباسم سات الذكي للإنعاش السحابي (الاسم + الرابط)")
    print("=" * 70)

    token = get_admin_token()
    if token:
        print("🔐 تم توثيق صلاحيات الأدمن السحابية بنجاح.")
    else:
        print("⚠️ تنبيه: لم يتم توثيق الصلاحيات (لن يتم تحديث فايربيس في حال التوقف).")

    streams = fetch_streams()
    print(f"📡 جاري فحص {len(streams)} قناة...\n")

    healthy = 0
    healed = 0

    for sid, stream in streams.items():
        title = stream.get('title', 'بدون عنوان')
        is_ok, reason = check_stream_health(stream)

        if is_ok:
            healthy += 1
            print(f"🟢 [شغال]  {title:<35} | {reason}")
        else:
            print(f"🔴 [متوقف] {title:<35} | {reason}")
            source_url = stream.get('source_url') or DEFAULT_SOURCES.get(sid)

            if token and source_url:
                print(f"   ⚡ بدء القنص الذاتي لصفحة المصدر: {source_url}")
                new_title, new_url = await sniff_source(source_url)

                # إذا لم يُلتقط اسم جديد نحتفظ بالاسم الحالي
                final_title = new_title or title

                if new_url:
                    print(f"   🎯 تم قنص الاسم الجديد: [{final_title}] والرابط الجديد بنجاح!")
                    if update_firebase_stream(sid, final_title, new_url, token):
                        print(f"   🟢 تم تحديث القناة بفايربيس (الاسم + الرابط معاً)!")
                        healed += 1
                    else:
                        print("   ❌ فشل إرسال التحديث لفايربيس.")
                else:
                    # فحص السيرفرات الاحتياطية المعتمدة
                    if title in KNOWN_FALLBACKS:
                        fb_title, fb_url = KNOWN_FALLBACKS[title]
                        print(f"   🩹 اعتماد السيرفر الاحتياطي: [{fb_title}]")
                        update_firebase_stream(sid, fb_title, fb_url, token)
                        healed += 1
                    else:
                        print(f"   ⚠️ القناة متوقفة من المصدر الأصلي.")

    print("\n" + "=" * 70)
    print(f"📊 النتيجة: {healthy} شغال | {healed} تم إنعاشها وتحديث اسمها ورابطها تلقائياً.")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
