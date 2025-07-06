import { createClient } from '@libsql/client';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import logger from './logger.js';
import { Readable } from 'stream';
import { z } from 'zod';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../questions.db');
const YAML_PATH = path.join(__dirname, '../../Questions/questions_1.union.yml');
logger.info({ DB_PATH, YAML_PATH }, 'DB and YAML paths');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const S3_BUCKET = process.env.S3_BUCKET!;
const S3_KEY = process.env.S3_KEY || 'questions.db';

export const TriviaQuestionSchema = z.object({
  question: z.string(),
  difficulty: z.string(),
  correct_answer: z.string(),
  incorrect_answers: z.array(z.string()),
  version: z.number().default(1),
  type: z.string().default('bad-boss'),
});

export type TriviaQuestion = z.infer<typeof TriviaQuestionSchema>;

export async function ensureDatabase() {
  logger.info('Ensuring database...');
  // 1. Try to load from local file
  if (!fs.existsSync(DB_PATH)) {
    logger.info('Local DB not found, trying to download from S3...');
    try {
      await downloadDbFromS3();
    } catch (e) {
      logger.warn('Could not download from S3, seeding from YAML...');
      await seedDbFromYaml();
    }
  } else {
    logger.info('Local DB found.');
  }
  return createClient({ url: `file:${DB_PATH}` });
}

async function downloadDbFromS3() {
  logger.info('Downloading DB from S3...');
  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: S3_KEY });
  const response = await s3.send(command);
  const writeStream = fs.createWriteStream(DB_PATH);
  const body = response.Body;
  if (!body) throw new Error('No body in S3 response');
  const nodeStream = (body as any).pipe
    ? (body as NodeJS.ReadableStream)
    : Readable.fromWeb(body as any);

  await new Promise<void>((resolve, reject) => {
    nodeStream
      .pipe(writeStream)
      .on('finish', () => resolve())
      .on('error', (err) => {
        logger.error({ err }, 'Error writing DB from S3');
        reject(err);
      });
  });
  logger.info('Downloaded DB from S3.');
}

export async function uploadDbToS3() {
  logger.info('Uploading DB to S3...');
  const fileStream = fs.createReadStream(DB_PATH);
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: S3_KEY,
    Body: fileStream,
  });
  await s3.send(command);
  logger.info('Uploaded DB to S3.');
}

