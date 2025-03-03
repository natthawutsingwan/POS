# app.py
from flask import Flask, render_template, request, jsonify
import os

app = Flask(__name__)

# เก็บข้อมูลสินค้าบนเซิร์ฟเวอร์
items_storage = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/calculate', methods=['POST'])
def calculate():
    try:
        data = request.json
        items = data.get('items', [])

        # บันทึกข้อมูลสินค้าไปยัง storage
        items_storage.extend(items)

        # ตรวจสอบและคำนวณราคารวม
        total = sum(float(item['price']) * int(item['quantity']) for item in items if 'price' in item and 'quantity' in item)

        return jsonify({"total": total, "stored_items": items_storage})
    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == '__main__':
    # ปิดการใช้งาน debug เพื่อลดปัญหา _multiprocessing
    app.run(debug=False, host='0.0.0.0', port=5000)






import requests
from bs4 import BeautifulSoup
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# 1. ดึงข้อมูลจากหน้าเว็บ
url = 'https://example.com'
response = requests.get(url)
soup = BeautifulSoup(response.text, 'html.parser')

# 2. ค้นหาข้อมูลที่ต้องการ (ตัวอย่าง: ดึงหัวข้อข่าว)
data = []
for item in soup.find_all('h2'):
    title = item.text.strip()
    data.append([title])

# 3. เชื่อมต่อกับ Google Sheets
scope = ["AKfycbz2Zl-dTf84GSjFHAZpygE9mnApwu9SPq4Kjum70SET"]
creds = ServiceAccountCredentials.from_json_keyfile_name('credentials.json', scope)
client = gspread.authorize(creds)

# 4. เปิดชีตและเพิ่มข้อมูล
spreadsheet = client.open('My Web Scraper')  # ชื่อ Google Sheets
worksheet = spreadsheet.sheet1  # เลือกชีตแรก

# 5. เขียนข้อมูลลงใน Google Sheets
worksheet.append_rows(data)
print('✅ บันทึกข้อมูลเสร็จเรียบร้อย!')
