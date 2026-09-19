#!/usr/bin/env python3
import os
import sys
import json
import threading
import requests
import re
from urllib.parse import urlparse, parse_qs
import tkinter as tk
from tkinter import ttk, messagebox

FIREBASE_API_KEY = "AIzaSyD4U4DFTtO8zuqIlrJp19ji1ESptfuVr9E"
DB_URL = "https://albasem-cams-default-rtdb.firebaseio.com/streams.json"
CONFIG_FILE = os.path.expanduser("~/albasem-cams/config.json")

class AlbasemApp:
    def __init__(self, root):
        self.root = root
        self.root.title("الباسم سات | أداة إدارة وقنص الكاميرات الحية")
        self.root.geometry("620x760")
        self.root.resizable(False, False)
        self.root.configure(bg="#070a12")

        self.id_token = None
        self.load_credentials()
        self.setup_ui()

    def load_credentials(self):
        self.email = "satalet@gmail.com"
        self.password = ""
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    self.email = cfg.get("email", self.email)
                    self.password = cfg.get("password", "")
            except Exception as e:
                print(f"Error reading config: {e}")

    def get_token(self):
        if not self.password or self.password == "ضع_كلمة_المرور_هنا":
            messagebox.showerror("تنبيه", "يرجى كتابة كلمة المرور بملف config.json أولاً!")
            return False
        
        auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        payload = {
            "email": self.email,
            "password": self.password,
            "returnSecureToken": True
        }
        try:
            res = requests.post(auth_url, json=payload, timeout=8)
            data = res.json()
            if "idToken" in data:
                self.id_token = data["idToken"]
                return True
            else:
                err = data.get('error', {}).get('message', 'فشل المصادقة')
                messagebox.showerror("خطأ في الدخول", f"رفض السيرفر الدخول:\n{err}")
                return False
        except Exception as e:
            messagebox.showerror("خطأ اتصال", f"تعذر الاتصال بالسيرفر:\n{e}")
            return False

    def setup_ui(self):
        # الهيدر الرئيسي
        header_frame = tk.Frame(self.root, bg="#0d1322", padx=15, pady=15)
        header_frame.pack(fill="x")

        title_lbl = tk.Label(header_frame, text="📡 الباسم سات - نظام المراقبة الحي", 
                             font=("DejaVu Sans", 14, "bold"), fg="#10b981", bg="#0d1322")
        title_lbl.pack(anchor="e")

        sub_lbl = tk.Label(header_frame, text="قنص روابط البث المباشر واليوتيوب والنشر الفوري في التطبيق", 
                           font=("DejaVu Sans", 9), fg="#94a3b8", bg="#0d1322")
        sub_lbl.pack(anchor="e")

        main_box = tk.Frame(self.root, bg="#070a12", padx=20, pady=10)
        main_box.pack(fill="both", expand=True)

        # 1. قسم صيد الروابط
        sniff_frame = tk.LabelFrame(main_box, text=" 🎯 1. قنّاص الروابط الذكي ", 
                                    font=("DejaVu Sans", 10, "bold"), fg="#38bdf8", bg="#0f172a", 
                                    padx=12, pady=10, relief="solid", bd=1)
        sniff_frame.pack(fill="x", pady=6)

        tk.Label(sniff_frame, text="رابط صفحة البث في الموقع أو رابط يوتيوب:", font=("DejaVu Sans", 9), fg="#cbd5e1", bg="#0f172a").pack(anchor="e")
        self.page_url_entry = tk.Entry(sniff_frame, font=("Courier", 10), bg="#070a12", fg="#38bdf8", insertbackground="white")
        self.page_url_entry.pack(fill="x", pady=4)

        self.sniff_btn = tk.Button(sniff_frame, text="🚀 قنص واستخراج البث والاسم تلقائياً", 
                                   font=("DejaVu Sans", 10, "bold"), bg="#0284c7", fg="white", 
                                   activebackground="#0369a1", cursor="hand2", command=self.start_sniff_thread)
        self.sniff_btn.pack(fill="x", pady=5)

        # 2. قسم بيانات الكاميرا
        cam_frame = tk.LabelFrame(main_box, text=" 📝 2. تفاصيل ونشر الكاميرا ", 
                                  font=("DejaVu Sans", 10, "bold"), fg="#10b981", bg="#0f172a", 
                                  padx=12, pady=10, relief="solid", bd=1)
        cam_frame.pack(fill="x", pady=6)

        # اسم الكاميرا
        tk.Label(cam_frame, text="اسم / عنوان الكاميرا:", font=("DejaVu Sans", 9), fg="#cbd5e1", bg="#0f172a").pack(anchor="e")
        self.title_entry = tk.Entry(cam_frame, font=("DejaVu Sans", 10), bg="#070a12", fg="white", insertbackground="white")
        self.title_entry.pack(fill="x", pady=3)

        row_frame = tk.Frame(cam_frame, bg="#0f172a")
        row_frame.pack(fill="x", pady=3)

        # المنطقة
        col1 = tk.Frame(row_frame, bg="#0f172a")
        col1.pack(side="right", fill="x", expand=True, padx=(4, 0))
        tk.Label(col1, text="المنطقة / الفهرس:", font=("DejaVu Sans", 9), fg="#cbd5e1", bg="#0f172a").pack(anchor="e")
        self.area_combo = ttk.Combobox(col1, values=["نابلس", "القدس", "كفر عقب", "الرام", "رام الله", "طولكرم", "جنين", "الخليل", "أخبار", "عام"], font=("DejaVu Sans", 9))
        self.area_combo.set("نابلس")
        self.area_combo.pack(fill="x")

        # نوع البث
        col2 = tk.Frame(row_frame, bg="#0f172a")
        col2.pack(side="left", fill="x", expand=True, padx=(0, 4))
        tk.Label(col2, text="نوع البث:", font=("DejaVu Sans", 9), fg="#cbd5e1", bg="#0f172a").pack(anchor="e")
        self.type_combo = ttk.Combobox(col2, values=["hls", "youtube", "image"], state="readonly", font=("DejaVu Sans", 9))
        self.type_combo.set("hls")
        self.type_combo.pack(fill="x")

        # رابط البث المستخرج
        tk.Label(cam_frame, text="رابط البث الصافي (Direct Stream URL):", font=("DejaVu Sans", 9), fg="#cbd5e1", bg="#0f172a").pack(anchor="e", pady=(6, 0))
        self.stream_url_entry = tk.Entry(cam_frame, font=("Courier", 10), bg="#070a12", fg="#10b981", insertbackground="white")
        self.stream_url_entry.pack(fill="x", pady=3)

        # زر النشر
        self.publish_btn = tk.Button(cam_frame, text="✨ نشر الكاميرا فوراً على موقع وتطبيق الباسم سات", 
                                     font=("DejaVu Sans", 11, "bold"), bg="#059669", fg="white", 
                                     activebackground="#047857", cursor="hand2", command=self.publish_stream)
        self.publish_btn.pack(fill="x", pady=8)

        # شريط الحالة
        self.status_lbl = tk.Label(self.root, text="جاهز للعمل...", font=("DejaVu Sans", 9), fg="#64748b", bg="#070a12", pady=8)
        self.status_lbl.pack(side="bottom", fill="x")

    def log(self, text, color="#94a3b8"):
        self.status_lbl.config(text=text, fg=color)

    def start_sniff_thread(self):
        target_url = self.page_url_entry.get().strip()
        if not target_url:
            messagebox.showwarning("تنبيه", "يرجى وضع رابط صفحة البث أولاً!")
            return

        self.sniff_btn.config(state="disabled", text="⏳ جاري التحليل والقنص...")
        self.log("جاري فحص الرابط ونوع البث...", "#38bdf8")

        thread = threading.Thread(target=self.run_sniff, args=(target_url,), daemon=True)
        thread.start()

    def run_sniff(self, target_url):
        # 1. إذا كان الرابط يوتيوب
        if "youtube.com" in target_url or "youtu.be" in target_url:
            self.handle_youtube(target_url)
            return

        # 2. للبث المباشر العادي عبر Playwright (صيد M3U8)
        found_url = None
        extracted_title = ""
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
                page = context.new_page()

                def handle_req(req):
                    nonlocal found_url
                    if ".m3u8" in req.url and not found_url:
                        found_url = req.url

                page.on("request", handle_req)
                page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
                page.wait_for_timeout(3500)

                # استخراج اسم الكاميرا من الصفحة
                try:
                    h1 = page.locator("h1").first.inner_text()
                    if h1 and len(h1.strip()) > 1:
                        extracted_title = h1.strip()
                except Exception:
                    pass

                if not extracted_title:
                    raw_title = page.title()
                    extracted_title = raw_title.split("-")[0].split("|")[0].strip()

                browser.close()
        except Exception as e:
            print("Sniff error:", e)

        self.root.after(0, self.finish_sniff_hls, found_url, extracted_title)

    def handle_youtube(self, target_url):
        extracted_title = ""
        final_url = target_url

        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
                page.wait_for_timeout(3000)
                
                # التقاط الرابط الفعلي بعد التحويل والاسم
                final_url = page.url
                raw_title = page.title()
                extracted_title = raw_title.replace("- YouTube", "").strip()
                browser.close()
        except Exception:
            pass

        # تحويل الرابط لـ Embed نظيف
        vid_id = None
        if "youtu.be" in final_url:
            vid_id = final_url.split("/")[-1].split("?")[0]
        elif "v=" in final_url:
            match = re.search(r"v=([a-zA-Z0-9_-]+)", final_url)
            if match: vid_id = match.group(1)

        embed_url = f"https://www.youtube-nocookie.com/embed/{vid_id}" if vid_id else final_url
        if not extracted_title:
            extracted_title = "بث مباشر يوتيوب"

        self.root.after(0, self.finish_youtube, embed_url, extracted_title)

    def finish_youtube(self, url, title):
        self.sniff_btn.config(state="normal", text="🚀 قنص واستخراج البث والاسم تلقائياً")
        self.stream_url_entry.delete(0, tk.END)
        self.stream_url_entry.insert(0, url)
        self.type_combo.set("youtube")
        self.area_combo.set("أخبار")
        self.title_entry.delete(0, tk.END)
        self.title_entry.insert(0, title)
        self.log("تم استخراج بث اليوتيوب بنجاح!", "#10b981")
        messagebox.showinfo("نجاح 🎯", f"تم التعرف على بث اليوتيوب:\n{title}\n\nجاهز للنشر بضغطة واحدة!")

    def finish_sniff_hls(self, url, title):
        self.sniff_btn.config(state="normal", text="🚀 قنص واستخراج البث والاسم تلقائياً")
        if title:
            self.title_entry.delete(0, tk.END)
            self.title_entry.insert(0, title)

        if url:
            clean_url = url.split("?")[0] if ("index.m3u8" in url or "mono.m3u8" in url) else url
            self.stream_url_entry.delete(0, tk.END)
            self.stream_url_entry.insert(0, clean_url)
            self.type_combo.set("hls")
            self.log("تم اصطياد رابط M3U8 بنجاح!", "#10b981")
            messagebox.showinfo("نجاح 🎯", f"تم اصطياد الرابط والاسم:\n{title}\n{clean_url}")
        else:
            self.log("تعذر العثور على رابط تلقائي، يمكنك وضعه يدوياً.", "#f87171")
            messagebox.showwarning("تنبيه", "لم يتم التقاط رابط m3u8 تلقائياً. تأكد من تشغيل البث في الصفحة.")

    def publish_stream(self):
        title = self.title_entry.get().strip()
        area = self.area_combo.get().strip()
        stream_type = self.type_combo.get()
        url = self.stream_url_entry.get().strip()

        if not title or not url:
            messagebox.showwarning("نقص بيانات", "يرجى ملء اسم الكاميرا ورابط البث على الأقل!")
            return

        if not self.id_token:
            self.log("جاري التحقق من هوية الحساب في Firebase...", "#38bdf8")
            if not self.get_token():
                return

        payload = {
            "title": title,
            "area": area,
            "type": stream_type,
            "url": url,
            "category": "سير",
            "status": "active"
        }

        try:
            push_url = f"{DB_URL}?auth={self.id_token}"
            res = requests.post(push_url, json=payload, timeout=8)
            if res.status_code == 200:
                self.log(f"تم نشر '{title}' في السيرفر بنجاح!", "#10b981")
                messagebox.showinfo("مبروك يا أبو باسم! 🚀", f"تم نشر الكاميرا بنجاح:\n'{title}'")
                self.title_entry.delete(0, tk.END)
                self.stream_url_entry.delete(0, tk.END)
                self.page_url_entry.delete(0, tk.END)
            else:
                messagebox.showerror("خطأ", f"رفض السيرفر الحفظ: {res.text}")
        except Exception as e:
            messagebox.showerror("خطأ اتصال", f"فشل رفع الكاميرا:\n{e}")

if __name__ == "__main__":
    root = tk.Tk()
    app = AlbasemApp(root)
    root.mainloop()
