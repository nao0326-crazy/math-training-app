import { useEffect, useMemo, useState } from 'react';
import type { Category } from '../types/problem';
import { getAllGenerators } from '../engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../engine/diversity/metadata';
import { categoryLabel } from '../utils/stats';
import { difficultyLabel } from '../engine/difficulty/difficulty';
import {
  DEFAULT_ADMIN_PRACTICE_DIFFICULTY_RANGE,
  getAdminPracticeConfiguration,
  saveAdminPracticeConfiguration,
} from '../storage/db';
import type { DifficultyLevel, DifficultyRange } from '../types/problem';

interface PracticeSetupPageProps {
  onSaved: (problemTypes: string[], difficultyRange: DifficultyRange) => void;
  onClose: () => void;
}

const GENERATORS = getAllGenerators().filter(
  (generator) => getTypeSupportedLevels(generator.type).length > 0,
);
const CATEGORIES = [...new Set(GENERATORS.map((generator) => generator.category))];

export default function PracticeSetupPage({ onSaved, onClose }: PracticeSetupPageProps) {
  const [problemTypes, setProblemTypes] = useState<string[]>([]);
  const [difficultyRange, setDifficultyRange] = useState<DifficultyRange>(
    DEFAULT_ADMIN_PRACTICE_DIFFICULTY_RANGE,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(problemTypes), [problemTypes]);

  useEffect(() => {
    let cancelled = false;
    void getAdminPracticeConfiguration()
      .then((configuration) => {
        if (!cancelled) {
          setProblemTypes(configuration.problemTypes);
          setDifficultyRange(configuration.difficultyRange);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
          setError('保存済みの出題設定を読み込めませんでした。設定を変更せず、画面を閉じてください。');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleType = (type: string) => {
    setProblemTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
    setError(null);
  };

  const toggleCategory = (category: Category) => {
    const categoryTypes = GENERATORS.filter((generator) => generator.category === category)
      .map((generator) => generator.type);
    const allSelected = categoryTypes.every((type) => selectedSet.has(type));
    setProblemTypes((current) =>
      allSelected
        ? current.filter((type) => !categoryTypes.includes(type))
        : [...new Set([...current, ...categoryTypes])],
    );
    setError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await saveAdminPracticeConfiguration(problemTypes, difficultyRange);
      onSaved(problemTypes, difficultyRange);
    } catch {
      setError('出題設定を保存できませんでした。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="home-page practice-setup-page">
      <section className="settings-section">
        <h2>管理者タブ：出題設定</h2>
        <p>出題範囲にする問題の種類をえらんでください。</p>
        <p aria-live="polite">選択中：{problemTypes.length}種類</p>
        <div className="difficulty-range-controls">
          <label>
            出題難易度の下限
            <select
              value={difficultyRange.min}
              disabled={isLoading || loadFailed}
              onChange={(event) => {
                const min = Number(event.target.value) as DifficultyLevel;
                setDifficultyRange((current) => ({
                  min,
                  max: Math.max(min, current.max) as DifficultyLevel,
                }));
                setError(null);
              }}
            >
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>{`Lv${level} - ${difficultyLabel(level as DifficultyLevel)}`}</option>
              ))}
            </select>
          </label>
          <label>
            出題難易度の上限
            <select
              value={difficultyRange.max}
              disabled={isLoading || loadFailed}
              onChange={(event) => {
                const max = Number(event.target.value) as DifficultyLevel;
                setDifficultyRange((current) => ({
                  min: Math.min(current.min, max) as DifficultyLevel,
                  max,
                }));
                setError(null);
              }}
            >
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>{`Lv${level} - ${difficultyLabel(level as DifficultyLevel)}`}</option>
              ))}
            </select>
          </label>
          <p aria-live="polite">
            設定範囲：Lv{difficultyRange.min}〜Lv{difficultyRange.max}
          </p>
        </div>
      </section>
      {isLoading ? (
        <p className="loading-message">保存済みの範囲を読み込んでいます...</p>
      ) : loadFailed ? (
        <p className="error-message" role="alert">{error}</p>
      ) : (
        <>
          <div className="action-buttons">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setProblemTypes(GENERATORS.map((generator) => generator.type))}
            >
              全て選択
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setProblemTypes([])}
            >
              全て解除
            </button>
          </div>
          {CATEGORIES.map((category) => {
            const categoryGenerators = GENERATORS.filter(
              (generator) => generator.category === category,
            );
            const allSelected = categoryGenerators.every((generator) =>
              selectedSet.has(generator.type),
            );
            return (
              <section className="settings-section" key={category}>
                <h3>{categoryLabel(category)}</h3>
                <button
                  type="button"
                  className="secondary-button"
                  aria-pressed={allSelected}
                  onClick={() => toggleCategory(category)}
                >
                  {allSelected ? 'この分野を全て解除' : 'この分野を全て選択'}
                </button>
                <div className="category-buttons">
                  {categoryGenerators.map((generator) => (
                    <label className="category-button" key={generator.type}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(generator.type)}
                        onChange={() => toggleType(generator.type)}
                      />
                      <span>{generator.description}</span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
      {error && !loadFailed && <p className="error-message" role="alert">{error}</p>}
      <div className="action-buttons">
        <button
          className="primary-button"
          type="button"
          disabled={isLoading || isSaving || loadFailed}
          onClick={() => void handleSave()}
        >
          {isSaving ? '保存しています...' : '出題範囲を保存'}
        </button>
        <button className="secondary-button" type="button" onClick={onClose}>
          管理者タブを閉じる
        </button>
      </div>
    </div>
  );
}
