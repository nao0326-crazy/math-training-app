/**
 * IndexedDB ストレージ層
 * 学習履歴・出題履歴・設定を保存する
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AnswerRecord, QuestionHistory, StudySettings } from '../types/history';

/**
 * IndexedDB のスキーマ定義
 */
interface MathAppDB extends DBSchema {
  answers: {
    key: number;
    value: AnswerRecord;
    indexes: {
      'by-date': string;
      'by-category': string;
      'by-type': string;
    };
  };
  questions: {
    key: number;
    value: QuestionHistory;
    indexes: {
      'by-date': string;
    };
  };
  settings: {
    key: string;
    value: StudySettings;
  };
}

const DB_NAME = 'grade6-math-app';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MathAppDB>> | null = null;

/**
 * データベース接続を取得する
 */
function getDB(): Promise<IDBPDatabase<MathAppDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MathAppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 解答履歴ストア
        const answerStore = db.createObjectStore('answers', {
          keyPath: 'id',
          autoIncrement: true,
        });
        answerStore.createIndex('by-date', 'answeredAt');
        answerStore.createIndex('by-category', 'category');
        answerStore.createIndex('by-type', 'problemType');

        // 出題履歴ストア
        const questionStore = db.createObjectStore('questions', {
          keyPath: 'id',
          autoIncrement: true,
        });
        questionStore.createIndex('by-date', 'askedAt');

        // 設定ストア
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

/**
 * 解答履歴を保存する
 */
export async function saveAnswerRecord(record: AnswerRecord): Promise<void> {
  const db = await getDB();
  await db.add('answers', record);
}

/**
 * 解答履歴を全件取得する
 */
export async function getAllAnswerRecords(): Promise<AnswerRecord[]> {
  const db = await getDB();
  return db.getAll('answers');
}

/**
 * 解答履歴を新しい順に取得する
 */
export async function getRecentAnswerRecords(limit: number): Promise<AnswerRecord[]> {
  const db = await getDB();
  const all = await db.getAll('answers');
  return all.slice(-limit);
}

/**
 * 出題履歴を保存する
 */
export async function saveQuestionHistory(record: QuestionHistory): Promise<void> {
  const db = await getDB();
  await db.add('questions', record);
}

/**
 * 出題履歴を全件取得する
 */
export async function getAllQuestionHistory(): Promise<QuestionHistory[]> {
  const db = await getDB();
  return db.getAll('questions');
}

/**
 * 出題履歴を新しい順に取得する
 */
export async function getRecentQuestionHistory(limit: number): Promise<QuestionHistory[]> {
  const db = await getDB();
  const all = await db.getAll('questions');
  return all.slice(-limit);
}

/**
 * 設定を保存する
 */
export async function saveSettings(settings: Omit<StudySettings, 'key'>): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key: 'study', ...settings });
}

/**
 * 設定を取得する
 */
export async function getSettings(): Promise<StudySettings | null> {
  const db = await getDB();
  const record = await db.get('settings', 'study');
  return record ?? null;
}

/**
 * 全データを削除する (リセット用)
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear('answers');
  await db.clear('questions');
  await db.clear('settings');
}