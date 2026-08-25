/**
 * 回答入力コンポーネント
 *
 * 問題の解答種類に応じて適切な入力UIを自動選択する。
 * タブレット・スマートフォンではOS標準のソフトウェアキーボードを表示しない。
 *
 * 入力UIの種類:
 * - integer: 数字のみ (小数点なし)
 * - decimal: 数字 + 小数点
 * - fraction: 分子・分母の専用入力枠
 * - mixed: 整数部 + 分子・分母の専用入力枠
 * - yesno: はい/いいえボタン
 * - string: テキスト入力 + キーパッド (式・リスト等)
 *
 * すべての入力フィールドは readOnly + inputMode="none" に設定され、
 * OSキーボードの表示を防ぐ。PCでは onKeyDown によってキーボード入力を捕捉する。
 */

import { useState, useCallback, KeyboardEvent } from 'react';
import type { Problem } from '../types/problem';
import {
  getAnswerInputType,
  validateAnswerInput,
  getNormalizedAnswer,
} from '../utils/inputType';

interface AnswerInputProps {
  problem: Problem;
  disabled?: boolean;
  onSubmit: (answer: string) => void;
}

/** キーパッドボタン定義 */
interface KeypadButton {
  label: string;
  value: string;
  className?: string;
  isNumber?: boolean;
}

/** キーパッドボタン定義 (数字キーパッド) */
function getNumberPadButtons(showDecimal: boolean): KeypadButton[] {
  return [
    { label: '1', value: '1', className: 'number-btn', isNumber: true },
    { label: '2', value: '2', className: 'number-btn', isNumber: true },
    { label: '3', value: '3', className: 'number-btn', isNumber: true },
    { label: showDecimal ? '．' : '', value: showDecimal ? 'decimal' : '', className: 'symbol-btn' },
    { label: '4', value: '4', className: 'number-btn', isNumber: true },
    { label: '5', value: '5', className: 'number-btn', isNumber: true },
    { label: '6', value: '6', className: 'number-btn', isNumber: true },
    { label: '⌫', value: 'delete', className: 'action-btn' },
    { label: '7', value: '7', className: 'number-btn', isNumber: true },
    { label: '8', value: '8', className: 'number-btn', isNumber: true },
    { label: '9', value: '9', className: 'number-btn', isNumber: true },
    { label: 'C', value: 'clear', className: 'action-btn' },
    { label: '0', value: '0', className: 'number-btn zero-btn', isNumber: true },
  ];
}

/** テキスト入力用キーパッド */
function getTextKeypadButtons(): KeypadButton[] {
  return [
    { label: '1', value: '1', className: 'number-btn', isNumber: true },
    { label: '2', value: '2', className: 'number-btn', isNumber: true },
    { label: '3', value: '3', className: 'number-btn', isNumber: true },
    { label: '．', value: '.', className: 'symbol-btn' },
    { label: '4', value: '4', className: 'number-btn', isNumber: true },
    { label: '5', value: '5', className: 'number-btn', isNumber: true },
    { label: '6', value: '6', className: 'number-btn', isNumber: true },
    { label: '／', value: '/', className: 'symbol-btn' },
    { label: '7', value: '7', className: 'number-btn', isNumber: true },
    { label: '8', value: '8', className: 'number-btn', isNumber: true },
    { label: '9', value: '9', className: 'number-btn', isNumber: true },
    { label: 'と', value: 'と', className: 'symbol-btn' },
    { label: '0', value: '0', className: 'number-btn zero-btn', isNumber: true },
    { label: '，', value: ',', className: 'symbol-btn' },
    { label: '⌫', value: 'delete', className: 'action-btn' },
    { label: 'C', value: 'clear', className: 'action-btn' },
  ];
}

/** 表示用入力フィールド (readOnly + inputMode="none") */
function AnswerField({
  value,
  placeholder,
  active,
  onFocus,
  onKeyDown,
  disabled,
  className = '',
}: {
  value: string;
  placeholder?: string;
  active?: boolean;
  onFocus?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <input
      type="text"
      className={`answer-display ${active ? 'active' : ''} ${className}`}
      value={value}
      placeholder={placeholder}
      readOnly
      inputMode="none"
      autoComplete="off"
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      disabled={disabled}
    />
  );
}

/**
 * 汎用キーパッドグリッドコンポーネント
 */
