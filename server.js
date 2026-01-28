const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = 8766;

// ============ OPENAI / WHISPER ============
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function transcribeAudio(audioPath) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1',
    response_format: 'text'
  });

  return response;
}

// ============ ANTHROPIC / CLAUDE ANALYSIS ============
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function analyzeTranscript(transcript, context = 'auto') {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Analyze this voice note transcript. Context category: ${context}

Transcript: "${transcript}"

Respond in JSON format only:
{
  "summary": "1-2 sentence summary",
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "sentimentScore": 0.0 to 1.0 (0=very negative, 1=very positive),
  "topics": ["topic1", "topic2"],
  "actionItems": ["action1"] or [],
  "mood": "one word describing emotional state"
}`
    }]
  });

  const text = response.content[0].text;
  // Parse JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid analysis response');
  return JSON.parse(jsonMatch[0]);
}

// ============ LOGGING ============
const logBuffer = [];
const MAX_LOGS = 200;

function log(msg, level = 'INFO') {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  logBuffer.push(line);
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  console.log(line);
}

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
  try {
    const { timestamp, device, context, transcript } = req.body;
    const hasAudio = !!req.file;
    log(`Ingest request: device=${device}, context=${context}, hasAudio=${hasAudio}`);

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
    log(`New entry saved: id=${entry.id}, audio=${hasAudio ? 'yes' : 'no'}`);
    res.json({ success: true, entryId: entry.id });

    // Auto-transcribe if audio present and API key configured
    if (hasAudio && process.env.OPENAI_API_KEY) {
      transcribeAudio(req.file.path)
        .then(async transcript => {
          entry.transcript = transcript;
          entry.transcribedAt = new Date().toISOString();
          saveEntries();
          log(`Transcribed entry ${entry.id}: "${transcript.substring(0, 50)}..."`);

          // Auto-analyze if Anthropic key configured
          if (process.env.ANTHROPIC_API_KEY) {
            try {
              const analysis = await analyzeTranscript(transcript, entry.context);
              Object.assign(entry, {
                summary: analysis.summary,
                sentiment: analysis.sentiment,
                sentimentScore: analysis.sentimentScore,
                topics: analysis.topics,
                actionItems: analysis.actionItems,
                mood: analysis.mood,
                processed: true,
                analyzedAt: new Date().toISOString()
              });
              saveEntries();
              log(`Analyzed entry ${entry.id}: ${analysis.sentiment}, "${analysis.summary.substring(0, 40)}..."`);
            } catch (err) {
              log(`Analysis failed for ${entry.id}: ${err.message}`, 'ERROR');
              entry.processed = true;
              saveEntries();
            }
          } else {
            entry.processed = true;
            saveEntries();
          }
        })
        .catch(err => {
          log(`Transcription failed for ${entry.id}: ${err.message}`, 'ERROR');
        });
    }
  } catch (err) {
    log(`Ingest error: ${err.message}`, 'ERROR');
    res.status(500).json({ success: false, error: err.message });
  }
});

// Manual transcription endpoint
app.post('/api/lifelog/transcribe/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const entry = entries.find(e => e.id === id);

  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  if (!entry.audioPath) return res.status(400).json({ error: 'No audio file' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  try {
    log(`Manual transcription requested for entry ${id}`);
    const transcript = await transcribeAudio(entry.audioPath);
    entry.transcript = transcript;
    entry.transcribedAt = new Date().toISOString();
    saveEntries();
    log(`Transcribed entry ${id}: "${transcript.substring(0, 50)}..."`);

    // Auto-analyze after manual transcription
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const analysis = await analyzeTranscript(transcript, entry.context);
        Object.assign(entry, {
          summary: analysis.summary,
          sentiment: analysis.sentiment,
          sentimentScore: analysis.sentimentScore,
          topics: analysis.topics,
          actionItems: analysis.actionItems,
          mood: analysis.mood,
          processed: true,
          analyzedAt: new Date().toISOString()
        });
        saveEntries();
        log(`Analyzed entry ${id}: ${analysis.sentiment}`);
        res.json({ success: true, transcript, analysis });
      } catch (err) {
        log(`Analysis failed for ${id}: ${err.message}`, 'ERROR');
        entry.processed = true;
        saveEntries();
        res.json({ success: true, transcript, analysisError: err.message });
      }
    } else {
      entry.processed = true;
      saveEntries();
      res.json({ success: true, transcript });
    }
  } catch (err) {
    log(`Transcription failed for ${id}: ${err.message}`, 'ERROR');
    res.status(500).json({ error: err.message });
  }
});

// Manual analysis endpoint
app.post('/api/lifelog/analyze/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const entry = entries.find(e => e.id === id);

  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  if (!entry.transcript) return res.status(400).json({ error: 'No transcript to analyze' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    log(`Manual analysis requested for entry ${id}`);
    const analysis = await analyzeTranscript(entry.transcript, entry.context);
    Object.assign(entry, {
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      sentimentScore: analysis.sentimentScore,
      topics: analysis.topics,
      actionItems: analysis.actionItems,
      mood: analysis.mood,
      analyzedAt: new Date().toISOString()
    });
    saveEntries();
    log(`Analyzed entry ${id}: ${analysis.sentiment}, "${analysis.summary.substring(0, 40)}..."`);
    res.json({ success: true, analysis });
  } catch (err) {
    log(`Analysis failed for ${id}: ${err.message}`, 'ERROR');
    res.status(500).json({ error: err.message });
  }
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

// ============ HEALTH, STATUS & LOGS ============

app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(logBuffer.slice(-limit));
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'kinship-lifelog',
    version: '1.2.0',
    uptime: process.uptime(),
    entries: entries.length,
    whisperEnabled: !!process.env.OPENAI_API_KEY,
    claudeEnabled: !!process.env.ANTHROPIC_API_KEY
  });
});

app.get('/api/status', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = entries.filter(e => e.timestamp.startsWith(today));
  const transcribed = entries.filter(e => e.transcript).length;
  const analyzed = entries.filter(e => e.summary).length;
  const pendingTranscription = entries.filter(e => e.audioPath && !e.transcript).length;
  const pendingAnalysis = entries.filter(e => e.transcript && !e.summary).length;

  res.json({
    total: entries.length,
    today: todayEntries.length,
    transcribed,
    analyzed,
    pendingTranscription,
    pendingAnalysis,
    lastEntry: entries[entries.length - 1]?.timestamp || null,
    whisperEnabled: !!process.env.OPENAI_API_KEY,
    claudeEnabled: !!process.env.ANTHROPIC_API_KEY
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
