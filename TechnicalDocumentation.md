# 📋 AR Mentor — Technical Documentation

---

## PHASE 5: Sprint Planning (4-Member Team, 48-Hour Hackathon)

### Team Roles
| Member | Role | Primary Responsibilities |
|--------|------|------------------------|
| **Dev A** | AR Engineer | Three.js scenes, WebXR, 3D models, interactions |
| **Dev B** | AI Engineer | Claude/GPT integration, OCR, Voice, Emotion Engine |
| **Dev C** | Frontend Dev | React components, UI/UX, routing, state management |
| **Dev D** | Backend Dev | Node.js API, PostgreSQL schema, Docker, deployment |

---

### Hour-by-Hour Sprint Plan

#### SPRINT 1: Foundation (Hours 0–8)
| Hour | Dev A | Dev B | Dev C | Dev D |
|------|-------|-------|-------|-------|
| 0-1 | Project setup, Three.js boilerplate | OpenAI/Claude API connection test | React + Vite + Tailwind setup | PostgreSQL schema design |
| 1-3 | Basic Three.js scene rendering in browser | AI tutor endpoint (basic) | Onboarding screen + grade selection | Auth endpoints (register/login) |
| 3-5 | First 3D model: Atom with orbiting electrons | OCR pipeline with Tesseract.js | Dashboard home screen | DB migrations + Redis setup |
| 5-7 | DNA double helix procedural geometry | AI explanation generator endpoint | AR modal component + camera view | API gateway + rate limiting |
| 7-8 | **SYNC**: Integration checkpoint — AR renders in UI | AI calls return in UI | Routing works across all pages | API returns valid responses |

#### SPRINT 2: Core Features (Hours 8–20)
| Hour | Dev A | Dev B | Dev C | Dev D |
|------|-------|-------|-------|-------|
| 8-11 | Solar System + orbit animations | Voice STT/TTS integration | Scanner tab + file upload UI | Sessions + analytics endpoints |
| 11-14 | Cell biology + pendulum physics | Emotion detection engine | Lab grid UI + lab cards | OCR scan endpoint (full pipeline) |
| 14-17 | Graph visualization (parametric curves) | Career simulation AI prompts | Knowledge Map (Canvas 2D) | AR asset endpoint + caching |
| 17-19 | AR touch interactions (drag/rotate/explode) | Context-aware tutor (AR context injection) | Career simulator UI | Docker compose + deployment |
| 19-20 | **SYNC**: Feature freeze + integration testing | | | |

#### SPRINT 3: Novel Features + Polish (Hours 20–36)
| Hour | Dev A | Dev B | Dev C | Dev D |
|------|-------|-------|-------|-------|
| 20-23 | Explode-view animation | Confusion threshold auto-simplify | Bottom nav + FAB + glassmorphism | Knowledge map DB + API |
| 23-26 | Historical time travel AR scene | AI-generated lesson config | Concept tag interaction + tooltips | Conversation history persistence |
| 26-30 | Particle effects on AR models | Multi-language support (Hindi) | Progress bars + XP display | Performance optimization + indexes |
| 30-34 | AR anchor simulation (WebXR fallback) | Real-world object identifier AI | Toast notifications + loading states | Monitoring + health checks |
| 34-36 | **SYNC**: Full integration test + bug fixes | | | |

#### SPRINT 4: Docs + Pitch (Hours 36–48)
| Hour | All Members |
|------|------------|
| 36-40 | Documentation: README, Architecture, API, Setup, UserGuide |
| 40-43 | Demo script rehearsal + slide creation |
| 43-46 | Performance testing + final bug fixes |
| 46-48 | Final demo run-through + submission |

---

## PHASE 7: Testing Strategy

### Unit Tests

