import { generateProblem } from './src/engine/selector/generatorRegistry';

// Test generating with difficulty level 1, 2, 4, 5
for (const level of [1, 2, 4, 5] as const) {
  console.log(`=== Difficulty level ${level} ===`);
  for (let i = 0; i < 20; i++) {
    const p = generateProblem({ difficulty: level });
    console.log(
      `${p.type.padEnd(25)} | requested=${level} | actual=${p.difficulty.level} | calc=${p.difficulty.components.calculationComplexity} num=${p.difficulty.components.numberComplexity} reasoning=${p.difficulty.components.reasoningComplexity} reading=${p.difficulty.components.readingComplexity} | ${p.question}`
    );
  }
}