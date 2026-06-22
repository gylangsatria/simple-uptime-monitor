const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5090;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ===== KONFIGURASI LAYANAN =====
// Tambahkan layanan yang ingin dimonitor di sini
const services = [
    { name: 'Google', url: 'https://google.com' },
    { name: 'WinPoin', url: 'https://winpoin.com' },
    { name: 'Personal Blog Gylang', url: 'https://gylang.my.id' },
    { name: 'API Harga BBM', url: 'https://api.gylang.my.id/api/harga-bbm' }
];

const serviceHistory = {};
services.forEach((service) => {
    serviceHistory[service.url] = [];
});

// ===== ENDPOINT CEK STATUS =====
app.get('/api/status', async (req, res) => {
    try {
        const results = await Promise.all(
            services.map(async (service) => {
                try {
                    const startTime = Date.now();
                    const response = await axios.get(service.url, {
                        timeout: 5000,
                        validateStatus: () => true // terima semua status
                    });
                    
                    const result = {
                        ...service,
                        status: response.status < 400 ? 'up' : 'down',
                        statusCode: response.status,
                        responseTime: Date.now() - startTime,
                        lastChecked: new Date().toISOString()
                    };

                    const history = serviceHistory[service.url];
                    history.push({
                        timestamp: result.lastChecked,
                        status: result.status,
                        statusCode: result.statusCode,
                        responseTime: result.responseTime
                    });
                    if (history.length > 24) history.shift();

                    return { ...result, history: [...history] };
                } catch (error) {
                    const result = {
                        ...service,
                        status: 'down',
                        statusCode: error.response?.status || 0,
                        responseTime: null,
                        lastChecked: new Date().toISOString(),
                        error: error.message
                    };

                    const history = serviceHistory[service.url];
                    history.push({
                        timestamp: result.lastChecked,
                        status: result.status,
                        statusCode: result.statusCode,
                        responseTime: result.responseTime
                    });
                    if (history.length > 24) history.shift();

                    return { ...result, history: [...history] };
                }
            })
        );
        
        res.json({
            success: true,
            data: results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===== ROUTE UTAMA =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Uptime Monitor running on http://localhost:${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/api/status`);
});