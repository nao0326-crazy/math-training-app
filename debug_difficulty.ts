import { generateProblem } from './src/engine/selector/generatorRegistry';
import { validateProblem } from './src/engine/validator/validator';

// 各難易度で問題を生成し、指定難易度と実際の難易度・問題内容を確認する
for (const level of [1, 2, 3, 4, 5] as const) {
  console.log(`=== Difficulty level ${level} ===`);
  for (let i = 0; i < 10; i++) {
    const p = generateProblem({ difficulty: level });
    const validation = validateProblem(p);
    console.log(
      `Requested: ${level} | ` +
      `Generator: ${p.type.padEnd(25)} | ` +
      `Generated: ${p.difficulty.level} | ` +
      `Validation: ${validation.valid ? 'PASS' : 'FAIL'} | ` +
      `calc=${p.difficulty.components.calculationComplexity} ` +
      `num=${p.difficulty.components.numberComplexity} ` +
      `reasoning=${p.difficulty.components.reasoningComplexity} ` +
      `reading=${p.difficulty.components.readingComplexity} | ` +
      p.question
    );
  }
}