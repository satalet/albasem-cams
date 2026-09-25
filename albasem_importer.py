#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
منظومة الباسم سات - أداة الاستيراد والفرز الاحترافية (M3U Importer Pro - GTK3)
واجهة GTK3 متطورة ومطابقة بالكامل لمنظومة الباسم سات، دعم العربية الأصلي، مستعرض ملفات كالي الرسمي،
وتحكم مطلق بوجهة وتفريعات القنوات قبل نشرها للفايربيس.
"""

import os
import re
import json
import threading
from concurrent.futures import ThreadPoolExecutor
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('Gdk', '3.0')
from gi.repository import Gtk, GLib, Gdk, Pango

# ضبط اتجاه الواجهة من اليمين لليسار للغة العربية السليمة
Gtk.Widget.set_default_direction(Gtk.TextDirection.RTL)

session = requests.Session()
retries = Retry(total=3, backoff_factor=0.5, status_forcelist=[500, 502, 503, 504])
session.mount('https://', HTTPAdapter(max_retries=retries))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# قراءة مفتاح الـ API تلقائياً
FIREBASE_API_KEY = ""
gui_path = os.path.join(BASE_DIR, "albasem_gui.py")
if os.path.exists(gui_path):
    with open(gui_path, "r", encoding="utf-8") as f:
        m = re.search(r'FIREBASE_API_KEY\s*=\s*["\']([^"\']+)["\']', f.read())
        if m:
            FIREBASE_API_KEY = m.group(1)

# قراءة حساب الدخول من config.json
CONFIG_EMAIL = ""
CONFIG_PASSWORD = ""
config_path = os.path.join(BASE_DIR, "config.json")
if os.path.exists(config_path):
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            CONFIG_EMAIL = cfg.get("email", "")
            CONFIG_PASSWORD = cfg.get("password", "")
    except Exception:
        pass

DB_BASE = "https://albasem-cams-default-rtdb.firebaseio.com"

PRESET_SOURCES = {
    "قنوات العالم العربي المفتوحة (IPTV-org)": "https://iptv-org.github.io/iptv/languages/ara.m3u",
    "قنوات إخبارية عربية وعالمية": "https://iptv-org.github.io/iptv/categories/news.m3u",
    "قنوات وثائقية مفتوحة": "https://iptv-org.github.io/iptv/categories/documentary.m3u",
    "قنوات أطفال مفتوحة": "https://iptv-org.github.io/iptv/categories/kids.m3u"
}

def smart_subcat(raw_group):
    g = str(raw_group).lower()
    if any(k in g for k in ["kid", "child", "cartoon", "animation", "أطفال"]):
        return "أطفال"
    elif any(k in g for k in ["news", "خبر", "أخبار"]):
        return "إخبارية"
    elif any(k in g for k in ["relig", "islam", "quran", "دين", "قرآن", "إسلام"]):
        return "إسلاميات"
    elif any(k in g for k in ["movie", "cinema", "series", "فلم", "مسلسل", "افلام"]):
        return "أفلام ومسلسلات"
    elif any(k in g for k in ["sport", "رياض"]):
        return "رياضة"
    elif any(k in g for k in ["doc", "وثائق"]):
        return "وثائقي"
    elif any(k in g for k in ["music", "موسيق", "أغان"]):
        return "موسيقى"
    else:
        return "مشكّل ومنوعات"

class AlbasemImporterGtk(Gtk.Window):
    def __init__(self):
        super().__init__(title="الباسم سات | أداة استيراد وفرز قنوات البث المباشر و IPTV")
        self.set_default_size(1120, 800)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_border_width(12)

        self.channels_data = []
        self.firebase_categories = ["IPTV", "نابلس", "رام الله", "شباب اف ام نابلس", "قنوات أخبار", "قنوات عربيه", "عام"]
        self.firebase_subs = ["أفلام ومسلسلات", "إخبارية", "رياضة", "إسلاميات", "أطفال", "وثائقي", "موسيقى", "مشكّل ومنوعات"]

        self.apply_dark_css()
        self.build_ui()
        self.sync_firebase_structure_thread()

    def apply_dark_css(self):
        css = b"""
        window { background-color: #0b0f19; }
        * { font-family: 'Noto Sans Arabic', 'Segoe UI', 'DejaVu Sans', sans-serif; font-size: 13px; }
        label { color: #f8fafc; }
        entry {
            background-color: #131b2e;
            color: #38bdf8;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 6px 10px;
        }
        combobox button {
            background-color: #131b2e;
            color: #f8fafc;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 4px;
        }
        treeview {
            background-color: #0f172a;
            color: #f8fafc;
            border: 1px solid #1e293b;
            border-radius: 6px;
        }
        treeview:selected {
            background-color: #0284c7;
            color: #ffffff;
        }
        treeview header button {
            background-color: #1e293b;
            color: #38bdf8;
            font-weight: bold;
            border: none;
            padding: 6px;
        }
        frame {
            border: 1px solid #1e293b;
            border-radius: 8px;
            padding: 8px;
            background-color: #101728;
        }
        frame > border {
            border: 1px solid #1e293b;
            border-radius: 8px;
        }
        frame label {
            font-weight: bold;
            color: #38bdf8;
        }
        button {
            background-color: #1e293b;
            color: #f8fafc;
            border-radius: 6px;
            padding: 6px 12px;
            font-weight: bold;
            border: 1px solid #334155;
        }
        button:hover { background-color: #334155; }
        .btn-primary { background-color: #0284c7; color: white; border: none; }
        .btn-primary:hover { background-color: #0369a1; }
        .btn-success { background-color: #10b981; color: white; border: none; }
        .btn-success:hover { background-color: #059669; }
        .btn-warning { background-color: #d97706; color: white; border: none; }
        .btn-warning:hover { background-color: #b45309; }
        """
        provider = Gtk.CssProvider()
        provider.load_from_data(css)
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

    def build_ui(self):
        main_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        self.add(main_vbox)

        # 1. الترويسة الرئيسية
        header_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        lbl_title = Gtk.Label()
        lbl_title.set_markup("<span size='x-large' weight='bold' foreground='#10b981'>👑 الباسم سات - نظام الاستيراد والفرز الذكي</span>")
        lbl_title.set_halign(Gtk.Align.CENTER)
        header_box.pack_start(lbl_title, False, False, 0)

        lbl_sub = Gtk.Label(label="جلب باقات M3U، فحص الروابط الصاروخي، وتعيين الأقسام والتفريعات بنقرة زر")
        lbl_sub.set_halign(Gtk.Align.CENTER)
        header_box.pack_start(lbl_sub, False, False, 0)
        main_vbox.pack_start(header_box, False, False, 0)

        # 2. إطار مصادر القنوات وروابط M3U
        src_frame = Gtk.Frame(label=" 📡 1. مصادر القنوات وروابط M3U ")
        src_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        src_vbox.set_border_width(8)
        src_frame.add(src_vbox)

        row_src = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        lbl_pre = Gtk.Label(label="باقات جاهزة:")
        row_src.pack_start(lbl_pre, False, False, 0)

        self.preset_combo = Gtk.ComboBoxText()
        for k in PRESET_SOURCES.keys():
            self.preset_combo.append_text(k)
        self.preset_combo.set_active(0)
        self.preset_combo.connect("changed", self.on_preset_changed)
        row_src.pack_start(self.preset_combo, False, False, 0)

        lbl_url = Gtk.Label(label="رابط الباقة:")
        row_src.pack_start(lbl_url, False, False, 0)

        self.url_entry = Gtk.Entry()
        self.url_entry.set_text(list(PRESET_SOURCES.values())[0])
        row_src.pack_start(self.url_entry, True, True, 0)

        btn_load_url = Gtk.Button(label="🌐 جلب من الرابط")
        btn_load_url.get_style_context().add_class("btn-primary")
        btn_load_url.connect("clicked", self.on_load_url_clicked)
        row_src.pack_start(btn_load_url, False, False, 0)

        btn_load_file = Gtk.Button(label="📁 فتح ملف محلي")
        btn_load_file.get_style_context().add_class("btn-success")
        btn_load_file.connect("clicked", self.on_load_file_clicked)
        row_src.pack_start(btn_load_file, False, False, 0)

        src_vbox.pack_start(row_src, False, False, 0)
        main_vbox.pack_start(src_frame, False, False, 0)

        # 3. إطار تعيين الوجهة والتفريع
        dest_frame = Gtk.Frame(label=" 🎯 2. تعيين وجهة وتفريع القنوات المحددة بالجدول ")
        dest_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        dest_vbox.set_border_width(8)
        dest_frame.add(dest_vbox)

        row_dest = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        lbl_area = Gtk.Label(label="القسم الرئيسي:")
        row_dest.pack_start(lbl_area, False, False, 0)

        self.target_main_combo = Gtk.ComboBoxText.new_with_entry()
        for c in self.firebase_categories:
            self.target_main_combo.append_text(c)
        self.target_main_combo.get_child().set_text("IPTV")
        row_dest.pack_start(self.target_main_combo, False, False, 0)

        lbl_subcat = Gtk.Label(label="تفريع IPTV الفرعي:")
        row_dest.pack_start(lbl_subcat, False, False, 0)

        self.target_sub_combo = Gtk.ComboBoxText.new_with_entry()
        for s in self.firebase_subs:
            self.target_sub_combo.append_text(s)
        self.target_sub_combo.get_child().set_text("أفلام ومسلسلات")
        row_dest.pack_start(self.target_sub_combo, False, False, 0)

        btn_apply = Gtk.Button(label="📌 تعيين الوجهة للقنوات المحددة")
        btn_apply.get_style_context().add_class("btn-primary")
        btn_apply.connect("clicked", self.on_apply_destination_clicked)
        row_dest.pack_start(btn_apply, False, False, 0)

        self.lock_check = Gtk.CheckButton(label="🔒 قفل القنوات المنشورة برمز 1415")
        row_dest.pack_end(self.lock_check, False, False, 0)

        dest_vbox.pack_start(row_dest, False, False, 0)
        main_vbox.pack_start(dest_frame, False, False, 0)

        # 4. شريط البحث والفلترة السريعة
        row_filter = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        lbl_search = Gtk.Label(label="🔍 بحث بالاسم أو الرابط:")
        row_filter.pack_start(lbl_search, False, False, 0)

        self.search_entry = Gtk.Entry()
        self.search_entry.set_placeholder_text("ابحث هنا...")
        self.search_entry.connect("changed", lambda w: self.refresh_table())
        row_filter.pack_start(self.search_entry, False, False, 0)

        lbl_sub_flt = Gtk.Label(label="تصفية التفريع:")
        row_filter.pack_start(lbl_sub_flt, False, False, 0)

        self.filter_sub_combo = Gtk.ComboBoxText()
        self.filter_sub_combo.append_text("الكل")
        self.filter_sub_combo.set_active(0)
        self.filter_sub_combo.connect("changed", lambda w: self.refresh_table())
        row_filter.pack_start(self.filter_sub_combo, False, False, 0)

        self.count_lbl = Gtk.Label(label="القنوات: 0 | المحددة: 0")
        self.count_lbl.set_markup("<span weight='bold' foreground='#fbbf24'>القنوات: 0 | المحددة: 0</span>")
        row_filter.pack_end(self.count_lbl, False, False, 0)

        main_vbox.pack_start(row_filter, False, False, 0)

        # 5. جدول القنوات المطور (Gtk.TreeView)
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_vexpand(True)
        scrolled.set_hexpand(True)

        # types: bool(selected), str(name), str(area), str(subCategory), str(status), str(url), int(orig_index)
        self.store = Gtk.ListStore(bool, str, str, str, str, str, int)
        self.treeview = Gtk.TreeView(model=self.store)
        self.treeview.set_rules_hint(True)

        # عمود التحديد
        renderer_toggle = Gtk.CellRendererToggle()
        renderer_toggle.connect("toggled", self.on_toggle_cell)
        col_toggle = Gtk.TreeViewColumn("تحديد", renderer_toggle, active=0)
        col_toggle.set_alignment(0.5)
        self.treeview.append_column(col_toggle)

        # عمود اسم القناة
        renderer_name = Gtk.CellRendererText()
        col_name = Gtk.TreeViewColumn("اسم القناة", renderer_name, text=1)
        col_name.set_min_width(220)
        col_name.set_resizable(True)
        self.treeview.append_column(col_name)

        # عمود القسم الرئيسي
        renderer_area = Gtk.CellRendererText()
        col_area = Gtk.TreeViewColumn("القسم الرئيسي", renderer_area, text=2)
        col_area.set_min_width(120)
        col_area.set_alignment(0.5)
        self.treeview.append_column(col_area)

        # عمود تفريع IPTV
        renderer_sub = Gtk.CellRendererText()
        col_sub = Gtk.TreeViewColumn("تفريعات IPTV", renderer_sub, text=3)
        col_sub.set_min_width(140)
        col_sub.set_alignment(0.5)
        self.treeview.append_column(col_sub)

        # عمود حالة البث
        renderer_status = Gtk.CellRendererText()
        col_status = Gtk.TreeViewColumn("حالة الرابط", renderer_status, text=4)
        col_status.set_min_width(110)
        col_status.set_alignment(0.5)
        self.treeview.append_column(col_status)

        # عمود الرابط
        renderer_url = Gtk.CellRendererText()
        col_url = Gtk.TreeViewColumn("رابط البث الحقيقي (Stream URL)", renderer_url, text=5)
        col_url.set_min_width(380)
        col_url.set_resizable(True)
        self.treeview.append_column(col_url)

        scrolled.add(self.treeview)
        main_vbox.pack_start(scrolled, True, True, 0)

        # 6. شريط الأوامر السفلية والرفع للفايربيس
        bot_bar = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)

        btn_all = Gtk.Button(label="تحديد الكل [✓]")
        btn_all.connect("clicked", lambda w: self.set_all_selection(True))
        bot_bar.pack_start(btn_all, False, False, 0)

        btn_none = Gtk.Button(label="إلغاء التحديد [✗]")
        btn_none.connect("clicked", lambda w: self.set_all_selection(False))
        bot_bar.pack_start(btn_none, False, False, 0)

        btn_working = Gtk.Button(label="⚡ تحديد الشغال فقط [✅]")
        btn_working.connect("clicked", lambda w: self.select_working_only())
        bot_bar.pack_start(btn_working, False, False, 0)

        btn_fast_check = Gtk.Button(label="🚀 فحص الروابط الصاروخي (30 مسار)")
        btn_fast_check.get_style_context().add_class("btn-primary")
        btn_fast_check.connect("clicked", self.on_fast_check_clicked)
        bot_bar.pack_start(btn_fast_check, False, False, 0)

        btn_upload = Gtk.Button(label="🔥 نشر القنوات المحددة لمنصة الباسم سات فوراً")
        btn_upload.get_style_context().add_class("btn-success")
        btn_upload.connect("clicked", self.on_upload_clicked)
        bot_bar.pack_end(btn_upload, False, False, 0)

        main_vbox.pack_start(bot_bar, False, False, 0)

        # شريط الحالة
        self.status_lbl = Gtk.Label(label="جاهز للعمل ومزامنة البث المباشر...")
        self.status_lbl.set_halign(Gtk.Align.START)
        main_vbox.pack_start(self.status_lbl, False, False, 0)

    def show_message(self, title, msg, msg_type=Gtk.MessageType.INFO):
        dlg = Gtk.MessageDialog(
            transient_for=self,
            flags=Gtk.DialogFlags.MODAL,
            message_type=msg_type,
            buttons=Gtk.ButtonsType.OK,
            text=title
        )
        dlg.format_secondary_text(msg)
        dlg.run()
        dlg.destroy()

    def ask_yes_no(self, title, msg):
        dlg = Gtk.MessageDialog(
            transient_for=self,
            flags=Gtk.DialogFlags.MODAL,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.YES_NO,
            text=title
        )
        dlg.format_secondary_text(msg)
        res = dlg.run()
        dlg.destroy()
        return res == Gtk.ResponseType.YES

    def on_preset_changed(self, combo):
        active_text = combo.get_active_text()
        if active_text in PRESET_SOURCES:
            self.url_entry.set_text(PRESET_SOURCES[active_text])

    # فتح مستعرض ملفات كالي لينكس الرسمي
    def on_load_file_clicked(self, widget):
        chooser = Gtk.FileChooserDialog(
            title="اختر ملف قنوات البث (M3U / M3U8)",
            parent=self,
            action=Gtk.FileChooserAction.OPEN
        )
        chooser.add_button("إلغاء", Gtk.ResponseType.CANCEL)
        chooser.add_button("فتح الملف", Gtk.ResponseType.OK)

        filter_m3u = Gtk.FileFilter()
        filter_m3u.set_name("ملفات القنوات (*.m3u, *.m3u8)")
        filter_m3u.add_pattern("*.m3u")
        filter_m3u.add_pattern("*.m3u8")
        filter_m3u.add_pattern("*.M3U")
        filter_m3u.add_pattern("*.M3U8")
        chooser.add_filter(filter_m3u)

        filter_all = Gtk.FileFilter()
        filter_all.set_name("جميع الملفات (*.*)")
        filter_all.add_pattern("*")
        chooser.add_filter(filter_all)

        down_dir = os.path.expanduser("~/Downloads")
        if os.path.exists(down_dir):
            chooser.set_current_folder(down_dir)
        else:
            chooser.set_current_folder(os.path.expanduser("~"))

        res = chooser.run()
        fpath = None
        if res == Gtk.ResponseType.OK:
            fpath = chooser.get_filename()
        chooser.destroy()

        if fpath and os.path.exists(fpath):
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    self._parse_m3u(f.read())
                self.status_lbl.set_text(f"تم جلب {len(self.channels_data)} قناة من الملف: {os.path.basename(fpath)}")
            except Exception as e:
                self.show_message("خطأ في قراءة الملف", str(e), Gtk.MessageType.ERROR)

    def on_load_url_clicked(self, widget):
        url = self.url_entry.get_text().strip()
        if not url:
            self.show_message("تنبيه", "يرجى إدخال رابط صالح أولاً!", Gtk.MessageType.WARNING)
            return

        self.status_lbl.set_text("جاري جلب الباقة من الرابط بالإنترنت...")
        threading.Thread(target=self._load_url_worker, args=(url,), daemon=True).start()

    def _load_url_worker(self, url):
        try:
            r = requests.get(url, timeout=15)
            r.raise_for_status()
            GLib.idle_add(self._parse_m3u, r.text)
            GLib.idle_add(lambda: self.status_lbl.set_text(f"تم جلب {len(self.channels_data)} قناة بنجاح!"))
        except Exception as e:
            GLib.idle_add(self.show_message, "خطأ بالتحميل", f"فشل جلب الرابط: {e}", Gtk.MessageType.ERROR)
            GLib.idle_add(lambda: self.status_lbl.set_text("فشل جلب الرابط."))

    def _parse_m3u(self, text):
        self.channels_data = []
        lines = text.strip().splitlines()
        current_meta = None

        default_area = self.target_main_combo.get_child().get_text().strip() or "IPTV"

        idx = 0
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line.startswith("#EXTINF:"):
                name_match = re.search(r',([^,]+)$', line)
                channel_name = name_match.group(1).strip() if name_match else "قناة غير معروفة"

                logo_match = re.search(r'tvg-logo="([^"]+)"', line) or re.search(r"tvg-logo='([^']+)'", line)
                logo = logo_match.group(1).strip() if logo_match else ""

                group_match = re.search(r'group-title="([^"]+)"', line) or re.search(r"group-title='([^']+)'", line)
                raw_group = group_match.group(1).strip() if group_match else ""
                sub_cat = smart_subcat(raw_group)

                current_meta = {
                    "id": idx,
                    "name": channel_name,
                    "logo": logo,
                    "area": default_area,
                    "subCategory": sub_cat,
                    "selected": True,
                    "status": "غير مفحوص"
                }
            elif line.startswith("#"):
                continue
            else:
                if current_meta:
                    current_meta["url"] = line
                    self.channels_data.append(current_meta)
                    idx += 1
                    current_meta = None

        # تحديث قائمة تصفية التفريعات
        self.filter_sub_combo.remove_all()
        self.filter_sub_combo.append_text("الكل")
        subs = sorted(list(set(c["subCategory"] for c in self.channels_data)))
        for s in subs:
            self.filter_sub_combo.append_text(s)
        self.filter_sub_combo.set_active(0)

        self.refresh_table()

    def refresh_table(self):
        query = self.search_entry.get_text().strip().lower()
        selected_sub = self.filter_sub_combo.get_active_text() or "الكل"

        self.store.clear()
        matching_count = 0
        selected_count = 0

        for c in self.channels_data:
            match_q = (query in c["name"].lower()) or (query in c["url"].lower())
            match_s = (selected_sub == "الكل" or c["subCategory"] == selected_sub)
            if match_q and match_s:
                matching_count += 1
                if c["selected"]:
                    selected_count += 1
                self.store.append([
                    c["selected"],
                    c["name"],
                    c["area"],
                    c["subCategory"],
                    c["status"],
                    c["url"],
                    c["id"]
                ])

        self.count_lbl.set_markup(
            f"<span weight='bold' foreground='#fbbf24'>المعروض: {matching_count} من أصل {len(self.channels_data)} | المحددة: {selected_count}</span>"
        )

    def on_toggle_cell(self, cell, path):
        tree_iter = self.store.get_iter(path)
        cur_val = self.store.get_value(tree_iter, 0)
        c_id = self.store.get_value(tree_iter, 6)

        new_val = not cur_val
        self.store.set_value(tree_iter, 0, new_val)

        for c in self.channels_data:
            if c["id"] == c_id:
                c["selected"] = new_val
                break

        selected_count = sum(1 for c in self.channels_data if c["selected"])
        self.count_lbl.set_markup(
            f"<span weight='bold' foreground='#fbbf24'>المعروض: {len(self.store)} من أصل {len(self.channels_data)} | المحددة: {selected_count}</span>"
        )

    def set_all_selection(self, state):
        for c in self.channels_data:
            c["selected"] = state
        tree_iter = self.store.get_iter_first()
        while tree_iter:
            self.store.set_value(tree_iter, 0, state)
            tree_iter = self.store.iter_next(tree_iter)

        selected_count = sum(1 for c in self.channels_data if c["selected"])
        self.count_lbl.set_markup(
            f"<span weight='bold' foreground='#fbbf24'>المعروض: {len(self.store)} من أصل {len(self.channels_data)} | المحددة: {selected_count}</span>"
        )

    def select_working_only(self):
        working_count = 0
        for c in self.channels_data:
            if "شغال" in str(c.get("status", "")):
                c["selected"] = True
                working_count += 1
            else:
                c["selected"] = False
        self.refresh_table()
        self.status_lbl.set_text(f"تم تحديد {working_count} قناة شغالة فقط بنجاح!")

    # تطبيق القسم والتفريع على القنوات المحددة بنقرة زر
    def on_apply_destination_clicked(self, widget):
        new_area = self.target_main_combo.get_child().get_text().strip() or "IPTV"
        new_sub = self.target_sub_combo.get_child().get_text().strip() or "أفلام ومسلسلات"

        selected = [c for c in self.channels_data if c["selected"]]
        if not selected:
            self.show_message("تنبيه", "يرجى تحديد القنوات المراد تغيير وجهتها أولاً!", Gtk.MessageType.WARNING)
            return

        for c in selected:
            c["area"] = new_area
            c["subCategory"] = new_sub

        self.refresh_table()
        self.show_message(
            "تم تعيين الوجهة",
            f"✅ تم بنجاح تعيين القسم [{new_area}] والتفريع [{new_sub}] لـ ({len(selected)}) قناة محددة!"
        )

    def on_fast_check_clicked(self, widget):
        selected = [c for c in self.channels_data if c["selected"]]
        if not selected:
            selected = self.channels_data
            for c in selected:
                c["selected"] = True

        if not selected:
            self.show_message("تنبيه", "لا توجد قنوات لفحصها.", Gtk.MessageType.INFO)
            return

        self.status_lbl.set_text(f"جاري فحص {len(selected)} قناة بسرعة فائقة عبر 30 مسار...")
        threading.Thread(target=self._fast_check_worker, args=(selected,), daemon=True).start()

    def _fast_check_worker(self, channels):
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

        def _check_one(item):
            try:
                res = requests.head(item["url"], headers=headers, timeout=3.5, allow_redirects=True)
                if res.status_code in [200, 206, 302]:
                    item["status"] = "شغال ✅"
                    item["selected"] = True
                else:
                    item["status"] = f"خطأ {res.status_code}"
                    item["selected"] = False
            except Exception:
                item["status"] = "ميت ❌"
                item["selected"] = False

        with ThreadPoolExecutor(max_workers=30) as ex:
            list(ex.map(_check_one, channels))

        working = sum(1 for c in channels if "شغال" in c.get("status", ""))
        GLib.idle_add(self.refresh_table)
        GLib.idle_add(lambda: self.status_lbl.set_text(
            f"اكتمل الفحص الصاروخي! الشغال: {working} | تم تحديد الشغال فقط تلقائياً."
        ))

    def sync_firebase_structure_thread(self):
        threading.Thread(target=self._sync_firebase_worker, daemon=True).start()

    def _sync_firebase_worker(self):
        try:
            r1 = session.get(f"{DB_BASE}/streams/_config_categories.json", timeout=6)
            cats = r1.json()
            if cats and isinstance(cats, list):
                self.firebase_categories = [c for c in cats if c and c != "all"]

            r2 = session.get(f"{DB_BASE}/streams/_config_iptv_subs.json", timeout=6)
            subs = r2.json()
            if subs and isinstance(subs, list):
                self.firebase_subs = [s for s in subs if s]

            GLib.idle_add(self._update_combos_ui)
        except Exception:
            pass

    def _update_combos_ui(self):
        self.target_main_combo.remove_all()
        for c in self.firebase_categories:
            self.target_main_combo.append_text(c)
        self.target_main_combo.get_child().set_text(self.firebase_categories[0] if self.firebase_categories else "IPTV")

        self.target_sub_combo.remove_all()
        for s in self.firebase_subs:
            self.target_sub_combo.append_text(s)
        self.target_sub_combo.get_child().set_text(self.firebase_subs[0] if self.firebase_subs else "أفلام ومسلسلات")

        self.status_lbl.set_text("✅ تم مزامنة أقسام وتفريعات الباسم سات لايف من الفايربيس!")

    def get_firebase_token(self):
        if not FIREBASE_API_KEY or not CONFIG_PASSWORD:
            return None
        auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        payload = {"email": CONFIG_EMAIL, "password": CONFIG_PASSWORD, "returnSecureToken": True}
        try:
            res = session.post(auth_url, json=payload, timeout=8)
            return res.json().get("idToken")
        except Exception:
            return None

    def on_upload_clicked(self, widget):
        selected = [c for c in self.channels_data if c["selected"]]
        if not selected:
            self.show_message("تنبيه", "لم يتم تحديد أي قناة لنشرها!", Gtk.MessageType.WARNING)
            return

        is_locked = self.lock_check.get_active()
        lock_note = " (مع قفلها برمز 1415)" if is_locked else ""
        if not self.ask_yes_no("تأكيد النشر", f"هل أنت متأكد من رفع ({len(selected)}) قناة إلى منصة الباسم سات{lock_note}؟"):
            return

        self.status_lbl.set_text("جاري المصادقة ورفع القنوات إلى السيرفر...")
        threading.Thread(target=self._upload_worker, args=(selected, is_locked), daemon=True).start()

    def _upload_worker(self, channels, is_locked):
        token = self.get_firebase_token()
        if not token:
            GLib.idle_add(self.show_message, "خطأ دخول", "فشل تسجيل الدخول للفايربيس! تأكد من ملف config.json", Gtk.MessageType.ERROR)
            GLib.idle_add(lambda: self.status_lbl.set_text("فشل المصادقة مع السيرفر."))
            return

        push_url = f"{DB_BASE}/streams.json?auth={token}"
        success = 0

        for c in channels:
            payload = {
                "title": c["name"],
                "area": c.get("area", "IPTV"),
                "category": c.get("subCategory", "مشكّل ومنوعات"),
                "subCategory": c.get("subCategory", "مشكّل ومنوعات"),
                "url": c["url"],
                "type": "hls",
                "status": "active",
                "isLocked": bool(is_locked),
                "logo": c.get("logo", "")
            }
            try:
                res = session.post(push_url, json=payload, timeout=6)
                if res.status_code == 200:
                    success += 1
            except Exception:
                pass

        msg = f"✅ تم بنجاح نشر ({success}) قناة مفروزة ومجهزة إلى منصة الباسم سات!"
        GLib.idle_add(self.show_message, "اكتمل النشر والفرز", msg, Gtk.MessageType.INFO)
        GLib.idle_add(lambda: self.status_lbl.set_text(msg))

if __name__ == "__main__":
    app = AlbasemImporterGtk()
    app.connect("destroy", Gtk.main_quit)
    app.show_all()
    Gtk.main()
