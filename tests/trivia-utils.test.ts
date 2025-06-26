import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

function loadYamlArray(file: string, key: string): string[] {
  const QUESTIONS_DIR = path.join(__dirname, '../Questions');
  const filePath = path.join(QUESTIONS_DIR, file);
  if (!fs.existsSync(filePath)) return [];
  const doc = yaml.load(fs.readFileSync(filePath, 'utf8')) as any;
  return Array.isArray(doc?.[key]) ? doc[key] : [];
}

describe('YAML Array Loader', () => {
  it('loads good responses from reactions/good_responses.yml', () => {
    const arr = loadYamlArray('reactions/good_responses.yml', 'responses');
    expect(arr.length).toBeGreaterThan(0);
    expect(arr.some(r => typeof r === 'string')).toBe(true);
  });

  it('loads bad responses from reactions/bad_responses.yml', () => {
    const arr = loadYamlArray('reactions/bad_responses.yml', 'responses');
    expect(arr.length).toBeGreaterThan(0);
    expect(arr.some(r => typeof r === 'string')).toBe(true);
  });

  it('loads possible answers from reactions/possible_answers.yml', () => {
    const arr = loadYamlArray('reactions/possible_answers.yml', 'answers');
    expect(arr.length).toBeGreaterThan(0);
    expect(arr.some(r => typeof r === 'string')).toBe(true);
  });
}); 