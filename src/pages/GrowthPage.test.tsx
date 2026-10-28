/**
 * 成長記録画面のテスト
 * IndexedDB はモックし、空状態・データあり状態・エラー状態を検証する。
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import GrowthPage from './GrowthPage';
import type { GrowthData } from '../types/growth';

// aggregateGrowthData をモック
vi.mock('../utils/growthStats', () => ({
  aggregateGrowthData: vi.fn(),
  aggregateByCategory: vi.fn().mockReturnValue([]),
  aggregateByProblemType: vi.fn().mockReturnValue([]),
  formatAccuracy: (rate: number | null) =>
    rate === null ? '未学習' : `${Math.round(rate)}%`,
  formatAverageTime: (seconds: number | null) =>
    seconds === null ? '未学習' : `${Math.round(seconds)}秒`,
  formatMs: (ms: number) => `${Math.round(ms / 1000)}秒`,
}));
// storage/db のモック（IndexedDBアクセスを模擬）
vi.mock('../storage/db', () => ({
  getAllAnswerRecords: vi.fn().mockResolvedValue([]),
  getAllGenerators: vi.fn(),
  getTypeSupportedLevels: vi.fn(),
  listSpeedGateSessions: vi.fn(),
  computeSpeedGateResult: vi.fn(),
}));
import { aggregateGrowthData } from '../utils/growthStats';

const mockedAggregate = aggregateGrowthData as ReturnType<typeof vi.fn>;

const emptyData: GrowthData = {
  today: null,
  todaySpeedGate: null,
  dailyGrowth: [],
  dailySpeedGate: [],
  byProblemType: [],
  comparison: {
    prevAccuracyRate: null,
    recentAccuracyRate: null,
    prevAverageTimeSec: null,
    recentAverageTimeSec: null,
    prevQuestionCount: 0,
    recentQuestionCount: 0,
  },
  totalQuestionCount: 0,
  totalCorrectCount: 0,
  totalAverageTimeSec: 0,
  hasData: false,
};

const dataWithRecords: GrowthData = {
  today: {
    dateKey: '2026-10-25',
    questionCount: 10,
    correctCount: 8,
    accuracyRate: 80,
    averageTimeSec: 15.5,
    hasLearned: true,
  },
  todaySpeedGate: null,
  dailyGrowth: [
    { dateKey: '2026-10-19', questionCount: 5, correctCount: 4, accuracyRate: 80, averageTimeSec: 12, hasLearned: true },
    { dateKey: '2026-10-20', questionCount: 8, correctCount: 6, accuracyRate: 75, averageTimeSec: 14, hasLearned: true },
    { dateKey: '2026-10-21', questionCount: 0, correctCount: 0, accuracyRate: 0, averageTimeSec: 0, hasLearned: false },
    { dateKey: '2026-10-22', questionCount: 10, correctCount: 9, accuracyRate: 90, averageTimeSec: 10, hasLearned: true },
    { dateKey: '2026-10-23', questionCount: 7, correctCount: 5, accuracyRate: 71.4, averageTimeSec: 18, hasLearned: true },
    { dateKey: '2026-10-24', questionCount: 6, correctCount: 6, accuracyRate: 100, averageTimeSec: 8, hasLearned: true },
    { dateKey: '2026-10-25', questionCount: 10, correctCount: 8, accuracyRate: 80, averageTimeSec: 15.5, hasLearned: true },
  ],
  dailySpeedGate: [],
  byProblemType: [
    { problemType: 'addition_2_2', label: '整数', totalCount: 20, correctCount: 16, accuracyRate: 80 },
    { problemType: 'subtraction_2_2', label: '引き算', totalCount: 15, correctCount: 10, accuracyRate: 66.7 },
  ],
  comparison: {
    prevAccuracyRate: 70,
    recentAccuracyRate: 80,
    prevAverageTimeSec: 20,
    recentAverageTimeSec: 15,
    prevQuestionCount: 30,
    recentQuestionCount: 40,
  },
  totalQuestionCount: 46,
  totalCorrectCount: 35,
  totalAverageTimeSec: 13.5,
  hasData: true,
};

describe('GrowthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('データがない場合は空状態を表示する', async () => {
    mockedAggregate.mockResolvedValue(emptyData);

    render(<GrowthPage />);

    await waitFor(() => {
      expect(screen.getByText('成長記録はまだありません')).toBeInTheDocument();
    });
    expect(screen.queryByText('正答率')).not.toBeInTheDocument();
  });

  it('データがある場合は正答率・問題数・平均時間を表示する', async () => {
    mockedAggregate.mockResolvedValue(dataWithRecords);

    render(<GrowthPage />);

    await waitFor(() => {
      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText('10 問')).toBeInTheDocument();
    });
  });

  it('問題タイプ別正答率テーブルを表示する', async () => {
    mockedAggregate.mockResolvedValue(dataWithRecords);

    render(<GrowthPage />);

    await waitFor(() => {
      expect(screen.getByText('問題タイプ別正答率')).toBeInTheDocument();
      expect(screen.getByText('整数')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  it('期間比較セクションを表示する', async () => {
    mockedAggregate.mockResolvedValue(dataWithRecords);

    render(<GrowthPage />);

    await waitFor(() => {
      expect(screen.getByText('期間比較')).toBeInTheDocument();
      expect(screen.getByText('前: 70%')).toBeInTheDocument();
      expect(screen.getByText('直近: 80%')).toBeInTheDocument();
    });
  });

  it('期間ボタンを切り替えると再取得する', async () => {
    mockedAggregate.mockResolvedValue(emptyData);

    render(<GrowthPage />);

    await waitFor(() => {
      expect(screen.getByText('成長記録はまだありません')).toBeInTheDocument();
    });

    const btn30 = screen.getByText('30日間');
    btn30.click();

    await waitFor(() => {
      expect(mockedAggregate).toHaveBeenCalledWith(30);
    });
  });

  it('エラー時はエラーメッセージを表示する', async () => {
    mockedAggregate.mockRejectedValue(new Error('DB error'));

    render(<GrowthPage />);

    await waitFor(() => {
      expect(screen.getByText(/学習記録の読み込みに失敗しました/)).toBeInTheDocument();
    });
  });
});