```typescript
// tests/unit/ai.service.test.ts
import { AIService } from '../src/services/ai.service';

describe('AIService', () => {
  describe('buildSystemPrompt', () => {
    it('should include grade in system prompt', () => {
      const prompt = AIService.buildSystemPrompt({ grade: '10', arContext: 'dna' });
      expect(prompt).toContain('Grade 10');
      expect(prompt).toContain('dna');
    });

    it('should default to normal depth', () => {
      const prompt = AIService.buildSystemPrompt({ grade: '10' });
      expect(prompt).toContain('normal');
    });
  });

  describe('extractConcepts', () => {
    it('should return valid concept array from OCR text', async () => {
      const result = await AIService.extractConcepts('DNA double helix base pairs adenine thymine');
      expect(Array.isArray(result.concepts)).toBe(true);
      expect(result.subject).toBeDefined();
      expect(result.arModelKey).toBeDefined();
    });
  });
});

// tests/unit/emotion.service.test.ts
import { EmotionService } from '../src/services/emotion.service';

describe('EmotionService', () => {
  describe('classify', () => {
    it('should detect confusion when interaction rate is very low', () => {
      const result = EmotionService.classify({
        interactionRate: 0.02,  // Very low: 2 touches per minute
        timeOnScreen: 120,       // 2 minutes
        replayCount: 3,          // Replayed 3 times
        questionCount: 0,
      });
      expect(result.state).toBe('confused');
      expect(result.score).toBeGreaterThan(0.6);
    });

    it('should detect engagement when interaction rate is high', () => {
      const result = EmotionService.classify({
        interactionRate: 2.5,
        timeOnScreen: 90,
        replayCount: 0,
        questionCount: 4,
      });
      expect(result.state).toBe('engaged');
    });
  });
});

// tests/unit/ocr.service.test.ts
import { OCRService } from '../src/services/ocr.service';

describe('OCRService', () => {
  it('should preprocess image to grayscale buffer', async () => {
    const mockBuffer = Buffer.from('fake-image-data');
    const result = await OCRService.preprocess(mockBuffer);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('should cache results by image hash', async () => {
    const hash = OCRService.hashImage(Buffer.from('test'));
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64); // SHA-256
  });
});
```

### Integration Tests

```typescript
// tests/integration/auth.test.ts
import request from 'supertest';
import app from '../src/index';

describe('Auth Integration', () => {
  let authToken: string;

  it('POST /api/auth/register → 200 with token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test Student', email: 'test@armentor.com', password: 'Test@1234', grade: '10' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    authToken = res.body.token;
  });

  it('POST /api/auth/login → 200 with JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@armentor.com', password: 'Test@1234' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('GET /api/auth/me → 200 with user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@armentor.com');
  });

  it('GET /api/auth/me without token → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// tests/integration/ai-tutor.test.ts
describe('AI Tutor Integration', () => {
  it('POST /api/ai/tutor → response with reply and followUps', async () => {
    const res = await request(app)
      .post('/api/ai/tutor')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ question: 'What is DNA?', arContext: 'dna', history: [] });
    expect(res.status).toBe(200);
    expect(res.body.reply).toBeDefined();
    expect(res.body.suggestedFollowUps).toBeInstanceOf(Array);
  }, 15000); // 15s timeout for AI call

  it('POST /api/ai/tutor → cached response on repeat', async () => {
    const question = 'What is photosynthesis?';
    await request(app).post('/api/ai/tutor')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ question, arContext: 'cell', history: [] });

    const start = Date.now();
    const res = await request(app).post('/api/ai/tutor')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ question, arContext: 'cell', history: [] });

    expect(Date.now() - start).toBeLessThan(200); // Cache hit < 200ms
    expect(res.status).toBe(200);
  });
});
```

### Performance Testing

