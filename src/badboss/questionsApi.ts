import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getDbClient, uploadDbToS3 } from './QuestionsDatabase.js';
import logger from './logger.js';

const router = express.Router();

const REQUIRED_GUILD_ID = '1349570731532484669';
const S3_UPLOAD_DELAY_MS = process.env.S3_UPLOAD_DELAY_MS ? parseInt(process.env.S3_UPLOAD_DELAY_MS) : 30 * 60 * 1000; // 30 minutes

// Debounced S3 upload timer
let s3UploadTimeout: NodeJS.Timeout | null = null;
function scheduleS3Upload() {
  if (s3UploadTimeout) clearTimeout(s3UploadTimeout);
  s3UploadTimeout = setTimeout(async () => {
    try {
      await uploadDbToS3();
      logger.info('Database uploaded to S3 after debounce period.');
    } catch (err) {
      logger.error({ err }, 'Failed to upload DB to S3 after debounce period.');
    }
  }, S3_UPLOAD_DELAY_MS);
}

// Auth middleware: require session user and guild membership
router.use((req: Request, res: Response, next: NextFunction): any => {
  // @ts-expect-error
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // @ts-expect-error
  const guilds = req.session.user.guilds || [];
  const inGuild = guilds.some((g: any) => g.id === REQUIRED_GUILD_ID);
  if (!inGuild) {
    return res.status(403).json({ error: 'Forbidden: Not in required server' });
  }
  next();
});

// GET all questions
router.get('/', async (_req, res) => {
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
  scheduleS3Upload();
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
  scheduleS3Upload();
  res.json({ success: true });
});

// DELETE a question
router.delete('/:id', async (req, res) => {
  const db = await getDbClient();
  await db.execute('DELETE FROM questions WHERE id = ?', [req.params.id]);
  await db.close();
  scheduleS3Upload();
  res.json({ success: true });
});

export default router; 