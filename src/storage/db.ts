/**
 * IndexedDB ストレージ層
 * 学習履歴・出題履歴・設定を保存する
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AnswerRecord,
  QuestionHistory,
  StudySettings,
} from '../types/history';

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
  dailySync: {
    key: string;
    value: {
      submissionId: string;
      answeredAt: string;
    };
  };
}

const DB_NAME = 'grade6-math-app';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<MathAppDB>> | null = null;

/**
 * データベース接続を取得する
 */
function getDB(): Promise<IDBPDatabase<MathAppDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MathAppDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // 解答履歴ストア
        if (oldVersion < 1) {
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
        }

        // 回答済みだがネットワーク未送信のイベントを保存するoutbox
        if (oldVersion < 2) {
          db.createObjectStore('dailySync', { keyPath: 'submissionId' });
        }
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
  const transaction = db.transaction(['answers', 'dailySync'], 'readwrite');
  await transaction.objectStore('answers').add(record);

  if (record.submissionId) {
    await transaction.objectStore('dailySync').put({
      submissionId: record.submissionId,
      answeredAt: record.answeredAt,
    });
  }

  await transaction.done;
}

/**
 * 解答履歴を全件取得する
 */
export async function getAllAnswerRecords(): Promise<AnswerRecord[]> {
  const db = await getDB();
  return db.getAll('answers');
}

/** 未送信の日次集計イベントを全件取得する */
export async function getPendingDailyAnswerSyncTasks(): Promise<
  Array<{ submissionId: string; answeredAt: string }>
> {
  const db = await getDB();
  return db.getAll('dailySync');
}

/** 送信済みイベントをoutboxから削除する */
export async function removeDailyAnswerSyncTask(submissionId: string): Promise<void> {
  const db = await getDB();
  await db.delete('dailySync', submissionId);
}

/**
 * 機能導入前の直近2日分の回答を、冪等IDつきのoutboxへ移行する。
 * 古い回答まで一括送信せず、通知対象になっている前日・当日だけを移行する。
 */
export async function prepareLegacyDailyAnswerSyncTasks(): Promise<void> {
  const db = await getDB();
  const records = await db.getAll('answers');
  const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const candidates = records.filter((record) => {
    if (record.submissionId || typeof record.id !== 'number') return false;
    const answeredAt = new Date(record.answeredAt).getTime();
    return Number.isFinite(answeredAt) && answeredAt >= cutoff;
  });

  if (candidates.length === 0) return;

  const transaction = db.transaction(['answers', 'dailySync'], 'readwrite');
  for (const record of candidates) {
    const submissionId = `legacy-${record.id}`;
    await transaction.objectStore('answers').put({ ...record, submissionId });
    await transaction.objectStore('dailySync').put({
      submissionId,
      answeredAt: record.answeredAt,
    });
  }
  await transaction.done;
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
  await db.clear('dailySync');
}