/**
 * タッチ操作用の数字キーパッドコンポーネント
 * Androidタブレット・スマートフォンでの入力をサポートする
 *
 * 機能:
 * - 数字0-9入力
 * - 小数点(.)入力
 * - 分数入力 (/)
 * - 帯分数入力 (と)
 * - リスト入力 (,)
 * - クリア・削除
 * - はい/いいえ選択ボタン (yes/no問題向け)
 */

import type { Answer } from '../types/problem';

interface TouchKeypadProps {
  /** 現在の入力値 */
  value: string;
  /** 入力値が変更された時のコールバック */
  onChange: (value: string) => void;
  /** 解答を送信する時のコールバック */
  onSubmit: () => void;
  /** 入力が無効化されているか (回答済みか) */
  disabled?: boolean;
  /** 問題の解答 */
  answer?: Answer;
  /** 問題文 (はい/いいえ問題の判定に使用) */
  question?: string;
}

/**
 * キーパッドのボタン定義
 */
interface KeypadButton {
  label: string;
  value: string;
  className?: string;
}

/**
 * メインの数字キーパッドボタン
 */
const NUMBER_BUTTONS: KeypadButton[] = [
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
  { label: '6', value: '6' },
  { label: '7', value: '7' },
  { label: '8', value: '8' },
  { label: '9', value: '9' },
  { label: '0', value: '0' },
];

/**
 * 記号・操作ボタン
 */
const SYMBOL_BUTTONS: KeypadButton[] = [
  { label: '．', value: '.', className: 'symbol-btn' },
  { label: '／', value: '/', className: 'symbol-btn' },
  { label: 'と', value: 'と', className: 'symbol-btn' },
  { label: '，', value: ',', className: 'symbol-btn' },
  { label: '⌫', value: 'delete', className: 'action-btn' },
  { label: 'C', value: 'clear', className: 'action-btn' },
];

export default function TouchKeypad({
  value,
  onChange,
  onSubmit,
  disabled = false,
  answer,
  question = '',
}: TouchKeypadProps) {
  // はい/いいえ問題かどうかを判定
  // 問題文に「はい」または「いいえ」が含まれている場合、選択ボタンを表示
  const isYesNoQuestion =
    answer?.kind === 'string' &&
    (question.includes('はい') || question.includes('いいえ'));

  /**
   * ボタンが押された時の処理
   */
  const handlePress = (btn: KeypadButton) => {
    if (disabled) return;

    if (btn.value === 'delete') {
      onChange(value.slice(0, -1));
    } else if (btn.value === 'clear') {
      onChange('');
    } else {
      // 入力可能な文字数制限 (20文字)
      if (value.length < 20) {
        onChange(value + btn.value);
      }
    }
  };

  /**
   * はい/いいえボタンが押された時の処理
   */
  const handleYesNo = (selected: string) => {
    if (disabled) return;
    onChange(selected);
  };

  return (
    <div className="touch-keypad">
      {/* はい/いいえ選択 (文字列回答の問題向け) */}
      {isYesNoQuestion ? (
        <div className="yesno-buttons">
          <button
            type="button"
            className="keypad-button yesno-btn"
            onClick={() => handleYesNo('はい')}
            disabled={disabled}
          >
            はい
          </button>
          <button
            type="button"
            className="keypad-button yesno-btn"
            onClick={() => handleYesNo('いいえ')}
            disabled={disabled}
          >
            いいえ
          </button>
        </div>
      ) : (
        <>
          {/* 数字キーパッド */}
          <div className="keypad-grid">
            {NUMBER_BUTTONS.map((btn) => (
              <button
                key={btn.label}
                type="button"
                className="keypad-button number-btn"
                onClick={() => handlePress(btn)}
                disabled={disabled}
              >
                {btn.label}
              </button>
            ))}
            {SYMBOL_BUTTONS.map((btn) => (
              <button
                key={btn.label}
                type="button"
                className={`keypad-button ${btn.className ?? ''}`}
                onClick={() => handlePress(btn)}
                disabled={disabled}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* 回答送信ボタン */}
          <button
            type="button"
            className="keypad-submit"
            onClick={onSubmit}
            disabled={disabled || value.trim() === ''}
          >
            こたえる
          </button>
        </>
      )}
    </div>
  );
}
