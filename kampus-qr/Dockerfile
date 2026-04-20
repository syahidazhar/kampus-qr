# 1. Gunakan Base Image Node.js (Berbasis Debian Linux)
FROM node:20-bullseye-slim

# 2. Update sistem Linux & Install dependensi
# (DITAMBAHKAN python3-venv DI SINI)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    tesseract-ocr \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 3. Buat folder kerja di dalam Docker
WORKDIR /app

# 4. Buat Virtual Environment Python
RUN python3 -m venv /opt/venv

# 5.[SANGAT PENTING] Jadikan Virtual Environment sebagai default Python
ENV PATH="/opt/venv/bin:$PATH"

# 6. Install Library Python di dalam Virtual Environment tersebut
RUN pip install opencv-python-headless pytesseract

# 7. Copy package.json dan install library Node.js
COPY package*.json ./
RUN npm install

# 8. Copy seluruh file project (server.js, html, cert, excel, dll)
COPY . .

# 9. Buka Port 3000 agar bisa diakses dari luar container
EXPOSE 3000

# 10. Perintah untuk menyalakan server saat Docker berjalan
CMD ["node", "server.js"]