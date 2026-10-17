/**
 * 通常モードのホーム画面 (分野別学習 + 共有出題エントリの統合)
 *
 * 方針:
 * - 通常ユーザーは「分野 (area)」から、その分野の成績に合った難易度の学習を始められる。
 * - 共有出題エントリ「問題を解く」は、管理者タブで保存された出題範囲に従って出題する。
 * - 詳細設定は管理者モード (パスワード式) のときだけ別に表示する。
 */

import { useEffect, useState } from 'react';
import type { Category, DifficultyLevel, DifficultyRange } from '../types/problem';
import type { CurriculumGrade } from '../engine/curriculum/curriculumScope';
import { buildQuestionPool } from '../engine/selector/questionPool';
import { categoryLabel } from '../utils/stats';
import { listLearningAreas } from '../utils/adaptiveDifficulty';
import { difficultyLabel } from '../engine/difficulty/difficulty';
import AdminGateDialog from '../components/AdminGateDialog';
import type { QuizSelection } from './quizSelection';

interface HomePageProps {
  /** 通常モード: 指定された分野 (area) の学習を始める */
  onStartArea: (area: string) => void;
  /** 学習履歴へ移動 */
  onShowHistory: () => void;
  /** 管理者モードが解除済みなら詳細設定を出す */
  adminUnlocked?: boolean;
  /** 管理者モードの解除通知 (親で状態を保持する) */
  onAdminUnlockedChange?: (unlocked: boolean) => void;
  /** 管理者モードから指定して学習を始める */
  onStartAdminQuiz?: (selection: QuizSelection) => void;
  /** 共有出題: 保存済みの出題範囲に従って学習を始める */
  onStartQuiz: (difficulty: number) => void;
  /** 管理者タブ (認証) を開く */
  onOpenVerification: () => void;
  /** 管理者タブ (設定済み) を開く */
  onOpenPracticeSetup: () => void;
  /** 管理者タブを閉じる */
  onCloseAdminSettings: () => void;
  /** 管理者タブが認証済みかどうか */
  isAdminAuthenticated: boolean;
  /** 保存済みの問題タイプ数 (null = 読み込み中) */
  savedProblemTypeCount: number | null;
  /** 保存済みの難易度範囲 (null = 読み込み中) */
  savedDifficultyRange: DifficultyRange | null;
  /** 出題範囲の読み込みエラー */
  scopeLoadError: string | null;
  /** 学習開始時のエラー */
  startError: string | null;
  /** 学習開始処理中かどうか */
  isStarting: boolean;
}

/** 選択可能な学年 (小1〜小6) */
const GRADES: { value: CurriculumGrade; label: string }[] = [
  { value: 1, label: '小学1年' },
  { value: 2, label: '小学2年' },
  { value: 3, label: '小学3年' },
  { value: 4, label: '小学4年' },
  { value: 5, label: '小学5年' },
  { value: 6, label: '小学6年' },
];

const DIFFICULTIES: DifficultyLevel[] = [1, 2, 3, 4, 5];

