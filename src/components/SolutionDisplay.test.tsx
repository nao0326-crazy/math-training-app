/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SolutionDisplay from './SolutionDisplay';
import type { Answer, SolutionStep } from '../types/problem';

describe('SolutionDisplay の番号付け', () => {
  it('説明だけのステップがあっても途中式の番号は①から始まる', () => {
    const steps: SolutionStep[] = [
      { explanation: 'それぞれの数について、約数が1と自分自身だけか調べます' },
      { expression: '60: 素数ではない' },
      { expression: '11: 素数' },
    ];
    const answer: Answer = { kind: 'string', value: '11' };
    render(<SolutionDisplay solutionSteps={steps} answer={answer} />);
    expect(screen.getByText('①')).toBeTruthy();
    expect(screen.getByText('②')).toBeTruthy();
  });
});
