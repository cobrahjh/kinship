# LifeLog — Your AI Memory Companion

**Tagline:** "Never lose a thought. Understand yourself better."

---

## The Problem

People have thousands of thoughts, ideas, and conversations daily. Most are lost forever.

- "What was that idea I had in the shower?"
- "What did the doctor actually say?"
- "Why do I always feel drained on Wednesdays?"
- "I know I thought about this before, but what did I decide?"

Journals require effort. Notes get scattered. Memory fades.

**What if you could just... talk, and your life would remember?**

---

## The Solution

LifeLog is a voice-first personal companion that:

1. **Captures** your voice notes effortlessly
2. **Understands** what you meant, not just what you said
3. **Connects** ideas across days, weeks, months
4. **Surfaces** insights you'd never notice yourself
5. **Respects** your privacy completely

---

## Target Users

### Primary
| Persona | Need | Hook |
|---------|------|------|
| **Busy Professional** | Capture ideas between meetings | "Your second brain that actually works" |
| **Person with ADHD** | Externalize racing thoughts | "Stop losing brilliant ideas" |
| **Therapy/Self-growth** | Track patterns, mood, progress | "See yourself clearly" |
| **Caregiver/Patient** | Remember appointments, instructions | "Never miss important details" |
| **Creative** | Capture inspiration anywhere | "Ideas don't wait for notebooks" |
| **Aging Adult** | Memory support | "Your memory, backed up" |

### Secondary
- Students (lecture notes, study ideas)
- Entrepreneurs (capture everything)
- Writers (dialogue, observations)
- Anyone doing talk therapy

---

## Core Experience

### 1. Capture (Dead Simple)

**Phone App:**
```
┌─────────────────────────┐
│                         │
│                         │
│      ┌─────────┐        │
│      │         │        │
│      │   🎙️    │        │  ← Big tap target
│      │  HOLD   │        │
│      └─────────┘        │
│                         │
│   "Just talk. I've got  │
│        you."            │
│                         │
└─────────────────────────┘
```

**Interactions:**
- **Tap & hold** to record (releases to stop)
- **Double-tap** for continuous recording
- **Shake phone** to quick-capture (accessibility)
- **"Hey LifeLog"** hands-free trigger (optional)
- **Widget** on home screen for 1-tap access
- **Watch app** (Apple Watch / WearOS)

**No friction. No categorizing. No thinking. Just talk.**

---

### 2. Automatic Understanding

User says:
> "Remind me to call mom about the birthday party, also I had a weird pain in my knee today, oh and I think the Johnson proposal needs the budget section reworked, Sarah mentioned their CFO is really particular about margins"

LifeLog extracts:
```
📋 Action Item: Call mom about birthday party
🏥 Health Note: Knee pain reported
💼 Work Note: Johnson proposal - rework budget section
👤 Person: Sarah (context: Johnson account)
👤 Person: Johnson CFO - particular about margins
```

**User doesn't organize. AI organizes.**

---

### 3. Smart Surfaces

#### Daily Recap (Push notification at chosen time)
```
┌─────────────────────────┐
│ 📅 Your Tuesday Recap   │
├─────────────────────────┤
│                         │
│ You captured 12 moments │
│                         │
│ 💡 3 ideas              │
│ ✅ 5 action items       │
│ 👤 Mentioned: Sarah,    │
│    Mom, Dr. Chen        │
│                         │
│ 😊 Mood: Mostly positive│
│    (dip around 3pm)     │
│                         │
│ [View Full Day]         │
└─────────────────────────┘
```

#### Weekly Insights
```
┌─────────────────────────┐
│ 📊 Week in Review       │
├─────────────────────────┤
│                         │
│ Patterns noticed:       │
│                         │
│ • You mentioned "tired" │
│   6 times this week     │
│   (up from 2 last week) │
│                         │
│ • Most creative ideas   │
│   came between 9-11am   │
│                         │
│ • You've mentioned the  │
│   garage project 4x but │
│   no action items yet   │
│                         │
│ 💬 "Maybe schedule that │
│    garage time?"        │
│                         │
└─────────────────────────┘
```

#### Monthly Reflection
- Mood trends graphed
- Recurring themes identified
- Goals mentioned vs completed
- Relationship patterns (who you talk about most)
- Health mentions tracked
- Growth areas highlighted

---

### 4. Conversational Retrieval

**User asks:**
> "What did I say about the Johnson account?"

**LifeLog responds:**
> Over the past 2 weeks, you've mentioned Johnson 7 times:
> 
> - Jan 15: "Sarah mentioned their CFO is particular about margins"
> - Jan 18: "Johnson meeting went well, they want revised proposal by Friday"
> - Jan 22: "Need to rework budget section"
> - Jan 26: "Sent the proposal, waiting to hear back"
>
> Want me to summarize the full context?

