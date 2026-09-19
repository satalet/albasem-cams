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
        self.set_default_size(620, 780)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_border_width(15)

        self.id_token = None
        self.discovered_streams = []
        self.load_credentials()

        main_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self.add(main_vbox)

        # 1. الهيدر
        header_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        lbl_title = Gtk.Label()
        lbl_title.set_markup("<span size='x-large' weight='bold' foreground='#10b981'>📡 الباسم سات - نظام المراقبة الحي</span>")
        lbl_title.set_halign(Gtk.Align.END)
        header_box.pack_start(lbl_title, False, False, 0)

        lbl_sub = Gtk.Label(label="قنص روابط البث ونشر القنوات فردياً أو دفعة واحدة بنقرة زر")
        lbl_sub.set_halign(Gtk.Align.END)
        header_box.pack_start(lbl_sub, False, False, 0)
        main_vbox.pack_start(header_box, False, False, 0)

        # 2. إطار القنّاص
        sniff_frame = Gtk.Frame(label=" 🎯 1. قنّاص الروابط فائق السرعة ")
        sniff_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        sniff_vbox.set_border_width(8)
        sniff_frame.add(sniff_vbox)

        lbl_url = Gtk.Label(label="رابط صفحة البث بالموقع أو رابط قناة اليوتيوب:")
        lbl_url.set_halign(Gtk.Align.END)
        sniff_vbox.pack_start(lbl_url, False, False, 0)

        self.page_url_entry = Gtk.Entry()
        self.page_url_entry.set_placeholder_text("https://...")
        sniff_vbox.pack_start(self.page_url_entry, False, False, 0)

        self.sniff_btn = Gtk.Button(label="🚀 قنص وفحص جميع قنوات وسيرفرات الصفحة")
        self.sniff_btn.connect("clicked", self.on_sniff_clicked)
        sniff_vbox.pack_start(self.sniff_btn, False, False, 0)
        main_vbox.pack_start(sniff_frame, False, False, 0)

        # 3. إطار القنوات المكتشفة (جدول السيرفرات المتعددة)
        self.multi_frame = Gtk.Frame(label=" 📺 السيرفرات والقنوات المكتشفة بالصفحة ")
        multi_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        multi_vbox.set_border_width(8)
        self.multi_frame.add(multi_vbox)

        # قائمة العرض
        self.liststore = Gtk.ListStore(str, str, str)  # Title, URL, Type
        self.treeview = Gtk.TreeView(model=self.liststore)
        
        renderer_text = Gtk.CellRendererText()
        col_title = Gtk.TreeViewColumn("اسم القناة / السيرفر", renderer_text, text=0)
        col_title.set_expand(True)
        self.treeview.append_column(col_title)

        renderer_url = Gtk.CellRendererText()
        col_url = Gtk.TreeViewColumn("نوع البث", renderer_url, text=2)
        self.treeview.append_column(col_url)

        self.treeview.connect("cursor-changed", self.on_tree_selection_changed)

        scrolled = Gtk.ScrolledWindow()
        scrolled.set_min_content_height(130)
        scrolled.add(self.treeview)
        multi_vbox.pack_start(scrolled, True, True, 0)

        # أزرار النشر المتعدد
        batch_btns_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        
        self.publish_all_btn = Gtk.Button(label="⚡ نشر جميع القنوات المكتشفة دفعة واحدة")
        self.publish_all_btn.connect("clicked", self.on_publish_all_clicked)
        batch_btns_box.pack_start(self.publish_all_btn, True, True, 0)

        multi_vbox.pack_start(batch_btns_box, False, False, 0)
        main_vbox.pack_start(self.multi_frame, True, True, 0)

        # 4. إطار تفاصيل وتعديل الكاميرا المحددة
        cam_frame = Gtk.Frame(label=" 📝 2. تفاصيل النشر والمنطقة ")
        cam_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        cam_vbox.set_border_width(8)
        cam_frame.add(cam_vbox)

        lbl_t = Gtk.Label(label="اسم الكاميرا المحدد:")
        lbl_t.set_halign(Gtk.Align.END)
        cam_vbox.pack_start(lbl_t, False, False, 0)

        self.title_entry = Gtk.Entry()
        cam_vbox.pack_start(self.title_entry, False, False, 0)

        row_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        
        # نوع البث
        v_type = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
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
        v_area = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        lbl_area = Gtk.Label(label="المنطقة / التبويب:")
        lbl_area.set_halign(Gtk.Align.END)
        self.area_combo = Gtk.ComboBoxText.new_with_entry()
        for a in ["نابلس", "شباب اف ام نابلس", "قنوات أخبار", "القدس", "كفر عقب", "الرام", "رام الله", "طولكرم", "جنين", "عام"]:
            self.area_combo.append_text(a)
        self.area_combo.set_active(0)
        v_area.pack_start(lbl_area, False, False, 0)
        v_area.pack_start(self.area_combo, True, True, 0)
        row_box.pack_start(v_area, True, True, 0)

        cam_vbox.pack_start(row_box, False, False, 0)

        lbl_st = Gtk.Label(label="رابط البث:")
        lbl_st.set_halign(Gtk.Align.END)
        cam_vbox.pack_start(lbl_st, False, False, 0)

        self.stream_url_entry = Gtk.Entry()
        cam_vbox.pack_start(self.stream_url_entry, False, False, 0)

        self.publish_single_btn = Gtk.Button(label="✨ نشر القناة المحددة فقط")
        self.publish_single_btn.connect("clicked", self.on_publish_single_clicked)
        cam_vbox.pack_start(self.publish_single_btn, False, False, 0)

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
            self.show_dialog("تنبيه", "يرجى وضع رابط صفحة البث أولاً!", Gtk.MessageType.WARNING)
            return

        self.sniff_btn.set_sensitive(False)
        self.sniff_btn.set_label("⏳ جاري القنص فائق السرعة...")
        self.status_lbl.set_text("جاري صيد السيرفرات والقنوات المتاحة...")

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
                    r = requests.get(target_url, headers=headers, timeout=6)
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

        # 2. فحص فائق السرعة عبر تسريع Playwright وحظر الملفات الثقيلة
        found_streams = []
        seen_urls = set()
        extracted_title = ""

        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True, args=['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--disable-gpu'])
                context = browser.new_context(user_agent="Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36")
                page = context.new_page()

                # تسريع خيالي: منع تحميل الصور والفيديوهات والخطوط داخل المتصفح الخفي
                def block_heavy(route):
                    if route.request.resource_type in ["image", "media", "font"]:
                        route.abort()
                    else:
                        route.continue_()
                page.route("**/*", block_heavy)

                def handle_req(req):
                    u = req.url
                    if ".m3u8" in u and not any(x in u for x in ["chunk", "segment"]):
                        clean_u = u.split("?")[0] if ("index.m3u8" in u or "mono.m3u8" in u) else u
                        if clean_u not in seen_urls:
                            seen_urls.add(clean_u)
                            found_streams.append({"label": "البث المباشر (سيرفر رئيسي)", "url": clean_u, "type": "hls"})

                page.on("request", handle_req)

                try:
                    page.goto(target_url, wait_until="commit", timeout=8000)
                except Exception:
                    pass

                try:
                    extracted_title = page.title().split("-")[0].split("|")[0].strip()
                except Exception:
                    extracted_title = "بث مباشر"

                page.wait_for_timeout(1000)

                # استخراج أزرار السيرفرات والروابط برمشة عين
                js_extract = """
                () => {
                    const found = [];
                    const html = document.documentElement.innerHTML;
                    const matches = html.match(/https?:\\/\\/[^"'\\s<>]+\\.m3u8[^"'\\s<>]*/g) || [];
                    matches.forEach(m => found.push({label: 'رابط مباشر', url: m}));

                    document.querySelectorAll('button, a, .btn').forEach(el => {
                        const txt = (el.innerText || el.textContent || '').trim();
                        if (txt.includes('سيرفر') || txt.includes('القرآن') || txt.includes('قرآن')) {
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
                                lbl = "سيرفر مباشر"
                                if "1.m3u8" in clean_u: lbl = "إذاعة وتلفزيون القرآن الكريم"
                                elif "2.m3u8" in clean_u: lbl = "تلفزيون شباب FM (سيرفر 1)"
                                found_streams.append({"label": f"{extracted_title} - {lbl}", "url": clean_u, "type": "hls"})
                except Exception:
                    pass

                browser.close()
        except Exception as e:
            print("Sniff error:", e)

        # دعم سيرفرات شباب FM وقناة القرآن الكريم تلقائياً
        if "shababfm" in target_url:
            s_list = [
                ("تلفزيون شباب FM (سيرفر 1 - رئيسي)", "https://shabab.showtv.ps:443/shabab/fkJtYD2sJQ/2.m3u8"),
                ("إذاعة وتلفزيون القرآن الكريم (نابلس)", "https://shabab.showtv.ps:443/shabab/fkJtYD2sJQ/1.m3u8"),
                ("شباب FM - سيرفر احتياطي 2", "https://shabab.showtv.ps:443/shabab/fkJtYD2sJQ/index.m3u8"),
                ("شباب FM - سيرفر احتياطي 3", "https://shabab.showtv.ps:443/shabab/fkJtYD2sJQ/mono.m3u8"),
            ]
            for name, u in s_list:
                if u not in seen_urls:
                    seen_urls.add(u)
                    found_streams.append({"label": name, "url": u, "type": "hls", "area": "شباب اف ام نابلس"})

        GLib.idle_add(self.apply_multi_results, found_streams)

    def apply_multi_results(self, streams):
        self.sniff_btn.set_sensitive(True)
        self.sniff_btn.set_label("🚀 قنص وفحص جميع قنوات وسيرفرات الصفحة")
        self.discovered_streams = streams

        if not streams:
            self.status_lbl.set_text("[-] لم يتم العثور على سيرفرات m3u8.")
            self.show_dialog("تنبيه", "لم يتم التقاط سيرفرات بث مباشر في هذه الصفحة.", Gtk.MessageType.WARNING)
            return

        self.liststore.clear()
        for s in streams:
            self.liststore.append([s["label"], s["url"], s.get("type", "hls")])

        # تحديد أول عنصر تلقائياً وتعبئة الخانات
        if len(self.liststore) > 0:
            self.treeview.set_cursor(Gtk.TreePath(0), None, False)
            st = streams[0]
            self.title_entry.set_text(st["label"])
            self.stream_url_entry.set_text(st["url"])
            self.area_combo.get_child().set_text(st.get("area", "شباب اف ام نابلس"))

        self.status_lbl.set_text(f"✓ تم اكتشاف {len(streams)} قناة وسيرفر بنجاح!")
        self.show_dialog("صيد متكامل! 🎯", f"تم العثور على {len(streams)} قناة وسيرفر بنجاح!\n\nيمكنك الآن:\n1. الضغط على أي قناة ونشرها لحالها.\n2. أو الضغط على زر (نشر جميع القنوات دفعة واحدة) لتنزيلها كلها!", Gtk.MessageType.INFO)

    def on_tree_selection_changed(self, treeview):
        selection = treeview.get_selection()
        model, treeiter = selection.get_selected()
        if treeiter is not None:
            self.title_entry.set_text(model[treeiter][0])
            self.stream_url_entry.set_text(model[treeiter][1])
            b_type = model[treeiter][2]
            self.type_combo.set_active(1 if b_type == "youtube" else 0)

    def on_publish_single_clicked(self, widget):
        title = self.title_entry.get_text().strip()
        url = self.stream_url_entry.get_text().strip()
        stream_type = self.type_combo.get_active_text() or "hls"
        area = self.area_combo.get_child().get_text().strip() or "عام"

        if not title or not url:
            self.show_dialog("نقص بيانات", "يرجى كتابة الاسم والرابط!", Gtk.MessageType.WARNING)
            return

        if not self.id_token and not self.get_token():
            return

        self.push_to_firebase(title, url, stream_type, area)
        self.show_dialog("تم النشر! 🚀", f"تم نشر القناة بنجاح:\n'{title}'", Gtk.MessageType.INFO)

    def on_publish_all_clicked(self, widget):
        if not self.discovered_streams:
            self.show_dialog("تنبيه", "لا توجد قنوات مكتشفة لنشرها!", Gtk.MessageType.WARNING)
            return

        if not self.id_token and not self.get_token():
            return

        area = self.area_combo.get_child().get_text().strip() or "عام"
        count = 0

        self.status_lbl.set_text("جاري نشر جميع القنوات دفعة واحدة...")
        for s in self.discovered_streams:
            title = s["label"]
            url = s["url"]
            b_type = s.get("type", "hls")
            if self.push_to_firebase(title, url, b_type, area):
                count += 1

        self.status_lbl.set_text(f"✓ تم نشر {count} قناة دفعة واحدة بنجاح!")
        self.show_dialog("مبروك يا أبو باسم! 🚀⚡", f"تم نشر جميع الـ ({count}) قنوات وسيرفرات دفعة واحدة بنجاح في تبويب: '{area}'!", Gtk.MessageType.INFO)

    def push_to_firebase(self, title, url, stream_type, area):
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
            return res.status_code == 200
        except Exception:
            return False

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
