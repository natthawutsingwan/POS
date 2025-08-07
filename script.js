// Global variables
        let products = [];
        let cart = [];
        let salesHistory = [];
        let receiptCounter = parseInt(localStorage.getItem('pos-receipt-counter')) || 1;
        let settings = JSON.parse(localStorage.getItem('pos-settings')) || {
            shopName: 'CCKC',
            shopAddress: '123 สันทราย เชียงใหม่',
            shopPhone: '02-123-4567',
            shopTax: '1234567890123',
            password: 'Pass1234',
            sheetsEnabled: false,
            spreadsheetId: '',
            apiKey: '',
            productsSheet: 'Products',
            historySheet: 'Sales'
        };

        // Google Sheets integration with your Apps Script URL
        let isOnline = false;
        const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6XGG25-AXbZl9DKF3_LMlvLEG5rLLb8qKX3U_CF3TNGrOQ7WCGGfL_SNcbcI_hgFsMQ/exec';

        // Initialize app
        document.addEventListener('DOMContentLoaded', function() {
            showPage('sales');
            loadInitialData();
            loadSettings();
            checkConnection();
            
            // Event listeners
            document.getElementById('product-search').addEventListener('input', searchProducts);
            document.getElementById('cash-received').addEventListener('input', calculateChange);
            document.getElementById('payment-method').addEventListener('change', togglePaymentMethod);
            
            // Enter key support
            document.getElementById('stock-password').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') checkStockPassword();
            });
            
            document.getElementById('cash-received').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') processPayment();
            });
            
            // Auto-sync every 5 minutes if online
            setInterval(() => {
                if (isOnline) {
                    syncWithGoogleSheets(true); // Silent sync
                }
            }, 300000);
            
            // Initial sync after 2 seconds
            setTimeout(() => {
                syncWithGoogleSheets(true);
            }, 2000);
        });

        // Google Apps Script Integration Functions
        async function syncWithGoogleSheets(silent = false) {
            if (!GOOGLE_APPS_SCRIPT_URL) {
                console.log('Google Apps Script URL not configured');
                return false;
            }
            
            try {
                // Test connection with proper CORS handling
                const testResponse = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'cors',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'test'
                    })
                });
                
                if (!testResponse.ok) {
                    throw new Error(`HTTP ${testResponse.status}: ${testResponse.statusText}`);
                }
                
                const testResult = await testResponse.json();
                
                if (testResult.success) {
                    updateConnectionStatus(true);
                    if (!silent) {
                        console.log('✅ เชื่อมต่อ Google Sheets สำเร็จ');
                    }
                    
                    // Sync products
                    await syncProductsToGoogleSheets(silent);
                    
                    // Sync sales history
                    await syncSalesHistoryToGoogleSheets(silent);
                    
                    return true;
                } else {
                    updateConnectionStatus(false);
                    if (!silent) {
                        console.error('❌ เชื่อมต่อ Google Sheets ไม่สำเร็จ:', testResult.error || 'Unknown error');
                    }
                    return false;
                }
            } catch (error) {
                updateConnectionStatus(false);
                if (!silent) {
                    console.error('เกิดข้อผิดพลาดในการเชื่อมต่อ:', error.message);
                }
                return false;
            }
        }

        async function syncProductsToGoogleSheets(silent = false) {
            if (!silent) {
                document.getElementById('sync-status').innerHTML = 
                    '<span class="text-blue-600">🔄 กำลังซิงค์ข้อมูลสินค้า...</span>';
            }
            
            try {
                // Send all products at once for better performance
                const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'syncProducts',
                        products: products
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                if (result.success) {
                    if (!silent) {
                        console.log(`✅ ซิงค์สินค้า ${products.length} รายการสำเร็จ`);
                    }
                    return true;
                } else {
                    throw new Error(result.error || 'Sync failed');
                }
            } catch (error) {
                if (!silent) {
                    console.error('❌ ซิงค์สินค้าไม่สำเร็จ:', error);
                    document.getElementById('sync-status').innerHTML = 
                        `<span class="text-red-600">❌ ซิงค์สินค้าไม่สำเร็จ: ${error.message}</span>`;
                }
                return false;
            }
        }

        async function syncSalesHistoryToGoogleSheets(silent = false) {
            if (!silent) {
                document.getElementById('sync-status').innerHTML = 
                    '<span class="text-blue-600">🔄 กำลังซิงค์ประวัติการขาย...</span>';
            }
            
            try {
                // Prepare sales data for batch sync
                const salesData = salesHistory.map(sale => ({
                    id: sale.id,
                    date: sale.date,
                    items: sale.items.map(item => `${item.name}(${item.quantity})`).join(';'),
                    total: sale.total,
                    paymentMethod: sale.paymentMethod === 'cash' ? 'เงินสด' : 'QR Code',
                    received: sale.received || sale.total,
                    change: sale.change || 0
                }));
                
                const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'syncSales',
                        sales: salesData
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                if (result.success) {
                    if (!silent) {
                        console.log(`✅ ซิงค์ประวัติการขาย ${salesHistory.length} รายการสำเร็จ`);
                    }
                    return true;
                } else {
                    throw new Error(result.error || 'Sync failed');
                }
            } catch (error) {
                if (!silent) {
                    console.error('❌ ซิงค์ประวัติการขายไม่สำเร็จ:', error);
                    document.getElementById('sync-status').innerHTML = 
                        `<span class="text-red-600">❌ ซิงค์ประวัติการขายไม่สำเร็จ: ${error.message}</span>`;
                }
                return false;
            }
        }

        async function getDailyReportFromGoogleSheets(date = null) {
            try {
                const url = `${GOOGLE_APPS_SCRIPT_URL}?action=getDailyReport${date ? `&date=${date}` : ''}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.success) {
                    return result.data;
                } else {
                    throw new Error(result.error || 'Failed to get daily report');
                }
            } catch (error) {
                console.error('เกิดข้อผิดพลาดในการดึงรายงาน:', error);
                return null;
            }
        }

        async function getTopSellingProductsFromGoogleSheets(days = 7) {
            try {
                const url = `${GOOGLE_APPS_SCRIPT_URL}?action=getTopProducts&days=${days}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.success) {
                    return result.data;
                } else {
                    throw new Error(result.error || 'Failed to get top products');
                }
            } catch (error) {
                console.error('เกิดข้อผิดพลาดในการดึงสินค้าขายดี:', error);
                return null;
            }
        }

        // New function to load products from Google Sheets
        async function loadProductsFromGoogleSheets(silent = false) {
            try {
                if (!silent) {
                    document.getElementById('sync-status').innerHTML = 
                        '<span class="text-blue-600">🔄 กำลังโหลดสินค้าจาก Google Sheets...</span>';
                }
                
                const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getProducts`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.success && result.data && result.data.length > 0) {
                    // Update local products with data from Google Sheets
                    products = result.data.map(item => ({
                        id: item.id || Date.now() + Math.random(),
                        name: item.name || item.ชื่อสินค้า || '',
                        code: item.code || item.รหัสสินค้า || '',
                        price: parseFloat(item.price || item.ราคา || 0),
                        stock: parseInt(item.stock || item.สต็อก || 0),
                        image: item.image || '📦'
                    })).filter(product => product.name && product.code);
                    
                    localStorage.setItem('pos-products', JSON.stringify(products));
                    loadProducts();
                    
                    if (!silent) {
                        document.getElementById('sync-status').innerHTML = 
                            `<span class="text-green-600">✅ โหลดสินค้า ${products.length} รายการจาก Google Sheets สำเร็จ</span>`;
                    }
                    return true;
                } else {
                    if (!silent) {
                        document.getElementById('sync-status').innerHTML = 
                            '<span class="text-yellow-600">⚠️ ไม่พบข้อมูลสินค้าใน Google Sheets</span>';
                    }
                    return false;
                }
            } catch (error) {
                if (!silent) {
                    console.error('เกิดข้อผิดพลาดในการโหลดสินค้า:', error);
                    document.getElementById('sync-status').innerHTML = 
                        `<span class="text-red-600">❌ โหลดสินค้าไม่สำเร็จ: ${error.message}</span>`;
                }
                return false;
            }
        }

        // New function to backup data to Google Sheets
        async function backupToGoogleSheets() {
            try {
                document.getElementById('sync-status').innerHTML = 
                    '<span class="text-blue-600">🔄 กำลังสำรองข้อมูลไป Google Sheets...</span>';
                
                const backupData = {
                    products: products,
                    salesHistory: salesHistory.map(sale => ({
                        id: sale.id,
                        date: sale.date,
                        items: sale.items.map(item => `${item.name}(${item.quantity})`).join(';'),
                        total: sale.total,
                        paymentMethod: sale.paymentMethod === 'cash' ? 'เงินสด' : 'QR Code',
                        received: sale.received || sale.total,
                        change: sale.change || 0
                    })),
                    settings: {
                        shopName: settings.shopName,
                        shopAddress: settings.shopAddress,
                        shopPhone: settings.shopPhone,
                        shopTax: settings.shopTax
                    },
                    timestamp: new Date().toISOString()
                };
                
                const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'backup',
                        data: backupData
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('sync-status').innerHTML = 
                        '<span class="text-green-600">✅ สำรองข้อมูลไป Google Sheets สำเร็จ</span>';
                    return true;
                } else {
                    throw new Error(result.error || 'Backup failed');
                }
            } catch (error) {
                console.error('เกิดข้อผิดพลาดในการสำรองข้อมูล:', error);
                document.getElementById('sync-status').innerHTML = 
                    `<span class="text-red-600">❌ สำรองข้อมูลไม่สำเร็จ: ${error.message}</span>`;
                return false;
            }
        }

        // Modal functions
        let paymentModalTimer = null;
        
        function showModal(type, title, message, callback = null, showPrintButton = false) {
            const modal = document.getElementById('custom-modal');
            const icon = document.getElementById('modal-icon');
            const titleEl = document.getElementById('modal-title');
            const messageEl = document.getElementById('modal-message');
            const buttonsContainer = document.getElementById('modal-buttons');
            
            // Set content
            titleEl.textContent = title;
            messageEl.innerHTML = message;
            
            // Clear existing buttons
            buttonsContainer.innerHTML = '';
            
            // Set icon based on type
            switch(type) {
                case 'success':
                    icon.textContent = '✅';
                    break;
                case 'error':
                    icon.textContent = '❌';
                    break;
                case 'warning':
                    icon.textContent = '⚠️';
                    break;
                case 'info':
                    icon.textContent = 'ℹ️';
                    break;
                case 'loading':
                    icon.innerHTML = '<div class="loading-spinner"></div>';
                    break;
                default:
                    icon.textContent = '✅';
            }
            
            // Create buttons based on type and options
            if (type === 'loading') {
                // No buttons for loading
            } else if (showPrintButton) {
                // Payment success modal with two buttons
                const okButton = document.createElement('button');
                okButton.className = 'modal-button success';
                okButton.textContent = '✅ ตกลง';
                okButton.onclick = () => closeModal();
                
                const printButton = document.createElement('button');
                printButton.className = 'modal-button';
                printButton.style.background = '#3b82f6';
                printButton.textContent = '🖨️ พิมพ์ใบเสร็จ';
                printButton.onclick = () => {
                    closeModal();
                    if (callback) callback();
                };
                
                buttonsContainer.appendChild(okButton);
                buttonsContainer.appendChild(printButton);
            } else {
                // Single button modal
                const button = document.createElement('button');
                button.className = 'modal-button';
                button.textContent = 'ตกลง';
                button.onclick = () => {
                    closeModal();
                    if (callback) callback();
                };
                
                // Style button based on type
                switch(type) {
                    case 'success':
                        button.classList.add('success');
                        break;
                    case 'error':
                        button.classList.add('error');
                        break;
                    case 'warning':
                        button.classList.add('warning');
                        break;
                    default:
                        button.classList.add('success');
                }
                
                buttonsContainer.appendChild(button);
            }
            
            // Show modal
            modal.classList.add('show');
            
            // Auto-close for loading type
            if (type === 'loading') {
                setTimeout(() => {
                    closeModal();
                }, 800000);
            }
        }

        function showPaymentSuccessModal(title, message, receipt) {
            const modal = document.getElementById('custom-modal');
            const icon = document.getElementById('modal-icon');
            const titleEl = document.getElementById('modal-title');
            const messageEl = document.getElementById('modal-message');
            const buttonsContainer = document.getElementById('modal-buttons');
            
            // Clear any existing timer
            if (paymentModalTimer) {
                clearTimeout(paymentModalTimer);
                paymentModalTimer = null;
            }
            
            // Set content
            titleEl.textContent = title;
            messageEl.innerHTML = message + '<br><br><div id="countdown-timer" style="color: #6b7280; font-size: 14px;">ป็อปอัปจะปิดอัตโนมัติใน <span id="countdown-seconds">600</span> วินาที</div>';
            icon.textContent = '✅';
            
            // Clear existing buttons
            buttonsContainer.innerHTML = '';
            
            // Create buttons
            const okButton = document.createElement('button');
            okButton.className = 'modal-button success';
            okButton.textContent = '✅ ตกลง';
            okButton.onclick = () => {
                if (paymentModalTimer) {
                    clearTimeout(paymentModalTimer);
                    paymentModalTimer = null;
                }
                closeModal();
            };
            
            const printButton = document.createElement('button');
            printButton.className = 'modal-button';
            printButton.style.background = '#3b82f6';
            printButton.textContent = '🖨️ พิมพ์ใบเสร็จ';
            printButton.onclick = () => {
                if (paymentModalTimer) {
                    clearTimeout(paymentModalTimer);
                    paymentModalTimer = null;
                }
                closeModal();
                printReceipt(receipt);
            };
            
            buttonsContainer.appendChild(okButton);
            buttonsContainer.appendChild(printButton);
            
            // Show modal
            modal.classList.add('show');
            
            // Start countdown timer
            let secondsLeft = 600; // 10 minutes = 600 seconds
            const countdownElement = document.getElementById('countdown-seconds');
            
            const countdownInterval = setInterval(() => {
                secondsLeft--;
                if (countdownElement) {
                    countdownElement.textContent = secondsLeft;
                }
                
                if (secondsLeft <= 0) {
                    clearInterval(countdownInterval);
                    closeModal();
                }
            }, 500);
            
            // Set auto-close timer for 10 minutes
            paymentModalTimer = setTimeout(() => {
                clearInterval(countdownInterval);
                closeModal();
                paymentModalTimer = null;
            }, 600000); // 10 minutes = 600,000 milliseconds
        }

        function closeModal() {
            const modal = document.getElementById('custom-modal');
            modal.classList.remove('show');
        }

        function showLoadingModal(message) {
            showModal('loading', 'กำลังดำเนินการ...', message);
        }

        function showSuccessModal(title, message, callback = null) {
            showModal('success', title, message, callback);
        }

        function showErrorModal(title, message, callback = null) {
            showModal('error', title, message, callback);
        }

        function showWarningModal(title, message, callback = null) {
            showModal('warning', title, message, callback);
        }

        // Load initial data
        function loadInitialData() {
            // Load from localStorage first
            const localProducts = JSON.parse(localStorage.getItem('pos-products'));
            const localHistory = JSON.parse(localStorage.getItem('pos-history'));
            
            if (localProducts && localProducts.length > 0) {
                products = localProducts;
            } else {
                // Default products if no local data
                products = [
                    {id: 1, name: 'น้ำดื่ม', code: 'W001', price: 10, stock: 50, image: '💧'},
                    {id: 2, name: 'ขนมปัง', code: 'B001', price: 25, stock: 30, image: '🍞'},
                    {id: 3, name: 'กาแฟ', code: 'C001', price: 35, stock: 20, image: '☕'},
                    {id: 4, name: 'ลูกอม', code: 'S001', price: 5, stock: 100, image: '🍬'},
                    {id: 5, name: 'ขนมขบเคี้ยว', code: 'S002', price: 15, stock: 75, image: '🍿'},
                    {id: 6, name: 'น้ำอัดลม', code: 'D001', price: 20, stock: 40, image: '🥤'}
                ];
                localStorage.setItem('pos-products', JSON.stringify(products));
            }
            
            if (localHistory) {
                salesHistory = localHistory;
            } else {
                salesHistory = [];
            }
            
            loadProducts();
        }

        // Connection management
        function checkConnection() {
            syncWithGoogleSheets(true);
        }

        function updateConnectionStatus(online) {
            isOnline = online;
            const statusEl = document.getElementById('connection-status');
            
            if (online) {
                statusEl.textContent = '☁️ ออนไลน์';
                statusEl.className = 'connection-status online';
            } else {
                statusEl.textContent = '📡 ออฟไลน์';
                statusEl.className = 'connection-status offline';
            }
        }

        // Google Sheets functions
        function toggleSheetsIntegration() {
            const enabled = document.getElementById('enable-sheets').checked;
            const config = document.getElementById('sheets-config');
            
            if (enabled) {
                config.classList.remove('hidden');
            } else {
                config.classList.add('hidden');
                settings.sheetsEnabled = false;
                updateConnectionStatus(false);
            }
        }

        async function testConnection(silent = false) {
            try {
                if (!silent) {
                    document.getElementById('sync-status').innerHTML = 
                        '<span class="text-blue-600">🔄 กำลังทดสอบการเชื่อมต่อ...</span>';
                }
                
                const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'cors',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'test'
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const result = await response.json();
                
                if (result.success) {
                    updateConnectionStatus(true);
                    if (!silent) {
                        document.getElementById('sync-status').innerHTML = 
                            '<span class="text-green-600">✅ เชื่อมต่อ Google Apps Script สำเร็จ</span>';
                    }
                    return true;
                } else {
                    throw new Error(result.error || 'Connection failed');
                }
            } catch (error) {
                updateConnectionStatus(false);
                if (!silent) {
                    let errorMessage = error.message;
                    if (error.message.includes('Failed to fetch')) {
                        errorMessage = 'ไม่สามารถเชื่อมต่อได้ - ตรวจสอบ URL หรือสิทธิ์การเข้าถึง';
                    } else if (error.message.includes('CORS')) {
                        errorMessage = 'ปัญหา CORS - ตรวจสอบการตั้งค่า Google Apps Script';
                    }
                    document.getElementById('sync-status').innerHTML = 
                        `<span class="text-red-600">❌ เชื่อมต่อไม่สำเร็จ: ${errorMessage}</span>`;
                }
                return false;
            }
        }

        // Simple connection test function
        async function testSimpleConnection() {
            document.getElementById('sync-status').innerHTML = 
                '<span class="text-blue-600">🔄 กำลังทดสอบการเชื่อมต่อแบบง่าย...</span>';
            
            try {
                // Try simple GET request first
                const response = await fetch(GOOGLE_APPS_SCRIPT_URL);
                
                if (response.ok) {
                    const text = await response.text();
                    document.getElementById('sync-status').innerHTML = 
                        `<span class="text-green-600">✅ เชื่อมต่อสำเร็จ! Response: ${text.substring(0, 100)}...</span>`;
                    updateConnectionStatus(true);
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                document.getElementById('sync-status').innerHTML = 
                    `<span class="text-red-600">❌ เชื่อมต่อไม่สำเร็จ: ${error.message}</span>`;
                updateConnectionStatus(false);
            }
        }

        // Open Google Apps Script in new tab
        function openGoogleAppsScript() {
            const scriptId = '1pGOWYeum1jLO5gpvr9u3jYzC2b0M4bCcnFLphjuJLW8';
            const url = `https://script.google.com/d/${scriptId}/edit`;
            window.open(url, '_blank');
        }

        async function syncData(silent = false) {
            if (!GOOGLE_APPS_SCRIPT_URL) {
                if (!silent) {
                    showErrorModal('ไม่พบ Google Apps Script URL', 'กรุณาตรวจสอบการตั้งค่า Google Apps Script');
                }
                return;
            }
            
            if (!silent) {
                document.getElementById('sync-status').innerHTML = 
                    '<span class="text-blue-600">🔄 กำลังซิงค์ข้อมูลทั้งหมด...</span>';
            }
            
            try {
                // Test connection first
                const connectionTest = await testConnection(true);
                if (!connectionTest) {
                    throw new Error('ไม่สามารถเชื่อมต่อ Google Apps Script ได้');
                }
                
                // Sync products
                const productSync = await syncProductsToGoogleSheets(true);
                
                // Sync sales history
                const salesSync = await syncSalesHistoryToGoogleSheets(true);
                
                if (productSync && salesSync) {
                    if (!silent) {
                        document.getElementById('sync-status').innerHTML = 
                            '<span class="text-green-600">✅ ซิงค์ข้อมูลทั้งหมดสำเร็จ</span>';
                        showSuccessModal('ซิงค์ข้อมูลสำเร็จ! 🎉', 
                            `ซิงค์ข้อมูลไป Google Sheets เรียบร้อยแล้ว<br>` +
                            `• สินค้า: ${products.length} รายการ<br>` +
                            `• ประวัติการขาย: ${salesHistory.length} รายการ`);
                    }
                } else {
                    throw new Error('ซิงค์ข้อมูลบางส่วนไม่สำเร็จ');
                }
            } catch (error) {
                console.error('Sync error:', error);
                if (!silent) {
                    document.getElementById('sync-status').innerHTML = 
                        `<span class="text-red-600">❌ ซิงค์ข้อมูลไม่สำเร็จ: ${error.message}</span>`;
                    showErrorModal('ซิงค์ข้อมูลไม่สำเร็จ', error.message);
                }
            }
        }

        // Page navigation
        function showPage(pageId) {
            document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
            document.getElementById(pageId + '-page').classList.remove('hidden');
            
            // Update nav buttons
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('bg-blue-400'));
            event.target.classList.add('bg-blue-400');
            
            // Load page-specific data
            if (pageId === 'history') loadHistory();
            if (pageId === 'stock') document.getElementById('stock-login').classList.remove('hidden');
            if (pageId === 'settings') loadSheetsSettings();
        }

        // Product management
        function refreshProducts() {
            document.getElementById('loading-products').classList.remove('hidden');
            document.getElementById('product-grid').classList.add('hidden');
            
            setTimeout(() => {
                loadProducts();
                document.getElementById('loading-products').classList.add('hidden');
                document.getElementById('product-grid').classList.remove('hidden');
            }, 500);
        }

        function loadProducts() {
            const grid = document.getElementById('product-grid');
            grid.innerHTML = '';
            
            if (products.length === 0) {
                grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-8">ไม่มีสินค้าในระบบ</div>';
                return;
            }
            
            products.forEach(product => {
                const productCard = document.createElement('div');
                productCard.className = `bg-white p-4 rounded-xl border-2 hover:border-blue-300 hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105 ${product.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`;
                
                if (product.stock > 0) {
                    productCard.onclick = () => addToCart(product);
                }
                
                // Stock status styling
                let stockBadge = '';
                let stockColor = '';
                if (product.stock === 0) {
                    stockBadge = 'หมด';
                    stockColor = 'bg-red-100 text-red-800 border-red-200';
                } else if (product.stock <= 5) {
                    stockBadge = 'เหลือน้อย';
                    stockColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
                } else {
                    stockBadge = 'พร้อมขาย';
                    stockColor = 'bg-green-100 text-green-800 border-green-200';
                }
                
                productCard.innerHTML = `
                    <div class="relative">
                        <!-- Stock Status Badge -->
                        <div class="absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-semibold border ${stockColor}">
                            ${stockBadge}
                        </div>
                        
                        <!-- Product Image -->
                        <div class="text-center mb-3">
                            <div class="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center text-3xl mb-2 shadow-inner">
                                ${product.image}
                            </div>
                        </div>
                        
                        <!-- Product Info -->
                        <div class="text-center space-y-2">
                            <!-- Product Name -->
                            <h3 class="font-semibold text-gray-800 text-sm leading-tight min-h-[2.5rem] flex items-center justify-center">
                                ${product.name}
                            </h3>
                            
                            <!-- Product Code -->
                            <div class="bg-gray-100 rounded-md px-2 py-1">
                                <p class="text-xs text-gray-600 font-mono">${product.code}</p>
                            </div>
                            
                            <!-- Price -->
                            <div class="bg-blue-50 rounded-lg py-2">
                                <p class="text-xl font-bold text-blue-600">฿${product.price.toLocaleString()}</p>
                            </div>
                            
                            <!-- Stock Info -->
                            <div class="flex justify-between items-center text-xs">
                                <span class="text-gray-500">คงเหลือ:</span>
                                <span class="font-semibold ${product.stock > 5 ? 'text-green-600' : product.stock > 0 ? 'text-yellow-600' : 'text-red-600'}">
                                    ${product.stock} ชิ้น
                                </span>
                            </div>
                            
                            <!-- Add to Cart Button -->
                            ${product.stock > 0 ? `
                                <button class="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-xs font-semibold transition-colors duration-200 flex items-center justify-center space-x-1">
                                    <span>🛒</span>
                                    <span>เพิ่มลงตะกร้า</span>
                                </button>
                            ` : `
                                <button class="w-full mt-2 bg-gray-400 text-white py-2 px-3 rounded-lg text-xs font-semibold cursor-not-allowed">
                                    สินค้าหมด
                                </button>
                            `}
                        </div>
                    </div>
                `;
                
                grid.appendChild(productCard);
            });
        }

        function searchProducts() {
            const searchTerm = document.getElementById('product-search').value.toLowerCase();
            const grid = document.getElementById('product-grid');
            
            const filteredProducts = products.filter(product => 
                product.name.toLowerCase().includes(searchTerm) ||
                product.code.toLowerCase().includes(searchTerm)
            );
            
            grid.innerHTML = '';
            
            if (filteredProducts.length === 0) {
                grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-8">ไม่พบสินค้าที่ค้นหา</div>';
                return;
            }
            
            filteredProducts.forEach(product => {
                const productCard = document.createElement('div');
                productCard.className = `bg-white p-4 rounded-xl border-2 hover:border-blue-300 hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105 ${product.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`;
                
                if (product.stock > 0) {
                    productCard.onclick = () => addToCart(product);
                }
                
                // Stock status styling
                let stockBadge = '';
                let stockColor = '';
                if (product.stock === 0) {
                    stockBadge = 'หมด';
                    stockColor = 'bg-red-100 text-red-800 border-red-200';
                } else if (product.stock <= 5) {
                    stockBadge = 'เหลือน้อย';
                    stockColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
                } else {
                    stockBadge = 'พร้อมขาย';
                    stockColor = 'bg-green-100 text-green-800 border-green-200';
                }
                
                productCard.innerHTML = `
                    <div class="relative">
                        <!-- Stock Status Badge -->
                        <div class="absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-semibold border ${stockColor}">
                            ${stockBadge}
                        </div>
                        
                        <!-- Product Image -->
                        <div class="text-center mb-3">
                            <div class="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center text-3xl mb-2 shadow-inner">
                                ${product.image}
                            </div>
                        </div>
                        
                        <!-- Product Info -->
                        <div class="text-center space-y-2">
                            <!-- Product Name -->
                            <h3 class="font-semibold text-gray-800 text-sm leading-tight min-h-[2.5rem] flex items-center justify-center">
                                ${product.name}
                            </h3>
                            
                            <!-- Product Code -->
                            <div class="bg-gray-100 rounded-md px-2 py-1">
                                <p class="text-xs text-gray-600 font-mono">${product.code}</p>
                            </div>
                            
                            <!-- Price -->
                            <div class="bg-blue-50 rounded-lg py-2">
                                <p class="text-xl font-bold text-blue-600">฿${product.price.toLocaleString()}</p>
                            </div>
                            
                            <!-- Stock Info -->
                            <div class="flex justify-between items-center text-xs">
                                <span class="text-gray-500">คงเหลือ:</span>
                                <span class="font-semibold ${product.stock > 5 ? 'text-green-600' : product.stock > 0 ? 'text-yellow-600' : 'text-red-600'}">
                                    ${product.stock} ชิ้น
                                </span>
                            </div>
                            
                            <!-- Add to Cart Button -->
                            ${product.stock > 0 ? `
                                <button class="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-xs font-semibold transition-colors duration-200 flex items-center justify-center space-x-1">
                                    <span>🛒</span>
                                    <span>เพิ่มลงตะกร้า</span>
                                </button>
                            ` : `
                                <button class="w-full mt-2 bg-gray-400 text-white py-2 px-3 rounded-lg text-xs font-semibold cursor-not-allowed">
                                    สินค้าหมด
                                </button>
                            `}
                        </div>
                    </div>
                `;
                
                grid.appendChild(productCard);
            });
        }

        // Cart management
        function addToCart(product) {
            if (product.stock === 0) return;
            
            const existingItem = cart.find(item => item.id === product.id);
            if (existingItem) {
                if (existingItem.quantity < product.stock) {
                    existingItem.quantity++;
                }
            } else {
                cart.push({...product, quantity: 1});
            }
            
            updateCartDisplay();
        }

        function updateCartDisplay() {
            const cartItems = document.getElementById('cart-items');
            cartItems.innerHTML = '';
            
            if (cart.length === 0) {
                cartItems.innerHTML = '<div class="text-center text-gray-500 py-4">ตะกร้าว่าง</div>';
                document.getElementById('total-amount').textContent = '฿0.00';
                return;
            }
            
            let total = 0;
            
            cart.forEach((item, index) => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;
                
                const cartItem = document.createElement('div');
                cartItem.className = 'flex justify-between items-center p-2 bg-gray-50 rounded';
                cartItem.innerHTML = `
                    <div class="flex-1">
                        <div class="font-medium text-sm">${item.name}</div>
                        <div class="text-xs text-gray-600">฿${item.price} x ${item.quantity}</div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="changeQuantity(${index}, -1)" class="bg-red-500 text-white w-6 h-6 rounded text-xs">-</button>
                        <span class="w-8 text-center text-sm">${item.quantity}</span>
                        <button onclick="changeQuantity(${index}, 1)" class="bg-green-500 text-white w-6 h-6 rounded text-xs">+</button>
                        <button onclick="removeFromCart(${index})" class="bg-red-600 text-white w-6 h-6 rounded text-xs">×</button>
                    </div>
                    <div class="w-16 text-right font-bold text-sm">฿${itemTotal}</div>
                `;
                
                cartItems.appendChild(cartItem);
            });
            
            document.getElementById('total-amount').textContent = `฿${total.toFixed(2)}`;
            calculateChange();
        }

        function changeQuantity(index, change) {
            const item = cart[index];
            const product = products.find(p => p.id === item.id);
            
            if (change > 0 && item.quantity < product.stock) {
                item.quantity += change;
            } else if (change < 0 && item.quantity > 1) {
                item.quantity += change;
            }
            
            updateCartDisplay();
        }

        function removeFromCart(index) {
            cart.splice(index, 1);
            updateCartDisplay();
        }

        // Payment processing
        function togglePaymentMethod() {
            const method = document.getElementById('payment-method').value;
            const cashPayment = document.getElementById('cash-payment');
            
            if (method === 'cash') {
                cashPayment.classList.remove('hidden');
            } else {
                cashPayment.classList.add('hidden');
            }
        }

        function calculateChange() {
            const total = parseFloat(document.getElementById('total-amount').textContent.replace('฿', ''));
            const received = parseFloat(document.getElementById('cash-received').value) || 0;
            const change = received - total;
            
            document.getElementById('change-amount').textContent = `฿${Math.max(0, change).toFixed(2)}`;
        }

        function processPayment() {
            if (cart.length === 0) {
                showErrorModal('ไม่สามารถชำระเงินได้', 'กรุณาเลือกสินค้าก่อนชำระเงิน');
                return;
            }
            
            const total = parseFloat(document.getElementById('total-amount').textContent.replace('฿', ''));
            const paymentMethod = document.getElementById('payment-method').value;
            const received = parseFloat(document.getElementById('cash-received').value) || 0;
            
            if (paymentMethod === 'cash' && received < total) {
                showErrorModal('เงินไม่เพียงพอ', `ยอดรวม: ฿${total.toFixed(2)}<br>เงินที่รับ: ฿${received.toFixed(2)}<br>ขาดอีก: ฿${(total - received).toFixed(2)}`);
                return;
            }
            
            showLoadingModal('กำลังประมวลผลการชำระเงิน...');
            
            setTimeout(() => {
                // Update stock
                cart.forEach(cartItem => {
                    const product = products.find(p => p.id === cartItem.id);
                    product.stock -= cartItem.quantity;
                });
                
                // Create receipt
                const receipt = {
                    id: `POS${String(receiptCounter).padStart(3, '0')}`,
                    date: new Date().toISOString(),
                    items: [...cart],
                    total: total,
                    paymentMethod: paymentMethod,
                    received: paymentMethod === 'cash' ? received : total,
                    change: paymentMethod === 'cash' ? Math.max(0, received - total) : 0
                };
                
                salesHistory.unshift(receipt);
                receiptCounter++;
                
                // Save to localStorage
                localStorage.setItem('pos-products', JSON.stringify(products));
                localStorage.setItem('pos-history', JSON.stringify(salesHistory));
                localStorage.setItem('pos-receipt-counter', receiptCounter.toString());
                
                // Auto-sync if online
                if (isOnline) {
                    syncWithGoogleSheets(true);
                }
                
                // Clear cart
                cart = [];
                updateCartDisplay();
                loadProducts();
                document.getElementById('cash-received').value = '';
                
                // Show success modal with payment details
                const changeAmount = receipt.change;
                let message = `หมายเลขใบเสร็จ: <strong>${receipt.id}</strong><br>`;
                message += `ยอดรวม: <strong>฿${total.toFixed(2)}</strong><br>`;
                message += `ชำระด้วย: <strong>${paymentMethod === 'cash' ? 'เงินสด' : 'QR Code'}</strong><br>`;
                
                if (paymentMethod === 'cash') {
                    message += `เงินที่รับ: <strong>฿${received.toFixed(2)}</strong><br>`;
                    if (changeAmount > 0) {
                        message += `<span style="color: #ef4444; font-size: 18px;">เงินทอน: <strong>฿${changeAmount.toFixed(2)}</strong></span>`;
                    } else {
                        message += `เงินทอน: <strong>฿0.00</strong>`;
                    }
                }
                
                // Show success modal with print button option and 10-minute auto-close
                showPaymentSuccessModal('ชำระเงินสำเร็จ! 🎉', message, receipt);
            }, 1500);
        }

        function printReceipt(receipt) {
            const receiptDiv = document.getElementById('receipt-print');
            const date = new Date(receipt.date);
            
            receiptDiv.innerHTML = `
                <div style="text-align: center; margin-bottom: 10px;">
                    <h2>${settings.shopName}</h2>
                    <p>${settings.shopAddress}</p>
                    <p>โทร: ${settings.shopPhone}</p>
                    <p>เลขประจำตัวผู้เสียภาษี: ${settings.shopTax}</p>
                    <hr>
                </div>
                
                <p><strong>ใบเสร็จเลขที่:</strong> ${receipt.id}</p>
                <p><strong>วันที่:</strong> ${date.toLocaleDateString('th-TH')}</p>
                <p><strong>เวลา:</strong> ${date.toLocaleTimeString('th-TH')}</p>
                <hr>
                
                <table style="width: 100%; font-size: 11px;">
                    <thead>
                        <tr>
                            <th style="text-align: left;">รายการ</th>
                            <th style="text-align: center;">จำนวน</th>
                            <th style="text-align: right;">ราคา</th>
                            <th style="text-align: right;">รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${receipt.items.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td style="text-align: center;">${item.quantity}</td>
                                <td style="text-align: right;">฿${item.price}</td>
                                <td style="text-align: right;">฿${(item.price * item.quantity).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <hr>
                <p style="text-align: right;"><strong>ยอดรวม: ฿${receipt.total.toFixed(2)}</strong></p>
                <p style="text-align: right;">เงินรับ: ฿${receipt.received.toFixed(2)}</p>
                <p style="text-align: right;">เงินทอน: ฿${receipt.change.toFixed(2)}</p>
                <p style="text-align: right;">ชำระด้วย: ${receipt.paymentMethod === 'cash' ? 'เงินสด' : 'QR Code'}</p>
                
                <hr>
                <p style="text-align: center; margin-top: 10px;">ขอบคุณที่ใช้บริการ</p>
            `;
            
            receiptDiv.classList.remove('hidden');
            window.print();
            receiptDiv.classList.add('hidden');
        }

        function printLastReceipt() {
            if (salesHistory.length === 0) {
                showWarningModal('ไม่พบใบเสร็จ', 'ไม่มีประวัติการขายในระบบ');
                return;
            }
            
            const today = new Date().toDateString();
            const todayReceipts = salesHistory.filter(receipt => 
                new Date(receipt.date).toDateString() === today
            );
            
            if (todayReceipts.length === 0) {
                showWarningModal('ไม่พบใบเสร็จ', 'ไม่มีประวัติการขายในวันนี้');
                return;
            }
            
            showLoadingModal('กำลังเตรียมใบเสร็จ...');
            
            setTimeout(() => {
                printReceipt(todayReceipts[0]);
                showSuccessModal('พิมพ์ใบเสร็จสำเร็จ', `พิมพ์ใบเสร็จ ${todayReceipts[0].id} เรียบร้อยแล้ว`);
            }, 1000);
        }

        // Stock management
        function checkStockPassword() {
            const password = document.getElementById('stock-password').value;
            
            if (!password) {
                showErrorModal('กรุณากรอกรหัสผ่าน', 'โปรดใส่รหัสผ่านเพื่อเข้าสู่ระบบจัดการสต็อก');
                return;
            }
            
            showLoadingModal('กำลังตรวจสอบรหัสผ่าน...');
            
            setTimeout(() => {
                if (password === settings.password) {
                    document.getElementById('stock-login').classList.add('hidden');
                    document.getElementById('stock-management').classList.remove('hidden');
                    loadStockList();
                    showSuccessModal('เข้าสู่ระบบสำเร็จ', 'ยินดีต้อนรับสู่ระบบจัดการสต็อก');
                } else {
                    showErrorModal('รหัสผ่านไม่ถูกต้อง', 'กรุณาตรวจสอบรหัสผ่านและลองใหม่อีกครั้ง');
                    document.getElementById('stock-password').value = '';
                }
            }, 1000);
        }

        function addNewProduct() {
            const name = document.getElementById('new-product-name').value.trim();
            const code = document.getElementById('new-product-code').value.trim();
            const price = parseFloat(document.getElementById('new-product-price').value);
            const stock = parseInt(document.getElementById('new-product-stock').value);
            const imageFile = document.getElementById('new-product-image').files[0];
            
            if (!name || !code || !price || !stock) {
                showErrorModal('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลสินค้าให้ครบทุกช่อง');
                return;
            }
            
            if (price <= 0) {
                showErrorModal('ราคาไม่ถูกต้อง', 'ราคาสินค้าต้องมากกว่า 0 บาท');
                return;
            }
            
            if (stock < 0) {
                showErrorModal('จำนวนสต็อกไม่ถูกต้อง', 'จำนวนสต็อกต้องเป็นจำนวนเต็มบวก');
                return;
            }
            
            // Check if code already exists
            if (products.find(p => p.code === code)) {
                showErrorModal('รหัสสินค้าซ้ำ', `รหัสสินค้า "${code}" มีอยู่ในระบบแล้ว<br>กรุณาใช้รหัสอื่น`);
                return;
            }
            
            showLoadingModal('กำลังเพิ่มสินค้าใหม่...');
            
            setTimeout(() => {
                const newProduct = {
                    id: Date.now(),
                    name: name,
                    code: code,
                    price: price,
                    stock: stock,
                    image: '📦' // Default emoji, could be enhanced to handle actual images
                };
                
                // Handle image upload (simplified - in real app would upload to server)
                if (imageFile) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        // In a real app, you'd upload this to a server
                        // For demo purposes, we'll just use an emoji
                        newProduct.image = '🖼️';
                        products.push(newProduct);
                        localStorage.setItem('pos-products', JSON.stringify(products));
                        loadProducts();
                        loadStockList();
                        clearNewProductForm();
                        
                        // Auto-sync if online
                        if (isOnline) {
                            syncWithGoogleSheets(true);
                        }
                        
                        showSuccessModal('เพิ่มสินค้าสำเร็จ! 🎉', 
                            `เพิ่มสินค้า "${name}" เรียบร้อยแล้ว<br>รหัสสินค้า: ${code}<br>ราคา: ฿${price}<br>สต็อก: ${stock} ชิ้น`);
                    };
                    reader.readAsDataURL(imageFile);
                } else {
                    products.push(newProduct);
                    localStorage.setItem('pos-products', JSON.stringify(products));
                    loadProducts();
                    loadStockList();
                    clearNewProductForm();
                    
                    // Auto-sync if online
                    if (isOnline) {
                        syncWithGoogleSheets(true);
                    }
                    
                    showSuccessModal('เพิ่มสินค้าสำเร็จ! 🎉', 
                        `เพิ่มสินค้า "${name}" เรียบร้อยแล้ว<br>รหัสสินค้า: ${code}<br>ราคา: ฿${price}<br>สต็อก: ${stock} ชิ้น`);
                }
            }, 1000);
        }

        function clearNewProductForm() {
            document.getElementById('new-product-name').value = '';
            document.getElementById('new-product-code').value = '';
            document.getElementById('new-product-price').value = '';
            document.getElementById('new-product-stock').value = '';
            document.getElementById('new-product-image').value = '';
        }

        function loadStockList() {
            const stockList = document.getElementById('stock-list');
            stockList.innerHTML = `
                <table class="w-full border-collapse border border-gray-300">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="border border-gray-300 p-2">รูปภาพ</th>
                            <th class="border border-gray-300 p-2">ชื่อสินค้า</th>
                            <th class="border border-gray-300 p-2">รหัส</th>
                            <th class="border border-gray-300 p-2">ราคา</th>
                            <th class="border border-gray-300 p-2">สต็อก</th>
                            <th class="border border-gray-300 p-2">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(product => `
                            <tr id="product-row-${product.id}">
                                <td class="border border-gray-300 p-2 text-center text-2xl">${product.image}</td>
                                <td class="border border-gray-300 p-2">
                                    <span id="name-display-${product.id}">${product.name}</span>
                                    <input type="text" id="name-edit-${product.id}" value="${product.name}" class="w-full p-1 border rounded hidden">
                                </td>
                                <td class="border border-gray-300 p-2">
                                    <span id="code-display-${product.id}">${product.code}</span>
                                    <input type="text" id="code-edit-${product.id}" value="${product.code}" class="w-full p-1 border rounded hidden">
                                </td>
                                <td class="border border-gray-300 p-2">
                                    <span id="price-display-${product.id}">฿${product.price}</span>
                                    <input type="number" id="price-edit-${product.id}" value="${product.price}" class="w-full p-1 border rounded hidden" step="0.01">
                                </td>
                                <td class="border border-gray-300 p-2 text-center">
                                    <div class="flex items-center justify-center space-x-2">
                                        <button onclick="adjustStock(${product.id}, -1)" class="bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded text-xs transition-colors">-</button>
                                        <span id="stock-display-${product.id}" class="w-12 text-center font-semibold">${product.stock}</span>
                                        <input type="number" id="stock-edit-${product.id}" value="${product.stock}" class="w-16 p-1 border rounded text-center hidden" min="0">
                                        <button onclick="adjustStock(${product.id}, 1)" class="bg-green-500 hover:bg-green-600 text-white w-6 h-6 rounded text-xs transition-colors">+</button>
                                    </div>
                                </td>
                                <td class="border border-gray-300 p-2 text-center">
                                    <div id="normal-buttons-${product.id}" class="space-x-1">
                                        <button onclick="editProduct(${product.id})" class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs transition-colors">✏️ แก้ไข</button>
                                        <button onclick="deleteProduct(${product.id})" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs transition-colors">🗑️ ลบ</button>
                                    </div>
                                    <div id="edit-buttons-${product.id}" class="space-x-1 hidden">
                                        <button onclick="saveProduct(${product.id})" class="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs transition-colors">✅ บันทึก</button>
                                        <button onclick="cancelEdit(${product.id})" class="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs transition-colors">❌ ยกเลิก</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        function adjustStock(productId, change) {
            const product = products.find(p => p.id === productId);
            if (product) {
                const oldStock = product.stock;
                const newStock = Math.max(0, product.stock + change);
                
                if (oldStock === newStock && change < 0) {
                    showWarningModal('ไม่สามารถลดสต็อกได้', `สต็อกของ "${product.name}" อยู่ที่ 0 แล้ว`);
                    return;
                }
                
                product.stock = newStock;
                localStorage.setItem('pos-products', JSON.stringify(products));
                loadStockList();
                loadProducts();
                
                // Auto-sync if online
                if (isOnline) {
                    syncWithGoogleSheets(true);
                }
                
                // Show success message
                const action = change > 0 ? 'เพิ่ม' : 'ลด';
                const changeText = change > 0 ? `+${change}` : change.toString();
                showSuccessModal(`${action}สต็อกสำเร็จ`, 
                    `${product.name}<br>สต็อกเดิม: ${oldStock} ชิ้น<br>ปรับ: ${changeText} ชิ้น<br>สต็อกใหม่: ${newStock} ชิ้น`);
            }
        }

        function editProduct(productId) {
            // Hide normal buttons and show edit buttons
            document.getElementById(`normal-buttons-${productId}`).classList.add('hidden');
            document.getElementById(`edit-buttons-${productId}`).classList.remove('hidden');
            
            // Hide display elements and show input fields
            document.getElementById(`name-display-${productId}`).classList.add('hidden');
            document.getElementById(`name-edit-${productId}`).classList.remove('hidden');
            
            document.getElementById(`code-display-${productId}`).classList.add('hidden');
            document.getElementById(`code-edit-${productId}`).classList.remove('hidden');
            
            document.getElementById(`price-display-${productId}`).classList.add('hidden');
            document.getElementById(`price-edit-${productId}`).classList.remove('hidden');
            
            document.getElementById(`stock-display-${productId}`).classList.add('hidden');
            document.getElementById(`stock-edit-${productId}`).classList.remove('hidden');
        }

        function saveProduct(productId) {
            const product = products.find(p => p.id === productId);
            if (!product) return;
            
            const newName = document.getElementById(`name-edit-${productId}`).value.trim();
            const newCode = document.getElementById(`code-edit-${productId}`).value.trim();
            const newPrice = parseFloat(document.getElementById(`price-edit-${productId}`).value);
            const newStock = parseInt(document.getElementById(`stock-edit-${productId}`).value);
            
            // Validation
            if (!newName || !newCode || !newPrice || newPrice <= 0 || newStock < 0) {
                showErrorModal('ข้อมูลไม่ถูกต้อง', 'กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง<br>- ชื่อสินค้าและรหัสต้องไม่ว่าง<br>- ราคาต้องมากกว่า 0<br>- สต็อกต้องเป็นจำนวนเต็มบวก');
                return;
            }
            
            // Check if code already exists (except current product)
            const existingProduct = products.find(p => p.code === newCode && p.id !== productId);
            if (existingProduct) {
                showErrorModal('รหัสสินค้าซ้ำ', `รหัสสินค้า "${newCode}" มีอยู่ในระบบแล้ว<br>กรุณาใช้รหัสอื่น`);
                return;
            }
            
            showLoadingModal('กำลังบันทึกการแก้ไข...');
            
            setTimeout(() => {
                // Save changes
                const oldData = {
                    name: product.name,
                    code: product.code,
                    price: product.price,
                    stock: product.stock
                };
                
                product.name = newName;
                product.code = newCode;
                product.price = newPrice;
                product.stock = newStock;
                
                localStorage.setItem('pos-products', JSON.stringify(products));
                loadStockList();
                loadProducts();
                
                // Auto-sync if online
                if (isOnline) {
                    syncWithGoogleSheets(true);
                }
                
                showSuccessModal('แก้ไขสินค้าสำเร็จ! 🎉', 
                    `แก้ไขสินค้า "${newName}" เรียบร้อยแล้ว<br>` +
                    `รหัส: ${oldData.code} → ${newCode}<br>` +
                    `ราคา: ฿${oldData.price} → ฿${newPrice}<br>` +
                    `สต็อก: ${oldData.stock} → ${newStock} ชิ้น`);
            }, 1000);
        }

        function cancelEdit(productId) {
            const product = products.find(p => p.id === productId);
            if (!product) return;
            
            // Reset input values to original
            document.getElementById(`name-edit-${productId}`).value = product.name;
            document.getElementById(`code-edit-${productId}`).value = product.code;
            document.getElementById(`price-edit-${productId}`).value = product.price;
            document.getElementById(`stock-edit-${productId}`).value = product.stock;
            
            // Show display elements and hide input fields
            document.getElementById(`name-display-${productId}`).classList.remove('hidden');
            document.getElementById(`name-edit-${productId}`).classList.add('hidden');
            
            document.getElementById(`code-display-${productId}`).classList.remove('hidden');
            document.getElementById(`code-edit-${productId}`).classList.add('hidden');
            
            document.getElementById(`price-display-${productId}`).classList.remove('hidden');
            document.getElementById(`price-edit-${productId}`).classList.add('hidden');
            
            document.getElementById(`stock-display-${productId}`).classList.remove('hidden');
            document.getElementById(`stock-edit-${productId}`).classList.add('hidden');
            
            // Show normal buttons and hide edit buttons
            document.getElementById(`normal-buttons-${productId}`).classList.remove('hidden');
            document.getElementById(`edit-buttons-${productId}`).classList.add('hidden');
        }

        function deleteProduct(productId) {
            const product = products.find(p => p.id === productId);
            if (!product) return;
            
            showModal('warning', 'ยืนยันการลบสินค้า', 
                `คุณต้องการลบสินค้า "${product.name}" หรือไม่?<br><small>การดำเนินการนี้ไม่สามารถยกเลิกได้</small>`, 
                () => {
                    showLoadingModal('กำลังลบสินค้า...');
                    
                    setTimeout(() => {
                        products = products.filter(p => p.id !== productId);
                        localStorage.setItem('pos-products', JSON.stringify(products));
                        loadStockList();
                        loadProducts();
                        
                        // Auto-sync if online
                        if (isOnline) {
                            syncWithGoogleSheets(true);
                        }
                        
                        showSuccessModal('ลบสินค้าสำเร็จ', `ลบสินค้า "${product.name}" ออกจากระบบแล้ว`);
                    }, 1000);
                }
            );
            
            // Change button text for confirmation
            document.getElementById('modal-button').textContent = 'ยืนยันลบ';
            document.getElementById('modal-button').className = 'modal-button error';
        }

        // Sales history
        function loadHistory() {
            const historyList = document.getElementById('history-list');
            
            if (salesHistory.length === 0) {
                historyList.innerHTML = '<p class="text-center text-gray-500 py-8">ไม่มีประวัติการขาย</p>';
                return;
            }
            
            historyList.innerHTML = `
                <table class="w-full border-collapse border border-gray-300">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="border border-gray-300 p-2">หมายเลขใบเสร็จ</th>
                            <th class="border border-gray-300 p-2">วันที่</th>
                            <th class="border border-gray-300 p-2">เวลา</th>
                            <th class="border border-gray-300 p-2">ยอดรวม</th>
                            <th class="border border-gray-300 p-2">การชำระเงิน</th>
                            <th class="border border-gray-300 p-2">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${salesHistory.map(receipt => {
                            const date = new Date(receipt.date);
                            return `
                                <tr>
                                    <td class="border border-gray-300 p-2 text-center">${receipt.id}</td>
                                    <td class="border border-gray-300 p-2 text-center">${date.toLocaleDateString('th-TH')}</td>
                                    <td class="border border-gray-300 p-2 text-center">${date.toLocaleTimeString('th-TH')}</td>
                                    <td class="border border-gray-300 p-2 text-center">฿${receipt.total.toFixed(2)}</td>
                                    <td class="border border-gray-300 p-2 text-center">${receipt.paymentMethod === 'cash' ? 'เงินสด' : 'QR Code'}</td>
                                    <td class="border border-gray-300 p-2 text-center">
                                        <button onclick="printReceipt(${JSON.stringify(receipt).replace(/"/g, '&quot;')})" class="bg-blue-500 text-white px-2 py-1 rounded text-xs">🖨️ พิมพ์ซ้ำ</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }

        function searchHistory() {
            const date = document.getElementById('history-date').value;
            const search = document.getElementById('history-search').value.toLowerCase();
            
            let filteredHistory = salesHistory;
            
            if (date) {
                filteredHistory = filteredHistory.filter(receipt => 
                    new Date(receipt.date).toDateString() === new Date(date).toDateString()
                );
            }
            
            if (search) {
                filteredHistory = filteredHistory.filter(receipt => 
                    receipt.id.toLowerCase().includes(search)
                );
            }
            
            const historyList = document.getElementById('history-list');
            
            if (filteredHistory.length === 0) {
                historyList.innerHTML = '<p class="text-center text-gray-500 py-8">ไม่พบข้อมูลที่ค้นหา</p>';
                return;
            }
            
            historyList.innerHTML = `
                <table class="w-full border-collapse border border-gray-300">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="border border-gray-300 p-2">หมายเลขใบเสร็จ</th>
                            <th class="border border-gray-300 p-2">วันที่</th>
                            <th class="border border-gray-300 p-2">เวลา</th>
                            <th class="border border-gray-300 p-2">ยอดรวม</th>
                            <th class="border border-gray-300 p-2">การชำระเงิน</th>
                            <th class="border border-gray-300 p-2">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredHistory.map(receipt => {
                            const date = new Date(receipt.date);
                            return `
                                <tr>
                                    <td class="border border-gray-300 p-2 text-center">${receipt.id}</td>
                                    <td class="border border-gray-300 p-2 text-center">${date.toLocaleDateString('th-TH')}</td>
                                    <td class="border border-gray-300 p-2 text-center">${date.toLocaleTimeString('th-TH')}</td>
                                    <td class="border border-gray-300 p-2 text-center">฿${receipt.total.toFixed(2)}</td>
                                    <td class="border border-gray-300 p-2 text-center">${receipt.paymentMethod === 'cash' ? 'เงินสด' : 'QR Code'}</td>
                                    <td class="border border-gray-300 p-2 text-center">
                                        <button onclick="printReceipt(${JSON.stringify(receipt).replace(/"/g, '&quot;')})" class="bg-blue-500 text-white px-2 py-1 rounded text-xs">🖨️ พิมพ์ซ้ำ</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }

        function exportCSV() {
            if (salesHistory.length === 0) {
                alert('ไม่มีข้อมูลสำหรับส่งออก');
                return;
            }
            
            let csv = 'หมายเลขใบเสร็จ,วันที่,เวลา,รายการสินค้า,ยอดรวม,การชำระเงิน\n';
            
            salesHistory.forEach(receipt => {
                const date = new Date(receipt.date);
                const items = receipt.items.map(item => `${item.name}(${item.quantity})`).join(';');
                csv += `${receipt.id},${date.toLocaleDateString('th-TH')},${date.toLocaleTimeString('th-TH')},"${items}",${receipt.total},${receipt.paymentMethod === 'cash' ? 'เงินสด' : 'QR Code'}\n`;
            });
            
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `sales_history_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
        }

        function clearHistory() {
            if (confirm('คุณแน่ใจหรือไม่ที่จะลบประวัติการขายทั้งหมด?')) {
                salesHistory = [];
                localStorage.setItem('pos-history', JSON.stringify(salesHistory));
                loadHistory();
                alert('ลบประวัติการขายเรียบร้อยแล้ว');
            }
        }

        // Settings
        function loadSettings() {
            document.getElementById('shop-name').value = settings.shopName;
            document.getElementById('shop-address').value = settings.shopAddress;
            document.getElementById('shop-phone').value = settings.shopPhone;
            document.getElementById('shop-tax').value = settings.shopTax;
        }

        function loadSheetsSettings() {
            document.getElementById('enable-sheets').checked = settings.sheetsEnabled;
            document.getElementById('spreadsheet-id').value = settings.spreadsheetId;
            document.getElementById('api-key').value = settings.apiKey;
            document.getElementById('products-sheet').value = settings.productsSheet;
            document.getElementById('history-sheet').value = settings.historySheet;
            
            if (settings.sheetsEnabled) {
                document.getElementById('sheets-config').classList.remove('hidden');
            }
        }

        function saveSettings() {
            showLoadingModal('กำลังบันทึกการตั้งค่า...');
            
            setTimeout(() => {
                settings.shopName = document.getElementById('shop-name').value || 'ร้านค้าของฉัน';
                settings.shopAddress = document.getElementById('shop-address').value || '123 ถนนสุขุมวิท กรุงเทพฯ';
                settings.shopPhone = document.getElementById('shop-phone').value || '02-123-4567';
                settings.shopTax = document.getElementById('shop-tax').value || '1234567890123';
                
                // Google Sheets settings
                settings.sheetsEnabled = document.getElementById('enable-sheets').checked;
                settings.spreadsheetId = document.getElementById('spreadsheet-id').value;
                settings.apiKey = document.getElementById('api-key').value;
                settings.productsSheet = document.getElementById('products-sheet').value || 'Products';
                settings.historySheet = document.getElementById('history-sheet').value || 'Sales';
                
                localStorage.setItem('pos-settings', JSON.stringify(settings));
                
                // Check connection after saving
                if (settings.sheetsEnabled) {
                    checkConnection();
                } else {
                    updateConnectionStatus(false);
                }
                
                showSuccessModal('บันทึกการตั้งค่าสำเร็จ! 🎉', 
                    `ข้อมูลร้าน: ${settings.shopName}<br>` +
                    `Google Sheets: ${settings.sheetsEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}<br>` +
                    `การตั้งค่าทั้งหมดถูกบันทึกแล้ว`);
            }, 1000);
        }

        function changePassword() {
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            
            if (!currentPassword) {
                showErrorModal('กรุณากรอกรหัสผ่านปัจจุบัน', 'โปรดใส่รหัสผ่านปัจจุบันเพื่อยืนยันตัวตน');
                return;
            }
            
            if (currentPassword !== settings.password) {
                showErrorModal('รหัสผ่านไม่ถูกต้อง', 'รหัสผ่านปัจจุบันที่คุณใส่ไม่ถูกต้อง');
                return;
            }
            
            if (!newPassword || newPassword.length < 4) {
                showErrorModal('รหัสผ่านใหม่ไม่ถูกต้อง', 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร');
                return;
            }
            
            if (currentPassword === newPassword) {
                showWarningModal('รหัสผ่านเหมือนเดิม', 'รหัสผ่านใหม่ต้องแตกต่างจากรหัสผ่านปัจจุบัน');
                return;
            }
            
            showLoadingModal('กำลังเปลี่ยนรหัสผ่าน...');
            
            setTimeout(() => {
                settings.password = newPassword;
                localStorage.setItem('pos-settings', JSON.stringify(settings));
                
                document.getElementById('current-password').value = '';
                document.getElementById('new-password').value = '';
                
                showSuccessModal('เปลี่ยนรหัสผ่านสำเร็จ! 🔒', 
                    'รหัสผ่านใหม่ถูกบันทึกแล้ว<br>กรุณาจดจำรหัสผ่านใหม่ไว้ให้ดี');
            }, 1000);
        }
