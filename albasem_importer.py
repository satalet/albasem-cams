#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
منظومة الباسم سات - أداة الاستيراد والفرز الجماعي الذكية (M3U Importer Pro)
دعم المصادقة الرسمية عبر Firebase Auth، الفرز التلقائي، والتوافق 100% مع منصة الباسم سات.
"""

import os
import re
import json
import requests
import threading
from concurrent.futures import ThreadPoolExecutor
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    def ar(text):
        if not text:
            return ""
        return get_display(arabic_reshaper.reshape(str(text)))
except Exception:
    def ar(text):
        return text

# دالة الفرز والتعريب الذكي للتصنيفات الفرعية
def smart_subcat(raw_group):
    g = str(raw_group).lower()
    if any(k in g for k in ["kid", "child", "cartoon", "animation"]):
        return "أطفال"
    elif any(k in g for k in ["news", "خبر", "أخبار"]):
        return "إخبارية"
    elif any(k in g for k in ["relig", "islam", "quran", "دين", "قرآن"]):
        return "إسلاميات"
    elif any(k in g for k in ["movie", "cinema", "series", "فلم", "مسلسل"]):
        return "أفلام ومسلسلات"
    elif any(k in g for k in ["sport", "رياض"]):
        return "رياضة"
    elif any(k in g for k in ["doc", "وثائق"]):
        return "وثائقي"
    elif any(k in g for k in ["music", "موسيق", "أغان"]):
        return "موسيقى"
    else:
        return "مشكّل ومنوعات"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# قراءة مفتاح الـ API من albasem_gui.py تلقائياً
FIREBASE_API_KEY = ""
gui_path = os.path.join(BASE_DIR, "albasem_gui.py")
if os.path.exists(gui_path):
    with open(gui_path, "r", encoding="utf-8") as f:
        m = re.search(r'FIREBASE_API_KEY\s*=\s*["\']([^"\']+)["\']', f.read())
        if m:
            FIREBASE_API_KEY = m.group(1)

# قراءة بيانات الدخول من config.json
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

DB_URL = "https://albasem-cams-default-rtdb.firebaseio.com/streams.json"

PRESET_SOURCES = {
    "قنوات العالم العربي (مفتوحة - IPTV-org)": "https://iptv-org.github.io/iptv/languages/ara.m3u",
    "قنوات إخبارية عامة (IPTV-org)": "https://iptv-org.github.io/iptv/categories/news.m3u",
    "قنوات وثائقية مفتوحة": "https://iptv-org.github.io/iptv/categories/documentary.m3u"
}

class AlbasemImporterApp:
    def __init__(self, root):
        self.root = root
        self.root.title(ar("الباسم سات - أداة الاستيراد السريع والفرز الذكي"))
        self.root.geometry("1060x720")
        self.root.minsize(900, 600)

        self.channels_data = []
        self.filtered_data = []
        self.id_token = None

        self.setup_ui()

    def setup_ui(self):
        style = ttk.Style()
        style.theme_use('clam')
        
        # 1. شريط المصدر
        source_frame = ttk.LabelFrame(self.root, text=ar(" 📡 مصدر القنوات المفتوحة (M3U) "), padding=10)
        source_frame.pack(fill="x", padx=10, pady=5)

        ttk.Label(source_frame, text=ar("اختر باقة جاهزة:")).grid(row=0, column=0, sticky="w", padx=5)
        
        self.preset_map = {ar(k): v for k, v in PRESET_SOURCES.items()}
        self.preset_combo = ttk.Combobox(source_frame, values=list(self.preset_map.keys()), width=40, state="readonly")
        self.preset_combo.grid(row=0, column=1, padx=5, pady=2)
        self.preset_combo.current(0)
        self.preset_combo.bind("<<ComboboxSelected>>", self.on_preset_change)

        ttk.Label(source_frame, text=ar("أو رابط مخصص:")).grid(row=1, column=0, sticky="w", padx=5)
        self.url_var = tk.StringVar(value=list(PRESET_SOURCES.values())[0])
        self.url_entry = ttk.Entry(source_frame, textvariable=self.url_var, width=50)
        self.url_entry.grid(row=1, column=1, padx=5, pady=2)

        btn_box = ttk.Frame(source_frame)
        btn_box.grid(row=1, column=2, padx=5)
        ttk.Button(btn_box, text=ar("جلب من الرابط 🌐"), command=self.load_from_url_thread).pack(side="left", padx=2)
        ttk.Button(btn_box, text=ar("فتح ملف محلي 📁"), command=self.load_from_file).pack(side="left", padx=2)

        # 2. شريط الفلترة
        filter_frame = ttk.Frame(self.root, padding=5)
        filter_frame.pack(fill="x", padx=10)

        ttk.Label(filter_frame, text=ar("🔍 بحث بالاسم:")).pack(side="left", padx=5)
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *args: self.apply_filter())
        ttk.Entry(filter_frame, textvariable=self.search_var, width=25).pack(side="left", padx=5)

        ttk.Label(filter_frame, text=ar("التصنيف:")).pack(side="left", padx=5)
        self.category_filter = ttk.Combobox(filter_frame, values=[ar("الكل")], width=20, state="readonly")
        self.category_filter.current(0)
        self.category_filter.bind("<<ComboboxSelected>>", lambda e: self.apply_filter())
        self.category_filter.pack(side="left", padx=5)

        self.count_label = ttk.Label(filter_frame, text=ar("القنوات: 0"), font=("bold", 10))
        self.count_label.pack(side="right", padx=10)

        # 3. جدول القنوات
        table_frame = ttk.Frame(self.root, padding=5)
        table_frame.pack(fill="both", expand=True, padx=10)

        cols = ("select", "name", "group", "status", "url")
        self.tree = ttk.Treeview(table_frame, columns=cols, show="headings", selectmode="extended")
        
        self.tree.heading("select", text=ar("تحديد"))
        self.tree.heading("name", text=ar("اسم القناة"))
        self.tree.heading("group", text=ar("الفرز الفرعي المقترح"))
        self.tree.heading("status", text=ar("حالة الرابط"))
        self.tree.heading("url", text=ar("رابط البث الحقيقي"))

        self.tree.column("select", width=65, anchor="center")
        self.tree.column("name", width=220, anchor="w")
        self.tree.column("group", width=140, anchor="center")
        self.tree.column("status", width=110, anchor="center")
        self.tree.column("url", width=420, anchor="w")

        scrollbar = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        
        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        self.tree.bind("<space>", self.toggle_selection)
        self.tree.bind("<Double-1>", self.toggle_selection)

        # 4. شريط الإجراءات والرفع إلى Firebase
        action_frame = ttk.LabelFrame(self.root, text=ar(" 🚀 التحكم، الفحص، والنشر المباشر لمنصة الباسم سات "), padding=10)
        action_frame.pack(fill="x", padx=10, pady=5)

        ttk.Label(action_frame, text=ar("نشر تحت قسم رئيسي:")).grid(row=0, column=0, sticky="w", padx=5)
        self.target_cat_var = tk.StringVar(value="IPTV")
        ttk.Entry(action_frame, textvariable=self.target_cat_var, width=25).grid(row=0, column=1, padx=5, pady=2)

        btn_row = ttk.Frame(action_frame)
        btn_row.grid(row=1, column=0, columnspan=4, pady=8, sticky="ew")

        ttk.Button(btn_row, text=ar("تحديد الكل [✓]"), command=lambda: self.set_all_selection(True)).pack(side="left", padx=4)
        ttk.Button(btn_row, text=ar("إلغاء التحديد [✗]"), command=lambda: self.set_all_selection(False)).pack(side="left", padx=4)
        ttk.Button(btn_row, text=ar("⚡ تحديد الشغال فقط [✅]"), command=self.select_working_only).pack(side="left", padx=4)
        ttk.Button(btn_row, text=ar("🚀 فحص فائق السرعة"), command=self.check_selected_health_fast).pack(side="left", padx=4)
        
        self.upload_btn = ttk.Button(btn_row, text=ar("🔥 رفع المحددة إلى الباسم سات فوراً"), command=self.upload_to_firebase_thread)
        self.upload_btn.pack(side="right", padx=10)

        self.status_bar = ttk.Label(self.root, text=ar("جاهز للعمل.."), relief="sunken", anchor="w", padding=4)
        self.status_bar.pack(fill="x", side="bottom")

    def on_preset_change(self, event=None):
        choice = self.preset_combo.get()
        if choice in self.preset_map:
            self.url_var.set(self.preset_map[choice])

    def load_from_url_thread(self):
        url = self.url_var.get().strip()
        if not url:
            messagebox.showwarning(ar("تنبيه"), ar("يرجى إدخال رابط صالح أولاً"))
            return
        threading.Thread(target=self._load_url_worker, args=(url,), daemon=True).start()

    def _load_url_worker(self, url):
        self.status_bar.config(text=ar("جاري جلب القنوات من الرابط..."))
        try:
            r = requests.get(url, timeout=15)
            r.raise_for_status()
            self._parse_m3u(r.text)
            self.root.after(0, lambda: self.status_bar.config(text=ar(f"تم جلب {len(self.channels_data)} قناة بنجاح!")))
        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror(ar("خطأ في التحميل"), f"{e}"))
            self.root.after(0, lambda: self.status_bar.config(text=ar("فشل الجلب.")))

    def load_from_file(self):
        fpath = filedialog.askopenfilename(filetypes=[("M3U Files", "*.m3u;*.m3u8"), ("All Files", "*.*")])
        if fpath:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            self._parse_m3u(content)
            self.status_bar.config(text=ar(f"تم تحميل {len(self.channels_data)} قناة من الملف."))

    def _parse_m3u(self, text):
        self.channels_data = []
        lines = text.strip().splitlines()
        current_meta = None
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
                group = smart_subcat(raw_group)

                current_meta = {
                    "name": channel_name,
                    "logo": logo,
                    "group": group,
                    "selected": True,
                    "status": "غير مفحوص"
                }
            elif line.startswith("#"):
                continue
            else:
                if current_meta:
                    current_meta["url"] = line
                    self.channels_data.append(current_meta)
                    current_meta = None

        self.root.after(0, self._update_ui_after_parse)

    def _update_ui_after_parse(self):
        raw_groups = sorted(list(set(c["group"] for c in self.channels_data)))
        self.category_filter["values"] = [ar("الكل")] + [ar(g) for g in raw_groups]
        self.category_filter.current(0)
        self.apply_filter()

    def apply_filter(self):
        query = self.search_var.get().strip().lower()
        selected_grp = self.category_filter.get()

        self.tree.delete(*self.tree.get_children())
        self.filtered_data = []

        for item in self.channels_data:
            match_query = query in item["name"].lower() or query in item["url"].lower()
            match_group = (selected_grp == ar("الكل") or ar(item["group"]) == selected_grp)

            if match_query and match_group:
                self.filtered_data.append(item)
                sel_text = "☑" if item["selected"] else "☐"
                self.tree.insert("", "end", values=(
                    sel_text,
                    ar(item["name"]),
                    ar(item["group"]),
                    ar(item["status"]),
                    item["url"]
                ))

        self.count_label.config(text=ar(f"القنوات المعروضة: {len(self.filtered_data)} من أصل {len(self.channels_data)}"))

    def toggle_selection(self, event=None):
        selected_items = self.tree.selection()
        for iid in selected_items:
            idx = self.tree.index(iid)
            if idx < len(self.filtered_data):
                item = self.filtered_data[idx]
                item["selected"] = not item["selected"]
                self.tree.set(iid, column="select", value="☑" if item["selected"] else "☐")

    def set_all_selection(self, state):
        for item in self.filtered_data:
            item["selected"] = state
        for iid in self.tree.get_children():
            self.tree.set(iid, column="select", value="☑" if state else "☐")

    def select_working_only(self):
        count = 0
        for item in self.channels_data:
            if "شغال" in str(item.get("status", "")):
                item["selected"] = True
                count += 1
            else:
                item["selected"] = False
        self.apply_filter()
        self.status_bar.config(text=ar(f"تم تحديد {count} قناة شغالة فقط!"))

    def check_selected_health_fast(self):
        selected = [c for c in self.channels_data if c["selected"]]
        if not selected:
            selected = self.filtered_data
            for item in selected:
                item["selected"] = True

        if not selected:
            messagebox.showinfo(ar("تنبيه"), ar("لا توجد قنوات لفحصها."))
            return

        threading.Thread(target=self._fast_health_worker, args=(selected,), daemon=True).start()

    def _fast_health_worker(self, channels):
        self.status_bar.config(text=ar(f"جاري فحص {len(channels)} قناة بسرعة فائقة (25 مسار)..."))
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

        def _check_single(item):
            try:
                res = requests.head(item["url"], headers=headers, timeout=3, allow_redirects=True)
                if res.status_code in [200, 206, 302]:
                    item["status"] = "شغال ✅"
                    item["selected"] = True
                else:
                    item["status"] = f"خطأ {res.status_code}"
                    item["selected"] = False
            except Exception:
                item["status"] = "ميت ❌"
                item["selected"] = False

        with ThreadPoolExecutor(max_workers=25) as executor:
            list(executor.map(_check_single, channels))

        self.root.after(0, self.apply_filter)
        working_count = sum(1 for c in channels if "شغال" in c.get("status", ""))
        self.root.after(0, lambda: self.status_bar.config(
            text=ar(f"اكتمل الفحص الصاروخي! شغال: {working_count} | تم تحديد الشغال فقط تلقائياً!")
        ))

    def get_firebase_token(self):
        if not FIREBASE_API_KEY or not CONFIG_PASSWORD:
            return None
        auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        payload = {"email": CONFIG_EMAIL, "password": CONFIG_PASSWORD, "returnSecureToken": True}
        try:
            res = requests.post(auth_url, json=payload, timeout=8)
            data = res.json()
            return data.get("idToken")
        except Exception:
            return None

    def upload_to_firebase_thread(self):
        selected = [c for c in self.channels_data if c["selected"]]
        if not selected:
            messagebox.showwarning(ar("تنبيه"), ar("لم يتم تحديد أي قناة شغالة لنشرها!"))
            return

        target_area = self.target_cat_var.get().strip() or "IPTV"
        if not messagebox.askyesno(ar("تأكيد النشر"), ar(f"سيتم رفع {len(selected)} قناة شغالة ومفروزة إلى قسم [{target_area}]. متابعة؟")):
            return

        threading.Thread(target=self._upload_worker, args=(target_area, selected), daemon=True).start()

    def _upload_worker(self, target_area, channels):
        self.status_bar.config(text=ar("جاري التحقق من صلاحية الأدمن وتوليد التوكن..."))
        token = self.get_firebase_token()
        if not token:
            self.root.after(0, lambda: messagebox.showerror(ar("خطأ دخول"), ar("فشل تسجيل الدخول للفايربيس! تأكد من config.json")))
            self.root.after(0, lambda: self.status_bar.config(text=ar("فشل المصادقة.")))
            return

        self.status_bar.config(text=ar("جاري ضخ القنوات المفرودة إلى منصة الباسم سات..."))
        push_url = f"{DB_URL}?auth={token}"
        success_count = 0

        for c in channels:
            payload = {
                "title": c["name"],
                "area": target_area,
                "category": c.get("group", "مشكّل ومنوعات"),
                "subCategory": c.get("group", "مشكّل ومنوعات"),
                "url": c["url"],
                "type": "hls",
                "status": "active",
                "logo": c.get("logo", "")
            }
            try:
                res = requests.post(push_url, json=payload, timeout=8)
                if res.status_code == 200:
                    success_count += 1
            except Exception as e:
                print(f"Error uploading {c['name']}: {e}")

        msg = ar(f"تم بنجاح رفع {success_count} قناة شغالة ومفروزة إلى منصة الباسم سات!")
        self.root.after(0, lambda: messagebox.showinfo(ar("اكتمل الرفع والفرز"), msg))
        self.root.after(0, lambda: self.status_bar.config(text=msg))

if __name__ == "__main__":
    root = tk.Tk()
    app = AlbasemImporterApp(root)
    root.mainloop()
