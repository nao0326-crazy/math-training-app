import type { AnswerRecord, QuestionHistory } from '../types/history';
import {
  getAllAnswerRecords,
  getAllQuestionHistory,
  saveAnswerRecord,
  saveQuestionHistory,
} from '../storage/db';
import { ANSWER_RECORDED_EVENT } from '../utils/dailyCount';
import { runDailyAnswerSync } from './dailyAnswerSync';

export async function loadQuizHistory(): Promise<{
  history: AnswerRecord[];
  questionHistory: QuestionHistory[];
}> {
  const [history, questionHistory] = await Promise.all([
    getAllAnswerRecords(),
    getAllQuestionHistory(),
  ]);
  return { history, questionHistory };
}

export function persistQuestionHistory(record: QuestionHistory): void {
  void saveQuestionHistory(record);
}

export function persistAnswerRecord(
  record: AnswerRecord,
  canStartDailySync: () => boolean = () => true,
): void {
  void saveAnswerRecord(record).then(() => {
    if (canStartDailySync()) void runDailyAnswerSync(canStartDailySync);
  });
  window.dispatchEvent(new Event(ANSWER_RECORDED_EVENT));
}
