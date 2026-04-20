const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const xlsx = require('xlsx');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.xlsx');

// ==========================================
// 🗄️ MANAJEMEN DATABASE SPREADSHEET
// ==========================================
let inventoryDb = {}; 
let validQRIds = new Set();
let headers =[]; // Menyimpan daftar nama kolom dari Excel
let incrementalCounters = {}; // Menyimpan nomor terakhir untuk tiap kolom ID

// Fungsi Auto-Detect Aturan dari Nama Kolom
function detectBehavior(colName) {
    const lowerName = colName.toLowerCase();
    if (lowerName === 'qr_id') return 'ignore';
    if (lowerName === 'terakhir_update') return 'auto_date';
    if (lowerName.includes('seri') || lowerName.includes('serial')) return 'unique';
    if (lowerName.includes('id')) return 'incremental';
    return 'general';
}

function loadDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        console.error("❌ ERROR: database.xlsx tidak ditemukan!");
        return;
    }

    const workbook = xlsx.readFile(DB_FILE);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    headers = xlsx.utils.sheet_to_json(sheet, { header: 1 })[0] ||[];
    if (!headers.includes('QR_ID')) headers.unshift('QR_ID');
    
    // --- FITUR BARU: Pastikan kolom Terakhir_Update selalu ada di Excel ---
    if (!headers.includes('Terakhir_Update')) {
        headers.push('Terakhir_Update');
        console.log("[LOG] Kolom 'Terakhir_Update' otomatis ditambahkan ke memori.");
    }

    const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    inventoryDb = {};
    validQRIds.clear();
    incrementalCounters = {};

    headers.forEach(h => {
        if (detectBehavior(h) === 'incremental') incrementalCounters[h] = 1;
    });

    data.forEach(row => {
        if (row.QR_ID) {
            const qrId = String(row.QR_ID).trim();
            inventoryDb[qrId] = row;
            validQRIds.add(qrId);

            headers.forEach(h => {
                if (detectBehavior(h) === 'incremental' && row[h]) {
                    let val = parseInt(row[h]);
                    if (!isNaN(val) && val >= incrementalCounters[h]) {
                        incrementalCounters[h] = val + 1;
                    }
                }
            });
        }
    });
}


function saveDatabase() {
    const dataArray = Object.values(inventoryDb);
    const sheet = xlsx.utils.json_to_sheet(dataArray, { header: headers });
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, "Inventory");
    xlsx.writeFile(workbook, DB_FILE);
}

// Muat data saat server jalan
loadDatabase();

