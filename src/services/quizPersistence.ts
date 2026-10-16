import type { AnswerRecord, QuestionHistory } from '../types/history';
import {
  getAllAnswerRecords,
  getAllQuestionHistory,
  saveAnswerRecord,
  saveQuestionHistory,
} from '../storage/db';
import { ANSWER_RECORDED_EVENT } from '../utils/dailyCount';
import { runDailyAnswerSync } from './dailyAnswerSync';

export interface QuizHistory {
  answers: AnswerRecord[];
  questions: QuestionHistory[];
}

/**
 * 管理者演習には通常学習の既存履歴も渡さず、永続ストレージを読まない。
 */
export async function loadQuizHistory(isAdminMode: boolean): Promise<QuizHistory> {
  if (isAdminMode) return { answers: [], questions: [] };

  const [answers, questions] = await Promise.all([
    getAllAnswerRecords(),
    getAllQuestionHistory(),
  ]);
  return { answers, questions };
}

export async function persistQuizQuestion(
  isAdminMode: boolean,
  record: QuestionHistory,
): Promise<void> {
  if (isAdminMode) return;
  await saveQuestionHistory(record);
}

export async function persistQuizAnswer(
  isAdminMode: boolean,
  record: AnswerRecord,
  canStartSync: () => boolean = () => true,
): Promise<void> {
  if (isAdminMode) return;

  // 受理済みの通常回答は完了させる。管理者モードへ切り替わった後は
  // 保存完了後に新しい同期を始めない。
  await saveAnswerRecord(record);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ANSWER_RECORDED_EVENT));
  }
  if (canStartSync()) await runDailyAnswerSync(canStartSync);
}
