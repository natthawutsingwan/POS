
        function addItem() {
            const item = document.createElement('div');
            item.innerHTML = `
                <label>สินค้า: <input type="text" class="name"></label>
                <label>ราคา: <input type="number" class="price" step="0.01"></label>
                <label>จำนวน: <input type="number" class="quantity" value="1"></label>
                <button onclick="removeItem(this)">ลบ</button>
            `;
            document.getElementById('items').appendChild(item);
        }

        function removeItem(button) {
            button.parentElement.remove();
        }

        async function calculateTotal() {
            const items = Array.from(document.querySelectorAll('#items div')).map(div => ({
                name: div.querySelector('.name').value,
                price: parseFloat(div.querySelector('.price').value),
                quantity: parseInt(div.querySelector('.quantity').value),
            })).filter(item => item.name && !isNaN(item.price) && !isNaN(item.quantity));

            const response = await fetch('/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });

            const result = await response.json();
            document.getElementById('total').textContent = `ราคารวม: ${result.total} บาท`;
        }
        function displayProducts() {
            const productList = document.getElementById('product-list');
            productList.innerHTML = products.map((product, index) => `
                <div class="product-item">
                    <img src="${product.image}" alt="${product.name}">
                    <p>${product.name}</p>
                    <p>ราคา: ${product.price} บาท</p>
                    <button onclick="addProductToCart(${index})">เลือกสินค้า</button>
                </div>
            `).join('');
        }

        function addProductToCart(index) {
            const product = products[index];
            const item = document.createElement('div');
            item.innerHTML = `
                <label>สินค้า: <input type="text" class="name" value="${product.name}" readonly></label>
                <label>ราคา: <input type="number" class="price" value="${product.price}" readonly></label>
                <label>จำนวน: <input type="number" class="quantity" value="1" min="1" required oninput="updateTotal()"></label>
                <button onclick="removeItem(this)">ลบ</button>
            `;
            document.getElementById('items').appendChild(item);
            updateTotal();
        }

        function addItem() {
            const item = document.createElement('div');
            item.innerHTML = `
                <label>สินค้า: <input type="text" class="name" required></label>
                <label>ราคา: <input type="number" class="price" step="0.01" min="0" required></label>
                <label>จำนวน: <input type="number" class="quantity" value="1" min="1" required oninput="updateTotal()"></label>
                <button onclick="removeItem(this)">ลบ</button>
            `;
            document.getElementById('items').appendChild(item);
            updateTotal();
        }

        function removeItem(button) {
            button.parentElement.remove();
            updateTotal();
        }

        function updateTotal() {
            const items = Array.from(document.querySelectorAll('#items div'));
            const total = items.reduce((sum, div) => {
                const price = parseFloat(div.querySelector('.price').value) || 0;
                const quantity = parseInt(div.querySelector('.quantity').value) || 0;
                return sum + (price * quantity);
            }, 0);

            document.getElementById('total').textContent = `ราคารวม: ${total.toFixed(2)} บาท`;
        }

        function calculateTotal() {
            updateTotal();

            const items = Array.from(document.querySelectorAll('#items div'));
            const receiptItems = document.getElementById('receipt-items');
            receiptItems.innerHTML = items.map(div => {
                const name = div.querySelector('.name').value;
                const price = div.querySelector('.price').value;
                const quantity = div.querySelector('.quantity').value;
                return `<p>${name} - ${quantity} x ${price} บาท</p>`;
            }).join('');

            const total = parseFloat(document.getElementById('total').textContent.replace('ราคารวม: ', '').replace(' บาท', ''));
            const payment = parseFloat(prompt(`รวมทั้งหมด: ${total.toFixed(2)} บาท\nกรุณาใส่จำนวนเงินที่รับ:`)) || 0;
            const change = payment - total;

            if (payment >= total) {
                document.getElementById('receipt-payment').textContent = `จำนวนเงินที่รับ: ${payment.toFixed(2)} บาท`;
                document.getElementById('receipt-change').textContent = `เงินทอน: ${change.toFixed(2)} บาท`;
                document.getElementById('receipt').style.display = 'block';
                window.print();
                location.reload();
            } else {
                alert("จำนวนเงินไม่เพียงพอ!");
            }
        }

        window.onload = displayProducts;
        // เพิ่มฟังก์ชันบันทึกข้อมูลลง Google Sheets
function saveToGoogleSheet(items, total, payment, change) {
    const url = 'https://docs.google.com/spreadsheets/d/16WGajWX_j913yEZvCEoOnCr8mnM5qbfPOJXZk37pSBU/edit?gid=0#gid=0'; // ใส่ URL ของ Web App จาก Google Apps Script

    const payload = {
        items: items.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity
        })),
        total: total,
        payment: payment,
        change: change,
        timestamp: new Date().toISOString()
    };

    fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => console.log('ข้อมูลถูกบันทึกเรียบร้อยแล้ว'))
    .catch(error => console.error('เกิดข้อผิดพลาดในการบันทึก:', error));
}

// เรียกใช้ฟังก์ชันนี้หลังจากการชำระเงินสำเร็จ
function saveTransaction() {
    const items = Array.from(document.querySelectorAll('#items div')).map(div => {
        return {
            name: div.querySelector('.name').value,
            price: parseFloat(div.querySelector('.price').value),
            quantity: parseInt(div.querySelector('.quantity').value)
        };
    });

    const total = parseFloat(document.getElementById('total').textContent.replace('ราคารวม: ', '').replace(' บาท', ''));
    const payment = parseFloat(prompt(`รวมทั้งหมด: ${total.toFixed(2)} บาท\nกรุณาใส่จำนวนเงินที่รับ:`)) || 0;
    const change = payment - total;

    if (payment >= total) {
        saveToGoogleSheet(items, total, payment, change);
        alert('บันทึกข้อมูลเรียบร้อยแล้ว');
    } else {
        alert('จำนวนเงินไม่เพียงพอ!');
    }
}

// แก้ไขให้เรียกใช้ saveTransaction() แทน location.reload() หลังจากการชำระเงิน
