#!/usr/bin/env python3
import os
import sys
import json
import threading
import requests
from urllib.parse import urlparse, parse_qs
import tkinter as tk
from tkinter import ttk, messagebox

# تفعيل تشبيك وعكس الحروف العربية لتناسب نظام Tkinter
try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    def ar(text):
        if not text: return ""
        reshaped = arabic_reshaper.reshape(text)
        return get_display(reshaped)
except ImportError:
    def ar(text): return text

FIREBASE_API_KEY = "AIzaSyD4U4DFTtO8zuqIlrJp19ji1ESptfuVr9E"
DB_URL = "https://albasem-cams-default-rtdb.firebaseio.com/streams.json"
CONFIG_FILE = os.path.expanduser("~/albasem-cams/config.json")

class AlbasemApp:
    def __init__(self, root):
        self.root = root
        self.root.title(ar("الباسم سات | أداة إدارة وقنص الكاميرات الحية"))
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
            messagebox.showerror(ar("تنبيه"), ar("يرجى كتابة كلمة المرور بملف config.json أولاً!"))
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
                messagebox.showerror(ar("خطأ في الدخول"), f"{ar('رفض السيرفر الدخول')}:\n{err}")
                return False
        except Exception as e:
            messagebox.showerror(ar("خطأ اتصال"), f"{ar('تعذر الاتصال بالسيرفر')}:\n{e}")
            return False

    def setup_ui(self):
        # Header Box
        header_frame = tk.Frame(self.root, bg="#0d1322", padx=15, pady=15)
        header_frame.pack(fill="x")

        title_lbl = tk.Label(header_frame, text=ar("📡 الباسم سات - نظام المراقبة الحي"), 
                             font=("Tajawal", 15, "bold"), fg="#10b981", bg="#0d1322")
        title_lbl.pack(anchor="e")

        sub_lbl = tk.Label(header_frame, text=ar("قنص روابط البث المباشر والنشر الفوري في التطبيق"), 
                           font=("Tajawal", 10), fg="#94a3b8", bg="#0d1322")
        sub_lbl.pack(anchor="e")

        main_box = tk.Frame(self.root, bg="#070a12", padx=20, pady=10)
        main_box.pack(fill="both", expand=True)

        # 1. قسم صيد الروابط
        sniff_frame = tk.LabelFrame(main_box, text=ar(" 🎯 1. قنّاص الروابط الذكي "), 
                                    font=("Tajawal", 10, "bold"), fg="#38bdf8", bg="#0f172a", 
                                    padx=12, pady=8, relief="solid", bd=1)
        sniff_frame.pack(fill="x", pady=4)

        tk.Label(sniff_frame, text=ar("رابط صفحة البث في الموقع:"), font=("Tajawal", 9), fg="#cbd5e1", bg="#0f172a").pack(anchor="e")
        self.page_url_entry = tk.Entry(sniff_frame, font=("Courier", 10), bg="#070a12", fg="#38bdf8", insertbackground="white")
        self.page_url_entry.pack(fill="x", pady=3)

        self.sniff_btn = tk.Button(sniff_frame, text=ar("🚀 قنص واستخراج الرابط والاسم تلقائياً"), 
                                   font=("Tajawal", 10, "bold"), bg="#0284c7", fg="white", 
                                   activebackground="#0369a1", cursor="hand2", command=self.start_sniff_thread)
        self.sniff_btn.pack(fill="x", pady=4)

        # 2. قسم بيانات الكاميرا
        cam_frame = tk.LabelFrame(main_box, text=ar(" 📝 2. تفاصيل ونشر الكاميرا "), 
                                  font=("Tajawal", 10, "bold"), fg="#10b981", bg="#0f172a", 
                                  padx=12, pady=8, relief="solid", bd=1)
        cam_frame.pack(fill="x", pady=4)

        # اسم الكاميرا
        tk.Label(cam_frame, text=ar("اسم / عنوان الكاميرا:"), font=("Tajawal", 9), fg="#cbd5e1", bg="#0f172a").pack(anchor="e")
        self.title_entry = tk.Entry(cam_frame, font=("Courier", 11), bg="#070a12", fg="white", insertbackground="white")
        self.title_entry.pack(fill="x", pady=2)
        self.title_entry.bind("<KeyRelease>", self.update_title_preview)

        # معاينة حية للاسم
        self.title_preview_lbl = tk.Label(cam_frame, text=ar("المعاينة: (فارغ)"), font=("Tajawal", 10, "bold"), fg="#38bdf8", bg="#0f172a")
        self.title_preview_lbl.pack(anchor="e", pady=(0, 4))

        # المنطقة ونوع البث
        row_frame = tk.Frame(cam_frame, bg="#0f172a")
        row_frame.pack(fill="x", pady=2)

        # المنطقة (قائمة منسدلة سهلة)
        col1 = tk.Frame(row_frame, bg="#0f172a")
        col1.pack(side="right", fill="x", expand=True, padx=(4, 0))
        tk.Label(col1, text=ar("المنطقة / الفهرس:"), font=("Tajawal", 9), fg="#cbd5e1", bg="#0f172a").pack(anchor="e")
        self.area_combo = ttk.Combobox(col1, values=["نابلس", "القدس", "كفر عقب", "الرام", "رام الله", "طولكرم", "جنين", "الخليل", "عام"], font=("Arial", 10))
        self.area_combo.set("نابلس")
        self.area_combo.pack(fill="x")

        # نوع البث
        col2 = tk.Frame(row_frame, bg="#0f172a")
        col2.pack(side="left", fill="x", expand=True, padx=(0, 4))
        tk.Label(col2, text=ar("نوع البث:"), font=("Tajawal", 9), fg="#cbd5e1", bg="#0f172a").pack(anchor="e")
        self.type_combo = ttk.Combobox(col2, values=["hls", "youtube", "image"], state="readonly", font=("Arial", 9))
        self.type_combo.set("hls")
        self.type_combo.pack(fill="x")

        # رابط البث الصافي
        tk.Label(cam_frame, text=ar("رابط البث الصافي (Direct Stream URL):"), font=("Tajawal", 9), fg="#cbd5e1", bg="#0f172a").pack(anchor="e", pady=(4, 0))
        self.stream_url_entry = tk.Entry(cam_frame, font=("Courier", 10), bg="#070a12", fg="#10b981", insertbackground="white")
        self.stream_url_entry.pack(fill="x", pady=2)

        # زر النشر
        self.publish_btn = tk.Button(cam_frame, text=ar("✨ نشر الكاميرا فوراً على موقع وتطبيق الباسم سات"), 
                                     font=("Tajawal", 11, "bold"), bg="#059669", fg="white", 
                                     activebackground="#047857", cursor="hand2", command=self.publish_stream)
        self.publish_btn.pack(fill="x", pady=6)

        # شريط الحالة
        self.status_lbl = tk.Label(self.root, text=ar("جاهز للعمل..."), font=("Tajawal", 9), fg="#64748b", bg="#070a12", pady=6)
        self.status_lbl.pack(side="bottom", fill="x")

    def update_title_preview(self, event=None):
        raw_text = self.title_entry.get().strip()
        if raw_text:
            self.title_preview_lbl.config(text=f"{ar('المعاينة')}: {ar(raw_text)}")
        else:
            self.title_preview_lbl.config(text=ar("المعاينة: (فارغ)"))

    def log(self, text, color="#94a3b8"):
        self.status_lbl.config(text=ar(text), fg=color)

    def start_sniff_thread(self):
        target_url = self.page_url_entry.get().strip()
        if not target_url:
            messagebox.showwarning(ar("تنبيه"), ar("يرجى وضع رابط صفحة البث أولاً!"))
            return

        self.sniff_btn.config(state="disabled", text=ar("⏳ جاري القنص والفحص بالخلفية..."))
        self.log("المتصفح يتصنت على حركة البث الآن...", "#38bdf8")

        thread = threading.Thread(target=self.run_playwright_sniff, args=(target_url,), daemon=True)
        thread.start()

    def run_playwright_sniff(self, target_url):
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

                # استخراج اسم الكاميرا تلقائياً من الصفحة
                try:
                    h1 = page.locator("h1").first.inner_text()
                    if h1 and len(h1.strip()) > 1:
                        extracted_title = h1.strip()
                except Exception:
                    pass

                if not extracted_title:
                    raw_title = page.title()
                    if "-" in raw_title:
                        extracted_title = raw_title.split("-")[0].strip()
                    elif "|" in raw_title:
                        extracted_title = raw_title.split("|")[0].strip()
                    else:
                        extracted_title = raw_title.strip()

                browser.close()
        except Exception as e:
            print("Sniff error:", e)

        self.root.after(0, self.finish_sniff, found_url, extracted_title)

    def finish_sniff(self, url, title):
        self.sniff_btn.config(state="normal", text=ar("🚀 قنص واستخراج الرابط والاسم تلقائياً"))
        if title:
            self.title_entry.delete(0, tk.END)
            self.title_entry.insert(0, title)
            self.update_title_preview()

        if url:
            clean_url = url.split("?")[0] if ("index.m3u8" in url or "mono.m3u8" in url) else url
            self.stream_url_entry.delete(0, tk.END)
            self.stream_url_entry.insert(0, clean_url)
            self.type_combo.set("hls")
            self.log("تم اصطياد الرابط والاسم بنجاح!", "#10b981")
            messagebox.showinfo(ar("تم الصيد بنجاح! 🎯"), f"{ar('تم التقاط الرابط والاسم تلقائياً')}:\n{title}\n{clean_url}")
        else:
            self.log("تعذر العثور على رابط تلقائي، يمكنك وضعه يدوياً.", "#f87171")
            messagebox.showwarning(ar("لم يتم الصيد"), ar("لم يتم التقاط رابط .m3u8 تلقائياً. تأكد من تشغيل البث في الصفحة."))

    def publish_stream(self):
        title = self.title_entry.get().strip()
        area = self.area_combo.get().strip()
        stream_type = self.type_combo.get()
        url = self.stream_url_entry.get().strip()

        if not title or not url:
            messagebox.showwarning(ar("نقص بيانات"), ar("يرجى ملء اسم الكاميرا ورابط البث على الأقل!"))
            return

        if stream_type == "youtube":
            if "youtube.com" in url or "youtu.be" in url:
                parsed = urlparse(url)
                vid_id = None
                if "youtu.be" in parsed.netloc:
                    vid_id = parsed.path.strip("/")
                elif "v=" in parsed.query:
                    vid_id = parse_qs(parsed.query).get("v", [None])[0]
                if vid_id:
                    url = f"https://www.youtube-nocookie.com/embed/{vid_id}"

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
                messagebox.showinfo(ar("مبروك يا أبو باسم! 🚀"), f"{ar('تم نشر الكاميرا بنجاح')}:\n'{title}'")
                self.title_entry.delete(0, tk.END)
                self.stream_url_entry.delete(0, tk.END)
                self.page_url_entry.delete(0, tk.END)
                self.update_title_preview()
            else:
                messagebox.showerror(ar("خطأ"), f"{ar('رفض السيرفر الحفظ')}: {res.text}")
        except Exception as e:
            messagebox.showerror(ar("خطأ اتصال"), f"{ar('فشل رفع الكاميرا')}:\n{e}")

if __name__ == "__main__":
    root = tk.Tk()
    app = AlbasemApp(root)
    root.mainloop()
