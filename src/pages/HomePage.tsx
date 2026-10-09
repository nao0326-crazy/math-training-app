/**
 * 通常モードのホーム画面
 *
 * 方針: 通常ユーザーに選択を許すのは「学習する分野 (area)」だけ。
 * 学年・カテゴリ・問題タイプ・難易度の選択はここに置かず、
 * 管理者モード (パスワード式) のときだけ別に表示する。
 * 難易度は分野ボタンを押した後に、その分野の回答履歴から自動で決まる。
 */

import { useState } from 'react';
import type { Category, DifficultyLevel } from '../types/problem';
import type { CurriculumGrade } from '../engine/curriculum/curriculumScope';
import { buildQuestionPool } from '../engine/selector/questionPool';
import { categoryLabel } from '../utils/stats';
import { listLearningAreas } from '../utils/adaptiveDifficulty';
import AdminGateDialog from '../components/AdminGateDialog';
import { isAdminUnlocked, setAdminUnlocked } from '../utils/adminMode';
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

/**
 * 通常ユーザー向けの画面
 *
 * 分野 (area) ボタンを押すと、その分野の10問学習が始まる。
 * 難易度はボタンを押した後、その分野の回答履歴から自動で決まる。
 * 管理者は下部の小さな入口からパスワードを入力して詳細設定へ入れる。
 */
export default function HomePage({
  onStartArea,
  onShowHistory,
  adminUnlocked,
  onAdminUnlockedChange,
  onStartAdminQuiz,
}: HomePageProps) {
  const [unlocked, setUnlocked] = useState(() => adminUnlocked ?? isAdminUnlocked());
  const [showGate, setShowGate] = useState(false);

  // 管理者モードの指定内容 (すべて null = 絞り込みなし)
  const [category, setCategory] = useState<Category | null>(null);
  const [grade, setGrade] = useState<CurriculumGrade | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyLevel | null>(null);

  const isUnlocked = adminUnlocked ?? unlocked;
  const pool = isUnlocked ? buildQuestionPool() : [];
  // 通常モードに出す分野ボタン (curriculumScope に登場する area を重複なしで)
  const areas = listLearningAreas();

  const typesInScope = pool
    .filter((e) => (category ? e.category === category : true))
    .filter((e) => (grade ? e.grade === grade : true))
    .filter((e) => (difficulty ? e.supportedLevels.includes(difficulty) : true));

  const handleUnlock = (value: boolean) => {
    setUnlocked(value);
    setShowGate(false);
    setAdminUnlocked(value);
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
      </section>

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
        <button className="secondary-button" onClick={onShowHistory}>
          学習履歴を見る
        </button>
      </div>

      {/* 隠しゲート: ここから管理者モードへ入る */}
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
