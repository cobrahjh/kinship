# Kinship - AI Memory Companion

**Tagline:** "Never lose a thought. Understand yourself better."

---

## Overview

Kinship is a voice-first personal companion that captures your voice notes effortlessly, understands what you meant, and connects ideas across days, weeks, and months.

**Port:** 8766
**Stack:** Node.js, Express, JSON file storage

---

## Core Features

### Voice Capture
- Tap-to-record voice notes
- Context tagging (auto, health, idea, personal, work)
- Audio file storage with metadata
- Journal view of all entries

### AI Pipeline
When you record a voice note, Kinship automatically:
1. **Transcribes** using OpenAI Whisper
2. **Analyzes** using Claude (summary, sentiment, topics, action items, mood)
3. **Embeds** using OpenAI text-embedding-3-small for semantic search

### Semantic Search
Search by meaning, not just keywords:
- Natural language queries ("times I felt anxious about work")
- Cosine similarity matching against all embedded entries
- Results ranked by relevance with similarity scores

### Daily & Weekly Digests
AI-generated reflections on your entries:
- **Daily**: Title, narrative, mood, highlights, action items, reflection
- **Weekly**: Themes, wins, challenges, patterns noticed, week ahead intention

---

## Project Structure

```
C:\kinship\
├── server.js           # Express server (port 8766)
├── package.json        # Dependencies (express, multer, openai, @anthropic-ai/sdk)
├── CLAUDE.md           # This documentation
├── public/
│   ├── index.html      # Main dashboard (Capture, Journal, Search, Digest tabs)
│   └── manifest.json   # PWA manifest
├── plugins/
│   └── exercise/       # Future: Exercise tracking plugin
├── data/
│   ├── entries.json    # Voice note metadata + embeddings
│   └── audio/          # Audio recordings (webm)
└── docs/
    ├── LIFELOG-CONSUMER-PRODUCT-SPEC.md
    └── LIFELOG-MODULE-SPEC.md
```

---

## API Endpoints

### LifeLog
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/lifelog/ingest` | Upload voice note (auto-transcribes & analyzes) |
| POST | `/api/lifelog/transcribe/:id` | Manually transcribe entry |
| POST | `/api/lifelog/analyze/:id` | Manually analyze entry with Claude |
| GET | `/api/lifelog/entries` | Get all entries |
| GET | `/api/lifelog/entries/:date` | Get entries for date |
| GET | `/api/lifelog/search?q=` | Search entries (keyword) |
| GET | `/api/lifelog/search/semantic?q=` | Semantic search using embeddings |
| POST | `/api/lifelog/embed/:id` | Generate embedding for entry |
| POST | `/api/lifelog/embed-all` | Embed all unembedded entries |
| PATCH | `/api/lifelog/entries/:id` | Update entry |
| DELETE | `/api/lifelog/entries/:id` | Delete entry |
| GET | `/api/lifelog/digest/:date` | Get daily digest (add ?ai=true for AI narrative) |
| GET | `/api/lifelog/digest/week/:date` | Get weekly digest (any date in week, ?ai=true for AI) |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Service health check |
| GET | `/api/status` | Aggregated stats |

---

## Quick Start

```bash
cd C:\kinship
npm install

# Enable Whisper transcription (optional)
set OPENAI_API_KEY=sk-your-key-here

# Enable Claude analysis (optional)
set ANTHROPIC_API_KEY=sk-ant-your-key-here

