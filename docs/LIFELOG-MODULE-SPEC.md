# Hive LifeLog Module

**Purpose:** Continuous voice capture, transcription, AI analysis, and queryable personal history.

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Capture Layer  │────▶│  Process Layer   │────▶│  Storage Layer  │
│  (Phone/Device) │     │  (Hive Node)     │     │  (SQLite + Vec) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Analysis Layer  │
                        │  (Claude API)    │
                        └──────────────────┘
```

---

## 1. Capture Layer

### Option A: Phone App (Android/S25 Ultra)
- **Tasker + AutoVoice** - Triggered recording with auto-upload
- **Termux script** - Continuous background recording, chunked uploads
- **Custom PWA** - MediaRecorder API, uploads to Hive endpoint

### Option B: Dedicated Device (Recommended)
- **Limitless Pendant** or **PLAUD NotePin**
- Export via API or file sync → watched folder on Hive node

### Option C: Hybrid
- Phone for intentional capture ("Hey, note to self...")
- Pendant for passive ambient capture

### Upload Protocol
```
POST http://192.168.1.42:8760/lifelog/ingest
Content-Type: multipart/form-data

{
  audio: <binary>,
  timestamp: ISO8601,
  device: "s25-ultra" | "pendant" | "desktop",
  context: "meeting" | "personal" | "idea" | "auto"
}
```

---

## 2. Processing Layer

### Service: `lifelog-processor`
**Port:** 8760  
**Auto-registers** on Hive event mesh (8750)

```javascript
// C:\DevClaude\Hivemind\services\lifelog\index.js

const express = require('express');
const multer = require('multer');
const { whisper } = require('./whisper-local'); // or OpenAI Whisper API
const { db } = require('./database');
const { emitEvent } = require('../shared/event-mesh');

const app = express();
const upload = multer({ dest: 'temp/' });

// Ingest endpoint
app.post('/lifelog/ingest', upload.single('audio'), async (req, res) => {
  const { timestamp, device, context } = req.body;
  const audioPath = req.file.path;
  
  // Transcribe
  const transcript = await whisper.transcribe(audioPath);
  
  // Store raw
  const entryId = await db.insertEntry({
    timestamp: timestamp || new Date().toISOString(),
    device,
    context,
    audioPath,
    transcript,
    processed: false
  });
  
  // Emit for async processing
  emitEvent('lifelog:new-entry', { entryId });
  
  res.json({ success: true, entryId });
});

// Query endpoint
app.get('/lifelog/search', async (req, res) => {
  const { q, from, to, context } = req.query;
  const results = await db.semanticSearch(q, { from, to, context });
  res.json(results);
});

// Daily digest
app.get('/lifelog/digest/:date', async (req, res) => {
  const digest = await db.getDigest(req.params.date);
  res.json(digest);
});

app.listen(8760, () => {
  console.log('[LifeLog] Service running on :8760');
  emitEvent('service:register', { 
    name: 'lifelog', 
    port: 8760,
    endpoints: ['/lifelog/ingest', '/lifelog/search', '/lifelog/digest']
  });
});
```

---

## 3. Storage Layer

### SQLite Schema
```sql
-- C:\DevClaude\Hivemind\services\lifelog\schema.sql

CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME NOT NULL,
  device TEXT,
  context TEXT,
  audio_path TEXT,
  transcript TEXT,
  summary TEXT,
  sentiment TEXT,
  action_items TEXT,  -- JSON array
  people_mentioned TEXT,  -- JSON array
  topics TEXT,  -- JSON array
  embedding BLOB,  -- Vector for semantic search
  processed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE digests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE UNIQUE,
  summary TEXT,
  highlights TEXT,  -- JSON array
  patterns TEXT,  -- JSON: recurring themes
  recommendations TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,  -- 'weekly' | 'monthly' | 'pattern'
  period_start DATE,
  period_end DATE,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_entries_timestamp ON entries(timestamp);
CREATE INDEX idx_entries_context ON entries(context);
```

### Vector Search (sqlite-vss or manual)
```javascript
// Using OpenAI embeddings + cosine similarity
async function semanticSearch(query, filters) {
  const queryEmbedding = await getEmbedding(query);
  
  let sql = `SELECT *, cosine_similarity(embedding, ?) as score 
             FROM entries WHERE 1=1`;
  const params = [queryEmbedding];
  
  if (filters.from) {
    sql += ` AND timestamp >= ?`;
    params.push(filters.from);
  }
  if (filters.to) {
    sql += ` AND timestamp <= ?`;
    params.push(filters.to);
  }
  if (filters.context) {
    sql += ` AND context = ?`;
    params.push(filters.context);
  }
  
  sql += ` ORDER BY score DESC LIMIT 20`;
  
  return db.all(sql, params);
}
```

---

## 4. Analysis Layer

### Async Processor (Event-Driven)
```javascript
// C:\DevClaude\Hivemind\services\lifelog\analyzer.js

