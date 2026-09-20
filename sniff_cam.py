#!/usr/bin/env python3
import sys
import re

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("[!] مكتبة playwright مش نازلة، نزلها بأمر: pip install playwright && playwright install chromium")
    sys.exit(1)

def extract_stream(target_url):
    print(f"\n[*] جاري اصطياد رابط البث من: {target_url}")
    found_urls = []

    with sync_playwright() as p:
        # تشغيل المتصفح بالخلفية
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        # اعتراض الطلبات والبحث عن ملفات m3u8
        def handle_request(request):
            url = request.url
            if ".m3u8" in url and url not in found_urls:
                found_urls.append(url)
                print(f"\n[🎯] صيدك جاهز! تم التقاط رابط البث:")
                print(f"👉 {url}\n")

        page.on("request", handle_request)

        try:
            page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
            # انتظار 4 ثواني للتأكد من تشغيل مشغل الفيديو
            page.wait_for_timeout(4000)
        except Exception as e:
            print(f"[-] ملاحظة أثناء الفحص: {e}")
        finally:
            browser.close()

    if not found_urls:
        print("[-] لم يتم التقاط رابط .m3u8 تلقائياً، تأكد إن البث شغال بالصفحة.")
    return found_urls

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target = sys.argv[1]
    else:
        target = input("ادخل رابط صفحة البث: ").strip()

    if target:
        extract_stream(target)
