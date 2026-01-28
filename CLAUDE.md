# Kinship - AI Memory Companion

**Tagline:** "Never lose a thought. Understand yourself better."

---

## Overview

Kinship is a voice-first personal companion that captures your voice notes effortlessly, understands what you meant, and connects ideas across days, weeks, and months.

**Port:** 8760
**Stack:** Node.js, Express, JSON file storage

---

## Core Features

### Voice Capture
- Tap-to-record voice notes
- Context tagging (auto, health, idea, personal, work)
- Audio file storage with metadata
- Journal view of all entries

### Planned Features
- Whisper transcription integration
- Claude API for AI analysis and insights
- Daily/weekly/monthly digests
- Semantic search
- Pattern detection

---

## Project Structure

```
C:\kinship\
├── server.js           # Express server (port 8760)
├── package.json        # Dependencies
├── CLAUDE.md           # This file
├── public/
│   └── index.html      # Voice capture dashboard
├── plugins/
│   └── exercise/       # Future: MS Exercise plugin
│       └── index.html
├── data/
│   ├── entries.json    # Voice note metadata
│   └── audio/          # Audio recordings
└── docs/
    ├── LIFELOG-CONSUMER-PRODUCT-SPEC.md
    └── LIFELOG-MODULE-SPEC.md
```

---

## API Endpoints

### LifeLog
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/lifelog/ingest` | Upload voice note |
| GET | `/api/lifelog/entries` | Get all entries |
| GET | `/api/lifelog/entries/:date` | Get entries for date |
| GET | `/api/lifelog/search?q=` | Search entries |
| PATCH | `/api/lifelog/entries/:id` | Update entry |
| DELETE | `/api/lifelog/entries/:id` | Delete entry |
| GET | `/api/lifelog/digest/:date` | Get daily digest |

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
npm start
# Open http://localhost:8760
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
- [ ] Whisper transcription (local or API)
- [ ] Claude API for analysis
- [ ] Automatic summaries
- [ ] Sentiment tracking

### Phase 3
- [ ] Daily/weekly digests
- [ ] Semantic search with embeddings
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