const { onEvent, emitEvent } = require('../shared/event-mesh');
const { claude } = require('../shared/anthropic');
const { db } = require('./database');

onEvent('lifelog:new-entry', async ({ entryId }) => {
  const entry = await db.getEntry(entryId);
  
  const analysis = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Analyze this voice note transcript:

"${entry.transcript}"

Return JSON:
{
  "summary": "1-2 sentence summary",
  "sentiment": "positive|neutral|negative|mixed",
  "action_items": ["array of tasks mentioned"],
  "people_mentioned": ["names"],
  "topics": ["key themes"],
  "importance": 1-5
}`
    }]
  });
  
  const parsed = JSON.parse(analysis.content[0].text);
  
  // Get embedding for semantic search
  const embedding = await getEmbedding(entry.transcript);
  
  await db.updateEntry(entryId, {
    summary: parsed.summary,
    sentiment: parsed.sentiment,
    action_items: JSON.stringify(parsed.action_items),
    people_mentioned: JSON.stringify(parsed.people_mentioned),
    topics: JSON.stringify(parsed.topics),
    embedding,
    processed: true
  });
  
  emitEvent('lifelog:entry-processed', { entryId });
});
```

### Daily Digest Generator (Cron: 11pm)
```javascript
async function generateDailyDigest(date) {
  const entries = await db.getEntriesForDate(date);
  
  const digest = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Here are all voice notes from ${date}:

${entries.map(e => `[${e.timestamp}] ${e.transcript}`).join('\n\n')}

Generate a daily digest:
{
  "summary": "Overall day summary",
  "highlights": ["Key moments/insights"],
  "mood_arc": "How sentiment shifted through day",
  "wins": ["Accomplishments mentioned"],
  "concerns": ["Worries/problems raised"],
  "action_items": ["Consolidated tasks"],
  "recommendations": "AI advice based on patterns"
}`
    }]
  });
  
  await db.insertDigest(date, JSON.parse(digest.content[0].text));
}
```

### Weekly/Monthly Insights (Cron: Sunday 8pm / 1st of month)
```javascript
async function generateWeeklyInsights(startDate, endDate) {
  const digests = await db.getDigestRange(startDate, endDate);
  
  const insights = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `Weekly digests:

${digests.map(d => `[${d.date}]\n${d.summary}\nHighlights: ${d.highlights}`).join('\n\n')}

Analyze patterns:
{
  "recurring_themes": ["Topics that keep coming up"],
  "mood_pattern": "Overall emotional trend",
  "productivity_assessment": "How effectively time was used",
  "relationship_insights": "Patterns in interactions with others",
  "unresolved_items": ["Things mentioned but not addressed"],
  "growth_areas": ["Opportunities for improvement"],
  "wins_to_celebrate": ["Accomplishments to acknowledge"],
  "recommendations": ["Specific actionable advice"]
}`
    }]
  });
  
  await db.insertInsight('weekly', startDate, endDate, insights.content[0].text);
}
```

---

## 5. Query Interface

### CLI Tool
```bash
# C:\DevClaude\Hivemind\services\lifelog\cli.js

lifelog search "project deadlines"
lifelog today
lifelog digest 2026-01-27
lifelog weekly
lifelog ask "What have I been stressed about lately?"
```

### Web Dashboard (Optional)
- Port 8761
- Timeline view of entries
- Search with filters
- Digest viewer
- Insight charts (mood over time, topic frequency)

### Hive Integration
```javascript
// Query via event mesh
emitEvent('lifelog:query', { 
  type: 'search', 
  q: 'SimWidget bugs',
  from: '2026-01-01'
});