function KeypadGrid({
  buttons,
  onPress,
  disabled,
}: {
  buttons: KeypadButton[];
  onPress: (btn: KeypadButton) => void;
  disabled?: boolean;
}) {
  return (
    <div className="number-pad">
      <div className="keypad-grid">
        {buttons.map((btn) => (
          <button
            key={btn.label}
            type="button"
            className={`keypad-button ${btn.className ?? ''}`}
            onClick={() => onPress(btn)}
            disabled={disabled}
          >
            {btn.label}
          </button>
        ))}
      </div>
        </div>
  );
}

/**
 * 回答入力コンポーネント (メイン)
 *
 * 問題の解答種類に基づいて適切な入力UIを選択・表示する。
 */
export default function AnswerInput({
  problem,
  disabled = false,
  onSubmit,
}: AnswerInputProps) {
  const inputType = getAnswerInputType(problem.answer, problem.question);
  const isDecimal = problem.answer.kind === 'decimal';

  // === State ===
  const [textValue, setTextValue] = useState('');
  const [fracNum, setFracNum] = useState('');
  const [fracDen, setFracDen] = useState('');
  const [fracActive, setFracActive] = useState<'numerator' | 'denominator'>('numerator');
  const [mixedWhole, setMixedWhole] = useState('');
  const [mixedNum, setMixedNum] = useState('');
  const [mixedDen, setMixedDen] = useState('');
  const [mixedActive, setMixedActive] = useState<'whole' | 'numerator' | 'denominator'>('whole');
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    if (error) setError(null);
  }, [error]);

  // === params取得 ===
  const getParams = useCallback(() => {
    switch (inputType) {
      case 'integer':
      case 'decimal':
      case 'string':
      case 'yesno':
        return { text: textValue };
      case 'fraction':
        return { fraction: { numerator: fracNum, denominator: fracDen } };
      case 'mixed':
        return { mixed: { whole: mixedWhole, numerator: mixedNum, denominator: mixedDen } };
    }
  }, [inputType, textValue, fracNum, fracDen, mixedWhole, mixedNum, mixedDen]);

    const normalizedValue = getNormalizedAnswer(inputType, getParams());

  // === テキスト入力ハンドラ ===
  const handleNumberPress = useCallback(
    (digit: string) => {
      if (disabled || textValue.length >= 20) return;
      clearError();
      setTextValue(textValue + digit);
    },
    [textValue, disabled, clearError],
  );

  const handleDecimalPress = useCallback(() => {
    if (disabled || !isDecimal || textValue.includes('.')) return;
    clearError();
    setTextValue(textValue + '.');
  }, [textValue, disabled, isDecimal, clearError]);

  const handleTextKey = useCallback(
    (str: string) => {
      if (disabled || textValue.length >= 50) return;
      clearError();
      setTextValue(textValue + str);
    },
    [textValue, disabled, clearError],
  );

  const handleDelete = useCallback(() => {
    if (disabled) return;
    clearError();
    setTextValue(textValue.slice(0, -1));
  }, [textValue, disabled, clearError]);

  const handleClear = useCallback(() => {
    if (disabled) return;
    clearError();
    setTextValue('');
  }, [disabled, clearError]);

  const handleYesNoSelect = useCallback(
    (val: string) => {
      if (disabled) return;
      clearError();
      setTextValue(val);
    },
        [disabled, clearError],
  );

  // === 分数入力ハンドラ ===
  const handleFracNumberPress = useCallback(
    (digit: string) => {
      if (disabled) return;
      clearError();
      if (fracActive === 'numerator') {
        if (fracNum.length < 10) setFracNum(fracNum + digit);
      } else if (fracDen.length < 10) {
        setFracDen(fracDen + digit);
      }
    },
    [fracActive, fracNum, fracDen, disabled, clearError],
  );

  const handleFracDelete = useCallback(() => {
    if (disabled) return;
    clearError();
    if (fracActive === 'numerator') {
      setFracNum(fracNum.slice(0, -1));
    } else {
      setFracDen(fracDen.slice(0, -1));
    }
  }, [fracActive, fracNum, fracDen, disabled, clearError]);

  const handleFracClear = useCallback(() => {
    if (disabled) return;
    clearError();
    setFracNum('');
    setFracDen('');
    setFracActive('numerator');
  }, [disabled, clearError]);

  // === 帯分数入力ハンドラ ===
  const handleMixedNumberPress = useCallback(
    (digit: string) => {
      if (disabled) return;
      clearError();
      if (mixedActive === 'whole') {
        if (mixedWhole.length < 10) setMixedWhole(mixedWhole + digit);
      } else if (mixedActive === 'numerator') {
        if (mixedNum.length < 10) setMixedNum(mixedNum + digit);
      } else if (mixedDen.length < 10) {
        setMixedDen(mixedDen + digit);
      }
    },
    [mixedActive, mixedWhole, mixedNum, mixedDen, disabled, clearError],
  );

  const handleMixedDelete = useCallback(() => {
    if (disabled) return;
    clearError();
    if (mixedActive === 'whole') {
      setMixedWhole(mixedWhole.slice(0, -1));
    } else if (mixedActive === 'numerator') {
      setMixedNum(mixedNum.slice(0, -1));
    } else {
      setMixedDen(mixedDen.slice(0, -1));
    }
  }, [mixedActive, mixedWhole, mixedNum, mixedDen, disabled, clearError]);

  const handleMixedClear = useCallback(() => {
    if (disabled) return;
    clearError();
    setMixedWhole('');
    setMixedNum('');
    setMixedDen('');
    setMixedActive('whole');
  }, [disabled, clearError]);

  // === 決定ボタンハンドラ ===
  const handleSubmit = useCallback(() => {
    if (disabled) return;
    const params = getParams();
    const errMsg = validateAnswerInput(inputType, params);
    if (errMsg) {
      setError(errMsg);
      return;
    }
    setError(null);
    onSubmit(normalizedValue);
  }, [disabled, inputType, getParams, normalizedValue, onSubmit]);

  // === PCキーボードハンドラ ===
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      if (inputType === 'integer' || inputType === 'decimal') {
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          handleNumberPress(e.key);
        } else if (e.key === '.' && inputType === 'decimal') {
          e.preventDefault();
          handleDecimalPress();
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleDelete();
        } else if (e.key === 'Delete') {
          e.preventDefault();
          handleClear();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleSubmit();
        }
      } else if (inputType === 'yesno') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSubmit();
        }
      } else if (inputType === 'fraction') {
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          handleFracNumberPress(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleFracDelete();
        } else if (e.key === 'Delete') {
          e.preventDefault();
          handleFracClear();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleSubmit();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          setFracActive(fracActive === 'numerator' ? 'denominator' : 'numerator');
        }
      }
    },
    [
      disabled, inputType,
      handleNumberPress, handleDecimalPress, handleDelete, handleClear,
      handleFracNumberPress, handleFracDelete, handleFracClear,
      fracActive,
      handleSubmit,
    ],
  );

  // mixed の PCキーボードハンドラ
  const handleMixedKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleMixedNumberPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleMixedDelete();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handleMixedClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const order: Array<'whole' | 'numerator' | 'denominator'> =
          ['whole', 'numerator', 'denominator'];
        const idx = order.indexOf(mixedActive);
        const next = e.shiftKey
          ? order[(idx + order.length - 1) % order.length]
          : order[(idx + 1) % order.length];
        setMixedActive(next);
      }
    },
    [
      disabled, mixedActive,
      handleMixedNumberPress, handleMixedDelete, handleMixedClear, handleSubmit,
    ],
  );

  // string の PCキーボードハンドラ
  const handleStringKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleTextKey(e.key);
      }
    },
    [disabled, handleTextKey, handleSubmit],
  );

  // キーパッドの共通プレス処理 (integer/decimal/string 用)
  const handlePadPress = useCallback(
    (btn: KeypadButton) => {
      if (btn.value === 'delete') {
        handleDelete();
      } else if (btn.value === 'clear') {
        handleClear();
      } else if (btn.value === 'decimal') {
        handleDecimalPress();
      } else {
        handleNumberPress(btn.value);
      }
    },
    [handleDelete, handleClear, handleDecimalPress, handleNumberPress],
  );

  // 分数キーパッドのプレス処理
  const handleFracPadPress = useCallback(
    (btn: KeypadButton) => {
      if (btn.value === 'delete') {
        handleFracDelete();
      } else if (btn.value === 'clear') {
        handleFracClear();
      } else {
        handleFracNumberPress(btn.value);
      }
    },
    [handleFracDelete, handleFracClear, handleFracNumberPress],
  );

  // 帯分数キーパッドのプレス処理
  const handleMixedPadPress = useCallback(
    (btn: KeypadButton) => {
      if (btn.value === 'delete') {
        handleMixedDelete();
      } else if (btn.value === 'clear') {
        handleMixedClear();
      } else {
        handleMixedNumberPress(btn.value);
      }
    },
    [handleMixedDelete, handleMixedClear, handleMixedNumberPress],
  );

  // === UIレンダリング ===
  return (
    <div className="answer-input-container">
      <div className="answer-display-area">
        <div className="answer-label">答え</div>

        {/* === integer / decimal: 通常の数値入力 === */}
        {(inputType === 'integer' || inputType === 'decimal') && (
          <>
            <AnswerField
              value={textValue}
              placeholder="0"
              active={true}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              className="numeric-display"
            />
            <KeypadGrid
              buttons={getNumberPadButtons(isDecimal)}
              onPress={handlePadPress}
              disabled={disabled}
            />
          </>
        )}

        {/* === fraction: 分数入力 (分子・分母) === */}
        {inputType === 'fraction' && (
          <>
            <div className="fraction-display">
              <AnswerField
                value={fracNum}
                placeholder="分子"
                active={fracActive === 'numerator'}
                onFocus={() => setFracActive('numerator')}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="frac-num"
              />
              <div className="frac-bar" aria-hidden="true"></div>
              <AnswerField
                value={fracDen}
                placeholder="分母"
                active={fracActive === 'denominator'}
                onFocus={() => setFracActive('denominator')}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="frac-den"
              />
            </div>
            <KeypadGrid
              buttons={getNumberPadButtons(false)}
              onPress={handleFracPadPress}
              disabled={disabled}
            />
          </>
        )}

        {/* === mixed: 帯分数入力 (整数部・分子・分母) === */}
        {inputType === 'mixed' && (
          <>
            <div className="mixed-display">
              <AnswerField
                value={mixedWhole}
                placeholder="0"
                active={mixedActive === 'whole'}
                onFocus={() => setMixedActive('whole')}
                onKeyDown={handleMixedKeyDown}
                disabled={disabled}
                className="mixed-whole"
              />
              <span className="mixed-text">と</span>
              <div className="frac-part">
                <AnswerField
                  value={mixedNum}
                  placeholder="分子"
                  active={mixedActive === 'numerator'}
                  onFocus={() => setMixedActive('numerator')}
                  onKeyDown={handleMixedKeyDown}
                  disabled={disabled}
                  className="frac-num"
                />
                <div className="frac-bar" aria-hidden="true"></div>
                <AnswerField
                  value={mixedDen}
                  placeholder="分母"
                  active={mixedActive === 'denominator'}
                  onFocus={() => setMixedActive('denominator')}
                  onKeyDown={handleMixedKeyDown}
                  disabled={disabled}
                  className="frac-den"
                />
              </div>
            </div>
            <KeypadGrid
              buttons={getNumberPadButtons(false)}
              onPress={handleMixedPadPress}
              disabled={disabled}
            />
          </>
        )}

        {/* === yesno: はい/いいえボタン === */}
        {inputType === 'yesno' && (
          <>
            <AnswerField
              value={textValue}
              placeholder="はい / いいえ"
              active={true}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              className="yesno-display"
            />
            <div className="yesno-buttons">
              <button
                type="button"
                className={`yesno-btn yes-btn ${textValue === 'はい' ? 'selected' : ''}`}
                onClick={() => handleYesNoSelect('はい')}
                disabled={disabled}
              >
                はい
              </button>
              <button
                type="button"
                className={`yesno-btn no-btn ${textValue === 'いいえ' ? 'selected' : ''}`}
                onClick={() => handleYesNoSelect('いいえ')}
                disabled={disabled}
              >
                いいえ
              </button>
            </div>
          </>
        )}

        {/* === string: テキスト入力 + キーパッド === */}
        {inputType === 'string' && (
          <>
            <AnswerField
              value={textValue}
              placeholder="答えを入力"
              active={true}
              onKeyDown={handleStringKeyDown}
              disabled={disabled}
              className="string-display"
            />
            <KeypadGrid
              buttons={getTextKeypadButtons()}
              onPress={handlePadPress}
              disabled={disabled}
            />
          </>
        )}
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="answer-error" role="alert">
          {error}
        </div>
      )}

      {/* 決定ボタン */}
      <button
        type="button"
        className="submit-btn"
        onClick={handleSubmit}
        disabled={disabled}
      >
        決定する
      </button>
    </div>
  );
}

