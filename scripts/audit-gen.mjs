/**
 * audit-gen.mjs — 画像 (写真・イラスト) が必須の問題タイプを決定論的に生成する。
 *
 * アプリ本体と同じ generatorRegistry 経由で生成するため、
 * 生成 → 検証 → 解法付加 → 画面表示の経路をそのまま検証できる。
 * ランダム出題で「たまたま遭遇しなかった」を合格扱いにしないための直接生成。
 */
import {
  getAllGenerators,
  getGeneratorByType,
} from '../src/engine/selector/generatorRegistry.ts';

/** 画像が必須の問題タイプ (写真・イラストを使う教材) */
export const IMAGE_TYPES = Object.freeze([
  'realworld_shopping',
  'realworld_eggs',
]);

/** 検証対象の全バリアント (タイプ × 難易度) */
export const ALL_VARIANTS = Object.freeze(
  IMAGE_TYPES.flatMap((type) =>
    [2, 3, 4, 5].map((level) => `${type}:L${level}`),
  ),
);

/**
 * 指定タイプを指定難易度で生成する。
 * レジストリに登録された実ジェネレータを直接呼ぶため、
 * 検証 (validateProblem) まで含めた本体と同じ生成経路を通る。
 */
function generate(type, level) {
  const generator = getGeneratorByType(type);
  if (!generator) throw new Error(`generator not registered: ${type}`);
  // seed は number 型 (GenerationConfig.seed)。タイプと難易度から安定した値を導く。
  const seed =
    [...`${type}-L${level}`].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483647, 7);
  const problem = generator.generate({
    difficulty: level,
    seed,
  });
  return problem;
}

/** 全画像問題タイプの全バリアントを生成して返す */
export function buildImageCases() {
  const cases = [];
  for (const type of IMAGE_TYPES) {
    for (const level of [2, 3, 4, 5]) {
      cases.push({
        problemType: type,
        variant: `L${level}`,
        problem: generate(type, level),
      });
    }
  }
  return cases;
}

/**
 * 画像なし (通常) 問題が image を持たないことを確認するための標本。
 * レジストリ全ジェネレータから「画像を持つもの」を洗い出す監査にも使う。
 */
export function buildNormalSample() {
  return getAllGenerators()
    .filter((g) => !IMAGE_TYPES.includes(g.type))
    .slice(0, 40)
    .map((g) => ({ generator: g.type, problem: generate(g.type, 3) }));
}

/** レジストリ全体で image を実際に持つタイプを洗い出す (監査用) */
export function auditWhichGeneratorsEmitImages() {
  const withImage = [];
  const withoutImage = [];
  for (const g of getAllGenerators()) {
    let problem = null;
    try {
      problem = generate(g.type, 3);
    } catch {
      continue;
    }
    if (problem?.image?.src) withImage.push(g.type);
    else withoutImage.push(g.type);
  }
  return { withImage, withoutImage };
}

// ===== 直接実行時の監査レポート (vite-node scripts/audit-gen.mjs) =====
// e2e-image-problems.mjs からは export 経由で利用される。
// argv[1] がこのファイル自身を指すときだけ実行する (import では静かにする)。
const SELF = process.argv[1]?.replace(/\\/g, '/');
if (SELF && import.meta.url.includes('audit-gen')) {
  const audit = auditWhichGeneratorsEmitImages();
  console.log(`registered generators: ${audit.withImage.length + audit.withoutImage.length}`);
  console.log(`with image (${audit.withImage.length}): ${audit.withImage.join(', ')}`);

  const cases = buildImageCases();
  console.log(`\nimage cases: ${cases.length}`);
  for (const c of cases) {
    const p = c.problem;
    console.log(
      `  ${c.problemType}:${c.variant} src=${p.image?.src ?? 'NO-IMAGE'} `
      + `alt=${(p.image?.altText ?? '').slice(0, 28)}... `
      + `steps=${p.solutionSteps?.length ?? 0} q=${p.question.slice(0, 26)}...`,
    );
  }

  const broken = cases.filter((c) => !c.problem.image?.src);
  if (broken.length) {
    console.error(`\nFAIL: image missing on ${broken.length} cases`);
    process.exit(1);
  }
  console.log('\nOK: all image problem types carry an image spec');
}

