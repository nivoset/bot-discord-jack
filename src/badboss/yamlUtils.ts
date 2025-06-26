import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export function loadYamlArray(dir: string, file: string, key: string): string[] {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) return [];
  const doc = yaml.load(fs.readFileSync(filePath, 'utf8')) as any;
  return Array.isArray(doc?.[key]) ? doc[key] : [];
}

export function loadTriviaQuestions(dir: string): any[] {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  let allQuestions: any[] = [];
  for (const file of files) {
    if (file.startsWith('reactions/')) continue;
    const filePath = path.join(dir, file);
    const doc = yaml.load(fs.readFileSync(filePath, 'utf8')) as any;
    if (doc && Array.isArray(doc.questions)) {
      allQuestions = allQuestions.concat(doc.questions);
    }
  }
  return allQuestions;
} 