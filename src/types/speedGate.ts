/** 朝のハイスピード計算ゲートの型定義 */

export type SpeedGateOperation = 'add' | 'subtract' | 'multiply' | 'divide';

export interface SpeedGateProblem {
  id: string;
  index: number;
  operation: SpeedGateOperation;
  a: number;
  b: number;
  answer: number;
  question: string;
}

export interface SpeedGateAnswer {
  index: number;
  userAnswer: string | number | null;
  correctAnswer: number;
  isCorrect: boolean;
  elapsedMs: number;
  answeredAt: string;
}

export interface SpeedGateOperationStats {
  operation: SpeedGateOperation;
  total: number;
  correct: number;
  totalMs: number;
  averageMs: number;
  accuracy: number;
}

export interface SpeedGateResult {
  dateKey: string;
  totalCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  totalMs: number;
  averageMs: number;
  byOperation: Record<SpeedGateOperation, SpeedGateOperationStats>;
}

export type SpeedGateStatus = 'not_started' | 'in_progress' | 'completed';

export interface SpeedGateSession {
  dateKey: string;
  startedAt: string;
  completedAt?: string;
  status: SpeedGateStatus;
  problems: SpeedGateProblem[];
  answers: (SpeedGateAnswer | null)[];
  currentIndex: number;
}
