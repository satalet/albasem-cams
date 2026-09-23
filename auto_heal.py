#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
محرك الباسم سات الذكي للفحص العميق والقنص الآلي
Albasem Sat Deep Health Check & Auto-Healer
"""

import json, os, re, sys, urllib.request, urllib.parse

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

def deep_check_hls(url, timeout=6):
    """فحص عميق للبث: تحميل ملف البث وأول مقطع فيديو فعلي للتأكد 100%"""
    if not url: return False, "رابط فارغ"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as res:
            if res.status != 200:
                return False, f"HTTP {res.status}"
            raw = res.read().decode('utf-8', errors='ignore')
            lines = [l.strip() for l in raw.splitlines() if l.strip() and not l.startswith('#')]
            
            if not lines:
                return False, "ملف البث فارغ من المقاطع"
            
            # مسار أول مقطع فيديو
            chunk_target = lines[0]
            if not chunk_target.startswith('http'):
                chunk_url = urllib.parse.urljoin(url, chunk_target)
            else:
                chunk_url = chunk_target
                
            # فحص تحميل مقطع الفيديو الفعلي
            creq = urllib.request.Request(chunk_url, headers=HEADERS)
            with urllib.request.urlopen(creq, timeout=timeout) as cres:
                chunk_data = cres.read(1024)
                if len(chunk_data) > 0 and cres.status == 200:
                    return True, "بث حي مستقر ومقاطع سليمة"
                return False, "مقطع الفيديو تالف أو فارغ"
    except Exception as e:
        return False, f"فشل الاتصال: {str(e)[:40]}"

def scrape_nablusmix():
    """صياد الروابط الحية لكاميرات نابلس من المصدر الرسمي"""
    try:
        url = "https://nablusmix.live/channel/3"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8) as res:
            html = res.read().decode('utf-8', errors='ignore')
            links = re.findall(r'https?://[^\s\'"]+\.m3u8[^\s\'"]*', html)
            for link in links:
                is_alive, _ = deep_check_hls(link)
                if is_alive:
                    return link
    except Exception as e:
        print(f"⚠️ خطأ أثناء قنص نابلس ميكس: {e}")
    return None

def main():
    print("=" * 60)
    print("🚀 بدء محرك الفحص العميق للباسم سات...")
    print("=" * 60)

    # فحص كاميرات نابلس كمثال رئيسي
    current_nablus = "https://cam.showtv.ps:443/live/C0698BA41EC6F31A49BD382BA68983A0/17.m3u8"
    is_ok, msg = deep_check_hls(current_nablus)
    print(f"🔍 فحص جولة نابلسية: [{'شغال' if is_ok else 'معطل'}] -> {msg}")

    if not is_ok:
        print("⚡ محاولة قنص رابط حي بديل فوراً...")
        fresh_url = scrape_nablusmix()
        if fresh_url:
            print(f"🎯 تم صيد رابط حي جديد: {fresh_url}")
            # استبدال الرابط القديم بالجديد في app.js إذا لزم
            with open("app.js", "r", encoding="utf-8") as f:
                app_code = f.read()
            if current_nablus in app_code:
                app_code = app_code.replace(current_nablus, fresh_url)
                with open("app.js", "w", encoding="utf-8") as f:
                    f.write(app_code)
                print("✅ تم تحديث كود المنصة بالرابط المقنوص بنجاح!")
        else:
            print("⚠️ لم يتم العثور على رابط بديل حتى اللحظة.")

    print("\n✅ اكتمل الفحص العميق.")

if __name__ == "__main__":
    main()