npm start
# Open http://localhost:8766
```

---

## Plugins (Future)

### Exercise Plugin
Location: `plugins/exercise/`

MS-focused exercise tracking based on neuroplasticity principles. To be integrated as a loadable plugin with its own routes and storage.

Features:
- Balance, Upper Body, Lower Body, Stretching, Aerobic categories
- Session timers with auto-play
- Progress tracking and streaks

---

## Roadmap

### Phase 1 (Current)
- [x] Basic voice capture UI
- [x] Audio file storage
- [x] REST API structure
- [x] JSON persistence

### Phase 2
- [x] Whisper transcription (OpenAI API)
- [x] Claude API for analysis (summary, sentiment, topics, action items)
- [x] Automatic summaries
- [x] Sentiment tracking

### Phase 3
- [x] Daily digests (AI-generated narrative, highlights, reflection)
- [x] Weekly digests (themes, wins, challenges, patterns, week ahead)
- [x] Semantic search with embeddings (OpenAI text-embedding-3-small)
- [ ] Pattern detection
- [ ] Plugin system for exercise, etc.

### Phase 4
- [ ] Family sharing
- [ ] Mobile PWA optimization
- [ ] Wearable integration

---

## Privacy

All data stays local by default:
- Audio files stored in `data/audio/`
- Metadata in `data/entries.json`
- No cloud sync unless explicitly configured

---

## AI Features Documentation

### Transcription (Whisper)

**Requires:** `OPENAI_API_KEY`

Automatically transcribes audio recordings using OpenAI's Whisper model.

```javascript
// Auto-triggered after recording, or manually:
POST /api/lifelog/transcribe/:id
```

### Analysis (Claude)

**Requires:** `ANTHROPIC_API_KEY`

Extracts insights from transcripts using Claude:

| Field | Description |
|-------|-------------|
| `summary` | 1-2 sentence summary |
| `sentiment` | positive / negative / neutral / mixed |
| `sentimentScore` | 0.0 (negative) to 1.0 (positive) |
| `topics` | Array of mentioned topics |
| `actionItems` | Extracted to-dos |
| `mood` | Single word emotional state |

```javascript
// Auto-triggered after transcription, or manually:
POST /api/lifelog/analyze/:id
```

### Semantic Search (Embeddings)

**Requires:** `OPENAI_API_KEY`

Uses OpenAI's `text-embedding-3-small` model to convert text to 1536-dimensional vectors.

**How it works:**
1. Each entry's transcript + summary is embedded and stored
2. Search queries are embedded at query time
3. Cosine similarity finds the most relevant entries

```javascript
// Search by meaning:
GET /api/lifelog/search/semantic?q=feeling stressed about deadlines&limit=10&threshold=0.3

// Response:
{
  "results": [
    { "id": 123, "similarity": 0.82, "summary": "...", ... },
    { "id": 456, "similarity": 0.71, "summary": "...", ... }
  ],
  "query": "feeling stressed about deadlines",
  "totalEmbedded": 47
}
```

**Batch embed existing entries:**
```javascript
POST /api/lifelog/embed-all
// Returns: { "embedded": 45, "failed": 2, "total": 47 }
```

### Daily Digest

**Requires:** `ANTHROPIC_API_KEY`

Generates a reflective summary of a single day's entries.

```javascript
GET /api/lifelog/digest/2026-01-28?ai=true

// Response includes:
{
  "ai": {
    "title": "A Day of Progress",
    "narrative": "You started the day feeling...",
    "overallMood": "productive",
    "highlights": ["completed project milestone", "good workout"],
    "actionItems": ["follow up with team", "schedule dentist"],
    "reflection": "What would make tomorrow even better?"
  }
}
```

### Weekly Digest

**Requires:** `ANTHROPIC_API_KEY`

Analyzes patterns across a full week (Sunday-Saturday).

```javascript
GET /api/lifelog/digest/week/2026-01-28?ai=true

// Response includes:
{
  "weekStart": "2026-01-26",
  "weekEnd": "2026-02-01",
  "ai": {
    "title": "Week of Growth",
    "narrative": "This week showed a pattern of...",
    "overallMood": "determined",
    "topThemes": ["health", "creativity", "family"],
    "wins": ["exercised 4 days", "finished book"],
    "challenges": ["sleep schedule disrupted"],
    "patterns": ["more energy after morning workouts"],
    "actionItems": ["prioritize sleep", "continue exercise streak"],
    "weekAhead": "Consider setting a consistent bedtime this week."
  }
}
```

---

## Environment Variables

| Variable | Required For | Description |
|----------|--------------|-------------|
| `OPENAI_API_KEY` | Transcription, Embeddings | OpenAI API key for Whisper and embeddings |
| `ANTHROPIC_API_KEY` | Analysis, Digests | Anthropic API key for Claude |

**Windows:**
```bash
set OPENAI_API_KEY=sk-...
set ANTHROPIC_API_KEY=sk-ant-...
npm start
```

**Linux/Mac:**
```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

---

## Entry Data Structure

Each voice note entry contains:

```json
{
  "id": 1706470800000,
  "timestamp": "2026-01-28T15:00:00.000Z",
  "device": "web",
  "context": "work",
  "audioPath": "data/audio/abc123",
  "transcript": "I had a great meeting today...",
  "summary": "Positive meeting with team about Q1 goals.",
  "sentiment": "positive",
  "sentimentScore": 0.85,
  "topics": ["work", "meetings", "goals"],
  "actionItems": ["Send follow-up email"],
  "mood": "optimistic",
  "embedding": [0.023, -0.041, ...],  // 1536 dimensions
  "processed": true,
  "transcribedAt": "2026-01-28T15:00:05.000Z",
  "analyzedAt": "2026-01-28T15:00:08.000Z",
  "embeddedAt": "2026-01-28T15:00:09.000Z",
  "createdAt": "2026-01-28T15:00:00.000Z"
}
```
