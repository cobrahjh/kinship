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

// ============ OPENAI / EMBEDDINGS ============
async function generateEmbedding(text) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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

async function generateDailyDigest(dayEntries, dateStr) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  // Build summary of entries for Claude
  const entrySummaries = dayEntries.map((e, i) => {
    const time = new Date(e.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const content = e.summary || e.transcript || '(no content)';
    const mood = e.mood ? ` [${e.mood}]` : '';
    return `${time}: ${content}${mood}`;
  }).join('\n');

  const allTopics = [...new Set(dayEntries.flatMap(e => e.topics || []))];
  const allActions = dayEntries.flatMap(e => e.actionItems || []);
  const sentiments = dayEntries.filter(e => e.sentiment).map(e => e.sentiment);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Generate a daily digest for ${dateStr}. This is a personal voice journal.

Entries from today:
${entrySummaries}

Topics mentioned: ${allTopics.join(', ') || 'none'}
Sentiments: ${sentiments.join(', ') || 'none'}
Action items found: ${allActions.join('; ') || 'none'}

Create a warm, insightful daily digest. Respond in JSON format only:
{
  "title": "A brief title for the day (2-5 words)",
  "narrative": "A 2-3 paragraph reflection on the day, written in second person (you), connecting themes and noting patterns",
  "overallMood": "one word for overall mood",
  "highlights": ["key moment 1", "key moment 2"],
  "actionItems": ["consolidated action items"],
  "reflection": "A brief encouraging thought or question for tomorrow"
}`
    }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid digest response');
  return JSON.parse(jsonMatch[0]);
}

async function generateWeeklyDigest(weekEntries, startDate, endDate) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  // Group entries by day
  const byDay = {};
  weekEntries.forEach(e => {
    const day = e.timestamp.split('T')[0];
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(e);
  });

  // Build day summaries
  const daySummaries = Object.entries(byDay).map(([day, entries]) => {
    const dayName = new Date(day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const summaries = entries.map(e => e.summary || e.transcript?.substring(0, 100) || '(audio)').join('; ');
    const moods = entries.filter(e => e.mood).map(e => e.mood).join(', ');
    return `${dayName}: ${entries.length} entries. ${summaries}${moods ? ` [Moods: ${moods}]` : ''}`;
  }).join('\n');

  const allTopics = [...new Set(weekEntries.flatMap(e => e.topics || []))];
  const allActions = weekEntries.flatMap(e => e.actionItems || []);
  const sentimentCounts = {};
  weekEntries.forEach(e => {
    if (e.sentiment) sentimentCounts[e.sentiment] = (sentimentCounts[e.sentiment] || 0) + 1;
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Generate a weekly digest for ${startDate} to ${endDate}. This is a personal voice journal.

Week summary by day:
${daySummaries}

Topics across the week: ${allTopics.join(', ') || 'none'}
Sentiment distribution: ${Object.entries(sentimentCounts).map(([k,v]) => `${k}: ${v}`).join(', ') || 'none'}
Action items collected: ${allActions.join('; ') || 'none'}

Create an insightful weekly reflection. Respond in JSON format only:
{
  "title": "A brief title for the week (2-5 words)",
  "narrative": "A 3-4 paragraph reflection on the week, written in second person (you), identifying patterns, growth, and themes across days",
  "overallMood": "one word for the week's overall mood",
  "topThemes": ["theme 1", "theme 2", "theme 3"],
  "wins": ["accomplishment or positive moment 1", "win 2"],
  "challenges": ["challenge faced 1"] or [],
  "patterns": ["behavioral or emotional pattern noticed"],
  "actionItems": ["consolidated/prioritized action items for next week"],
  "weekAhead": "An encouraging thought or intention for the coming week"
}`
    }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid weekly digest response');
  return JSON.parse(jsonMatch[0]);
}

