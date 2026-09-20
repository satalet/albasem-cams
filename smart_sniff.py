#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
قناص الباسم سات المستقل (استخراج القسم، الاسم، والرابط تلقائياً 100%)
Albasem Sat - Autonomous Category & Stream Sniffer
"""

import asyncio
import json
import os
import sys
import argparse
import urllib.request
from urllib.parse import urlparse
from playwright.async_api import async_playwright

CONFIG_FILE = "/home/kali/albasem-cams/config.json"
API_KEY = "AIzaSyD4U4DFTtO8zuqIlrJp19ji1ESptfuVr9E"
FIREBASE_URL = "https://albasem-cams-default-rtdb.firebaseio.com/streams"

def get_auth_token():
    if not os.path.exists(CONFIG_FILE):
        print("❌ ملف الإعدادات config.json غير موجود.")
        sys.exit(1)
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        cfg = json.load(f)

    auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
    auth_data = json.dumps({"email": cfg['email'], "password": cfg['password'], "returnSecureToken": True}).encode('utf-8')
    req = urllib.request.Request(auth_url, data=auth_data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode('utf-8'))['idToken']
    except Exception as e:
        print(f"❌ خطأ توثيق الدخول مع فايربيس: {e}")
        sys.exit(1)

async def sniff_and_sync(target_url, area=None, custom_title=None, stream_id=None):
    print("=" * 65)
    print(f"🚀 بدء القنص الذاتي لصفحة المصدر: {target_url}")
    print("=" * 65)

    captured_m3u8 = []
    scraped_info = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        page.on("response", lambda r: captured_m3u8.append(r.url) if ".m3u8" in r.url else None)

        try:
            print("⏳ جاري فتح الصفحة واستخراج بيانات القناة وقسمها...")
            await page.goto(target_url, timeout=35000, wait_until="domcontentloaded")
            await asyncio.sleep(4)

            # استخراج الاسم والقسم تلقائياً من عناصر الصفحة
            scraped_info = await page.evaluate('''() => {
                // 1. استخراج الاسم
                let title = '';
                const h1 = document.querySelector('h1');
                if (h1 && h1.innerText.trim()) title = h1.innerText.trim();
                else {
                    const b = document.querySelector('.channel-title, .stream-title, h2');
                    if (b && b.innerText.trim()) title = b.innerText.trim();
                    else {
                        let t = document.title || '';
                        title = t.replace(/NABLUS LIVE|نابلس مباشر|بث حي|مباشر|شباب FM|-|\\|/gi, '').trim();
                    }
                }

                // 2. استخراج القسم/الفولدر من مسار الموقع (Breadcrumbs) أو وسوم التصنيف
                let category = '';
                const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb-item, .breadcrumb a, nav ol li, .nav-path a'));
                if (breadcrumbs.length > 1) {
                    // أخذ التصنيف الأوسط قبل اسم القناة
                    for (let i = breadcrumbs.length - 1; i >= 0; i--) {
                        let txt = breadcrumbs[i].innerText.trim();
                        if (txt && !txt.includes('الرئيسية') && !txt.includes('Home') && txt !== title) {
                            category = txt;
                            break;
                        }
                    }
                }

                if (!category) {
                    const catBadge = document.querySelector('.category, .badge-category, [data-category]');
                    if (catBadge && catBadge.innerText.trim()) category = catBadge.innerText.trim();
                }

                return { title: title || 'بث مباشر جديد', category: category || null };
            }''')

            # تنشيط المشغل بالخلفية
            btn = page.locator("button:has-text('تحديث البث'), .vjs-big-play-button")
            if await btn.count() > 0:
                await btn.first.click()
                await asyncio.sleep(4)

        except Exception as e:
            print(f"⚠️ تنبيه أثناء فحص الصفحة: {e}")

        await browser.close()

    # تحديد الاسم النهائي
    final_title = custom_title if custom_title else scraped_info.get('title', 'بث مباشر جديد')

    # تحديد القسم النهائي (يدوي -> مستخرج من الصفحة -> اسم دومين المصدر)
    if area and area.strip():
        final_area = area.strip()
    elif scraped_info.get('category'):
        final_area = scraped_info['category']
    else:
        # اشتقاق القسم الذاتي لو الصفحة ما فيها مسار واضح
        domain = urlparse(target_url).netloc.replace('www.', '').split('.')[0].capitalize()
        final_area = f"بثوث {domain}"

    print(f"🎯 الاسم المعتمد: [{final_title}]")
    print(f"📁 الفولدر/القسم المعتمد: [{final_area}]")

    # فلترة السيرفر المباشر
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
    if not valid_url and captured_m3u8:
        valid_url = captured_m3u8[0]

    if not valid_url:
        print(f"🔴 تنبيه: لم يتم العثور على رابط بث M3U8 نشط.")
        return

    print(f"🎯 تم قنص رابط البث الحي: {valid_url}")

    # التحديث في فايربيس
    token = get_auth_token()
    payload = {
        "title": final_title,
        "url": valid_url,
        "area": final_area,
        "type": "hls",
        "status": "active",
        "source_url": target_url
    }

    headers = {"Content-Type": "application/json"}
    if stream_id:
        db_url = f"{FIREBASE_URL}/{stream_id}.json?auth={token}"
        req = urllib.request.Request(db_url, data=json.dumps(payload).encode('utf-8'), headers=headers, method="PATCH")
        action = f"تحديث الكاميرا [{stream_id}]"
    else:
        db_url = f"{FIREBASE_URL}.json?auth={token}"
        req = urllib.request.Request(db_url, data=json.dumps(payload).encode('utf-8'), headers=headers, method="POST")
        action = "إضافة كاميرا جديدة"

    try:
        with urllib.request.urlopen(req) as resp:
            print(f"\n🟢 تم {action} بنجاح!")
            print(f"   📌 القناة: {final_title}")
            print(f"   📁 القسم الجديد: [{final_area}]")
            print(f"   🔗 الرابط: {valid_url}")
    except Exception as e:
        print(f"❌ خطأ في فايربيس: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="قناص الباسم سات الذاتي للقسم والاسم والرابط")
    parser.add_argument("url", help="رابط صفحة المصدر")
    parser.add_argument("area", nargs="?", default=None, help="اسم القسم (اتركه فارغاً لاستخراجه تلقائياً)")
    parser.add_argument("-t", "--title", default=None, help="اسم مخصص للقناة (اختياري)")
    parser.add_argument("-u", "--update-id", default=None, help="معرف القناة بفايربيس للتحديث")

    args = parser.parse_args()
    asyncio.run(sniff_and_sync(args.url, area=args.area, custom_title=args.title, stream_id=args.update_id))
