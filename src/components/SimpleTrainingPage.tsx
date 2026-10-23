import { useEffect, useRef, useState } from 'react';
import { CalculationGenerator } from '../problems/calculation/generators';
import type { CalculationType } from '../types/problem';

interface QuestionState {
  type: CalculationType;
  a: number;
  b: number;
  answer: number;
  userAnswer: number | null;
  isCorrect: boolean | null;
  submitted: boolean;
}

interface SimpleTrainingResults {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  averageResponseTime: number;
  perOperationBreakdown: {
    type: CalculationType;
    count: number;
    correct: number;
    accuracy: number;
  }[];
  totalTimeMs: number;
  completedAt: string;
}

interface SimpleTrainingPageProps {
  types?: CalculationType[];
  difficulty?: number;
}

export default function SimpleTrainingPage({ types, difficulty }: SimpleTrainingPageProps) {
  const [questions, setQuestions] = useState<QuestionState[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<number | null>(null);
  const [answersSubmitted, setAnswersSubmitted] = useState(false);
  const [results, setResults] = useState<SimpleTrainingResults | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const initQuestions = () => {
      const calculationTypes = types || ['addition_1_1', 'addition_2_1', 'subtraction_1_1', 'multiplication_1_1', 'division_2_1'];
      const questionCount = 10;
      const generated: QuestionState[] = [];

      for (let i = 0; i < questionCount; i++) {
        const type = calculationTypes[i % calculationTypes.length];
        const gen = new CalculationGenerator(1, [type]);
        const problem = gen.generate({ difficulty, seed: i });
        generated.push({
          type,
          a: problem.parameters?.a || 0,
          b: 1,
          answer: problem.answer?.value || 0,
          userAnswer: null,
          isCorrect: null,
          submitted: false,
        });
      }
      setQuestions(generated);
      setCurrentQuestionIndex(0);
      startTimeRef.current = Date.now();
    };

    initQuestions();
  }, [types, difficulty]);

  const handleAnswer = (answered: number) => {
    const current = questions[currentQuestionIndex];
    if (!current?.submitted) {
      const isCorrect = answered === current.answer;
      const updated = questions.map((q, i) =>
        i === currentQuestionIndex ? { ...q, userAnswer: answered, isCorrect, submitted: true } : q
      );
      setQuestions(updated);

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setUserAnswer(null);
      } else {
        const totalTime = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
        const accuracy = questions.filter(q => q.isCorrect).length / questions.length;
        setResults({
          totalQuestions: questions.length,
          correctCount: questions.filter(q => q.isCorrect).length,
          incorrectCount: questions.filter(q => !q.isCorrect).length,
          accuracy: Number(accuracy.toFixed(2)),
          averageResponseTime: totalTime / questions.length,
          perOperationBreakdown: [],
          totalTimeMs: totalTime,
          completedAt: new Date().toISOString(),
        });
        setAnswersSubmitted(true);
      }
    }
  };

  if (answersSubmitted || results) {
    return null;
  }

  const current = questions[currentQuestionIndex];
  if (!current) {
    return null;
  }

  return (
    <div className="simple-training-page">
      <h2>単純計算トレーニング</h2>
      <p>問題 {currentQuestionIndex + 1} / {questions.length}</p>
      <p>{`${current.a} + ${current.b}`}</p>
      <input
        type="number"
        value={userAnswer ?? ''}
        onChange={(e) => { const v = e.target.value as string; setUserAnswer(Number(v) || null); }}
        max={current.answer}
      />
      <button onClick={() => handleAnswer(current.answer)}>回答</button>
    </div>
  );
}