// ============ PATTERN DETECTION ============
function detectPatterns(entries, days = 30) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Filter entries within the time range
  const recentEntries = entries.filter(e => new Date(e.timestamp) >= cutoff);

  if (recentEntries.length === 0) {
    return { error: 'No entries in the specified time range' };
  }

  // Topic frequency
  const topicCounts = {};
  recentEntries.forEach(e => {
    (e.topics || []).forEach(topic => {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });
  });
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  // Mood frequency
  const moodCounts = {};
  recentEntries.forEach(e => {
    if (e.mood) {
      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
    }
  });
  const moodDistribution = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([mood, count]) => ({ mood, count }));

  // Sentiment over time (daily averages)
  const sentimentByDay = {};
  recentEntries.forEach(e => {
    if (e.sentimentScore !== undefined) {
      const day = e.timestamp.split('T')[0];
      if (!sentimentByDay[day]) sentimentByDay[day] = [];
      sentimentByDay[day].push(e.sentimentScore);
    }
  });
  const sentimentTrend = Object.entries(sentimentByDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, scores]) => ({
      date,
      avgSentiment: scores.reduce((a, b) => a + b, 0) / scores.length,
      entries: scores.length
    }));

  // Time-of-day patterns
  const hourCounts = {};
  const moodByHour = {};
  recentEntries.forEach(e => {
    const hour = new Date(e.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    if (e.mood) {
      if (!moodByHour[hour]) moodByHour[hour] = [];
      moodByHour[hour].push(e.mood);
    }
  });

  const timePatterns = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hour, count]) => {
      const moods = moodByHour[hour] || [];
      const moodFreq = {};
      moods.forEach(m => moodFreq[m] = (moodFreq[m] || 0) + 1);
      const topMood = Object.entries(moodFreq).sort((a, b) => b[1] - a[1])[0];
      return {
        hour: parseInt(hour),
        timeLabel: hour + ':00',
        count,
        commonMood: topMood ? topMood[0] : null
      };
    });

  // Day-of-week patterns
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeekCounts = {};
  recentEntries.forEach(e => {
    const dayOfWeek = new Date(e.timestamp).getDay();
    dayOfWeekCounts[dayOfWeek] = (dayOfWeekCounts[dayOfWeek] || 0) + 1;
  });
  const dayOfWeekPatterns = Object.entries(dayOfWeekCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([day, count]) => ({ day: dayNames[day], count }));

  // Overall stats
  const entriesWithSentiment = recentEntries.filter(e => e.sentimentScore !== undefined);
  const avgSentiment = entriesWithSentiment.length > 0
    ? entriesWithSentiment.reduce((sum, e) => sum + e.sentimentScore, 0) / entriesWithSentiment.length
    : 0;

  return {
    period: { days, from: cutoff.toISOString().split('T')[0], to: now.toISOString().split('T')[0] },
    totalEntries: recentEntries.length,
    avgSentiment: Math.round(avgSentiment * 100) / 100,
    topTopics,
    moodDistribution,
    sentimentTrend,
    timePatterns,
    dayOfWeekPatterns
  };
}

