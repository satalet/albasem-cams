#!/usr/bin/env python3
import os
import sys
import json
import threading
import requests
import re
from urllib.parse import urlparse, parse_qs

# استدعاء مكتبة لينكس الرسومية الأصلية (دعم أصلي 100% للغة العربية)
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib

FIREBASE_API_KEY = "AIzaSyD4U4DFTtO8zuqIlrJp19ji1ESptfuVr9E"
DB_URL = "https://albasem-cams-default-rtdb.firebaseio.com/streams.json"
CONFIG_FILE = os.path.expanduser("~/albasem-cams/config.json")

class AlbasemWindow(Gtk.Window):
    def __init__(self):
        super().__init__(title="الباسم سات | أداة إدارة وقنص الكاميرات الحية")
        self.set_default_size(580, 680)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_border_width(15)

        self.id_token = None
        self.load_credentials()

        # التخطيط العام
        main_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        self.add(main_vbox)

        # 1. الهيدر
        header_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
        lbl_title = Gtk.Label()
        lbl_title.set_markup("<span size='x-large' weight='bold' foreground='#10b981'>📡 الباسم سات - نظام المراقبة الحي</span>")
        lbl_title.set_halign(Gtk.Align.END)
        header_box.pack_start(lbl_title, False, False, 0)

        lbl_sub = Gtk.Label(label="قنص روابط البث المباشر (HLS / YouTube) والنشر الفوري في الموقع")
        lbl_sub.set_halign(Gtk.Align.END)
        header_box.pack_start(lbl_sub, False, False, 0)
        main_vbox.pack_start(header_box, False, False, 0)

        # 2. إطار القنّاص
        sniff_frame = Gtk.Frame(label=" 🎯 1. قنّاص الروابط الذكي ")
        sniff_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        sniff_vbox.set_border_width(10)
        sniff_frame.add(sniff_vbox)

        lbl_url = Gtk.Label(label="رابط صفحة البث بالموقع أو رابط قناة اليوتيوب:")
        lbl_url.set_halign(Gtk.Align.END)
        sniff_vbox.pack_start(lbl_url, False, False, 0)

        self.page_url_entry = Gtk.Entry()
        self.page_url_entry.set_placeholder_text("https://... أو https://www.youtube.com/.../live")
        sniff_vbox.pack_start(self.page_url_entry, False, False, 0)

        self.sniff_btn = Gtk.Button(label="🚀 قنص الرابط والاسم والنوع تلقائياً")
        self.sniff_btn.connect("clicked", self.on_sniff_clicked)
        sniff_vbox.pack_start(self.sniff_btn, False, False, 0)
        main_vbox.pack_start(sniff_frame, False, False, 0)

        # 3. إطار تفاصيل الكاميرا
        cam_frame = Gtk.Frame(label=" 📝 2. تفاصيل ونشر الكاميرا ")
        cam_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        cam_vbox.set_border_width(10)
        cam_frame.add(cam_vbox)

        # اسم الكاميرا
        lbl_t = Gtk.Label(label="اسم / عنوان الكاميرا:")
        lbl_t.set_halign(Gtk.Align.END)
        cam_vbox.pack_start(lbl_t, False, False, 0)

        self.title_entry = Gtk.Entry()
        cam_vbox.pack_start(self.title_entry, False, False, 0)

        # المنطقة والنوع
        row_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        
        # نوع البث
        v_type = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        lbl_type = Gtk.Label(label="نوع البث:")
        lbl_type.set_halign(Gtk.Align.END)
        self.type_combo = Gtk.ComboBoxText()
        for t in ["hls", "youtube", "image"]:
            self.type_combo.append_text(t)
        self.type_combo.set_active(0)
        v_type.pack_start(lbl_type, False, False, 0)
        v_type.pack_start(self.type_combo, True, True, 0)
        row_box.pack_start(v_type, True, True, 0)

        # المنطقة
        v_area = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        lbl_area = Gtk.Label(label="المنطقة:")
        lbl_area.set_halign(Gtk.Align.END)
        self.area_combo = Gtk.ComboBoxText.new_with_entry()
        for a in ["نابلس", "قنوات أخبار", "القدس", "كفر عقب", "الرام", "رام الله", "طولكرم", "جنين", "عام"]:
            self.area_combo.append_text(a)
        self.area_combo.set_active(0)
        v_area.pack_start(lbl_area, False, False, 0)
        v_area.pack_start(self.area_combo, True, True, 0)
        row_box.pack_start(v_area, True, True, 0)

        cam_vbox.pack_start(row_box, False, False, 0)

        # رابط البث المباشر
        lbl_st = Gtk.Label(label="رابط البث الصافي (Direct Stream URL):")
        lbl_st.set_halign(Gtk.Align.END)
        cam_vbox.pack_start(lbl_st, False, False, 0)

        self.stream_url_entry = Gtk.Entry()
        cam_vbox.pack_start(self.stream_url_entry, False, False, 0)

        # زر النشر
        self.publish_btn = Gtk.Button(label="✨ نشر الكاميرا فوراً على موقع وتطبيق الباسم سات")
        self.publish_btn.connect("clicked", self.on_publish_clicked)
        cam_vbox.pack_start(self.publish_btn, False, False, 0)

        main_vbox.pack_start(cam_frame, False, False, 0)

        # شريط الحالة
        self.status_lbl = Gtk.Label(label="جاهز للعمل...")
        self.status_lbl.set_halign(Gtk.Align.START)
        main_vbox.pack_end(self.status_lbl, False, False, 0)

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
                print("Error loading config:", e)

    def get_token(self):
        if not self.password or self.password == "ضع_كلمة_المرور_هنا":
            self.show_dialog("تنبيه", "يرجى وضع كلمة المرور بملف config.json أولاً!", Gtk.MessageType.WARNING)
            return False
        
        auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        payload = {"email": self.email, "password": self.password, "returnSecureToken": True}
        try:
            res = requests.post(auth_url, json=payload, timeout=8)
            data = res.json()
            if "idToken" in data:
                self.id_token = data["idToken"]
                return True
            else:
                self.show_dialog("خطأ", f"فشل الدخول للسيرفر: {data.get('error',{}).get('message','')}", Gtk.MessageType.ERROR)
                return False
        except Exception as e:
            self.show_dialog("خطأ اتصال", str(e), Gtk.MessageType.ERROR)
            return False

    def on_sniff_clicked(self, widget):
        target_url = self.page_url_entry.get_text().strip()
        if not target_url:
            self.show_dialog("تنبيه", "يرجى وضع رابط البث أو القناة أولاً!", Gtk.MessageType.WARNING)
            return

        self.sniff_btn.set_sensitive(False)
        self.sniff_btn.set_label("⏳ جاري القنص والاستخراج الصامت...")
        self.status_lbl.set_text("جاري الفحص واستخراج البث المباشر...")

        thread = threading.Thread(target=self.run_sniff, args=(target_url,), daemon=True)
        thread.start()

    def run_sniff(self, target_url):
        # 1. حل جذري لقنص اليوتيوب (استخراج VideoId حتى من روابط /live والقنوات)
        if "youtube.com" in target_url or "youtu.be" in target_url:
            vid_id = None
            title = "بث مباشر يوتيوب"

            # محاولة الاستخراج السريع من الرابط
            if "youtu.be/" in target_url:
                vid_id = target_url.split("youtu.be/")[1].split("?")[0].split("/")[0]
            elif "watch?v=" in target_url:
                vid_id = parse_qs(urlparse(target_url).query).get("v", [None])[0]

            # إذا كان الرابط /live أو قناة، نسحب الصفحة فوراً ونسحب الـ VideoId المخفي من الـ HTML
            if not vid_id or "/live" in target_url:
                try:
                    headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
                    r = requests.get(target_url, headers=headers, timeout=10)
                    html = r.text
                    
                    # قنص الـ videoId من كود الصفحة الداخلي
                    m_id = re.search(r'["\']videoId["\']\s*:\s*["\']([a-zA-Z0-9_-]{11})["\']', html)
                    if m_id:
                        vid_id = m_id.group(1)
                    
                    # قنص عنوان البث
                    m_t = re.search(r'<title>(.*?)</title>', html)
                    if m_t:
                        title = m_t.group(1).replace("- YouTube", "").strip()
                except Exception as e:
                    print("YouTube fetch error:", e)

            embed_url = f"https://www.youtube-nocookie.com/embed/{vid_id}" if vid_id else target_url
            GLib.idle_add(self.apply_result, embed_url, title, "youtube", "قنوات أخبار")
            return

        # 2. قنص صفحات HLS (.m3u8) عبر المتصفح الخفي
        found_url = None
        extracted_title = ""
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                def handle_req(req):
                    nonlocal found_url
                    if ".m3u8" in req.url and not found_url:
                        found_url = req.url
                page.on("request", handle_req)
                page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
                page.wait_for_timeout(3500)
                raw_title = page.title()
                extracted_title = raw_title.split("-")[0].split("|")[0].strip()
                browser.close()
        except Exception as e:
            print("Sniff error:", e)

        clean_url = found_url.split("?")[0] if (found_url and ("index.m3u8" in found_url or "mono.m3u8" in found_url)) else (found_url or target_url)
        GLib.idle_add(self.apply_result, clean_url, extracted_title or "بث مباشر", "hls", "نابلس")

    def apply_result(self, url, title, b_type, area):
        self.sniff_btn.set_sensitive(True)
        self.sniff_btn.set_label("🚀 قنص الرابط والاسم والنوع تلقائياً")
        self.title_entry.set_text(title)
        self.stream_url_entry.set_text(url)
        
        # ضبط النوع
        idx = 1 if b_type == "youtube" else 0
        self.type_combo.set_active(idx)
        
        # ضبط المنطقة
        self.area_combo.get_child().set_text(area)

        self.status_lbl.set_text(f"✓ تم التقاط البث بنجاح: {title}")
        self.show_dialog("تم القنص بنجاح! 🎯", f"تم العثور على البث وتحويله تلقائياً:\n\nالعنوان: {title}\nالرابط: {url}", Gtk.MessageType.INFO)

    def on_publish_clicked(self, widget):
        title = self.title_entry.get_text().strip()
        url = self.stream_url_entry.get_text().strip()
        stream_type = self.type_combo.get_active_text() or "hls"
        area = self.area_combo.get_child().get_text().strip() or "عام"

        if not title or not url:
            self.show_dialog("نقص بيانات", "يرجى كتابة الاسم والرابط!", Gtk.MessageType.WARNING)
            return

        if not self.id_token:
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
                self.show_dialog("مبروك يا أبو باسم! 🚀", f"تم نشر البث فوراً على الموقع:\n'{title}'", Gtk.MessageType.INFO)
                self.title_entry.set_text("")
                self.stream_url_entry.set_text("")
                self.page_url_entry.set_text("")
                self.status_lbl.set_text("جاهز للعمل...")
            else:
                self.show_dialog("خطأ", f"رفض السيرفر الحفظ: {res.text}", Gtk.MessageType.ERROR)
        except Exception as e:
            self.show_dialog("خطأ", str(e), Gtk.MessageType.ERROR)

    def show_dialog(self, title, msg, msg_type):
        dialog = Gtk.MessageDialog(transient_for=self, flags=0, message_type=msg_type,
                                  buttons=Gtk.ButtonsType.OK, text=title)
        dialog.format_secondary_text(msg)
        dialog.run()
        dialog.destroy()

if __name__ == "__main__":
    win = AlbasemWindow()
    win.connect("destroy", Gtk.main_quit)
    win.show_all()
    Gtk.main()
