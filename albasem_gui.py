
def extract_smart_channel_title(url, fallback_title=""):
    import re
    from urllib.parse import urlparse

    t = (fallback_title or "").strip()
    if t and t not in ["بث مباشر", "بث حي", "قناة مباشرة"]:
        noise = [
            r"بث\s*مباشر", r"مشاهدة\s*قناة", r"مشاهدة", r"قناة", r"لايف",
            r"أون\s*لاين", r"اون\s*لاين", r"اونلاين", r"حصريا",
            r"جودة\s*عالية", r"بدون\s*تقطيع", r"سيرفر\s*\d+",
            r"live\s*stream", r"live", r"watch", r"online", r"hls", r"hd", r"fhd"
        ]
        for pat in noise:
            t = re.sub(pat, "", t, flags=re.IGNORECASE)
        t = re.sub(r"[\s\-_\|:\/]+", " ", t).strip()
        if len(t) >= 2:
            return t

    try:
        path = urlparse(url).path
        parts = [p for p in path.split("/") if p and not p.endswith((".m3u8", ".ts", ".mpd", ".mp4"))]
        tech = {"live", "hls", "stream", "chunk", "manifest", "video", "playlist", "master", "mono", "index", "bitmovin", "gcp", "edge", "edgenextcdn", "token", "channel", "user"}
        for seg in reversed(parts):
            if len(seg) >= 8 and all(c in "0123456789abcdefABCDEF" for c in seg):
                continue
            words = [w for w in re.split(r"[-_.]", seg) if w.lower() not in tech and not w.isdigit() and len(w) > 1]
            if words:
                res = " ".join(words)
                res = re.sub(r"\bmbc\b", "MBC", res, flags=re.IGNORECASE)
                res = re.sub(r"\bbein\b", "beIN", res, flags=re.IGNORECASE)
                return res.title()
    except Exception:
        pass

    return "قناة مباشرة"

def verify_live_stream(url, referer=""):
    """فحص فوري للرابط والتأكد أنه بث حي حقيقي وشغال في المتصفح"""
    urls_to_try = []
    if url.startswith("http://"):
        urls_to_try.append(url.replace("http://", "https://", 1))
    urls_to_try.append(url)

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    for u in urls_to_try:
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                "Accept": "*/*"
            }
            if referer:
                headers["Referer"] = referer
            
            req = urllib.request.Request(u, headers=headers)
            with urllib.request.urlopen(req, timeout=3.5, context=ctx) as resp:
                if resp.status in [200, 206]:
                    content_start = resp.read(150).decode('utf-8', errors='ignore')
                    if "#EXTM3U" in content_start or "#EXT-X" in content_start:
                        return True, u
        except Exception:
            continue
    return False, url


def detect_area_smart(url, text):
    combined = (url + " " + text).lower()
    if any(k in combined for k in ["ramallah", "رام الله", "المنارة", "بلدية رام الله"]):
        return "رام الله"
    elif any(k in combined for k in ["nablus", "نابلس", "رفيديا", "الفاطمية", "الدوار"]):
        return "نابلس"
    elif any(k in combined for k in ["quds", "jerusalem", "القدس", "الأقصى"]):
        return "القدس"
    elif any(k in combined for k in ['عام', 'قنوات عربيه', 'رام الله', 'نابلس', 'شباب اف ام نابلس', 'قنوات أخبار']):
        return "كفر عقب"
    elif any(k in combined for k in ["alram", "الرام"]):
        return "الرام"
    elif any(k in combined for k in ["jenin", "جنين"]):
        return "جنين"
    elif any(k in combined for k in ["tulkarm", "طولكرم"]):
        return "طولكرم"
    elif any(k in combined for k in ["hebron", "الخليل"]):
        return "الخليل"
    elif any(k in combined for k in ["news", "أخبار", "جزيرة", "حدث"]):
        return "قنوات أخبار"
    return "عام"

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

def get_firebase_url():
    import os, json
    try:
        cfg = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
        if os.path.exists(cfg):
            with open(cfg, "r", encoding="utf-8") as f:
                d = json.load(f)
                u = d.get("firebase_url") or d.get("databaseURL")
                if u: return u.rstrip("/")
    except Exception:
        pass
    return "https://albasem-cams-default-rtdb.firebaseio.com"