```typescript
// tests/performance/load.test.ts
import { performance } from 'perf_hooks';

describe('Performance Benchmarks', () => {
  it('AR scene initialization < 500ms', () => {
    const start = performance.now();
    // Simulate Three.js scene setup
    const scene = initThreeScene('dna', '#38BDF8');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('Knowledge map renders 50 nodes < 100ms', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 300;
    const start = performance.now();
    drawKnowledgeMap(canvas, generateTestNodes(50));
    expect(performance.now() - start).toBeLessThan(100);
  });

  it('OCR preprocessing < 2000ms for 1MB image', async () => {
    const mockImage = Buffer.alloc(1024 * 1024); // 1MB
    const start = performance.now();
    await OCRService.preprocess(mockImage);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

// K6 Load Test Script (k6.io)
/*
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 100 },   // Hold 100 concurrent
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // < 1% error rate
  },
};

export default function() {
  const loginRes = http.post('http://localhost:3001/api/auth/login', JSON.stringify({
    email: 'loadtest@armentor.com', password: 'Test@1234'
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, { 'login status 200': r => r.status === 200 });
  
  const token = JSON.parse(loginRes.body).token;
  
  const lessonsRes = http.get('http://localhost:3001/api/lessons?subject=Physics&grade=10', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  check(lessonsRes, { 'lessons status 200': r => r.status === 200 });
  sleep(1);
}
*/
```

---

## PHASE 10: 10 Futuristic Features to Maximize Novelty Score

### 🌟 Next-Level AR + AI Features

**1. 🧠 Neural Learning Path AI**
Real-time brain state inference from behavioral biometrics (typing rhythm, scroll velocity). The system predicts optimal topic order and difficulty — not just based on quiz scores, but on live cognitive load signals. No competitor uses behavioral biometrics for learning path generation.

**2. 👁️ AR Gaze-Based Flashcards**
Using device front camera + face landmark detection (MediaPipe), track where on the AR scene the student is "looking." When a student stares at a specific AR element for 3+ seconds, a context-sensitive flashcard auto-appears. Completely hands-free learning.

**3. 🌐 Multiplayer AR Study Rooms**
Two students in different cities point their phones at the same virtual classroom. Using WebRTC + shared Three.js scene state, they both see the same 3D DNA model, can annotate it with AR markers, and have a spatial voice conversation. Think Google Meet + AR in a browser.

**4. 🎮 AR Quest System**
Learning gamified as an RPG: students earn XP by solving embedded AR puzzles (e.g., "Connect the correct base pairs in the floating DNA strand"). Incorrect interactions trigger physics-based visual feedback. Achievements unlock new AR "worlds" in the knowledge map.

**5. 📡 Real-Time Physical Lab Integration**
Connect Arduino or micro:bit sensors via Web Bluetooth. Student performs a real pendulum experiment at home — the AR overlay shows the theoretical curve overlaid on their actual measurement data in real time. Physical + digital learning convergence.

**6. 🗣️ Socratic AI Debate Mode**
Instead of answering questions, the AI takes a position opposite to the student's and argues it. Student must defend their understanding using evidence from AR visualizations. This higher-order thinking exercise (Bloom's Taxonomy level 5–6) is proven to dramatically improve retention.

**7. 🌍 AR Cultural Heritage Mode**
Point phone at any historical photograph or location → AI reconstructs the original structure/event in AR using NeRF-lite techniques. Students "visit" the Indus Valley Civilization, walk through the original Nalanda University, or witness the Battle of Plassey — all from their living room.

**8. 🔮 Concept Collision Engine**
Students drag two AR knowledge nodes together — the AI generates a real-time "what happens when these concepts meet" visualization. Drag "Electricity" + "Biology" → see how neurons fire. Drag "Chemistry" + "History" → see how gunpowder changed warfare. Cross-disciplinary synthesis, never seen in EdTech.

**9. 📱 Parent AR Progress Window**
Parents receive a weekly AR report: point phone at a printed QR code → a holographic summary of the child's learning week appears. Shows mastery growth as a 3D bar chart, weak areas as shrinking islands in the knowledge cosmos, and upcoming exam readiness score. Parents understand their child's learning visually.

**10. 🤖 AI Exam Predictor in AR**
30 days before an exam, AR Mentor activates "Exam Mode." The AI analyzes previous year CBSE/JEE/NEET papers, maps them to the student's knowledge map gaps, and renders predicted exam questions as floating AR cards sorted by probability of appearing. Students literally see which concepts are "glowing hot" for their upcoming exam.

