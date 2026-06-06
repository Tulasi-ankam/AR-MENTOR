/**
 * AR Mentor — Complete Backend Server
 * Node.js + Express + TypeScript
 * File: server/src/index.ts
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import Tesseract from 'tesseract.js';
import OpenAI from 'openai';

// ── CONFIG ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'ar-mentor-secret-change-in-prod';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

// ── CLIENTS ───────────────────────────────────────────────────
const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'ar_mentor',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'password',
});

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const openai = new OpenAI({ apiKey: OPENAI_KEY });

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// ── APP ───────────────────────────────────────────────────────
const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: 'Too many requests' });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 15, message: 'AI rate limit exceeded' });
app.use('/api', apiLimiter);
app.use('/api/ai', aiLimiter);

// ── TYPES ─────────────────────────────────────────────────────
interface AuthRequest extends Request {
  user?: { id: string; email: string; grade: string };
}

interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── MIDDLEWARE ────────────────────────────────────────────────
function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthRequest['user'];
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── AUTH ROUTES ───────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, grade, subjects } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, grade_level, weak_subjects)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, grade_level`,
      [name, email, hash, grade, JSON.stringify(subjects || [])]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, grade: user.grade_level }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, grade: user.grade_level }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res) => {
  const result = await db.query(
    'SELECT id, name, email, grade_level, weak_subjects, total_xp, streak_days FROM users WHERE id = $1',
    [req.user!.id]
  );
  res.json(result.rows[0]);
});

// ── AI TUTOR ROUTES ───────────────────────────────────────────
app.post('/api/ai/tutor', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { question, arContext, history = [], depth = 'normal' } = req.body;
    const user = req.user!;

    // Build context-aware system prompt
    const systemPrompt = `You are AR Mentor, an enthusiastic AI learning companion for a Grade ${user.grade} student.
The student is currently viewing an AR experience about: ${arContext || 'general topics'}.
Teaching mode: ${depth} (simple=ELI10, normal=grade-appropriate, advanced=competitive exam level).
Guidelines:
- Give clear, engaging explanations with real-world Indian examples
- Use analogies the student can relate to
- Keep responses 2–4 sentences unless detail is explicitly requested
- End with one thought-provoking question to deepen curiosity
- Use emojis sparingly (1–2 max)
- If confused, break concepts into numbered steps`;

    // Cache check
    const cacheKey = `tutor:${question.toLowerCase().slice(0, 50)}:${user.grade}:${arContext}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const messages: TutorMessage[] = [
      ...history.slice(-6),
      { role: 'user', content: question }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 400,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content || 'I could not generate a response. Please try again.';

    // Generate follow-up questions
    const followUpsCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Given this topic "${arContext}" and answer "${reply.slice(0, 100)}", generate 3 short follow-up questions a curious student might ask. Return as JSON array of strings only.`
      }],
      max_tokens: 150,
    });

    let followUps: string[] = [];
    try {
      followUps = JSON.parse(followUpsCompletion.choices[0].message.content || '[]');
    } catch { followUps = ['Tell me more', 'Give me an example', 'Why is this important?']; }

    const response = {
      reply,
      suggestedFollowUps: followUps,
      confidence: 0.95,
      relatedARModel: arContext,
    };

    // Cache for 30 minutes
    await redis.setex(cacheKey, 1800, JSON.stringify(response));

    // Save conversation to DB
    await db.query(
      `INSERT INTO tutor_conversations (user_id, topic_context, messages)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, topic_context) DO UPDATE
       SET messages = $3, updated_at = NOW()`,
      [user.id, arContext, JSON.stringify([...history, { role: 'user', content: question }, { role: 'assistant', content: reply }])]
    );

    res.json(response);
  } catch (err) {
    console.error('AI tutor error:', err);
    res.status(500).json({ error: 'AI service unavailable', reply: 'I am temporarily unavailable. Please try again in a moment.' });
  }
});

app.post('/api/ai/generate-lesson', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { topic, grade, subject } = req.body;
    const cacheKey = `lesson:${topic}:${grade}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Generate an AR lesson config for Grade ${grade} students learning about "${topic}" in ${subject}.
Return ONLY valid JSON with this structure:
{
  "title": "Lesson title with emoji",
  "keyPoints": ["point1", "point2", "point3"],
  "simpleExplanation": "ELI10 explanation in 2 sentences",
  "normalExplanation": "Grade-appropriate explanation in 3 sentences",  
  "advancedExplanation": "Competitive exam level, 3 sentences",
  "realWorldExample": "Indian context example",
  "arModelSuggestion": "atom|dna|cell|solar|graph|generic",
  "arColors": {"primary": "#hexcolor", "secondary": "#hexcolor"},
  "examTip": "One key exam tip",
  "funFact": "Amazing fact about this topic"
}`
      }],
      max_tokens: 600,
    });

    const text = completion.choices[0].message.content || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const lessonConfig = JSON.parse(clean);

    await redis.setex(cacheKey, 86400, JSON.stringify(lessonConfig)); // Cache 24h
    res.json(lessonConfig);
  } catch (err) {
    res.status(500).json({ error: 'Lesson generation failed' });
  }
});

// ── OCR ROUTES ────────────────────────────────────────────────
app.post('/api/ocr/scan', authMiddleware, upload.single('image'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const startTime = Date.now();

    // Run Tesseract OCR
    const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'eng', {
      logger: () => {}, // Suppress logs
    });

    // AI concept extraction
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Extract educational concepts from this OCR text: "${text.slice(0, 1000)}"
Return ONLY JSON:
{
  "subject": "Physics|Chemistry|Biology|Mathematics|History|Geography",
  "topic": "main topic name",
  "concepts": [{"name": "concept", "confidence": 0.9, "category": "term|formula|law|process"}],
  "arModelKey": "atom|dna|cell|solar|graph|newton|generic",
  "aiSummary": "2-sentence educational summary",
  "difficulty": 1
}`
      }],
      max_tokens: 400,
    });

    const extractText = extraction.choices[0].message.content || '{}';
    const data = JSON.parse(extractText.replace(/```json|```/g, '').trim());
    const processingMs = Date.now() - startTime;

    // Save to DB
    await db.query(
      `INSERT INTO ocr_scans (user_id, raw_ocr_text, extracted_concepts, subject_detected, ar_overlay_config, processing_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user!.id, text.slice(0, 5000), JSON.stringify(data.concepts), data.subject, JSON.stringify(data), processingMs]
    );

    res.json({ rawText: text, processingMs, ...data });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: 'OCR processing failed' });
  }
});

// ── ANALYTICS ROUTES ──────────────────────────────────────────
app.post('/api/analytics/event', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { sessionId, eventType, context, emotionScore } = req.body;
    await db.query(
      `INSERT INTO interaction_events (session_id, user_id, event_type, context, emotion_score)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, req.user!.id, eventType, JSON.stringify(context), emotionScore]
    );

    // Check if confusion threshold crossed
    if (eventType === 'confusion' && emotionScore > 0.7) {
      // Update user weak subjects
      await db.query(
        `UPDATE users SET weak_subjects = weak_subjects || $1::jsonb WHERE id = $2`,
        [JSON.stringify([context?.subject]), req.user!.id]
      );
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Event logging failed' });
  }
});

app.get('/api/analytics/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const [sessionsResult, eventsResult, userResult] = await Promise.all([
      db.query('SELECT COUNT(*), AVG(duration_seconds), SUM(confusion_events) FROM learning_sessions WHERE user_id = $1', [userId]),
      db.query('SELECT event_type, COUNT(*) FROM interaction_events WHERE user_id = $1 GROUP BY event_type', [userId]),
      db.query('SELECT total_xp, streak_days, weak_subjects FROM users WHERE id = $1', [userId]),
    ]);

    res.json({
      totalSessions: parseInt(sessionsResult.rows[0].count),
      avgDurationSeconds: Math.round(parseFloat(sessionsResult.rows[0].avg || '0')),
      totalConfusionEvents: parseInt(sessionsResult.rows[0].sum || '0'),
      eventBreakdown: eventsResult.rows,
      totalXP: userResult.rows[0].total_xp,
      streakDays: userResult.rows[0].streak_days,
      weakSubjects: userResult.rows[0].weak_subjects,
    });
  } catch {
    res.status(500).json({ error: 'Analytics fetch failed' });
  }
});

app.get('/api/analytics/knowledge-map', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM knowledge_nodes WHERE user_id = $1 ORDER BY mastery_level DESC',
      [req.user!.id]
    );

    // Generate 3D positions for nodes
    const nodes = result.rows.map((node, i) => ({
      ...node,
      x: Math.cos((i / result.rows.length) * Math.PI * 2) * (100 + i * 20),
      y: Math.sin((i / result.rows.length) * Math.PI * 2) * (100 + i * 20),
      z: (node.mastery_level - 0.5) * 100,
    }));

    res.json({ nodes, connections: [] });
  } catch {
    res.status(500).json({ error: 'Knowledge map fetch failed' });
  }
});

// ── LESSONS ROUTES ────────────────────────────────────────────
app.get('/api/lessons', async (req, res) => {
  try {
    const { subject, grade, page = 1, limit = 20 } = req.query;
    let query = 'SELECT * FROM ar_lessons WHERE is_public = true';
    const params: any[] = [];
    if (subject) { params.push(subject); query += ` AND subject = $${params.length}`; }
    if (grade) { params.push(grade); query += ` AND grade = $${params.length}`; }
    query += ` ORDER BY play_count DESC LIMIT ${limit} OFFSET ${(Number(page) - 1) * Number(limit)}`;
    const result = await db.query(query, params);
    res.json({ lessons: result.rows, page: Number(page) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

app.post('/api/lessons/:id/complete', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { score, durationSeconds } = req.body;

    // Update lesson play count
    await db.query('UPDATE ar_lessons SET play_count = play_count + 1 WHERE id = $1', [id]);

    // Update user XP
    const xpGained = Math.round((score || 0.5) * 100);
    await db.query('UPDATE users SET total_xp = total_xp + $1 WHERE id = $2', [xpGained, req.user!.id]);

    // Update knowledge node
    const lesson = await db.query('SELECT topic, subject FROM ar_lessons WHERE id = $1', [id]);
    if (lesson.rows[0]) {
      await db.query(
        `INSERT INTO knowledge_nodes (user_id, topic, subject, mastery_level, study_minutes, last_studied)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, topic) DO UPDATE
         SET mastery_level = LEAST(1.0, knowledge_nodes.mastery_level + $4 * 0.3),
             study_minutes = knowledge_nodes.study_minutes + $5,
             last_studied = NOW()`,
        [req.user!.id, lesson.rows[0].topic, lesson.rows[0].subject, score, Math.round(durationSeconds / 60)]
      );
    }

    res.json({ xpGained, message: 'Progress saved!' });
  } catch {
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

// ── AR ASSETS ─────────────────────────────────────────────────
const AR_MODELS_CONFIG: Record<string, object> = {
  solar: { type: 'solar', bodies: 8, animated: true, interactive: true },
  dna: { type: 'helix', turns: 3, animated: true, interactive: true },
  atom: { type: 'bohr', shells: 3, animated: true },
  cell: { type: 'organelle', count: 8, interactive: true },
  newton: { type: 'force_diagram', animated: true },
  graph: { type: 'parametric', equation: 'quadratic' },
};

app.get('/api/ar/models', (req, res) => {
  res.json(Object.keys(AR_MODELS_CONFIG).map(key => ({ key, ...AR_MODELS_CONFIG[key] })));
});

app.get('/api/ar/models/:key', (req, res) => {
  const config = AR_MODELS_CONFIG[req.params.key];
  if (!config) return res.status(404).json({ error: 'Model not found' });
  res.json({ key: req.params.key, ...config });
});

// ── CAREER SIMULATOR ──────────────────────────────────────────
app.get('/api/ai/career/:career', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { career } = req.params;
    const cacheKey = `career:${career}:${req.user!.grade}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Create an immersive AR career simulation script for a Grade ${req.user!.grade} student experiencing a day as a "${career}".
Return JSON:
{
  "title": "Career title with emoji",
  "dayScenario": "2-3 sentence vivid description of the AR scene",
  "tasks": ["task1", "task2", "task3"],
  "requiredSubjects": ["subject1", "subject2"],
  "avgSalaryIndia": "₹X-Y LPA",
  "topCompanies": ["company1", "company2", "company3"],
  "educationPath": "Clear path from Grade ${req.user!.grade} to this career",
  "arObjectSuggestion": "What 3D object to show in AR scene",
  "excitingFact": "One amazing fact about this career"
}`
      }],
      max_tokens: 500,
    });

    const text = completion.choices[0].message.content || '{}';
    const data = JSON.parse(text.replace(/```json|```/g, '').trim());
    await redis.setex(cacheKey, 86400, JSON.stringify(data));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Career simulation failed' });
  }
});

// ── HEALTH CHECK ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'AR Mentor API v1.0' });
});

// ── ERROR HANDLER ─────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── START ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 AR Mentor API running on port ${PORT}`);
  console.log(`📊 Database: ${process.env.DB_NAME || 'ar_mentor'}`);
  console.log(`🤖 AI: ${OPENAI_KEY ? 'Connected' : 'No API key — AI features limited'}`);
});

export default app;
