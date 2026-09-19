#!/usr/bin/env python3
import os
import sys
import json
import threading
import requests
import re
from urllib.parse import urlparse, parse_qs

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib

FIREBASE_API_KEY = "AIzaSyD4U4DFTtO8zuqIlrJp19ji1ESptfuVr9E"
DB_URL = "https://albasem-cams-default-rtdb.firebaseio.com/streams.json"
CONFIG_FILE = os.path.expanduser("~/albasem-cams/config.json")

class AlbasemWindow(Gtk.Window):
    def __init__(self):
        super().__init__(title="الباسم سات | أداة إدارة وقنص الكاميرات الحية")
        self.set_default_size(580, 720)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_border_width(15)

        self.id_token = None
        self.discovered_streams = []
        self.load_credentials()

        main_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        self.add(main_vbox)

        # 1. الهيدر
        header_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
        lbl_title = Gtk.Label()
        lbl_title.set_markup("<span size='x-large' weight='bold' foreground='#10b981'>📡 الباسم سات - نظام المراقبة الحي</span>")
        lbl_title.set_halign(Gtk.Align.END)
        header_box.pack_start(lbl_title, False, False, 0)

        lbl_sub = Gtk.Label(label="قنص روابط البث المباشر وكل السيرفرات المتاحة والنشر الفوري في الموقع")
        lbl_sub.set_halign(Gtk.Align.END)
        header_box.pack_start(lbl_sub, False, False, 0)
        main_vbox.pack_start(header_box, False, False, 0)

        # 2. إطار القنّاص
        sniff_frame = Gtk.Frame(label=" 🎯 1. قنّاص الروابط والسيرفرات المتعددة ")
        sniff_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        sniff_vbox.set_border_width(10)
        sniff_frame.add(sniff_vbox)

        lbl_url = Gtk.Label(label="رابط صفحة البث بالموقع أو رابط قناة اليوتيوب:")
        lbl_url.set_halign(Gtk.Align.END)
        sniff_vbox.pack_start(lbl_url, False, False, 0)

        self.page_url_entry = Gtk.Entry()
        self.page_url_entry.set_placeholder_text("https://...")
        sniff_vbox.pack_start(self.page_url_entry, False, False, 0)

        self.sniff_btn = Gtk.Button(label="🚀 قنص وفحص جميع سيرفرات وقنوات الصفحة")
        self.sniff_btn.connect("clicked", self.on_sniff_clicked)
        sniff_vbox.pack_start(self.sniff_btn, False, False, 0)

        # قائمة السيرفرات المكتشفة
        self.server_choice_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        lbl_srv = Gtk.Label(label="السيرفرات والقنوات المكتشفة بالصفحة (اختر منها):")
        lbl_srv.set_halign(Gtk.Align.END)
        self.server_choice_box.pack_start(lbl_srv, False, False, 0)
        
        self.server_combo = Gtk.ComboBoxText()
        self.server_combo.connect("changed", self.on_server_selected)
        self.server_choice_box.pack_start(self.server_combo, False, False, 0)
        self.server_choice_box.set_no_show_all(True)
        sniff_vbox.pack_start(self.server_choice_box, False, False, 0)

        main_vbox.pack_start(sniff_frame, False, False, 0)

        # 3. إطار تفاصيل الكاميرا
        cam_frame = Gtk.Frame(label=" 📝 2. تفاصيل ونشر الكاميرا ")
        cam_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        cam_vbox.set_border_width(10)
        cam_frame.add(cam_vbox)

        lbl_t = Gtk.Label(label="اسم / عنوان الكاميرا:")
        lbl_t.set_halign(Gtk.Align.END)
        cam_vbox.pack_start(lbl_t, False, False, 0)

        self.title_entry = Gtk.Entry()
        cam_vbox.pack_start(self.title_entry, False, False, 0)

        row_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        
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

        lbl_st = Gtk.Label(label="رابط البث الصافي (Direct Stream URL):")
        lbl_st.set_halign(Gtk.Align.END)
        cam_vbox.pack_start(lbl_st, False, False, 0)

        self.stream_url_entry = Gtk.Entry()
        cam_vbox.pack_start(self.stream_url_entry, False, False, 0)

        self.publish_btn = Gtk.Button(label="✨ نشر الكاميرا فوراً على موقع وتطبيق الباسم سات")
        self.publish_btn.connect("clicked", self.on_publish_clicked)
        cam_vbox.pack_start(self.publish_btn, False, False, 0)

        main_vbox.pack_start(cam_frame, False, False, 0)

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
        self.sniff_btn.set_label("⏳ جاري الفحص السريع واستخراج كل القنوات...")
        self.status_lbl.set_text("جاري استخراج السيرفرات عبر المحرك فائق السرعة...")

        thread = threading.Thread(target=self.run_sniff, args=(target_url,), daemon=True)
        thread.start()

    def run_sniff(self, target_url):
        # 1. يوتيوب
        if "youtube.com" in target_url or "youtu.be" in target_url:
            vid_id = None
            title = "بث مباشر يوتيوب"
            if "youtu.be/" in target_url:
                vid_id = target_url.split("youtu.be/")[1].split("?")[0].split("/")[0]
            elif "watch?v=" in target_url:
                vid_id = parse_qs(urlparse(target_url).query).get("v", [None])[0]

            if not vid_id or "/live" in target_url:
                try:
                    headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36"}
                    r = requests.get(target_url, headers=headers, timeout=8)
                    html = r.text
                    m_id = re.search(r'["\']videoId["\']\s*:\s*["\']([a-zA-Z0-9_-]{11})["\']', html)
                    if m_id: vid_id = m_id.group(1)
                    m_t = re.search(r'<title>(.*?)</title>', html)
                    if m_t: title = m_t.group(1).replace("- YouTube", "").strip()
                except Exception as e:
                    print("YouTube fetch error:", e)

            embed_url = f"https://www.youtube-nocookie.com/embed/{vid_id}" if vid_id else target_url
            streams = [{"label": title, "url": embed_url, "type": "youtube", "area": "قنوات أخبار"}]
            GLib.idle_add(self.apply_multi_results, streams)
            return

        # 2. قنص صفحات البث (فائق السرعة - ثانيتين فقط)
        found_streams = []
        seen_urls = set()
        extracted_title = ""

        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True, args=['--autoplay-policy=no-user-gesture-required', '--no-sandbox'])
                context = browser.new_context(user_agent="Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36")
                page = context.new_page()

                def handle_req(req):
                    u = req.url
                    if ".m3u8" in u and not any(x in u for x in ["chunk", "segment"]):
                        clean_u = u.split("?")[0] if ("index.m3u8" in u or "mono.m3u8" in u) else u
                        if clean_u not in seen_urls:
                            seen_urls.add(clean_u)
                            found_streams.append({"label": "البث المباشر التلقائي", "url": clean_u})

                page.on("request", handle_req)

                try:
                    page.goto(target_url, wait_until="domcontentloaded", timeout=10000)
                except Exception:
                    pass

                try:
                    extracted_title = page.title().split("-")[0].split("|")[0].strip()
                except Exception:
                    extracted_title = "بث مباشر"

                # فحص فوري داخل المتصفح لسحب روابط M3U8 والأزرار في نصف ثانية
                js_extract = """
                () => {
                    const found = [];
                    const html = document.documentElement.innerHTML;
                    const matches = html.match(/https?:\\/\\/[^"'\\s<>]+\\.m3u8[^"'\\s<>]*/g) || [];
                    matches.forEach(m => found.push({label: 'رابط مباشر', url: m}));

                    // فحص أزرار المشغل المباشرة الخاصة بالسيرفرات فقط
                    document.querySelectorAll('button, a, .btn, span').forEach(el => {
                        const txt = (el.innerText || el.textContent || '').trim();
                        if ((txt.includes('سيرفر') || txt.includes('القرآن') || txt.includes('قرآن')) && txt.length < 30) {
                            try { el.click(); } catch(e){}
                        }
                    });
                    return found;
                }
                """
                try:
                    js_links = page.evaluate(js_extract)
                    for item in js_links:
                        u = item['url']
                        if ".m3u8" in u and not any(x in u for x in ["chunk", "segment"]):
                            clean_u = u.split("?")[0] if ("index.m3u8" in u or "mono.m3u8" in u) else u
                            if clean_u not in seen_urls:
                                seen_urls.add(clean_u)
                                # تسمية ذكية حسب الرابط
                                lbl = "سيرفر مباشر"
                                if "1.m3u8" in clean_u or "quran" in clean_u.lower():
                                    lbl = "إذاعة القرآن الكريم (سيرفر القرآن)"
                                elif "2.m3u8" in clean_u:
                                    lbl = "تلفزيون شباب FM (البث الرئيسي)"
                                found_streams.append({"label": f"{extracted_title} - {lbl}", "url": clean_u})
                except Exception as e:
                    print("JS Eval error:", e)

                page.wait_for_timeout(1500)
                browser.close()
        except Exception as e:
            print("Sniff error:", e)

        # إذا كانت الصفحة شباب FM بالتحديد، التأكد من وجود سيرفرين القرآن وشباب TV
        if "shababfm" in target_url:
            quran_url = "https://shabab.showtv.ps:443/shabab/fkJtYD2sJQ/1.m3u8"
            shabab_url = "https://shabab.showtv.ps:443/shabab/fkJtYD2sJQ/2.m3u8"
            if quran_url not in seen_urls:
                found_streams.append({"label": "إذاعة القرآن الكريم - نابلس (سيرفر القرآن)", "url": quran_url})
            if shabab_url not in seen_urls:
                found_streams.append({"label": "تلفزيون شباب FM - نابلس (سيرفر 1 الرئيسي)", "url": shabab_url})

        formatted = []
        for s in found_streams:
            lbl = s["label"]
            # تسمية ذكية لو مش متسمية
            if "1.m3u8" in s["url"]:
                lbl = "إذاعة وتلفزيون القرآن الكريم"
            elif "2.m3u8" in s["url"]:
                lbl = "تلفزيون شباب FM (البث العام)"

            formatted.append({
                "label": lbl,
                "url": s["url"],
                "type": "hls",
                "area": "نابلس"
            })

        GLib.idle_add(self.apply_multi_results, formatted)

    def apply_multi_results(self, streams):
        self.sniff_btn.set_sensitive(True)
        self.sniff_btn.set_label("🚀 قنص وفحص جميع سيرفرات وقنوات الصفحة")
        self.discovered_streams = streams

        if not streams:
            self.status_lbl.set_text("[-] لم يتم العثور على سيرفرات m3u8.")
            self.show_dialog("تنبيه", "لم يتم التقاط سيرفرات بث مباشر في هذه الصفحة.", Gtk.MessageType.WARNING)
            return

        self.server_combo.remove_all()
        for s in streams:
            self.server_combo.append_text(f"{s['label']}")
        
        self.server_choice_box.show_all()
        self.server_combo.set_active(0)
        self.status_lbl.set_text(f"✓ تم التقاط {len(streams)} سيرفر بث بنجاح!")
        self.show_dialog("صيد متكامل! 🎯", f"تم العثور على {len(streams)} قناة وسيرفر!\nاختر القناة من القائمة المنسدلة الجديدة بالأسفل.", Gtk.MessageType.INFO)

    def on_server_selected(self, combo):
        idx = combo.get_active()
        if idx >= 0 and idx < len(self.discovered_streams):
            st = self.discovered_streams[idx]
            self.title_entry.set_text(st["label"])
            self.stream_url_entry.set_text(st["url"])
            type_idx = 1 if st.get("type") == "youtube" else 0
            self.type_combo.set_active(type_idx)
            self.area_combo.get_child().set_text(st.get("area", "نابلس"))

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
                self.server_choice_box.hide()
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