class AlbasemWindow(Gtk.Window):

    def sync_live_categories_from_firebase(self):
        import tkinter as tk
        from tkinter import ttk
        import threading, json, urllib.request

        def _fetch():
            try:
                db_url = get_firebase_url()
                all_cats = ["عام"]
                try:
                    r1 = urllib.request.urlopen(f"{db_url}/categories.json", timeout=4)
                    d1 = json.loads(r1.read().decode("utf-8"))
                    if isinstance(d1, list): all_cats.extend([x for x in d1 if x])
                    elif isinstance(d1, dict): all_cats.extend([x for x in d1.values() if x])
                except Exception: pass

                try:
                    r2 = urllib.request.urlopen(f"{db_url}/streams.json?shallow=false", timeout=4)
                    d2 = json.loads(r2.read().decode("utf-8"))
                    if isinstance(d2, dict):
                        for item in d2.values():
                            if isinstance(item, dict) and item.get("area"):
                                a = item.get("area").strip()
                                if a and a not in all_cats: all_cats.append(a)
                except Exception: pass

                clean = []
                for c in all_cats:
                    if c and c not in clean and c != "جميع الكاميرات": clean.append(c)

                def _apply():
                    root_w = getattr(self, "root", None) or getattr(self, "master", None) or tk._default_root
                    combos = []
                    def _scan(w):
                        try:
                            for ch in w.winfo_children():
                                if ch.winfo_class() in ("TCombobox", "Combobox"):
                                    combos.append(ch)
                                _scan(ch)
                        except Exception: pass
                    if root_w: _scan(root_w)

                    for cb in combos:
                        cb["values"] = clean
                        if "عام" in clean:
                            cb.set("عام")
                        elif clean:
                            cb.set(clean[0])
                    print("✅ [فايربيس] تم تحديث القائمة المنسدلة بنجاح للأقسام الحقيقية:", clean)

                root_w = getattr(self, "root", None) or getattr(self, "master", None) or tk._default_root
                if root_w and hasattr(root_w, "after"):
                    root_w.after(0, _apply)
                else:
                    _apply()
            except Exception as e:
                print("❌ خطأ المزامنة:", e)
        threading.Thread(target=_fetch, daemon=True).start()


    def __init__(self):
        self.stop_sniff_flag = False
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
        self.finish_btn = Gtk.Button(label="🎯 إنهاء الصيد واعتماد الروابط")
        self.finish_btn.set_sensitive(False)
        self.finish_btn.connect("clicked", self.on_force_finish_sniff)
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
        for a in ['عام', 'قنوات عربيه', 'رام الله', 'نابلس', 'شباب اف ام نابلس', 'قنوات أخبار']:
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

        self.sync_live_categories_from_firebase()
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
                browser = p.chromium.launch(headless=False, args=['--autoplay-policy=no-user-gesture-required', '--no-sandbox'])
                context = browser.new_context(
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                    viewport={'width': 1280, 'height': 720}
                )
                page = context.new_page()

                def handle_response(response):
                    try:
                        u = response.url
                        # حصر الصيد بروابط HLS المفتوحة فقط واستبعاد المقاطع الصغيرة
                        # فلتر ذكي: استبعاد مسارات الصوت والصورة المجزأة وحصر الصيد بالرابط الأب الكامل
                        sub_tracks = ['.ts', '.m4s', 'segment', 'chunk', '/video/', '/audio/', 'video.m3u8', 'audio.m3u8', 'manifest/video', 'manifest/audio', 'tracks-v', 'rendition']
                        if '.m3u8' in u.lower() and not any(x in u.lower() for x in sub_tracks):
                            clean_u = u.split('?')[0] if ('index.m3u8' in u or 'mono.m3u8' in u or 'playlist.m3u8' in u) else u
                            base_stream_path = clean_u.rsplit('/', 1)[0]
                            # منع تسجيل أكثر من تراك لنفس مسار القناة
                            if clean_u not in seen_urls and not any(base_stream_path in s['url'] for s in found_streams) and response.status in [200, 206]:
                                seen_urls.add(clean_u)
                                server_num = len(found_streams) + 1
                                ch_base_name = extract_smart_channel_title(u, extracted_title)
                                same_ch_count = sum(1 for s in found_streams if ch_base_name in s['label'])
                                lbl = f"{ch_base_name}" if same_ch_count == 0 else f"{ch_base_name} (سيرفر {same_ch_count + 1})"
                                print(f'\033[92m[✓] تم صيد رابط HLS شغال: {clean_u}\033[0m')
                                found_streams.append({'label': lbl, 'url': u, 'type': 'hls', 'area': detected_area})
                    except Exception:
                        pass

                page.on('response', handle_response)
                extracted_title = 'بث مباشر'
                detected_area = detect_area_smart(target_url, '')

                print('\n\033[96m🎮 المتصفح مفتوح قدامك يا أبو باسم...\033[0m')
                print('\033[93m👉 شغل الفيديو وسكر أي إعلانات.. لما تخلص بس اضغط [Enter] بالترمينال هون أو سكر نافذة المتصفح!\033[0m\n')

                try:
                    page.goto(target_url, wait_until='commit', timeout=20000)
                except Exception:
                    pass
                self.stop_sniff_flag = False
                GLib.idle_add(self.finish_btn.set_sensitive, True)

                def update_counter():
                    self.status_lbl.set_text(f"🟢 تم صيد {len(found_streams)} سيرفر HLS شغال حتى الآن...")
                    return False

                import select, sys, time
                start_t = time.time()
                while time.time() - start_t < 1200:
                    if page.is_closed() or self.stop_sniff_flag:
                        print("[-] تم طلب الإنهاء والاعتماد.")
                        break
                    if sys.stdin in select.select([sys.stdin], [], [], 0)[0]:
                        sys.stdin.readline()
                        print("[✓] تم تأكيد الانتهاء بضغط Enter من الترمينال.")
                        break
                    if len(found_streams) > 0:
                        GLib.idle_add(update_counter)
                    try:
                        page.wait_for_timeout(300)
                    except Exception:
                        break

                GLib.idle_add(self.finish_btn.set_sensitive, False)
                try:
                    browser.close()
                except Exception:
                    pass
        except Exception as e:
            print('Sniff error:', e)

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


    def on_force_finish_sniff(self, widget=None):
        self.stop_sniff_flag = True
        self.status_lbl.set_text("⏳ جاري إنهاء الصيد وجلب الروابط...")
        if hasattr(self, 'finish_btn'):
            self.finish_btn.set_sensitive(False)

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
            self.area_combo.get_child().set_text(st.get("area", detect_area_smart(st.get("url", ""), st.get("label", ""))))

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