export default function HomePage({
  onStartArea,
  onShowHistory,
  adminUnlocked,
  onAdminUnlockedChange,
  onStartAdminQuiz,
  onStartQuiz,
  onOpenVerification,
  onOpenPracticeSetup,
  onCloseAdminSettings,
  isAdminAuthenticated,
  savedProblemTypeCount,
  savedDifficultyRange,
  scopeLoadError,
  startError,
  isStarting,
}: HomePageProps) {
  // 管理者パスワードゲート (簡易ロック)
  const [unlocked, setUnlocked] = useState(false);
  const [showGate, setShowGate] = useState(false);

  // 管理者モードの指定内容 (すべて null = 絞り込みなし)
  const [category, setCategory] = useState<Category | null>(null);
  const [grade, setGrade] = useState<CurriculumGrade | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyLevel | null>(null);

  // 共有出題用の難易度選択 (保存済み範囲の内側に収める)
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(2);

  useEffect(() => {
    if (!savedDifficultyRange) return;
    if (
      selectedDifficulty < savedDifficultyRange.min ||
      selectedDifficulty > savedDifficultyRange.max
    ) {
      setSelectedDifficulty(savedDifficultyRange.min);
    }
  }, [savedDifficultyRange, selectedDifficulty]);

  const isUnlocked = adminUnlocked ?? unlocked;
  const pool = isUnlocked ? buildQuestionPool() : [];
  // 通常モードに出す分野ボタン (curriculumScope に登場する area を重複なしで)
  const areas = listLearningAreas();

  const typesInScope = pool
    .filter((e) => (category ? e.category === category : true))
    .filter((e) => (grade ? e.grade === grade : true))
    .filter((e) => (difficulty ? e.supportedLevels.includes(difficulty) : true));

  const selectableDifficulties = savedDifficultyRange
    ? DIFFICULTIES.filter(
        (level) => level >= savedDifficultyRange.min && level <= savedDifficultyRange.max,
      )
    : DIFFICULTIES;

  const handleUnlock = (value: boolean) => {
    setUnlocked(value);
    setShowGate(false);
    if (!value) {
      setCategory(null);
      setGrade(null);
      setType(null);
      setDifficulty(null);
    }
    onAdminUnlockedChange?.(value);
  };

  const handleAdminStart = () => {
    // 条件が1つもなければ通常モードと同じ完全ランダム出題。
    const hasFilter =
      category !== null || grade !== null || type !== null || difficulty !== null;
    const filter = hasFilter ? { category, grade, type, difficulty } : null;
    onStartAdminQuiz?.({
      studyMode: filter ? { kind: 'filtered', filter } : { kind: 'full-random' },
      category: filter ? category : null,
      difficulty: difficulty ?? 2,
      filter,
    });
  };

  return (
    <div className="home-page">
      <section className="hero-section">
        <h2>ようこそ！</h2>
        <p>分野ごとに、その分野の成績に合った難易度で問題を出題します。</p>
        <p>算数の問題をたくさんといて、じぶんの力をのばそう！</p>
      </section>

      {/* 保存済みの出題範囲と共有出題エントリ */}
      <section className="settings-section">
        <h3>問題のむずかしさ</h3>
        <div className="difficulty-buttons">
          {selectableDifficulties.map((level) => (
            <button
              key={level}
              type="button"
              className={`difficulty-button ${selectedDifficulty === level ? 'selected' : ''}`}
              onClick={() => setSelectedDifficulty(level)}
            >
              {difficultyLabel(level)}
            </button>
          ))}
        </div>
        <p aria-live="polite">
          {savedProblemTypeCount === null
            ? '保存済みの出題範囲を確認しています...'
            : `出題範囲：${savedProblemTypeCount}種類`}
        </p>
        {savedDifficultyRange && (
          <p aria-live="polite">
            出題難易度：Lv{savedDifficultyRange.min}〜Lv{savedDifficultyRange.max}
          </p>
        )}
        {(savedProblemTypeCount === 0 || scopeLoadError) && (
          <p className="error-message" role="status">
            {scopeLoadError ?? '出題範囲が空です。管理者タブで範囲を設定してください。'}
          </p>
        )}
        {startError && <p className="error-message" role="alert">{startError}</p>}
      </section>

      {/* 分野別学習: 押した分野の成績に合った難易度で出題する */}
      <section className="settings-section area-selection">
        <h3>どの分野を勉強しますか？</h3>
        <p className="study-hint">分野を押すと、その分野の問題を10問出題します。</p>
        <div className="area-buttons">
          {areas.map((area) => (
            <button
              key={area}
              type="button"
              className="primary-button area-button"
              data-area={area}
              onClick={() => onStartArea(area)}
            >
              {area}
            </button>
          ))}
        </div>
      </section>

      <div className="action-buttons">
        <button
          className="primary-button start-button"
          disabled={isStarting}
          onClick={() => onStartQuiz(selectedDifficulty)}
        >
          {isStarting ? '設定を読み込んでいます...' : '問題を解く'}
        </button>
        {isAdminAuthenticated ? (
          <>
            <button className="secondary-button" onClick={onOpenPracticeSetup}>
              管理者タブ（出題設定）
            </button>
            <button className="secondary-button" onClick={onCloseAdminSettings}>
              管理者タブを閉じる
            </button>
          </>
        ) : (
          <>
            <button className="secondary-button" onClick={onOpenVerification}>
              管理者タブ
            </button>
            <button className="secondary-button" onClick={onShowHistory}>
              学習履歴を見る
            </button>
          </>
        )}
      </div>

      {/* 隠しゲート: ここから管理者モード (詳細設定) へ入る */}
      {!isUnlocked ? (
        <section className="settings-section admin-entry">
          <button type="button" className="link-button" onClick={() => setShowGate(true)}>
            管理者モード
          </button>
        </section>
      ) : (
        <section className="settings-section admin-panel">
          <h3>管理者モード</h3>
          <p className="study-hint">指定がない場合は通常モードと同じ完全ランダム出題です。</p>

          <div className="admin-group">
            <label htmlFor="admin-category">分野</label>
            <select
              id="admin-category"
              value={category ?? ''}
              onChange={(e) => setCategory((e.target.value || null) as Category | null)}
            >
              <option value="">すべて</option>
              {[...new Set(pool.map((e) => e.category))].map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-group">
            <label htmlFor="admin-grade">学年</label>
            <select
              id="admin-grade"
              value={grade ?? ''}
              onChange={(e) =>
                setGrade(e.target.value ? (Number(e.target.value) as CurriculumGrade) : null)
              }
            >
              <option value="">すべて</option>
              {GRADES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-group">
            <label htmlFor="admin-difficulty">難易度</label>
            <select
              id="admin-difficulty"
              value={difficulty ?? ''}
              onChange={(e) =>
                setDifficulty(e.target.value ? (Number(e.target.value) as DifficultyLevel) : null)
              }
            >
              <option value="">すべて</option>
              {DIFFICULTIES.map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-group">
            <label htmlFor="admin-type">問題タイプ</label>
            <select id="admin-type" value={type ?? ''} onChange={(e) => setType(e.target.value || null)}>
              <option value="">すべて ({typesInScope.length}件)</option>
              {typesInScope.map((e) => (
                <option key={e.type} value={e.type}>
                  {e.type} ({e.description})
                </option>
              ))}
            </select>
          </div>

          <div className="action-buttons">
            <button className="primary-button" onClick={handleAdminStart}>
              この条件で学習をはじめる
            </button>
            <button className="secondary-button" onClick={() => handleUnlock(false)}>
              管理者モードを閉じる
            </button>
          </div>
        </section>
      )}

      {showGate && <AdminGateDialog onResolved={handleUnlock} onClose={() => setShowGate(false)} />}
    </div>
  );
}
