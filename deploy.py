#!/usr/bin/env python3
import sys, os, re, subprocess, datetime

repo_dir = "/home/kali/albasem-cams"
os.chdir(repo_dir)

now = datetime.datetime.now()
new_ver = now.strftime("%y.%m%d.%H%M")
msg = sys.argv[1] if len(sys.argv) > 1 else "تحديث المنصة وإصلاحات عامة"

print(f"\033[96m🚀 جاري تجهيز الإصدار الجديد: v{new_ver} ...\033[0m")

html_file = os.path.join(repo_dir, "index.html")
if os.path.exists(html_file):
    with open(html_file, "r", encoding="utf-8") as f:
        content = f.read()

    # تحديث روابط app.js و style.css برقم الفيرجن النظيف
    content = re.sub(r'app\.js(\?[^"\']*)?', f'app.js?v={new_ver}', content)
    content = re.sub(r'style\.css(\?[^"\']*)?', f'style.css?v={new_ver}', content)

    with open(html_file, "w", encoding="utf-8") as f:
        f.write(content)

print("\033[93m📦 جاري الرفع إلى GitHub مع كسر الكاش...\033[0m")
subprocess.run(["git", "add", "."])
subprocess.run(["git", "commit", "-m", f"Release v{new_ver}: {msg}"])
subprocess.run(["git", "push"])

print(f"\033[92m✅ تم إطلاق الإصدار v{new_ver} بنجاح تام!\033[0m")
