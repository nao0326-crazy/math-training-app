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
import type { ScratchNote } from '../types/scratch';
import type { SpeedGateSession } from '../types/speedGate';
import type { DailyLearningState, DailyLearningStateRecord } from '../utils/dailyLearning';
import type { DifficultyLevel, DifficultyRange } from '../types/problem';
import { getAllGenerators } from '../engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../engine/diversity/metadata';

const ADMIN_PRACTICE_SETTINGS_KEY = 'admin-practice-scope-v1';
export const DEFAULT_ADMIN_PRACTICE_DIFFICULTY_RANGE: DifficultyRange = {
  min: 1,
  max: 5,
};

interface AdminPracticeSettings {
  key: typeof ADMIN_PRACTICE_SETTINGS_KEY;
  problemTypes: string[];
  difficultyRange?: DifficultyRange;
}

export interface AdminPracticeConfiguration {
  problemTypes: string[];
  difficultyRange: DifficultyRange;
}

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
    value: StudySettings | AdminPracticeSettings | DailyLearningStateRecord;
  };
  dailySync: {
    key: string;
    value: {
      submissionId: string;
      answeredAt: string;
    };
  };
  /** 手書き途中式ノート (出題インスタンスごと。attemptId を主キーとする) */
  scratchNotes: {
    key: string;
    value: ScratchNote;
  };
  /** 朝のハイスピード計算ゲートのセッション (日付キーを主キー) */
  speedGateSessions: {
    key: string;
    value: SpeedGateSession;
  };
}

const DB_NAME = 'grade6-math-app';
// v4: 朝のハイスピード計算ゲート用ストア speedGateSessions を追加
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase<MathAppDB>> | null = null;

/**
 * データベース接続を取得する
 */
