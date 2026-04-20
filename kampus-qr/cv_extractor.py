import sys
import cv2
import pytesseract
import re
import json

# ==========================================
# KONFIGURASI TESSERACT
# ==========================================
#pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def main():
    debug_logs =[]
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"status": "error", "message": "Path gambar tidak diberikan.", "debug_log": debug_logs}))
            sys.exit(1)

        image_path = sys.argv[1]
        img = cv2.imread(image_path)
        
        if img is None:
            print(json.dumps({"status": "error", "message": "Gagal membaca gambar.", "debug_log": debug_logs}))
            sys.exit(1)

        # 1. OPTIMASI RESOLUSI (Khusus Kamera HP)
        h, w = img.shape[:2]
        debug_logs.append(f"Resolusi asli foto HP: {w}x{h}")
        
        if w < 1000:
            # Jika gambar kecil (seperti di Desktop), Upscale 2x
            img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
            debug_logs.append("Gambar di-upscale 2x karena resolusi kecil.")
        elif w > 2000:
            # Jika foto dari HP terlalu raksasa (4K), Downscale agar Tesseract bisa baca
            scale = 2000 / w
            img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
            debug_logs.append(f"Gambar raksasa dari HP di-downscale ke lebar 2000px.")

        # 2. PRE-PROCESSING
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # 3. PROSES OCR
        custom_config = r'--oem 3 --psm 6'
        raw_text = pytesseract.image_to_string(thresh, config=custom_config)
        
        debug_logs.append(f"--- RAW TEXT HASIL OCR ---\n{raw_text}\n--------------------------")

        # 4. REGEX LEBIH KUAT (Mendukung "SN", "S/N", "Serial No", "No. Seri")
        regex_rules =[
            r"(?:S/N|SN|Serial(?: No)?)\s*[:;-]?\s*([A-Za-z0-9 _-]+)",
            r"No[\.\s]*Seri\s*[:;-]?\s*([A-Za-z0-9 _-]+)"
        ]

        extracted_val = ""
        for regex in regex_rules:
            match = re.search(regex, raw_text, re.IGNORECASE)
            if match:
                extracted_val = match.group(1).strip().replace(" ", "")
                debug_logs.append(f"✅ Regex Cocok! Menemukan: {extracted_val}")
                break
        
        # 5. CETAK HASIL KE NODE.JS
        if extracted_val:
            print(json.dumps({"status": "success", "data": extracted_val, "debug_log": debug_logs}))
        else:
            print(json.dumps({"status": "error", "message": "Nomor seri tidak ditemukan pada gambar.", "debug_log": debug_logs}))

    except Exception as e:
        debug_logs.append(f"Terjadi error: {str(e)}")
        print(json.dumps({"status": "error", "message": str(e), "debug_log": debug_logs}))
        sys.exit(1)

if __name__ == "__main__":
    main()