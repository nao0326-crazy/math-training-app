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
import type { AnswerInputType, Problem } from '../types/problem';
import {
  getProblemChoiceOptions,
  getProblemInputType,
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

/** テキスト入力用キーパッド
 * 文字と式 (x・×) や分数リスト (／・と) など、式の記号入力をサポートする。
 */
function getTextKeypadButtons(): KeypadButton[] {
  return [
    { label: '1', value: '1', className: 'number-btn', isNumber: true },
    { label: '2', value: '2', className: 'number-btn', isNumber: true },
    { label: '3', value: '3', className: 'number-btn', isNumber: true },
    { label: 'x', value: 'x', className: 'symbol-btn' },
    { label: '4', value: '4', className: 'number-btn', isNumber: true },
    { label: '5', value: '5', className: 'number-btn', isNumber: true },
    { label: '6', value: '6', className: 'number-btn', isNumber: true },
    { label: '×', value: '×', className: 'symbol-btn' },
    { label: '÷', value: '÷', className: 'symbol-btn' },
    { label: '＝', value: '=', className: 'symbol-btn' },
    { label: '7', value: '7', className: 'number-btn', isNumber: true },
    { label: '8', value: '8', className: 'number-btn', isNumber: true },
    { label: '9', value: '9', className: 'number-btn', isNumber: true },
    { label: '．', value: '.', className: 'symbol-btn' },
    { label: '0', value: '0', className: 'number-btn zero-btn', isNumber: true },
    { label: '／', value: '/', className: 'symbol-btn' },
    { label: 'と', value: 'と', className: 'symbol-btn' },
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
 * 分数・帯分数入力のフィールド単位エラー状態
 */
interface FractionFieldErrors {
  whole: boolean;
  numerator: boolean;
  denominator: boolean;
}

/**
 * 入力欄ごとのエラー状態を計算する
 * 未入力の欄と分母0を検出して、画面上で「どこを直すべきか」を示す。
 * ※正解判定ロジックには関与しない (見た目上の補助のみ)
 */
function computeFieldErrors(
  _whole: string | undefined,
  numerator: string,
  denominator: string,
): FractionFieldErrors {
  const numEmpty = numerator.trim() === '';
  const denTrimmed = denominator.trim();
  const denEmpty = denTrimmed === '';
  const denZero = !denEmpty && parseInt(denTrimmed, 10) === 0;
  return {
    whole: false,
    numerator: numEmpty,
    denominator: denEmpty || denZero,
  };
}

/**
 * 複数分数 (通分) 入力のフィールド単位エラー状態を計算する
 * 未入力の欄と分母0を検出する (見た目上の補助のみ。判定は validateAnswerInput)
 */
function computeFlFieldErrors(
  fractions: { numerator: string; denominator: string }[],
): { numerator: boolean; denominator: boolean }[] {
  return fractions.map((f) => {
    const n = f.numerator.trim();
    const d = f.denominator.trim();
    const nEmpty = n === '';
    const dEmpty = d === '';
    const dZero = !dEmpty && /^\d+$/.test(d) && parseInt(d, 10) === 0;
    return { numerator: nEmpty, denominator: dEmpty || dZero };
  });
}

function computeRatioFieldErrors(left: string, right: string): { left: boolean; right: boolean } {
  return {
    left: !/^\d+$/.test(left.trim()),
    right: !/^\d+$/.test(right.trim()),
  };
}

/**
 * ラベル付き表示用入力フィールド (readOnly + inputMode="none")
 * 常時表示のラベル (①整数部・②分子・③分母 など) で、
 * 初見でも「何を入力する欄か」が分かるようにしている
 */
function LabeledAnswerField({
  id,
  orderBadge,
  label,
  value,
  placeholder,
  active,
  hasError,
  onFocus,
  onKeyDown,
  disabled,
  className = '',
}: {
  id: string;
  orderBadge: string;
  label: string;
  value: string;
  placeholder?: string;
  active?: boolean;
  hasError?: boolean;
  onFocus?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`labeled-field ${active ? 'field-active' : ''}`}>
      <label className={`field-label ${active ? 'label-active' : ''}`} htmlFor={id}>
        <span className="order-badge" aria-hidden="true">
          {orderBadge}
        </span>
        {label}
      </label>
      <input
        type="text"
        id={id}
        className={`answer-display ${active ? 'active' : ''} ${hasError ? 'input-error' : ''} ${className}`}
        value={value}
        placeholder={placeholder}
        readOnly
        inputMode="none"
        autoComplete="off"
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-invalid={hasError || undefined}
      />
    </div>
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
  const inputType: AnswerInputType = getProblemInputType(problem);
  const isDecimal = inputType === 'decimal';
  const choiceOptions = getProblemChoiceOptions(problem);

  // === State ===
  const [textValue, setTextValue] = useState('');
  const [fracNum, setFracNum] = useState('');
  const [fracDen, setFracDen] = useState('');
  const [fracActive, setFracActive] = useState<'numerator' | 'denominator'>('numerator');
  const [mixedWhole, setMixedWhole] = useState('');
  const [mixedNum, setMixedNum] = useState('');
  const [mixedDen, setMixedDen] = useState('');
  const [mixedActive, setMixedActive] = useState<'whole' | 'numerator' | 'denominator'>('whole');
  const [ratioLeft, setRatioLeft] = useState('');
  const [ratioRight, setRatioRight] = useState('');
  const [ratioActive, setRatioActive] = useState<'left' | 'right'>('left');
  const [error, setError] = useState<string | null>(null);
  // フィールド単位のエラー表示用 (どの欄を直すべきか枠線で示す)
  const [fracFieldError, setFracFieldError] = useState({ numerator: false, denominator: false });
  const [mixedFieldError, setMixedFieldError] = useState({
    whole: false,
    numerator: false,
    denominator: false,
  });
  const [ratioFieldError, setRatioFieldError] = useState({ left: false, right: false });
  // 複数分数 (通分) 入力用の state
  const [fracList, setFracList] = useState([
    { numerator: '', denominator: '' },
    { numerator: '', denominator: '' },
  ]);
  const [flActive, setFlActive] = useState<{
    item: number;
    field: 'numerator' | 'denominator';
  }>({ item: 0, field: 'numerator' });
  const [flFieldError, setFlFieldError] = useState(
    fracList.map(() => ({ numerator: false, denominator: false })),
  );

  const clearError = useCallback(() => {
    setError(null);
    setFracFieldError({ numerator: false, denominator: false });
    setMixedFieldError({ whole: false, numerator: false, denominator: false });
    setRatioFieldError({ left: false, right: false });
    setFlFieldError((previous) =>
      previous.map(() => ({ numerator: false, denominator: false })),
    );
  }, []);

  // === params取得 ===
  const getParams = useCallback(() => {
    switch (inputType) {
      case 'fraction':
        return { fraction: { numerator: fracNum, denominator: fracDen } };
      case 'fraction-list':
        return { fractionList: fracList };
      case 'mixed':
        return { mixed: { whole: mixedWhole, numerator: mixedNum, denominator: mixedDen } };
      case 'ratio':
        return { ratio: { left: ratioLeft, right: ratioRight } };
      case 'integer':
      case 'decimal':
      case 'string':
      case 'list':
      case 'expression':
      case 'choice':
      case 'yesno':
        return { text: textValue };
    }
  }, [
    inputType,
    textValue,
    fracNum,
    fracDen,
    fracList,
    mixedWhole,
    mixedNum,
    mixedDen,
    ratioLeft,
    ratioRight,
  ]);

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

  const handleChoiceSelect = useCallback(
    (choice: string) => {
      if (disabled) return;
      clearError();
      setTextValue(choice);
    },
    [clearError, disabled],
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


  // === 比入力ハンドラ ===
  const handleRatioNumberPress = useCallback(
    (digit: string) => {
      if (disabled) return;
      clearError();
      if (ratioActive === 'left') {
        if (ratioLeft.length < 10) setRatioLeft(ratioLeft + digit);
      } else if (ratioRight.length < 10) {
        setRatioRight(ratioRight + digit);
      }
    },
    [clearError, disabled, ratioActive, ratioLeft, ratioRight],
  );

  const handleRatioDelete = useCallback(() => {
    if (disabled) return;
    clearError();
    if (ratioActive === 'left') setRatioLeft(ratioLeft.slice(0, -1));
    else setRatioRight(ratioRight.slice(0, -1));
  }, [clearError, disabled, ratioActive, ratioLeft, ratioRight]);

  const handleRatioClear = useCallback(() => {
    if (disabled) return;
    clearError();
    setRatioLeft('');
    setRatioRight('');
    setRatioActive('left');
  }, [clearError, disabled]);

  const handleRatioPadPress = useCallback(
    (btn: KeypadButton) => {
      if (btn.value === 'delete') handleRatioDelete();
      else if (btn.value === 'clear') handleRatioClear();
      else handleRatioNumberPress(btn.value);
    },
    [handleRatioClear, handleRatioDelete, handleRatioNumberPress],
  );




  // === 決定ボタンハンドラ ===
  const handleSubmit = useCallback(() => {
    if (disabled) return;
    const params = getParams();
    const errMsg = validateAnswerInput(inputType, params);
    if (errMsg) {
      setError(errMsg);
      // どの入力欄が不足・不正かを枠線でも示す (判定ロジックは変更していない)
      if (inputType === 'fraction') {
        setFracFieldError(computeFieldErrors(undefined, fracNum, fracDen));
      } else if (inputType === 'mixed') {
        setMixedFieldError(computeFieldErrors(mixedWhole, mixedNum, mixedDen));
      } else if (inputType === 'fraction-list') {
        setFlFieldError(computeFlFieldErrors(fracList));
      } else if (inputType === 'ratio') {
        setRatioFieldError(computeRatioFieldErrors(ratioLeft, ratioRight));
      }
      return;
    }
    setError(null);
    onSubmit(getNormalizedAnswer(inputType, params));
  }, [
    disabled,
    inputType,
    getParams,
    onSubmit,
    fracNum,
    fracDen,
    fracList,
    mixedWhole,
    mixedNum,
    mixedDen,
    ratioLeft,
    ratioRight,
  ]);


  const handleRatioKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleRatioNumberPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleRatioDelete();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handleRatioClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setRatioActive(ratioActive === 'left' ? 'right' : 'left');
      }
    },
    [disabled, ratioActive, handleRatioNumberPress, handleRatioDelete, handleRatioClear, handleSubmit],
  );


  // === PCキーボードハンドラ ===
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (inputType === 'ratio') {
        handleRatioKeyDown(e);
        return;
      }
      if (inputType === 'expression' || inputType === 'list' || inputType === 'string') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSubmit();
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          handleTextKey(e.key);
        }
        return;
      }

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
      handleRatioKeyDown, handleTextKey,
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
      } else if (inputType === 'integer' || inputType === 'decimal') {
        handleNumberPress(btn.value);
      } else {
        handleTextKey(btn.value);
      }
    },
    [handleDelete, handleClear, handleDecimalPress, handleNumberPress, handleTextKey, inputType],
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

  // === 複数分数 (通分) 入力ハンドラ ===
  const updateFracListField = useCallback(
    (updater: (f: { numerator: string; denominator: string }) => { numerator: string; denominator: string }) => {
      setFracList((prev) =>
        prev.map((f, i) => (i === flActive.item ? updater(f) : f)),
      );
    },
    [flActive.item],
  );

  const handleFlNumberPress = useCallback(
    (digit: string) => {
      if (disabled) return;
      clearError();
      updateFracListField((f) =>
        f[flActive.field].length >= 5 ? f : { ...f, [flActive.field]: f[flActive.field] + digit },
      );
    },
    [disabled, flActive.field, clearError, updateFracListField],
  );

  const handleFlDelete = useCallback(() => {
    if (disabled) return;
    clearError();
    updateFracListField((f) => ({ ...f, [flActive.field]: f[flActive.field].slice(0, -1) }));
  }, [disabled, flActive.field, clearError, updateFracListField]);

  const handleFlClear = useCallback(() => {
    if (disabled) return;
    clearError();
    updateFracListField((f) => ({ ...f, [flActive.field]: '' }));
  }, [disabled, flActive.field, clearError, updateFracListField]);

  const handleFlPadPress = useCallback(
    (btn: KeypadButton) => {
      if (btn.value === 'delete') {
        handleFlDelete();
      } else if (btn.value === 'clear') {
        handleFlClear();
      } else {
        handleFlNumberPress(btn.value);
      }
    },
    [handleFlDelete, handleFlClear, handleFlNumberPress],
  );

  const handleFlKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleFlNumberPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleFlDelete();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handleFlClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const order: Array<{ item: number; field: 'numerator' | 'denominator' }> = [
          { item: 0, field: 'numerator' },
          { item: 0, field: 'denominator' },
          { item: 1, field: 'numerator' },
          { item: 1, field: 'denominator' },
        ];
        const idx = order.findIndex(
          (o) => o.item === flActive.item && o.field === flActive.field,
        );
        const next = e.shiftKey
          ? order[(idx + order.length - 1) % order.length]
          : order[(idx + 1) % order.length];
        setFlActive(next);
      }
    },
    [disabled, flActive, handleFlNumberPress, handleFlDelete, handleFlClear, handleSubmit],
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
            <div className="fraction-display" role="group" aria-label="分数の入力">
              <LabeledAnswerField
                id="fraction-numerator"
                orderBadge="①"
                label="分子"
                value={fracNum}
                placeholder="分子"
                active={fracActive === 'numerator'}
                hasError={fracFieldError.numerator}
                onFocus={() => setFracActive('numerator')}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="frac-num"
              />
              <div className="frac-bar" aria-hidden="true"></div>
              <LabeledAnswerField
                id="fraction-denominator"
                orderBadge="②"
                label="分母"
                value={fracDen}
                placeholder="分母"
                active={fracActive === 'denominator'}
                hasError={fracFieldError.denominator}
                onFocus={() => setFracActive('denominator')}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="frac-den"
              />
            </div>
            <p className="input-example">例：3/4</p>
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
            <div className="mixed-display" role="group" aria-label="帯分数の入力">
              <LabeledAnswerField
                id="mixed-whole"
                orderBadge="①"
                label="整数部"
                value={mixedWhole}
                placeholder="0"
                active={mixedActive === 'whole'}
                hasError={mixedFieldError.whole}
                onFocus={() => setMixedActive('whole')}
                onKeyDown={handleMixedKeyDown}
                disabled={disabled}
                className="mixed-whole"
              />
              <span className="mixed-text">と</span>
              <div className="frac-part">
                <LabeledAnswerField
                  id="mixed-numerator"
                  orderBadge="②"
                  label="分子"
                  value={mixedNum}
                  placeholder="分子"
                  active={mixedActive === 'numerator'}
                  hasError={mixedFieldError.numerator}
                  onFocus={() => setMixedActive('numerator')}
                  onKeyDown={handleMixedKeyDown}
                  disabled={disabled}
                  className="frac-num"
                />
                <div className="frac-bar" aria-hidden="true"></div>
                <LabeledAnswerField
                  id="mixed-denominator"
                  orderBadge="③"
                  label="分母"
                  value={mixedDen}
                  placeholder="分母"
                  active={mixedActive === 'denominator'}
                  hasError={mixedFieldError.denominator}
                  onFocus={() => setMixedActive('denominator')}
                  onKeyDown={handleMixedKeyDown}
                  disabled={disabled}
                  className="frac-den"
                />
              </div>
            </div>
            <p className="input-example">例：2と3/4</p>
            <KeypadGrid
              buttons={getNumberPadButtons(false)}
              onPress={handleMixedPadPress}
              disabled={disabled}
            />
          </>
        )}

        {/* === fraction-list: 複数分数 (通分) 入力 (分数ごとに分子・分母) === */}
        {inputType === 'fraction-list' && (
          <>
            <div className="fraction-list" role="group" aria-label="分数の通分の入力">
              <div className="fraction-list-item">
                <LabeledAnswerField
                  id="fraction-list-0-numerator"
                  orderBadge="①"
                  label="分子"
                  value={fracList[0]?.numerator ?? ''}
                  placeholder="分子"
                  active={flActive.item === 0 && flActive.field === 'numerator'}
                  hasError={flFieldError[0]?.numerator}
                  onFocus={() => setFlActive({ item: 0, field: 'numerator' })}
                  onKeyDown={handleFlKeyDown}
                  disabled={disabled}
                  className="frac-num"
                />
                <div className="frac-bar" aria-hidden="true"></div>
                <LabeledAnswerField
                  id="fraction-list-0-denominator"
                  orderBadge="②"
                  label="分母"
                  value={fracList[0]?.denominator ?? ''}
                  placeholder="分母"
                  active={flActive.item === 0 && flActive.field === 'denominator'}
                  hasError={flFieldError[0]?.denominator}
                  onFocus={() => setFlActive({ item: 0, field: 'denominator' })}
                  onKeyDown={handleFlKeyDown}
                  disabled={disabled}
                  className="frac-den"
                />
              </div>
              <span className="fraction-list-connector" aria-hidden="true">
                と
              </span>
              <div className="fraction-list-item">
                <LabeledAnswerField
                  id="fraction-list-1-numerator"
                  orderBadge="③"
                  label="分子"
                  value={fracList[1]?.numerator ?? ''}
                  placeholder="分子"
                  active={flActive.item === 1 && flActive.field === 'numerator'}
                  hasError={flFieldError[1]?.numerator}
                  onFocus={() => setFlActive({ item: 1, field: 'numerator' })}
                  onKeyDown={handleFlKeyDown}
                  disabled={disabled}
                  className="frac-num"
                />
                <div className="frac-bar" aria-hidden="true"></div>
                <LabeledAnswerField
                  id="fraction-list-1-denominator"
                  orderBadge="④"
                  label="分母"
                  value={fracList[1]?.denominator ?? ''}
                  placeholder="分母"
                  active={flActive.item === 1 && flActive.field === 'denominator'}
                  hasError={flFieldError[1]?.denominator}
                  onFocus={() => setFlActive({ item: 1, field: 'denominator' })}
                  onKeyDown={handleFlKeyDown}
                  disabled={disabled}
                  className="frac-den"
                />
              </div>
            </div>
            <p className="input-example">例：15/20 と 8/20</p>
            <KeypadGrid
              buttons={getNumberPadButtons(false)}
              onPress={handleFlPadPress}
              disabled={disabled}
            />
          </>
        )}

        {/* === ratio: 比入力 (左 : 右) === */}
        {inputType === 'ratio' && (
          <>
            <div className="ratio-display" role="group" aria-label="比の入力">
              <LabeledAnswerField
                id="ratio-left"
                orderBadge="①"
                label="左"
                value={ratioLeft}
                placeholder="左"
                active={ratioActive === 'left'}
                hasError={ratioFieldError.left}
                onFocus={() => setRatioActive('left')}
                onKeyDown={handleRatioKeyDown}
                disabled={disabled}
                className="ratio-field"
              />
              <span className="ratio-colon" aria-hidden="true">:</span>
              <LabeledAnswerField
                id="ratio-right"
                orderBadge="②"
                label="右"
                value={ratioRight}
                placeholder="右"
                active={ratioActive === 'right'}
                hasError={ratioFieldError.right}
                onFocus={() => setRatioActive('right')}
                onKeyDown={handleRatioKeyDown}
                disabled={disabled}
                className="ratio-field"
              />
            </div>
            <KeypadGrid
              buttons={getNumberPadButtons(false)}
              onPress={handleRatioPadPress}
              disabled={disabled}
            />
          </>
        )}

        {/* === expression / list / string: テキスト入力 === */}
        {(inputType === 'expression' || inputType === 'list' || inputType === 'string') && (
          <>
            <AnswerField
              value={textValue}
              placeholder={inputType === 'list' ? '1, 2, 3' : '答えを入力'}
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

        {/* === choice: 選択肢 === */}
        {inputType === 'choice' && choiceOptions.length > 0 && (
          <div className="choice-buttons" role="group" aria-label="選択肢">
            {choiceOptions.map((choice) => (
              <button
                key={choice}
                type="button"
                className={`choice-btn ${textValue === choice ? 'selected' : ''}`}
                aria-pressed={textValue === choice}
                onClick={() => handleChoiceSelect(choice)}
                disabled={disabled}
              >
                {choice}
              </button>
            ))}
          </div>
        )}

        {inputType === 'choice' && choiceOptions.length === 0 && (
          <>
            <AnswerField
              value={textValue}
              placeholder="答えを入力"
              active={true}
              onKeyDown={handleStringKeyDown}
              disabled={disabled}
              className="string-display"
            />
            <KeypadGrid buttons={getTextKeypadButtons()} onPress={handlePadPress} disabled={disabled} />
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

        {/* === string / expression / list text input is rendered above === */}
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