export function getDB(): Promise<IDBPDatabase<MathAppDB>> {
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

        // 手書き途中式ノート (v3)。既存ストアには一切触れず、
        // 新しいストアを追加するだけなので既存データは保持される。
        if (oldVersion < 3) {
          db.createObjectStore('scratchNotes', { keyPath: 'attemptId' });
        }

        // 朝のハイスピード計算ゲート (v4)
        if (oldVersion < 4) {
          db.createObjectStore('speedGateSessions', { keyPath: 'dateKey' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * 途中式ノートを保存する (attemptId を主キーに put で上書き可)
 */
export async function saveScratchNote(note: ScratchNote): Promise<void> {
  const db = await getDB();
  await db.put('scratchNotes', note);
}

/**
 * 出題インスタンスの途中式を取得する (無ければ undefined)
 */
export async function getScratchNote(attemptId: string): Promise<ScratchNote | undefined> {
  const db = await getDB();
  return db.get('scratchNotes', attemptId);
}

/**
 * 保存済みの途中式をすべて取得する (復習画面用)
 */
export async function getAllScratchNotes(): Promise<ScratchNote[]> {
  const db = await getDB();
  return db.getAll('scratchNotes');
}

/**
 * 途中式を削除する
 */
export async function deleteScratchNote(attemptId: string): Promise<void> {
  const db = await getDB();
  await db.delete('scratchNotes', attemptId);
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
export async function prepareLegacyDailyAnswerSyncTasks(
  canContinue: () => boolean = () => true,
): Promise<boolean> {
  if (!canContinue()) return false;
  const db = await getDB();
  const records = await db.getAll('answers');
  if (!canContinue()) return false;
  const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const candidates = records.filter((record) => {
    if (record.submissionId || typeof record.id !== 'number') return false;
    const answeredAt = new Date(record.answeredAt).getTime();
    return Number.isFinite(answeredAt) && answeredAt >= cutoff;
  });

  if (candidates.length === 0) return true;
  if (!canContinue()) return false;

  const transaction = db.transaction(['answers', 'dailySync'], 'readwrite');
  const answerStore = transaction.objectStore('answers');
  const syncStore = transaction.objectStore('dailySync');

  // IndexedDB transactionは await の合間に inactive になる可能性がある。
  // 移行対象の全 put を transaction が active なうちに予約してから、
  // request と transaction の完了をまとめて待つ。
  const writes: Promise<unknown>[] = [];
  for (const record of candidates) {
    const submissionId = `legacy-${record.id}`;
    writes.push(answerStore.put({ ...record, submissionId }));
    writes.push(
      syncStore.put({
        submissionId,
        answeredAt: record.answeredAt,
      }),
    );
  }

  await Promise.all([...writes, transaction.done]);
  return true;
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
  if (!record || !('difficultyLevel' in record)) return null;
  return record ?? null;
}

/** Save the app-wide practice range independently from learner study settings. */
export async function saveAdminPracticeTypes(problemTypes: string[]): Promise<void> {
  const current = await getAdminPracticeConfiguration();
  await saveAdminPracticeConfiguration(problemTypes, current.difficultyRange);
}

/** Save the type scope and difficulty bounds together in the dedicated settings record. */
export async function saveAdminPracticeConfiguration(
  problemTypes: string[],
  difficultyRange: DifficultyRange,
): Promise<void> {
  if (
    !isDifficultyLevel(difficultyRange.min) ||
    !isDifficultyLevel(difficultyRange.max) ||
    difficultyRange.min > difficultyRange.max
  ) {
    throw new Error('難易度の範囲が正しくありません。');
  }

  const registeredTypes = new Set(
    getAllGenerators()
      .filter((generator) => getTypeSupportedLevels(generator.type).length > 0)
      .map((generator) => generator.type),
  );
  const validTypes = [...new Set(problemTypes)].filter((type) => registeredTypes.has(type));
  const db = await getDB();
  await db.put('settings', {
    key: ADMIN_PRACTICE_SETTINGS_KEY,
    problemTypes: validTypes,
    difficultyRange,
  });
}

/** Load the app-wide scope; legacy settings without difficulty bounds allow Lv1-5. */
export async function getAdminPracticeConfiguration(): Promise<AdminPracticeConfiguration> {
  const db = await getDB();
  const record = await db.get('settings', ADMIN_PRACTICE_SETTINGS_KEY);
  if (!record || !('problemTypes' in record)) {
    return {
      problemTypes: [],
      difficultyRange: DEFAULT_ADMIN_PRACTICE_DIFFICULTY_RANGE,
    };
  }

  const difficultyRange = 'difficultyRange' in record && record.difficultyRange !== undefined
    ? record.difficultyRange
    : DEFAULT_ADMIN_PRACTICE_DIFFICULTY_RANGE;
  if (
    !difficultyRange ||
    !isDifficultyLevel(difficultyRange.min) ||
    !isDifficultyLevel(difficultyRange.max) ||
    difficultyRange.min > difficultyRange.max
  ) {
    throw new Error('保存された難易度の範囲を読み込めませんでした。');
  }
  const registeredTypes = new Set(
    getAllGenerators()
      .filter((generator) => getTypeSupportedLevels(generator.type).length > 0)
      .map((generator) => generator.type),
  );
  const problemTypes = Array.isArray(record.problemTypes)
    ? [...new Set(record.problemTypes)].filter(
        (type): type is string => typeof type === 'string' && registeredTypes.has(type),
      )
    : [];
  return { problemTypes, difficultyRange };
}

/** Return only problem types with a registered, usable generator. */
export async function getAdminPracticeTypes(): Promise<string[]> {
  return (await getAdminPracticeConfiguration()).problemTypes;
}

function isDifficultyLevel(value: unknown): value is DifficultyLevel {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
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
  await db.clear('scratchNotes');
  await db.clear('speedGateSessions');
}
/**
 * 朝のハイスピード計算ゲートのセッションを保存する
 */
export async function saveSpeedGateSession(session: SpeedGateSession): Promise<void> {
  const db = await getDB();
  await db.put('speedGateSessions', session);
}

/**
 * 指定日のハイスピード計算セッションを取得する
 */
export async function loadSpeedGateSession(dateKey: string): Promise<SpeedGateSession | undefined> {
  const db = await getDB();
  return db.get('speedGateSessions', dateKey);
}

/**
 * 全ハイスピード計算セッションを取得する
 */
export async function listSpeedGateSessions(): Promise<SpeedGateSession[]> {
  const db = await getDB();
  return db.getAll('speedGateSessions');
}

/**
 * 指定日が完了済みかどうか
 */
export async function isSpeedGateCompleted(dateKey: string): Promise<boolean> {
  const session = await loadSpeedGateSession(dateKey);
  return session?.status === 'completed';
}

/**
 * 指定日のセッションを削除する
 */
export async function deleteSpeedGateSession(dateKey: string): Promise<void> {
  const db = await getDB();
  await db.delete('speedGateSessions', dateKey);
}
export async function loadDailyLearningState(): Promise<DailyLearningState | null> {
  const db = await getDB();
  const record = await db.get('settings', 'daily-learning-state-v1');
  if (!record || !('dateKey' in record)) return null;
  const { key, ...rest } = record as DailyLearningStateRecord;
  void key;
  return rest;
}

export async function saveDailyLearningState(state: DailyLearningState): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key: 'daily-learning-state-v1', ...state });
}