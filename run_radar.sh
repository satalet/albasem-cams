#!/bin/bash
clear
echo "================================================================="
echo "        📡 رادار الباسم سات - القنص الذاتي الشامل 📡             "
echo "================================================================="
echo ""
read -p "🔗 الصق رابط صفحة الكاميرا: " TARGET_URL

if [ -z "$TARGET_URL" ]; then
    echo -e "\n❌ لم يتم إدخال رابط! تم إلغاء العملية."
    read -p "اضغط Enter للإغلاق..."
    exit 1
fi

echo ""
read -p "📁 اسم القسم (اضغط Enter ليستخرجه السكريبت ويفتح فولدره تلقائياً): " TARGET_AREA

echo ""
read -p "✏️ اسم القناة (اضغط Enter لسحب الاسم الرسمي الأصلي من الموقع): " CUSTOM_TITLE

echo ""
echo "⏳ جاري تشغيل الرادار وفك عناصر الصفحة..."
echo "-----------------------------------------------------------------"

CMD="python3 /home/kali/albasem-cams/smart_sniff.py \"$TARGET_URL\""

if [ -n "$TARGET_AREA" ]; then
    CMD="$CMD \"$TARGET_AREA\""
fi

if [ -n "$CUSTOM_TITLE" ]; then
    CMD="$CMD -t \"$CUSTOM_TITLE\""
fi

eval $CMD

echo "-----------------------------------------------------------------"
echo "✔ انتهت المهمة بنجاح!"
read -p "اضغط Enter للإغلاق..."