**Natural language, not search syntax.**

---

### 5. Proactive Companion

LifeLog doesn't just store—it **helps**.

| Trigger | Response |
|---------|----------|
| User mentions same worry 3+ times | "I've noticed [X] keeps coming up. Want to talk through it or set an action?" |
| Action item older than 7 days | "You mentioned [X] on the 15th. Still on your radar?" |
| Mood declining trend | "Your notes have felt heavier this week. That's okay. Here if you need." |
| Repeated positive about person | "You've mentioned how great Sarah is 5 times. Told her lately?" |
| Health symptom pattern | "You've mentioned knee pain 3 times in 2 weeks. Worth noting for Dr. Chen?" |

**Not pushy. Not creepy. Just... thoughtful.**

---

## Privacy Architecture

### The Trust Problem

People won't record their innermost thoughts if they fear:
- Data breaches
- Company reading their notes
- Ads based on their fears
- Government subpoenas

### The Solution: Privacy Tiers

```
┌─────────────────────────────────────────────────────────────┐
│                    PRIVACY TIERS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔒 TIER 1: Local Only (Free)                              │
│     • All data stays on device                              │
│     • On-device AI (smaller model)                          │
│     • No account required                                   │
│     • Limited insights (no cloud compute)                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔐 TIER 2: Encrypted Cloud (Subscription)                 │
│     • End-to-end encrypted                                  │
│     • You hold the keys (we can't read it)                  │
│     • Full AI insights (computed on encrypted data)         │
│     • Cross-device sync                                     │
│     • We literally cannot access your data                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🏠 TIER 3: Self-Hosted (Power Users)                      │
│     • Run your own server                                   │
│     • Connect your own AI keys                              │
│     • Full control                                          │
│     • Open source option                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Technical Privacy

- **Zero-knowledge architecture** where possible
- **On-device transcription** option (Whisper runs locally)
- **Encryption at rest** with user-held keys
- **No training on user data** (explicit policy)
- **GDPR/CCPA compliant** - full data export/deletion
- **Warrant canary** for transparency

---

## Feature Roadmap

### MVP (v1.0)
- [ ] Tap-to-record capture
- [ ] Automatic transcription
- [ ] Basic AI extraction (topics, action items, people)
- [ ] Daily recap notification
- [ ] Simple search
- [ ] Local storage option

### Growth (v1.5)
- [ ] Weekly/monthly insights
- [ ] Mood tracking & visualization
- [ ] Natural language queries
- [ ] Watch app (Apple Watch, WearOS)
- [ ] Widget for quick capture
- [ ] Calendar integration (context for meetings)

### Mature (v2.0)
- [ ] Proactive companion nudges
- [ ] Relationship insights (people you mention)
- [ ] Health pattern detection
- [ ] Goal tracking from voice
- [ ] Shared memories (family, couples)
- [ ] Therapist/coach export mode

### Platform (v3.0)
- [ ] API for developers
- [ ] Integrations (Notion, Obsidian, Apple Notes)
- [ ] Wearable device partnerships
- [ ] Enterprise version (meeting notes, team insights)

---

## Business Model

### Freemium

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 30 captures/month, on-device only, basic search |
| **Personal** | $9.99/mo | Unlimited captures, cloud sync, full insights |
| **Family** | $14.99/mo | Up to 5 members, shared memories |
| **Lifetime** | $199 | Personal tier forever |

### Why This Works
- Free tier provides real value (captures habit)
- Insights are the "aha" that drives upgrades
- Privacy-focused = premium positioning
- Lifetime option for trust (we're not going anywhere)

---

## Competitive Landscape

| Product | Strength | Weakness | Our Angle |
|---------|----------|----------|-----------|
| **Otter.ai** | Best transcription | Meeting-focused, no personal insights | Life-focused, not work-focused |
| **Day One** | Beautiful journal | Requires writing effort | Voice-first, zero friction |
| **Notion** | Flexible | Complex, manual organization | AI organizes for you |
| **Apple Notes** | Built-in | No intelligence | Smart, not just storage |
| **Limitless** | Wearable | Hardware required, $100+ | Phone you already have |
| **Reflect** | AI notes | Text-first | Voice-first |

**Our moat:** Voice-first + AI understanding + privacy-first + insights

---

## User Flows

### Onboarding (< 2 minutes)

```
Screen 1: "LifeLog remembers so you don't have to"
          [Get Started]

Screen 2: "First, a quick test"
          [Hold to record]
          "Tell me about your day so far"
          