onEvent('lifelog:query-result', (results) => {
  console.log(results);
});
```

---

## 6. Phone Capture App (Minimal PWA)

```html
<!-- C:\DevClaude\Hivemind\services\lifelog\capture\index.html -->
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LifeLog Capture</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui;background:#111;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
    .record-btn{width:120px;height:120px;border-radius:50%;border:4px solid #333;background:#222;color:#fff;font-size:14px;cursor:pointer;transition:all .2s}
    .record-btn.recording{background:#ef4444;border-color:#dc2626;animation:pulse 1s infinite}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
    .status{margin-top:20px;font-size:14px;color:#888}
    .context-btns{display:flex;gap:8px;margin-bottom:30px}
    .ctx-btn{padding:8px 16px;border-radius:20px;border:1px solid #333;background:#222;color:#888;font-size:12px;cursor:pointer}
    .ctx-btn.active{background:#2563eb;border-color:#2563eb;color:#fff}
  </style>
</head>
<body>
  <div class="context-btns">
    <button class="ctx-btn active" data-ctx="auto">Auto</button>
    <button class="ctx-btn" data-ctx="idea">💡 Idea</button>
    <button class="ctx-btn" data-ctx="meeting">👥 Meeting</button>
    <button class="ctx-btn" data-ctx="personal">🏠 Personal</button>
  </div>
  
  <button class="record-btn" id="recordBtn">TAP TO RECORD</button>
  <div class="status" id="status">Ready</div>
  
  <script>
    const HIVE_URL = 'http://192.168.1.42:8760';
    let mediaRecorder, chunks = [], recording = false, context = 'auto';
    
    document.querySelectorAll('.ctx-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.ctx-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        context = btn.dataset.ctx;
      };
    });
    
    document.getElementById('recordBtn').onclick = async () => {
      if (!recording) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        chunks = [];
        
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = upload;
        mediaRecorder.start();
        
        recording = true;
        document.getElementById('recordBtn').classList.add('recording');
        document.getElementById('recordBtn').textContent = 'RECORDING...';
        document.getElementById('status').textContent = 'Tap to stop';
      } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        recording = false;
        document.getElementById('recordBtn').classList.remove('recording');
        document.getElementById('recordBtn').textContent = 'TAP TO RECORD';
        document.getElementById('status').textContent = 'Uploading...';
      }
    };
    
    async function upload() {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const form = new FormData();
      form.append('audio', blob, 'recording.webm');
      form.append('timestamp', new Date().toISOString());
      form.append('device', 's25-ultra');
      form.append('context', context);
      
      try {
        const res = await fetch(`${HIVE_URL}/lifelog/ingest`, { method: 'POST', body: form });
        const data = await res.json();
        document.getElementById('status').textContent = data.success ? '✓ Uploaded' : '✗ Failed';
      } catch (e) {
        document.getElementById('status').textContent = '✗ Network error';
      }
      
      setTimeout(() => {
        document.getElementById('status').textContent = 'Ready';
      }, 2000);
    }
  </script>
</body>
</html>
```

---

## 7. File Structure

```
C:\DevClaude\Hivemind\services\lifelog\
├── index.js          # Main service (port 8760)
├── analyzer.js       # Async AI processing
├── database.js       # SQLite wrapper
├── schema.sql        # DB schema
├── whisper-local.js  # Whisper integration
├── cli.js            # Command line tool
├── capture\          # PWA for phone
│   └── index.html
├── dashboard\        # Optional web UI
│   └── index.html
└── temp\             # Temp audio storage
```

---

## 8. Installation

```bash
# Add to Hive
cd C:\DevClaude\Hivemind\services
mkdir lifelog && cd lifelog
npm init -y
npm install express multer better-sqlite3 node-cron

# For local Whisper (optional, saves API costs)
pip install openai-whisper --break-system-packages

# Register with Hive startup
# Add to C:\DevClaude\Hivemind\genesis\services.json
```

---

## 9. Privacy & Legal

- **One-party consent:** WA state = one-party (you can record yourself)
- **Two-party states:** CA, FL, etc. - announce recording in meetings
- **Storage:** All local, no cloud unless you enable
- **Encryption:** Consider SQLCipher for DB encryption
- **Retention:** Configurable auto-delete after N days/months

---

## 10. Cost Estimates

| Component | Cost |
|-----------|------|
| Whisper API | ~$0.006/min |
| Claude Sonnet (analysis) | ~$0.003/entry |
| Embeddings | ~$0.0001/entry |
| **Daily (30 min audio, 50 entries)** | **~$0.35/day** |
| **Monthly** | **~$10-15** |

**Local Whisper:** Free but slower (~1x realtime on CPU)

---

## Next Steps

1. [ ] Scaffold service structure
2. [ ] Implement ingest endpoint
3. [ ] Set up Whisper (API or local)
4. [ ] Build SQLite schema + queries
5. [ ] Wire up Claude analysis
6. [ ] Deploy PWA to phone
7. [ ] Add to Hive auto-start
8. [ ] Build CLI tool
9. [ ] Optional: Web dashboard

---

**Ready to build?**