// ==========================================
// 🌐 SETUP JARINGAN & SSL
// ==========================================
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (let name in interfaces) {
        for (let iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}
const LAN_IP = getLocalIp();
const SECURE_URL = `https://${LAN_IP}:${PORT}`;

const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 🛣️ API ENDPOINTS
// ==========================================

// Ambil Struktur Form dari Header Excel
app.get('/api/schema', (req, res) => {
    const schema = headers
        .filter(h => h !== 'QR_ID')
        .map(h => ({ name: h, behavior: detectBehavior(h) }));
    res.json({ schema, incrementalCounters });
});

// Tambah Kolom Baru (Tulis Langsung ke Excel)
app.post('/api/add-column', (req, res) => {
    const newCol = req.body.column_name.trim();
    if (!newCol || headers.includes(newCol)) {
        return res.json({ status: 'error', message: 'Nama kolom kosong atau sudah ada.' });
    }
    
    headers.push(newCol); // Tambah header
    if (detectBehavior(newCol) === 'incremental') incrementalCounters[newCol] = 1;
    
    saveDatabase(); // Langsung tulis struktur baru ke Excel
    res.json({ status: 'success', message: `Kolom ${newCol} ditambahkan ke Excel!` });
});

// Mode Baca
app.get('/api/read/:qrCode', (req, res) => {
    const qrCode = req.params.qrCode.trim();
    if (!validQRIds.has(qrCode)) return res.json({ status: 'invalid' });
    res.json({ status: 'found', data: inventoryDb[qrCode] });
});

// Mode Tulis (Laporan Berbasis Kolom & Auto Date)
app.post('/api/write', (req, res) => {
    const qrCode = req.body.qr_code.trim();
    const payload = req.body.payload;
    
    if (!validQRIds.has(qrCode)) {
        return res.json({ status: 'error', message: 'QR Ilegal (Tidak ada di Master Data Excel)!' });
    }

    let currentRow = inventoryDb[qrCode] || { QR_ID: qrCode };
    let isUpdated = false;
    let changes =[]; 

    Object.keys(payload).forEach(colName => {
        const incomingValue = payload[colName];
        const behavior = detectBehavior(colName);
        const oldValue = currentRow[colName];

        if (incomingValue !== undefined && incomingValue.trim() !== '') {
            if (behavior === 'incremental') {
                if (oldValue && String(oldValue).trim() !== "") {
                    changes.push({ col: colName, status: 'skipped', text: 'Dilewati (Sudah ada ID)' });
                } else {
                    currentRow[colName] = incomingValue;
                    isUpdated = true;
                    changes.push({ col: colName, status: 'added', text: 'Ditambah' });
                    
                    let val = parseInt(incomingValue);
                    if (!isNaN(val) && val >= incrementalCounters[colName]) incrementalCounters[colName] = val + 1;
                }
            } else if (behavior !== 'auto_date') { // Abaikan jika HP ngirim field Terakhir_Update (mencegah spoofing)
                if (String(oldValue) === String(incomingValue)) {
                    changes.push({ col: colName, status: 'unchanged', text: 'Sama / Tetap' });
                } else if (!oldValue || String(oldValue).trim() === "") {
                    currentRow[colName] = incomingValue;
                    isUpdated = true;
                    changes.push({ col: colName, status: 'added', text: 'Ditambah' });
                } else {
                    currentRow[colName] = incomingValue;
                    isUpdated = true;
                    changes.push({ col: colName, status: 'updated', text: 'Diubah' });
                }
            }
        }
    });

    // --- FITUR BARU: AUTO TIMESTAMP ---
    if (isUpdated) {
        // Format tanggal (contoh: 05/11/2024 14:30:00)
        const now = new Date();
        const timestamp = now.toLocaleString('id-ID', { 
            day: '2-digit', month: '2-digit', year: 'numeric', 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        });
        
        currentRow['Terakhir_Update'] = timestamp;
        
        inventoryDb[qrCode] = currentRow;
        saveDatabase(); // Excel terupdate dengan kolom baru!
        
        changes.push({ col: 'Terakhir_Update', status: 'updated', text: 'Waktu Diperbarui' });
    }

    res.json({ status: 'success', incrementalCounters, isUpdated, changes });
});

// Portal QR Server
app.get('/api/get-connection-qr', async (req, res) => {
    const qrImage = await QRCode.toDataURL(SECURE_URL);
    res.json({ url: SECURE_URL, qrImage: qrImage });
});

const { exec } = require('child_process');

// API Khusus untuk Computer Vision (Python)
app.post('/api/extract-cv', (req, res) => {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.json({ status: 'error', message: 'Gambar kosong' });

    // 1. Bersihkan prefix Base64 dan simpan sebagai file gambar sementara
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const tempImagePath = path.join(__dirname, 'temp_cv_image.jpg');
    fs.writeFileSync(tempImagePath, base64Data, 'base64');

    // 2. Panggil Script Python (Pastikan Python sudah terinstall di PC)
    // Nama file python-nya nanti kita asumsikan 'cv_extractor.py'
    const pythonScript = path.join(__dirname, 'cv_extractor.py');
    
    // Command: python cv_extractor.py "temp_cv_image.jpg"
    exec(`python "${pythonScript}" "${tempImagePath}"`, (error, stdout, stderr) => {
        
        // 3. Hapus foto sementara agar harddisk PC tidak penuh
        if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);

        if (error) {
            console.error("[CV Error]", stderr);
            return res.json({ status: 'error', message: 'Script Python gagal berjalan' });
        }

        // 4. Tangkap output dari Python (Harus berupa JSON)
        // 4. Tangkap output dari Python (Harus berupa JSON)
        try {
            const result = JSON.parse(stdout.trim());
            
            // --- BACA BUKU HARIAN / LOG DETEKTIF DARI PYTHON ---
            console.log("\n🔍 --- LOG DETEKTIF DARI PYTHON ---");
            if (result.debug_log && result.debug_log.length > 0) {
                result.debug_log.forEach(msg => console.log(">", msg));
            }
            console.log("------------------------------------\n");

            if (result.status === "success") {
                res.json({ status: 'success', extracted_text: result.data });
            } else {
                res.json({ status: 'error', message: result.message || 'Gagal ekstrak teks' });
            }
        } catch (parseError) {
            console.error("[JSON Parse Error dari Python]:", stdout);
            res.json({ status: 'error', message: 'Output Python bukan JSON yang valid!' });
        }
    });
});

https.createServer(sslOptions, app).listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server Aktif! HP Akses: ${SECURE_URL}`);
});