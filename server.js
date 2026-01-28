const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8766;

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
const audioDir = path.join(dataDir, 'audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

// Data file for persistence
const dataFile = path.join(dataDir, 'entries.json');

// Load existing entries
let entries = [];
try {
  if (fs.existsSync(dataFile)) {
    entries = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  }
} catch (e) {
  console.log('[LifeLog] Starting with empty entries');
}

function saveEntries() {
  fs.writeFileSync(dataFile, JSON.stringify(entries, null, 2));
}

// Multer for audio uploads
const upload = multer({ dest: audioDir });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ LIFELOG ENDPOINTS ============

// Ingest voice note
app.post('/api/lifelog/ingest', upload.single('audio'), (req, res) => {
  const { timestamp, device, context, transcript } = req.body;
  const entry = {
    id: Date.now(),
    timestamp: timestamp || new Date().toISOString(),
    device: device || 'web',
    context: context || 'auto',
    audioPath: req.file ? req.file.path : null,
    transcript: transcript || null,
    summary: null,
    sentiment: null,
    processed: false,
    createdAt: new Date().toISOString()
  };
  entries.push(entry);
  saveEntries();
  console.log(`[LifeLog] New entry: ${entry.id} from ${entry.device} (${entry.context})`);
  res.json({ success: true, entryId: entry.id });
});

// Update entry (for transcript, etc.)
app.patch('/api/lifelog/entries/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const entry = entries.find(e => e.id === id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  Object.assign(entry, req.body, { updatedAt: new Date().toISOString() });
  saveEntries();
  res.json({ success: true, entry });
});

// Search entries
app.get('/api/lifelog/search', (req, res) => {
  const { q, from, to, context } = req.query;
  let results = [...entries];

  if (from) results = results.filter(e => e.timestamp >= from);
  if (to) results = results.filter(e => e.timestamp <= to);
  if (context) results = results.filter(e => e.context === context);
  if (q) results = results.filter(e =>
    (e.transcript && e.transcript.toLowerCase().includes(q.toLowerCase())) ||
    (e.summary && e.summary.toLowerCase().includes(q.toLowerCase()))
  );

  res.json(results);
});

// Get entries for date
app.get('/api/lifelog/entries/:date', (req, res) => {
  const dateStr = req.params.date;
  const dayEntries = entries.filter(e => e.timestamp.startsWith(dateStr));
  res.json(dayEntries);
});

// Get all entries
app.get('/api/lifelog/entries', (req, res) => {
  res.json(entries.slice(-100)); // Last 100 entries
});

// Delete entry
app.delete('/api/lifelog/entries/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Entry not found' });

  const entry = entries[idx];
  if (entry.audioPath && fs.existsSync(entry.audioPath)) {
    fs.unlinkSync(entry.audioPath);
  }
  entries.splice(idx, 1);
  saveEntries();
  res.json({ success: true });
});

// ============ STATS & DIGEST ============

// Get daily digest
app.get('/api/lifelog/digest/:date', (req, res) => {
  const dateStr = req.params.date;
  const dayEntries = entries.filter(e => e.timestamp.startsWith(dateStr));

  const contexts = {};
  dayEntries.forEach(e => {
    contexts[e.context] = (contexts[e.context] || 0) + 1;
  });

  res.json({
    date: dateStr,
    totalEntries: dayEntries.length,
    contexts,
    entries: dayEntries
  });
});

// ============ HEALTH & STATUS ============

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'kinship-lifelog',
    version: '1.0.0',
    uptime: process.uptime(),
    entries: entries.length
  });
});

app.get('/api/status', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = entries.filter(e => e.timestamp.startsWith(today));

  res.json({
    total: entries.length,
    today: todayEntries.length,
    lastEntry: entries[entries.length - 1]?.timestamp || null
  });
});

// Serve main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║              KINSHIP LifeLog v1.0.0                   ║
╠═══════════════════════════════════════════════════════╣
║  Dashboard:   http://localhost:${PORT}                   ║
║  API Health:  http://localhost:${PORT}/api/health        ║
║                                                       ║
║  Your voice. Your memories. Your life.               ║
╚═══════════════════════════════════════════════════════╝
`);
});
