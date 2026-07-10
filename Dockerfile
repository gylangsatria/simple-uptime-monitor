# Gunakan image Node.js versi 18 (LTS)
FROM node:18-alpine

# Buat working directory
WORKDIR /app

# Install build tools untuk native module (better-sqlite3)
RUN apk add --no-cache --virtual .build-deps python3 make g++

# Copy package.json dan package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production && apk del .build-deps

# Buat direktori untuk database
RUN mkdir -p /app/data

# Copy semua file
COPY . .

# Expose port
EXPOSE 5090

# Jalankan aplikasi
CMD ["node", "server.js"]