async function seedDbFromYaml() {
  logger.info('Seeding DB from YAML...');
  const yamlData = yaml.load(fs.readFileSync(YAML_PATH, 'utf8')) as any;
  // Create DB, create table, insert questions from yamlData
  const db = createClient({ url: `file:${DB_PATH}` });
  logger.info('Opened DB for seeding.');
  try {
    await db.execute(`CREATE TABLE questions (
      id INTEGER PRIMARY KEY,
      difficulty TEXT,
      version INTEGER DEFAULT 1,
      type TEXT DEFAULT 'bad-boss',
      data TEXT
    )`);
    logger.info('Created questions table.');
    console.log({ yamlData });
    for (const question of yamlData.questions) {
      const parseResult = TriviaQuestionSchema.safeParse({ ...question, type: question.type || 'bad-boss' });
      if (!parseResult.success) {
        logger.warn({ question, errors: parseResult.error.errors }, 'Invalid question, skipping');
        continue;
      }
      const validQuestion = parseResult.data;
      try {
        await db.execute(
          `INSERT INTO questions (difficulty, version, type, data) VALUES (?, ?, ?, ?)`,
          [validQuestion.difficulty, validQuestion.version, validQuestion.type, JSON.stringify(validQuestion)]
        );
      } catch (err) {
        logger.error({ err, validQuestion }, 'Error inserting question');
      }
    }
    logger.info('Seeded questions from YAML.');

    // Seed good_responses and bad_responses tables
    const questionsDir = path.dirname(YAML_PATH);
    const goodResponsesPath = path.join(questionsDir, 'reactions/good_responses.yml');
    const badResponsesPath = path.join(questionsDir, 'reactions/bad_responses.yml');
    const goodResponsesYaml = yaml.load(fs.readFileSync(goodResponsesPath, 'utf8')) as any;
    const badResponsesYaml = yaml.load(fs.readFileSync(badResponsesPath, 'utf8')) as any;

    await db.execute(`CREATE TABLE good_responses (
      id INTEGER PRIMARY KEY,
      version INTEGER DEFAULT 1,
      data TEXT
    )`);
    logger.info('Created good_responses table.');
    await db.execute(`CREATE TABLE bad_responses (
      id INTEGER PRIMARY KEY,
      version INTEGER DEFAULT 1,
      data TEXT
    )`);
    logger.info('Created bad_responses table.');

    logger.info('Seeding good responses from YAML...');
    if (Array.isArray(goodResponsesYaml.responses)) {
      for (const response of goodResponsesYaml.responses) {
        try {
          await db.execute(
            `INSERT INTO good_responses (version, data) VALUES (?, ?)`,
            [1, JSON.stringify(response)]
          );
        } catch (err) {
          logger.error({ err, response }, 'Error inserting good response');
        }
      }
    }
    logger.info('Seeded bad responses from YAML.');
    if (Array.isArray(badResponsesYaml.responses)) {
      for (const response of badResponsesYaml.responses) {
        try {
          await db.execute(
            `INSERT INTO bad_responses (version, data) VALUES (?, ?)`,
            [1, JSON.stringify(response)]
          );
        } catch (err) {
          logger.error({ err, response }, 'Error inserting bad response');
        }
      }
    }
  } finally {
    await db.close();
    logger.info('Closed DB after seeding.');
  }
  logger.info('Seeded DB from YAML.');
}

// Export a function to get a DB client
export async function getDbClient() {
  logger.info('Opening DB connection...');
  return await ensureDatabase()
}

export async function getRandomQuestion(): Promise<TriviaQuestion | undefined> {
  logger.info('Fetching random question from DB...');
  const db = await ensureDatabase();
  try {
    const result = await db.execute('SELECT data FROM questions ORDER BY RANDOM() LIMIT 1');
    if (result.rows.length === 0) {
      logger.warn('No questions found in DB.');
      return undefined;
    }
    const question = JSON.parse(result.rows[0].data as string) as TriviaQuestion;
    logger.info({ question }, 'Fetched random question');
    return question;
  } catch (err) {
    logger.error({ err }, 'Error fetching random question');
    return undefined;
  } finally {
    await db.close();
  }
}

export async function getGoodResponses(): Promise<string[]> {
  logger.info('Fetching all good responses from DB...');
  const db = await ensureDatabase();
  try {
    const result = await db.execute('SELECT data FROM good_responses');
    const responses = result.rows.map(row => JSON.parse(row.data as string));
    logger.info({ count: responses.length }, 'Fetched good responses');
    return responses;
  } catch (err) {
    logger.error({ err }, 'Error fetching good responses');
    return [];
  } finally {
    await db.close();
  }
}

export async function getBadResponses(): Promise<string[]> {
  logger.info('Fetching all bad responses from DB...');
  const db = await ensureDatabase();
  try {
    const result = await db.execute('SELECT data FROM bad_responses');
    const responses = result.rows.map(row => JSON.parse(row.data as string));
    logger.info({ count: responses.length }, 'Fetched bad responses');
    return responses;
  } catch (err) {
    logger.error({ err }, 'Error fetching bad responses');
    return [];
  } finally {
    await db.close();
  }
}

export async function getPossibleAnswers(): Promise<string[]> {
  logger.info('Fetching all possible answers from DB...');
  const db = await ensureDatabase();
  try {
    const result = await db.execute('SELECT data FROM possible_answers');
    const answers = result.rows.map(row => JSON.parse(row.data as string));
    logger.info({ count: answers.length }, 'Fetched possible answers');
    return answers;
  } catch (err) {
    logger.error({ err }, 'Error fetching possible answers');
    return [];
  } finally {
    await db.close();
  }
} 