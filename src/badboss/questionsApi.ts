import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getDbClient } from './QuestionsDatabase.js';
import logger from './logger.js';

const router = express.Router();

// Auth middleware: require session user
router.use((req: Request, res: Response, next: NextFunction):any => {
  // @ts-expect-error
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET all questions
router.get('/', async (req, res) => {
  logger.info('GET /api/questions');
  const db = await getDbClient();
  const result = await db.execute('SELECT id, difficulty, version, type, data FROM questions');
  await db.close();
  res.json(result.rows.map(row => ({
    id: row.id,
    difficulty: row.difficulty,
    version: row.version,
    type: row.type,
    ...JSON.parse(row.data as string)
  })));
});

// GET a single question by ID
router.get('/:id', (async (req: any, res: any) => {
  const db = await getDbClient();
  const result = await db.execute('SELECT id, difficulty, version, type, data FROM questions WHERE id = ?', [req.params.id]);
  await db.close();
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const row = result.rows[0];
  res.json({ id: row.id, difficulty: row.difficulty, version: row.version, type: row.type, ...JSON.parse(row.data as string) });
}) as any);

// POST create a new question
router.post('/', async (req, res) => {
  const { difficulty, version, type, ...data } = req.body;
  const db = await getDbClient();
  await db.execute(
    'INSERT INTO questions (difficulty, version, type, data) VALUES (?, ?, ?, ?)',
    [difficulty || 'unknown', version || 1, type || 'bad-boss', JSON.stringify(data)]
  );
  await db.close();
  res.status(201).json({ success: true });
});

// PUT update a question
router.put('/:id', async (req, res) => {
  const { difficulty, version, type, ...data } = req.body;
  const db = await getDbClient();
  await db.execute(
    'UPDATE questions SET difficulty = ?, version = ?, type = ?, data = ? WHERE id = ?',
    [difficulty || 'unknown', version || 1, type || 'bad-boss', JSON.stringify(data), req.params.id]
  );
  await db.close();
  res.json({ success: true });
});

// DELETE a question
router.delete('/:id', async (req, res) => {
  const db = await getDbClient();
  await db.execute('DELETE FROM questions WHERE id = ?', [req.params.id]);
  await db.close();
  res.json({ success: true });
});

export default router; 