---

## Setup.md (Quick Reference)

```bash
# Prerequisites
node >= 18.0.0
docker >= 24.0.0
docker-compose >= 2.0.0

# Environment Variables (.env)
OPENAI_API_KEY=sk-...          # Required for AI features
ANTHROPIC_API_KEY=sk-ant-...   # Alternative to OpenAI
DB_PASSWORD=your-db-password
JWT_SECRET=your-jwt-secret
CLIENT_URL=http://localhost:3000
API_URL=http://localhost:3001

# Option 1: Docker (Recommended)
git clone https://github.com/your-team/ar-mentor
cd ar-mentor
cp .env.example .env
# Edit .env with your API keys
docker-compose up --build
# App: http://localhost:3000
# API: http://localhost:3001

# Option 2: Manual Development
# Terminal 1 — Backend
cd server && npm install
npm run db:migrate
npm run dev     # Port 3001

# Terminal 2 — Frontend
cd client && npm install
npm run dev     # Port 5173

# Option 3: Single HTML Demo
# Just open ar-mentor-mvp.html in Chrome
# All AR and demo features work without backend
# AI tutor requires valid Anthropic API key in code

# Running Tests
cd server && npm test          # Jest unit + integration
npm run test:e2e               # Playwright end-to-end
npm run test:perf              # k6 load testing

# Build for Production
docker-compose -f docker-compose.prod.yml up --build
```

---

## API.md Quick Reference

```
Base URL: https://api.armentor.com/api/v1

Authentication: Bearer JWT token in Authorization header

Endpoints:
POST /auth/register    → {user, token}
POST /auth/login       → {user, token}
GET  /auth/me          → User profile

POST /ai/tutor         → {reply, followUps, confidence}
POST /ai/generate-lesson → AR lesson config JSON
GET  /ai/career/:name  → Career simulation data

POST /ocr/scan         → {concepts, arModelKey, aiSummary}

GET  /lessons          → Paginated lesson list
GET  /lessons/:id      → Lesson with 3D config
POST /lessons/:id/complete → {xpGained}

POST /analytics/event  → {ok: true}
GET  /analytics/me     → Dashboard stats
GET  /analytics/knowledge-map → 3D node graph

GET  /ar/models        → Available model keys
GET  /ar/models/:key   → Three.js config

Rate Limits:
  General: 60 req/min
  AI endpoints: 15 req/min
  OCR: 10 req/min
```

---

## UserGuide.md

### Getting Started
1. Open AR Mentor in Chrome (mobile or desktop)
2. Select your Grade and Subjects
3. Tap "Launch AR Mentor"

### Using Smart Scanner
1. Tap the 📷 Scanner tab
2. Tap "Scan Your Textbook" and photograph a page
3. AI detects concepts in 2–3 seconds
4. Tap "Launch AR Visualization" → interactive 3D model appears

### Using the AI Tutor
1. Tap the 🤖 button (top right or in AR scene)
2. Type or speak your question
3. AI responds with grade-appropriate explanation
4. Use "Simplify" or "Go Deeper" buttons to adjust difficulty

### AR Controls
- **Drag**: Rotate the 3D model
- **Pinch**: Zoom in/out (mobile)
- **↻ button**: Auto-rotate model
- **💥 button**: Explode-view (see inside the model)
- **🎙️ button**: Voice mode — ask questions by speaking

### Career Simulator
1. Tap the 🎯 Career tab
2. Choose any career
3. Read your "Day in the Life" AR script
4. See which subjects you need to study and how

### Knowledge Map
1. Tap the 🗺️ Map tab
2. Drag to explore your curriculum galaxy
3. Nodes = topics. Brighter = higher mastery
4. Tap any node to launch that AR lesson

### Tips for Maximum Learning
- Study for at least 15 minutes per AR session for best retention
- Use the AI Tutor after every AR model to consolidate understanding  
- Complete the Lab experiments before your actual exams
- Check your Knowledge Map weekly to spot weak areas
