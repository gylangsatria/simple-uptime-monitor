# Gunakan image Node.js versi 18 (LTS)
FROM node:18-alpine

# Buat working directory
WORKDIR /app

# Copy package.json dan package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy semua file
COPY . .

# Expose port
EXPOSE 3000

# Jalankan aplikasi
CMD ["node", "server.js"]