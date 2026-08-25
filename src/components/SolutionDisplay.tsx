/**
 * 解法表示コンポーネント (答え開示時のみ使用)
 *
 * 問題の計算方法を知らず、与えられた solutionSteps と answer を
 * 指定された順序で表示するだけの純粋な表示コンポーネント。
 *
 * 表示順序:
 *   ━━━━━━━━━━
 *   答え  ○○
 *   ━━━━━━━━━━
 *   途中式
 *   ① 〜〜
 *      ↓
 *   ② 〜〜
 *   ━━━━━━━━━━
 *   答え：○○
 *
 * 途中式がない問題では、壊れたUIにならないよう
 * 「答え」だけを安全に表示する。
 */

import type { Answer, SolutionStep } from '../types/problem';
import { formatAnswer } from '../utils/answer';

interface SolutionDisplayProps {
  solutionSteps?: SolutionStep[];
  answer: Answer;
}

/** ステップ番号 (①②③…31まで対応) */
function stepNumber(index: number): string {
  const circled = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛';
  return index < circled.length ? circled[index] : `${index + 1}.`;
}

export default function SolutionDisplay({ solutionSteps, answer }: SolutionDisplayProps) {
  const answerText = formatAnswer(answer);
  const steps = solutionSteps ?? [];

  return (
    <div className="solution-display">
      <div className="solution-answer-top">
        <span className="solution-label">答え</span>
        <span className="solution-answer-value">{answerText}</span>
      </div>

      {steps.length > 0 ? (
        <>
          <div className="solution-divider" aria-hidden="true"></div>
          <div className="solution-heading">途中式</div>
          <ol className="solution-steps">
            {steps.map((step, i) => (
              <li key={i} className="solution-step">
                {step.explanation && (
                  <p className="solution-explanation">{step.explanation}</p>
                )}
                {step.expression && (
                  <p className="solution-expression">
                    <span className="solution-num">{stepNumber(i)}</span>
                    {step.expression}
                  </p>
                )}
                {!step.expression && step.explanation && i < steps.length - 1 && (
                  <span className="solution-arrow" aria-hidden="true">↓</span>
                )}
              </li>
            ))}
          </ol>
          <div className="solution-divider" aria-hidden="true"></div>
          <div className="solution-final">
            答え：<strong>{answerText}</strong>
          </div>
        </>
      ) : (
        <p className="solution-none">この問題の途中式はありません。答えを確認してください。</p>
      )}
    </div>
  );
}