async function generatePatternInsights(patterns) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  const topicsStr = patterns.topTopics.map(t => t.topic + ' (' + t.count + 'x)').join(', ') || 'none';
  const moodsStr = patterns.moodDistribution.map(m => m.mood + ' (' + m.count + 'x)').join(', ') || 'none';
  const timesStr = patterns.timePatterns.map(t => t.timeLabel + ' (' + t.count + ' entries, mood: ' + (t.commonMood || 'unknown') + ')').join(', ');
  const daysStr = patterns.dayOfWeekPatterns.map(d => d.day + ' (' + d.count + ')').join(', ');

  const prompt = `Analyze these patterns from a personal voice journal over ${patterns.period.days} days (${patterns.totalEntries} entries):

Top Topics: ${topicsStr}
Mood Distribution: ${moodsStr}
Average Sentiment: ${patterns.avgSentiment} (0=negative, 1=positive)
Most Active Times: ${timesStr}
Most Active Days: ${daysStr}

Provide insightful observations. Respond in JSON format only:
{
  "insights": ["insight 1", "insight 2", "insight 3"],
  "strengths": ["positive pattern 1"],
  "areasForAttention": ["area that might need attention"],
  "suggestions": ["actionable suggestion based on patterns"],
  "summary": "A 2-3 sentence overall summary of what these patterns reveal"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid pattern insights response');
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

              // Generate embedding for semantic search
              try {
                const textToEmbed = `${transcript} ${analysis.summary}`;
                entry.embedding = await generateEmbedding(textToEmbed);
                entry.embeddedAt = new Date().toISOString();
                saveEntries();
                log(`Embedded entry ${entry.id}`);
              } catch (embErr) {
                log(`Embedding failed for ${entry.id}: ${embErr.message}`, 'ERROR');
              }
            } catch (err) {
              log(`Analysis failed for ${entry.id}: ${err.message}`, 'ERROR');
              entry.processed = true;
              saveEntries();
            }
          } else {
            // No Claude key, just embed transcript
            try {
              entry.embedding = await generateEmbedding(transcript);
              entry.embeddedAt = new Date().toISOString();
              entry.processed = true;
              saveEntries();
              log(`Embedded entry ${entry.id} (no analysis)`);
            } catch (embErr) {
              log(`Embedding failed for ${entry.id}: ${embErr.message}`, 'ERROR');
              entry.processed = true;
              saveEntries();
            }
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

// Semantic search using embeddings
app.get('/api/lifelog/search/semantic', async (req, res) => {
  const { q, limit = 10, threshold = 0.3 } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured for semantic search' });
  }

  try {
    log(`Semantic search: "${q}"`);

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(q);

    // Find entries with embeddings and calculate similarity
    const entriesWithEmbeddings = entries.filter(e => e.embedding);

    if (entriesWithEmbeddings.length === 0) {
      return res.json({ results: [], message: 'No embedded entries yet' });
    }

    const scored = entriesWithEmbeddings.map(e => ({
      ...e,
      similarity: cosineSimilarity(queryEmbedding, e.embedding)
    }));

    // Sort by similarity and filter by threshold
    const results = scored
      .filter(e => e.similarity >= parseFloat(threshold))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, parseInt(limit))
      .map(e => {
        // Remove embedding from response (too large)
        const { embedding, ...rest } = e;
        return rest;
      });

    log(`Semantic search found ${results.length} results`);
    res.json({ results, query: q, totalEmbedded: entriesWithEmbeddings.length });
  } catch (err) {
    log(`Semantic search error: ${err.message}`, 'ERROR');
    res.status(500).json({ error: err.message });
  }
});

// Embed a single entry manually
app.post('/api/lifelog/embed/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const entry = entries.find(e => e.id === id);

  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  if (!entry.transcript) return res.status(400).json({ error: 'No transcript to embed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  try {
    const textToEmbed = entry.summary ? `${entry.transcript} ${entry.summary}` : entry.transcript;
    entry.embedding = await generateEmbedding(textToEmbed);
    entry.embeddedAt = new Date().toISOString();
    saveEntries();
    log(`Manually embedded entry ${id}`);
    res.json({ success: true });
  } catch (err) {
    log(`Embed failed for ${id}: ${err.message}`, 'ERROR');
    res.status(500).json({ error: err.message });
  }
});

// Embed all entries that don't have embeddings
app.post('/api/lifelog/embed-all', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const unembedded = entries.filter(e => e.transcript && !e.embedding);
  log(`Embedding ${unembedded.length} entries...`);

  let embedded = 0;
  let failed = 0;

  for (const entry of unembedded) {
    try {
      const textToEmbed = entry.summary ? `${entry.transcript} ${entry.summary}` : entry.transcript;
      entry.embedding = await generateEmbedding(textToEmbed);
      entry.embeddedAt = new Date().toISOString();
      embedded++;
    } catch (err) {
      log(`Embed failed for ${entry.id}: ${err.message}`, 'ERROR');
      failed++;
    }
  }

  saveEntries();
  log(`Embedding complete: ${embedded} success, ${failed} failed`);
  res.json({ success: true, embedded, failed, total: unembedded.length });
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
app.get('/api/lifelog/digest/:date', async (req, res) => {
  const dateStr = req.params.date;
  const dayEntries = entries.filter(e => e.timestamp.startsWith(dateStr));

  const contexts = {};
  dayEntries.forEach(e => {
    contexts[e.context] = (contexts[e.context] || 0) + 1;
  });

  const sentiments = {};
  dayEntries.forEach(e => {
    if (e.sentiment) sentiments[e.sentiment] = (sentiments[e.sentiment] || 0) + 1;
  });

  const basicDigest = {
    date: dateStr,
    totalEntries: dayEntries.length,
    contexts,
    sentiments,
    topics: [...new Set(dayEntries.flatMap(e => e.topics || []))],
    actionItems: dayEntries.flatMap(e => e.actionItems || []),
    entries: dayEntries
  };

  // Generate AI digest if requested and Claude is available
  if (req.query.ai === 'true' && process.env.ANTHROPIC_API_KEY && dayEntries.length > 0) {
    try {
      log(`Generating AI digest for ${dateStr}`);
      const aiDigest = await generateDailyDigest(dayEntries, dateStr);
      basicDigest.ai = aiDigest;
      log(`AI digest generated for ${dateStr}: "${aiDigest.title}"`);
    } catch (err) {
      log(`AI digest failed for ${dateStr}: ${err.message}`, 'ERROR');
      basicDigest.aiError = err.message;
    }
  }

  res.json(basicDigest);
});

// Get weekly digest
app.get('/api/lifelog/digest/week/:date', async (req, res) => {
  const dateStr = req.params.date; // Any date in the week (will find week boundaries)
  const targetDate = new Date(dateStr);

  // Find start of week (Sunday)
  const startOfWeek = new Date(targetDate);
  startOfWeek.setDate(targetDate.getDate() - targetDate.getDay());
  const startStr = startOfWeek.toISOString().split('T')[0];

  // Find end of week (Saturday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const endStr = endOfWeek.toISOString().split('T')[0];

  // Get all entries in the week
  const weekEntries = entries.filter(e => {
    const entryDate = e.timestamp.split('T')[0];
    return entryDate >= startStr && entryDate <= endStr;
  });

  // Group by day
  const byDay = {};
  weekEntries.forEach(e => {
    const day = e.timestamp.split('T')[0];
    if (!byDay[day]) byDay[day] = { count: 0, moods: [], topics: [] };
    byDay[day].count++;
    if (e.mood) byDay[day].moods.push(e.mood);
    if (e.topics) byDay[day].topics.push(...e.topics);
  });

  const sentiments = {};
  weekEntries.forEach(e => {
    if (e.sentiment) sentiments[e.sentiment] = (sentiments[e.sentiment] || 0) + 1;
  });

  const basicDigest = {
    weekStart: startStr,
    weekEnd: endStr,
    totalEntries: weekEntries.length,
    daysWithEntries: Object.keys(byDay).length,
    byDay,
    sentiments,
    topics: [...new Set(weekEntries.flatMap(e => e.topics || []))],
    actionItems: weekEntries.flatMap(e => e.actionItems || []),
  };

  // Generate AI digest if requested
  if (req.query.ai === 'true' && process.env.ANTHROPIC_API_KEY && weekEntries.length > 0) {
    try {
      log(`Generating weekly AI digest for ${startStr} to ${endStr}`);
      const aiDigest = await generateWeeklyDigest(weekEntries, startStr, endStr);
      basicDigest.ai = aiDigest;
      log(`Weekly digest generated: "${aiDigest.title}"`);
    } catch (err) {
      log(`Weekly AI digest failed: ${err.message}`, 'ERROR');
      basicDigest.aiError = err.message;
    }
  }

  res.json(basicDigest);
});

// ============ HEALTH, STATUS & LOGS ============

app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(logBuffer.slice(-limit));
});


// Pattern detection endpoint
app.get('/api/lifelog/patterns', async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const ai = req.query.ai === 'true';

  log('Pattern detection requested: ' + days + ' days, AI insights: ' + ai);

  try {
    const patterns = detectPatterns(entries, days);

    if (patterns.error) {
      return res.json({ patterns: null, error: patterns.error });
    }

    if (ai) {
      try {
        const insights = await generatePatternInsights(patterns);
        return res.json({ patterns, ai: insights });
      } catch (aiErr) {
        log('AI pattern insights failed: ' + aiErr.message, 'ERROR');
        return res.json({ patterns, ai: null, aiError: aiErr.message });
      }
    }

    res.json({ patterns });
  } catch (err) {
    log('Pattern detection failed: ' + err.message, 'ERROR');
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'kinship-lifelog',
    version: '1.5.0',
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