Screen 3: [Shows AI extraction]
          "I heard: [summary]"
          "I noticed: [topics, people, action items]"
          "Pretty cool, right?"
          
Screen 4: "When should I send your daily recap?"
          [Time picker - defaults to 8pm]
          
Screen 5: "One more thing - your privacy"
          ○ Keep everything on this phone (free)
          ○ Sync across devices, encrypted (trial)
          
Screen 6: "You're ready. Just talk."
          [Big record button]
```

### Daily Use

```
Morning:
  - Notification: "Good morning! Capture your intentions?"
  - Quick record while making coffee
  
Throughout day:
  - Idea strikes → pull out phone → tap → talk → done
  - After meeting → quick debrief → AI extracts action items
  - Feeling stressed → vent to LifeLog → it listens
  
Evening:
  - Push notification: "Your day in 30 seconds"
  - See recap, feel organized
  - Optional: voice reflection on the day
```

---

## Technical Architecture (Simplified)

```
┌──────────────────────────────────────────────────────────┐
│                      USER DEVICE                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   Record    │→ │ Transcribe  │→ │   Store     │      │
│  │   (Audio)   │  │  (Whisper)  │  │  (SQLite)   │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│                          ↓                               │
│                   ┌─────────────┐                        │
│                   │  Local AI   │  ← On-device inference │
│                   │  (Extract)  │                        │
│                   └─────────────┘                        │
└──────────────────────────────────────────────────────────┘
                           │
                    (if cloud tier)
                           ↓
┌──────────────────────────────────────────────────────────┐
│                      CLOUD (E2E Encrypted)               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │    Sync     │  │  Deep AI    │  │   Insights  │      │
│  │   (Backup)  │  │ (Analysis)  │  │  (Patterns) │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└──────────────────────────────────────────────────────────┘
```

### Tech Stack (Proposed)

**Mobile:**
- React Native (iOS + Android from one codebase)
- Expo for rapid development
- On-device Whisper (whisper.cpp)
- SQLite for local storage

**Cloud (optional tier):**
- Supabase (Postgres + Auth + Realtime)
- Edge functions for AI processing
- E2E encryption layer

**AI:**
- Whisper for transcription
- Claude API for understanding/insights
- Local LLM option (Llama 3.2) for privacy tier

---

## Metrics That Matter

### Engagement
- DAU/MAU ratio (target: 40%+)
- Captures per user per day (target: 3+)
- Recap open rate (target: 60%+)

### Retention
- D1: 70%
- D7: 50%
- D30: 30%

### Business
- Free → Paid conversion: 5%
- Monthly churn: <5%
- LTV: $120+

### North Star
**"Moments captured that would otherwise be lost"**

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Privacy breach destroys trust | Zero-knowledge architecture, security audits |
| AI extraction errors frustrate | User correction feedback loop, improve models |
| Big tech copies us | Move fast, build community, privacy moat |
| Recording feels weird | Normalize through onboarding, show value fast |
| Legal issues (recording laws) | Clear education, consent prompts, geo-restrictions |

---

## Go-To-Market

### Phase 1: Early Adopters
- ProductHunt launch
- ADHD/productivity communities (Reddit, Twitter)
- Tech podcasts
- Influencer partnerships (productivity YouTubers)

### Phase 2: Growth
- App Store optimization
- Content marketing (blog: "quantified self")
- Referral program ("Give a friend their memory back")
- Partnerships (therapy apps, health apps)

### Phase 3: Mainstream
- Brand campaigns (emotional, not feature-focused)
- TV/podcast ads
- Enterprise offering

---

## The Bigger Vision

Today: Personal voice notes with AI understanding

Tomorrow: **A complete external memory for your life**

- Every conversation (with consent)
- Every meeting
- Every thought
- Every decision

Searchable. Understandable. **Yours.**

Not for surveillance. Not for ads. For **you** to understand yourself better, remember more, and live more intentionally.

---

## Next Steps

1. [ ] Validate: User interviews (10 people in target personas)
2. [ ] Prototype: Figma clickable prototype
3. [ ] MVP: React Native app with core capture + transcription
4. [ ] Test: 50 beta users for 2 weeks
5. [ ] Iterate: Based on feedback
6. [ ] Launch: ProductHunt + communities

---

## Questions to Answer

- Name: LifeLog? Capture? Remember? Second Mind? Echo?
- Pricing: Is $9.99 right? $4.99 for wider adoption?
- Wearable: Partner with existing (Limitless) or build our own eventually?
- Open source: Core app open, insights proprietary?

---

**This is the product. Ready to build it?**
