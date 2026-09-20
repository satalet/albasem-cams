#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
قناص الباسم سات الدقيق لكالي (فلترة السيرفرات وتفادي التكرار)
Albasem Sat - Advanced Precision Sniffer
"""

import asyncio, json, os, sys, urllib.request
from playwright.async_api import async_playwright

CONFIG_FILE = "/home/kali/albasem-cams/config.json"
API_KEY = "AIzaSyD4U4DFTtO8zuqIlrJp19ji1ESptfuVr9E"
FIREBASE_URL = "https://albasem-cams-default-rtdb.firebaseio.com/streams"

def get_auth_token():
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
    auth_data = json.dumps({"email": cfg['email'], "password": cfg['password'], "returnSecureToken": True}).encode('utf-8')
    req = urllib.request.Request(auth_url, data=auth_data, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read().decode('utf-8'))['idToken']

async def sniff_and_sync(target_url, stream_id_to_update=None):
    print("=" * 65)
    print(f"🚀 بدء القنص الدقيق لصفحة المصدر: {target_url}")
    print("=" * 65)

    captured_m3u8 = []
    page_title = None

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        page.on("response", lambda r: captured_m3u8.append(r.url) if ".m3u8" in r.url else None)

        try:
            await page.goto(target_url, timeout=35000, wait_until="domcontentloaded")
            await asyncio.sleep(4)

            page_title = await page.evaluate('''() => {
                const h1 = document.querySelector('h1');
                if (h1 && h1.innerText.trim()) return h1.innerText.trim();
                const b = document.querySelector('.channel-title, .stream-title, h2');
                if (b && b.innerText.trim()) return b.innerText.trim();
                let t = document.title || '';
                return t.replace(/NABLUS LIVE|نابلس مباشر|بث حي|مباشر|شباب FM|-|\\|/gi, '').trim() || 'بث مباشر جديد';
            }''')

            btn = page.locator("button:has-text('تحديث البث'), .vjs-big-play-button")
            if await btn.count() > 0:
                await btn.first.click()
                await asyncio.sleep(4)

        except Exception as e:
            print(f"⚠️ خطأ: {e}")

        await browser.close()

    print(f"🎯 الاسم الرسمي: [{page_title}]")
    
    # فلترة ذكية: البحث عن السيرفر الخاص وتفادي السيرفرات المتكررة إن أمكن
    valid_url = None
    for u in set(captured_m3u8):
        if "cam.showtv.ps" in u:
            valid_url = u
            break
    if not valid_url:
        for u in set(captured_m3u8):
            if "mono.m3u8" in u or "index.m3u8" in u:
                valid_url = u
                break

    if not valid_url:
        print(f"🔴 تنبيه: القناة متوقفة من المصدر.")
        return

    print(f"🎯 تم قنص الرابط المستقل: {valid_url}")
    token = get_auth_token()
    payload = {
        "title": page_title,
        "url": valid_url,
        "area": "نابلس",
        "type": "hls",
        "status": "active",
        "source_url": target_url
    }

    if stream_id_to_update:
        db_url = f"{FIREBASE_URL}/{stream_id_to_update}.json?auth={token}"
        req = urllib.request.Request(db_url, data=json.dumps(payload).encode('utf-8'), headers={"Content-Type": "application/json"}, method="PATCH")
    else:
        db_url = f"{FIREBASE_URL}.json?auth={token}"
        req = urllib.request.Request(db_url, data=json.dumps(payload).encode('utf-8'), headers={"Content-Type": "application/json"}, method="POST")

    urllib.request.urlopen(req)
    print(f"🟢 تم التحديث في فايربيس بنجاح بدون تكرار!")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "https://nablusmix.live/channel/3"
    update_id = sys.argv[2] if len(sys.argv) > 2 else None
    asyncio.run(sniff_and_sync(target, update_id))
