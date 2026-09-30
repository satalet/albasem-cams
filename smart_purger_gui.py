#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
👑 منظومة الباسم سات - المنظف الذكي ومحلل السيرفرات الرسومي (Smart IPTV Purger Pro - GTK3)
دعم التحديد المتعدد للسيرفرات والدومينات المشتركة مع مربعات اختيار والحذف المتوازي فائق السرعة.
"""

import os
import re
import json
import threading
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('Gdk', '3.0')
from gi.repository import Gtk, GLib, Gdk

Gtk.Widget.set_default_direction(Gtk.TextDirection.RTL)

session = requests.Session()
retries = Retry(total=3, backoff_factor=0.5, status_forcelist=[500, 502, 503, 504])
session.mount('https://', HTTPAdapter(max_retries=retries))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

FIREBASE_API_KEY = ""
gui_path = os.path.join(BASE_DIR, "albasem_gui.py")
if os.path.exists(gui_path):
    with open(gui_path, "r", encoding="utf-8") as f:
        m = re.search(r'FIREBASE_API_KEY\s*=\s*["\']([^"\']+)["\']', f.read())
        if m:
            FIREBASE_API_KEY = m.group(1)

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

class SmartPurgerGtk(Gtk.Window):
    def __init__(self):
        super().__init__(title="الباسم سات | أداة الاستكشاف الذكي وتفريغ السيرفرات المتعددة")
        self.set_default_size(1050, 720)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_border_width(12)

        self.all_streams = {}
        self.branches_data = {}
        self.current_selected_branch = None
        self.domains_map = {}

        self.apply_dark_css()
        self.build_ui()
        self.load_data_thread()

    def apply_dark_css(self):
        css = b"""
        window { background-color: #0b0f19; }
        * { font-family: 'Noto Sans Arabic', 'Segoe UI', 'DejaVu Sans', sans-serif; font-size: 13px; }
        label { color: #f8fafc; }
        combobox button {
            background-color: #131b2e;
            color: #38bdf8;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 6px 12px;
            font-weight: bold;
        }
        treeview {
            background-color: #0f172a;
            color: #f8fafc;
            border: 1px solid #1e293b;
            border-radius: 8px;
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
            padding: 8px;
        }
        frame {
            border: 1px solid #1e293b;
            border-radius: 8px;
            padding: 10px;
            background-color: #101728;
        }
        frame label {
            font-weight: bold;
            color: #38bdf8;
        }
        button {
            background-color: #1e293b;
            color: #f8fafc;
            border-radius: 6px;
            padding: 8px 14px;
            font-weight: bold;
            border: 1px solid #334155;
        }
        button:hover { background-color: #334155; }
        .btn-danger { background-color: #e11d48; color: white; border: none; }
        .btn-danger:hover { background-color: #be123c; }
        .btn-warning { background-color: #d97706; color: white; border: none; }
        .btn-warning:hover { background-color: #b45309; }
        .btn-primary { background-color: #0284c7; color: white; border: none; }
        .btn-primary:hover { background-color: #0369a1; }
        .btn-success { background-color: #10b981; color: white; border: none; }
        .btn-success:hover { background-color: #059669; }
        """
        provider = Gtk.CssProvider()
        provider.load_from_data(css)
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

    def build_ui(self):
        main_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self.add(main_vbox)

        # 1. الترويسة
        header_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        lbl_title = Gtk.Label()
        lbl_title.set_markup("<span size='x-large' weight='bold' foreground='#fbbf24'>🧹 أداة الباسم سات | التطهير الذكي وتحديد السيرفرات المتعددة</span>")
        lbl_title.set_halign(Gtk.Align.CENTER)
        header_box.pack_start(lbl_title, False, False, 0)

        lbl_desc = Gtk.Label(label="حدد عدة سيرفرات معاً بنقرة زر لحذف قنواتها فوراً أو تفريغ الفرع كاملاً")
        lbl_desc.set_halign(Gtk.Align.CENTER)
        header_box.pack_start(lbl_desc, False, False, 0)
        main_vbox.pack_start(header_box, False, False, 0)

        # 2. إطار اختيار الفرع
        branch_frame = Gtk.Frame(label=" 🎯 1. اختيار الفرع النشط ")
        branch_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        branch_vbox.set_border_width(8)
        branch_frame.add(branch_vbox)

        row_sel = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        lbl_b = Gtk.Label(label="القسم / الفرع النشط:")
        row_sel.pack_start(lbl_b, False, False, 0)

        self.branch_combo = Gtk.ComboBoxText()
        self.branch_combo.connect("changed", self.on_branch_changed)
        row_sel.pack_start(self.branch_combo, True, True, 0)

        btn_refresh = Gtk.Button(label="🔄 تحديث البيانات لايف")
        btn_refresh.get_style_context().add_class("btn-primary")
        btn_refresh.connect("clicked", lambda w: self.load_data_thread())
        row_sel.pack_start(btn_refresh, False, False, 0)

        branch_vbox.pack_start(row_sel, False, False, 0)

        self.branch_stats_lbl = Gtk.Label(label="اختر فرعاً لعرض السيرفرات...")
        self.branch_stats_lbl.set_halign(Gtk.Align.START)
        branch_vbox.pack_start(self.branch_stats_lbl, False, False, 0)
        main_vbox.pack_start(branch_frame, False, False, 0)

        # 3. إطار السيرفرات مع التحديد المتعدد
        table_frame = Gtk.Frame(label=" 📡 2. السيرفرات المكتشفة (يمكنك تحديد عدة سيرفرات بالصناديق) ")
        table_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        table_vbox.set_border_width(8)
        table_frame.add(table_vbox)

        # شريط أدوات التحديد السريع
        sel_bar = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        btn_sel_all = Gtk.Button(label="تحديد الكل [✓]")
        btn_sel_all.connect("clicked", lambda w: self.toggle_all_selection(True))
        sel_bar.pack_start(btn_sel_all, False, False, 0)

        btn_desel_all = Gtk.Button(label="إلغاء التحديد [✗]")
        btn_desel_all.connect("clicked", lambda w: self.toggle_all_selection(False))
        sel_bar.pack_start(btn_desel_all, False, False, 0)

        self.selected_summary_lbl = Gtk.Label(label="المحدد: 0 سيرفر (0 قناة)")
        self.selected_summary_lbl.set_markup("<span weight='bold' foreground='#38bdf8'>المحدد: 0 سيرفر (0 قناة)</span>")
        sel_bar.pack_end(self.selected_summary_lbl, False, False, 0)

        table_vbox.pack_start(sel_bar, False, False, 0)

        scrolled = Gtk.ScrolledWindow()
        scrolled.set_vexpand(True)
        scrolled.set_hexpand(True)

        # store: bool(selected), str(domain_key), int(channel_count), str(sample_title)
        self.store = Gtk.ListStore(bool, str, int, str)
        self.treeview = Gtk.TreeView(model=self.store)

        renderer_toggle = Gtk.CellRendererToggle()
        renderer_toggle.connect("toggled", self.on_cell_toggled)
        col_toggle = Gtk.TreeViewColumn("تحديد", renderer_toggle, active=0)
        col_toggle.set_alignment(0.5)
        self.treeview.append_column(col_toggle)

        col_dom = Gtk.TreeViewColumn("الدومين / السيرفر المشترك", Gtk.CellRendererText(), text=1)
        col_dom.set_min_width(320)
        col_dom.set_resizable(True)
        self.treeview.append_column(col_dom)

        col_count = Gtk.TreeViewColumn("عدد القنوات التابعة له", Gtk.CellRendererText(), text=2)
        col_count.set_min_width(140)
        col_count.set_alignment(0.5)
        self.treeview.append_column(col_count)

        col_sample = Gtk.TreeViewColumn("عينة من أسماء القنوات", Gtk.CellRendererText(), text=3)
        col_sample.set_min_width(320)
        col_sample.set_resizable(True)
        self.treeview.append_column(col_sample)

        scrolled.add(self.treeview)
        table_vbox.pack_start(scrolled, True, True, 0)
        main_vbox.pack_start(table_frame, True, True, 0)

        # 4. أزرار الحذف والتطهير
        btn_bar = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)

        self.btn_del_selected = Gtk.Button(label="🗑️ حذف السيرفرات المحددة فقط من هذا الفرع")
        self.btn_del_selected.get_style_context().add_class("btn-warning")
        self.btn_del_selected.connect("clicked", self.on_delete_selected_domains_clicked)
        btn_bar.pack_start(self.btn_del_selected, False, False, 0)

        self.btn_empty_branch = Gtk.Button(label="🔥 تفريغ ومسح الفرع بالكامل من السيرفر")
        self.btn_empty_branch.get_style_context().add_class("btn-danger")
        self.btn_empty_branch.connect("clicked", self.on_empty_branch_clicked)
        btn_bar.pack_end(self.btn_empty_branch, False, False, 0)

        main_vbox.pack_start(btn_bar, False, False, 0)

        # شريط الحالة السفلي
        self.status_lbl = Gtk.Label(label="جاري الاتصال بالسيرفر والتحضير...")
        self.status_lbl.set_halign(Gtk.Align.START)
        main_vbox.pack_start(self.status_lbl, False, False, 0)

    def show_message(self, title, msg, msg_type=Gtk.MessageType.INFO):
        dlg = Gtk.MessageDialog(
            transient_for=self,
            modal=True,
            destroy_with_parent=True,
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
            modal=True,
            destroy_with_parent=True,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.YES_NO,
            text=title
        )
        dlg.format_secondary_text(msg)
        res = dlg.run()
        dlg.destroy()
        return res == Gtk.ResponseType.YES

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

    def load_data_thread(self):
        self.status_lbl.set_text("⏳ جاري جلب جميع القنوات والفروع لايف من الفايربيس...")
        threading.Thread(target=self._load_data_worker, daemon=True).start()

    def _load_data_worker(self):
        token = self.get_firebase_token()
        if not token:
            GLib.idle_add(self.show_message, "خطأ دخول", "فشل تسجيل الدخول للفايربيس! تأكد من config.json", Gtk.MessageType.ERROR)
            GLib.idle_add(lambda: self.status_lbl.set_text("فشلت المصادقة."))
            return

        try:
            r = session.get(f"{DB_BASE}/streams.json?auth={token}", timeout=15)
            r.raise_for_status()
            data = r.json() or {}
        except Exception as e:
            GLib.idle_add(self.show_message, "خطأ اتصال", f"فشل جلب البيانات: {e}", Gtk.MessageType.ERROR)
            GLib.idle_add(lambda: self.status_lbl.set_text("فشل الاتصال."))
            return

        self.all_streams = data
        self.branches_data = {}

        for k, v in data.items():
            if not isinstance(v, dict):
                continue
            v["_key"] = k
            area = (v.get("area") or v.get("category") or "IPTV").strip()
            sub = (v.get("subCategory") or v.get("area") or "").strip()

            if area == "IPTV":
                branch_key = f"IPTV / {sub or 'مشكّل ومنوعات'}"
            elif area in ["قنوات محلية", "LOCAL"]:
                branch_key = f"قنوات محلية / {sub or 'عام'}"
            elif area in ["قنوات عربية", "ARAB"]:
                branch_key = f"قنوات عربية / {sub or 'عام'}"
            elif area in ["قنوات أجنبية", "WEST"]:
                branch_key = f"قنوات أجنبية / {sub or 'عام'}"
            else:
                branch_key = f"قسم مخصص: {area}"

            if branch_key not in self.branches_data:
                self.branches_data[branch_key] = []
            self.branches_data[branch_key].append(v)

        GLib.idle_add(self._update_branch_combo)

    def _update_branch_combo(self):
        self.branch_combo.remove_all()
        sorted_branches = sorted(self.branches_data.keys())
        for b in sorted_branches:
            count = len(self.branches_data[b])
            self.branch_combo.append_text(f"{b} ({count} قناة)")

        if sorted_branches:
            self.branch_combo.set_active(0)
            self.status_lbl.set_text(f"✅ تم تحميل {len(self.all_streams)} قناة ومزامنة {len(sorted_branches)} فرع بنجاح!")
        else:
            self.status_lbl.set_text("لا توجد قنوات مسجلة حالياً.")

    def on_branch_changed(self, combo):
        txt = combo.get_active_text()
        if not txt:
            return
        branch_name = txt.rsplit(" (", 1)[0]
        self.current_selected_branch = branch_name
        self.analyze_branch_domains(branch_name)

    def analyze_branch_domains(self, branch_name):
        channels = self.branches_data.get(branch_name, [])
        self.store.clear()
        self.domains_map = {}

        for c in channels:
            url = c.get("streamUrl") or c.get("url") or ""
            if not url:
                dom = "رابط مجهول / بدون عنوان"
            else:
                try:
                    parsed = urlparse(url)
                    if parsed.netloc:
                        dom = f"{parsed.scheme}://{parsed.netloc}"
                    else:
                        dom = url.split("/")[0]
                except Exception:
                    dom = url[:40]

            if dom not in self.domains_map:
                self.domains_map[dom] = []
            self.domains_map[dom].append(c)

        for dom, c_list in sorted(self.domains_map.items(), key=lambda x: len(x[1]), reverse=True):
            sample_titles = ", ".join([x.get("title", "بدون اسم") for x in c_list[:3]])
            if len(c_list) > 3:
                sample_titles += "..."
            # افتراضياً غير محدد: False
            self.store.append([False, dom, len(c_list), sample_titles])

        self.branch_stats_lbl.set_markup(
            f"<span weight='bold' foreground='#38bdf8'>إحصائيات [{branch_name}]:</span> "
            f"إجمالي القنوات: <span foreground='#fbbf24'>({len(channels)})</span> | "
            f"عدد السيرفرات المكتشفة: <span foreground='#10b981'>({len(self.domains_map)})</span>"
        )
        self.update_selection_summary()

    def on_cell_toggled(self, widget, path):
        tree_iter = self.store.get_iter(path)
        cur = self.store.get_value(tree_iter, 0)
        self.store.set_value(tree_iter, 0, not cur)
        self.update_selection_summary()

    def toggle_all_selection(self, state):
        tree_iter = self.store.get_iter_first()
        while tree_iter:
            self.store.set_value(tree_iter, 0, state)
            tree_iter = self.store.iter_next(tree_iter)
        self.update_selection_summary()

    def update_selection_summary(self):
        sel_domains = 0
        sel_channels = 0
        tree_iter = self.store.get_iter_first()
        while tree_iter:
            if self.store.get_value(tree_iter, 0):
                sel_domains += 1
                sel_channels += self.store.get_value(tree_iter, 2)
            tree_iter = self.store.iter_next(tree_iter)

        self.selected_summary_lbl.set_markup(
            f"<span weight='bold' foreground='#fbbf24'>المحدد: ({sel_domains}) سيرفر | ({sel_channels}) قناة</span>"
        )

    def on_delete_selected_domains_clicked(self, widget):
        selected_domains = []
        tree_iter = self.store.get_iter_first()
        while tree_iter:
            if self.store.get_value(tree_iter, 0):
                selected_domains.append(self.store.get_value(tree_iter, 1))
            tree_iter = self.store.iter_next(tree_iter)

        if not selected_domains:
            self.show_message("تنبيه", "يرجى تحديد سيرفر أو أكثر من القائمة أولاً!", Gtk.MessageType.WARNING)
            return

        channels = self.branches_data.get(self.current_selected_branch, [])
        to_delete = []
        for c in channels:
            url = c.get("streamUrl") or c.get("url") or ""
            if any(dom in url for dom in selected_domains):
                to_delete.append(c)

        if not self.ask_yes_no(
            "تأكيد حذف السيرفرات المحددة",
            f"هل أنت متأكد تماماً من حذف ({len(selected_domains)}) سيرفر محدد؟\n\n"
            f"إجمالي القنوات التي ستُحذف: ({len(to_delete)}) قناة من فرع:\n[{self.current_selected_branch}]\n\n"
            "هل تود المتابعة؟"
        ):
            return

        self.status_lbl.set_text(f"⏳ جاري حذف ({len(to_delete)}) قناة عبر الفايربيس...")
        threading.Thread(target=self._delete_batch_worker, args=(to_delete,), daemon=True).start()

    def on_empty_branch_clicked(self, widget):
        if not self.current_selected_branch:
            self.show_message("تنبيه", "يرجى اختيار فرع أولاً!", Gtk.MessageType.WARNING)
            return

        channels = self.branches_data.get(self.current_selected_branch, [])
        if not channels:
            self.show_message("تنبيه", "هذا الفرع فارغ بالفعل!", Gtk.MessageType.INFO)
            return

        if not self.ask_yes_no(
            "⚠️ تحذير: تفريغ الفرع بالكامل",
            f"هل أنت متأكد من تفريغ ومسح جميع قنوات فرع:\n[{self.current_selected_branch}]\n"
            f"وعددها ({len(channels)}) قناة بالكامل من الفايربيس؟ لا يمكن التراجع!"
        ):
            return

        self.status_lbl.set_text(f"⏳ جاري تفريغ فرع [{self.current_selected_branch}] بالكامل...")
        threading.Thread(target=self._delete_batch_worker, args=(channels,), daemon=True).start()

    def _delete_batch_worker(self, channels_list):
        token = self.get_firebase_token()
        if not token:
            GLib.idle_add(self.show_message, "خطأ", "فقد الاتصال بالمصادقة.", Gtk.MessageType.ERROR)
            return

        deleted_count = 0
        def _del_one(c):
            nonlocal deleted_count
            k = c.get("_key")
            if not k: return
            try:
                r = session.delete(f"{DB_BASE}/streams/{k}.json?auth={token}", timeout=6)
                if r.status_code == 200:
                    deleted_count += 1
            except Exception:
                pass

        with ThreadPoolExecutor(max_workers=30) as ex:
            list(ex.map(_del_one, channels_list))

        msg = f"✅ تم بنجاح حذف وتطهير ({deleted_count}) قناة من الفايربيس!"
        GLib.idle_add(self.show_message, "تمت العملية", msg, Gtk.MessageType.INFO)
        GLib.idle_add(self.load_data_thread)

if __name__ == "__main__":
    app = SmartPurgerGtk()
    app.connect("destroy", Gtk.main_quit)
    app.show_all()
    Gtk.main()
