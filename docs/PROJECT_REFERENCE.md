# プロジェクト総合仕様書 (PROJECT_REFERENCE)

> 本仕様書は、`c:\Users\monty\Desktop\問題` の作業ツリーを調査して作成した。
> 作成日: 2026-10-28。調査のみで、アプリ機能・バージョン・Git・Vercel・データは変更していない。

## 1. プロジェクト概要

- アプリ名: 小6数学トレーニング（パッケージ名 `grade6-math-generator`）
- 目的: 小学6年生向け算数問題の生成・出題・採点・学習履歴管理。問題は事前に用意せず、プログラムが毎回ランダム生成する。
- 対象: 小6範囲（数と計算、量・測定、図形、比・比例、文字と式、場合の数、データの活用）。
- リポジトリ: https://github.com/nao0326-crazy/math-training-app.git
- ローカルパス: `c:\Users\monty\Desktop\問題`（Git HEAD ブランチ `main`）
- UI: React 18 + Vite 6、ルーティングはライブラリなし（`src/App.tsx` の `page` state で手切り替え）。
- 状態管理: React Hooks のみ。CSS: `src/index.css` 1ファイル。

### 画面構成（`src/App.tsx` の `Page` 型）

| ページ | 役割 |
|---|---|
| home | ホーム。分野ボタン・学習開始・管理者タブへの導線 |
| quiz | 問題出題・採点・結果表示 |
| history | 学習履歴・カレンダー・統計・苦手復習 |
| growth | 成長記録（ヒートマップ・問題タイプ別正答率・期間比較） |
| mistakePractice | 前日/当日の誤答復習 |
| verification / practiceSetup / adminVerification | 管理者出題範囲の設定（クライアント簡易ゲート） |
| speedGate | 朝の100問ハイスピード計算ゲート |

### メンテナンスモード

- 実装: `src/utils/maintenanceMode.ts` の `isMaintenanceMode()` と `src/App.tsx` のトップレベル分岐 `maintenanceMode ? <MaintenancePage /> : <NormalApp />`。
- 環境変数: `VITE_MAINTENANCE_MODE`（`true` で公開停止）。
- 保護対象: `src/App.tsx`, `src/components/MaintenancePage.tsx`, `src/utils/maintenanceMode.ts`, `src/utils/maintenanceMode.test.ts`（AGENTS.md）。

## 2. 現在のバージョンとバージョン管理

### 2.1 バージョンの実態（調査結果）

| 対象 | 値 | 確認方法 |
|---|---|---|
| `package.json` の `version` | `2.2.0` | ファイル読み取り |
| `vite.config.ts` の `__APP_VERSION__` | `JSON.stringify(packageJson.version)` = `"2.2.0"` | ファイル読み取り |
| 画面表示のバージョン | `v{__APP_VERSION__}`（`src/App.tsx` ヘッダー） | コード読み取り |
| Git HEAD コミットメッセージ | `feat: ... (v2.2.0)` | `git log -1` |
| Git タグ | なし（`git tag -l` 空） | コマンド実行 |
| 本番画面表示（監査レポート時点） | `2.1.2` | `scripts/_compare_shots/report.json`（v2.1.2 監査のみ） |

### 2.2 バージョン食い違いの原因

1. ローカルソースコード: `2.2.0`（`package.json` / `__APP_VERSION__`）。
2. ローカルで実行するアプリ: ビルド時に `package.json` から注入されるため `2.2.0` と表示される（未ビルド dev でも Vite が同値を注入）。
3. GitHub の `main`: HEAD は `8a76941...` でコミットメッセージに v2.2.0。コード上のバージョンも `2.2.0`。
4. Vercel 本番デプロイ: 本リポジトリの `main` から自動ビルド。直近のデプロイ成果物（`vercel-deploy.json` / `vercel-inspect-latest.json`）の `createdAt` は 2026-10-18 で、v2.2.0 コミット（2026-10-28）より前。監査レポートでは本番画面が `2.1.2` を表示していた。
5. ブラウザ表示: PWA Service Worker のキャッシュにより古いアセットが表示される可能性がある（`registerType: autoUpdate`）。

**結論**: コード上のバージョン (`2.2.0`) と本番表示 (`2.1.2`) の食い違いは、本番がまだ v2.2.0 コミットを反映するデプロイを完了していない（またはキャッシュが古い）ためと推定される。Vercel のデプロイ済みコミット SHA は、今回の調査では確認できなかった（未確認）。

> 注意: この食い違いの解消（push/deploy）は今回の調査では実施していない。

### 2.3 バージョン管理の仕組み

- 単一ソース: `package.json` の `version`。
- `vite.config.ts` が `packageJson.version` を `__APP_VERSION__` として `define` に注入。
- 画面: `src/App.tsx` ヘッダーで `v{__APP_VERSION__}` 表示。
- PWA/SW: `vite-plugin-pwa` が Service Worker を生成。キャッシュ名は workbox 既定 + `html-cache`。バージョンをキャッシュキーに明示的に含める設定はない（未確認: SW 更新は `autoUpdate` に依存）。

## 3. ローカル・GitHub・Vercel の状態

### 3.1 ローカル

- ブランチ: `main`。
- HEAD SHA: `8a76941fe3275a28e12ea6589ccd77e51bbd6fcd`。
- `origin/main` と一致（`git status` で ahead/behind なし）。
- 作業ツリー: 未追跡ファイルのみ（`_all_types.txtempix.js`, `scripts/_compare.mjs`, `scripts/_compare_shots/`）。 tracked ファイルの変更なし。
- `package.json` version: `2.2.0`。

### 3.2 GitHub

- リモート: `origin` = https://github.com/nao0326-crazy/math-training-app.git
- `main` の HEAD（fetch 済み）: `8a76941...`（ローカルと一致）。
- タグ: なし。

### 3.3 Vercel

- プロジェクト名: `math-training-app`。
- 本番エイリアス: `math-training-app-three.vercel.app`（その他 `math-training-app-montyan9327issy-4885s-projects.vercel.app`, `math-training-app-git-main-...`）。
- ビルド設定（`vercel-deploy.json`）: framework `vite`, buildCommand `npm run build`, outputDirectory `dist`, nodeVersion `24.x`, rewrites `/(.*) -> /index.html`。
- デプロイ ID: `dpl_32XPCPHV5DwPa7Sk52y7KrQ56ToY`（readyState `READY`）。
- デプロイ作成時刻: 2026-10-18 01:24 JST（成果物上の値。v2.2.0 コミットより前）。
- Vercel が参照するブランチ: `main`（エイリアス `git-main` から推定）。
- デプロイ済みコミット SHA: 今回の調査では確認できなかった（未確認）。
- 本番表示バージョン: 監査レポート（v2.1.2 監査）では `2.1.2`。

> 注意: `vercel-deploy.json` / `vercel-inspect-latest.json` は 2026-10-18 時点の成果物であり、現在の最新デプロイを表しているかは未確認。

## 4. 画面と機能の仕様

- ホーム: 分野選択、学習開始、管理者タブへの導線、朝の100問ゲート。
- 練習（quiz）: 問題生成・回答・採点・途中式表示・結果。
- 履歴（history）: 月カレンダー、日別学習量、単元別/分野別成績、苦手復習。
- 成長（growth）: `src/pages/GrowthPage.tsx`。7/30/90日切替、問題タイプ別正答率、期間比較、カテゴリ→練習設定遷移。
- 管理者: `verification`/`practiceSetup`/`adminVerification`。クライアント簡易ゲート（`src/utils/adminMode.ts`、サーバー認証ではない）。
- 朝ゲート: `speedGate` 100問完了まで通常学習をブロック（`src/utils/speedGateTime.ts`）。
- 誤答復習: `mistakePractice`（前日/当日）。

### データフロー

- 通常問題の回答は `quizPersistence` 経由で IndexedDB `answers` に保存。
- 管理者モードの回答は通常履歴に保存されない（`src/services/quizPersistence.ts`）。
- 学習状態: `daily-learning-state-v1`（settings ストア）。

## 5. 問題・難易度・採点の仕様

- 問題生成: `src/engine/selector/generatorRegistry.ts` に登録されたジェネレータから選択。
- 問題タイプ: 96+（COVERAGE.md は古い 7 タイプ表記。実装は拡張済み）。
- 難易度: 1〜5。管理者設定の難易度範囲でフィルタ。
- 採点: 回答と正解の比較（`src/utils/answer.ts` 等）。
- 途中式: `SolutionDisplay` コンポーネント。
- 適応難易度: `src/utils/adaptiveDifficulty.ts`（履歴から自動決定）。

> COVERAGE.md は古い（7タイプのみ）ため、実装との乖離あり。

## 6. 学習履歴・データ保存の仕様

### IndexedDB

- DB 名: `grade6-math-app`（`src/storage/db.ts`）。
- スキーマバージョン: `DB_VERSION = 4`。
- ストア: `answers`, `questions`, `settings`, `dailySync`, `scratchNotes`, `speedGateSessions`。
- インデックス: answers に `by-date`, `by-category`, `by-type`。questions に `by-date`。
- 移行: `upgrade(db, oldVersion)` で v1→v2→v3→v4 を段階追加（既存データ保持）。

### 主要レコード

- `AnswerRecord`: problemId, problemType, category, difficulty, isCorrect, answerTimeSec, answeredAt, submissionId 等。
- `QuestionHistory`: 出題履歴。
- 設定: `StudySettings`, `AdminPracticeSettings`, `DailyLearningStateRecord`。
- 手書きノート: `ScratchNote`（attemptId キー）。
- 朝ゲート: `SpeedGateSession`（dateKey キー）。

### 成長統計

- `src/utils/growthStats.ts`: `deduplicateAnswers`, `buildDailyGrowth`, `aggregateByProblemType`, `computePeriodComparison`, `computeGrowthData`。
- 日付は日本時間（`getStudyDateKey`）。
- 重複防止: submissionId 優先、なければ problemId+answeredAt。

## 7. PWA・キャッシュ・更新の仕様

- `vite-plugin-pwa`（`vite.config.ts`）。
- registerType: `autoUpdate`、`injectRegister: auto`。
- workbox globPatterns: `**/*.{js,css,html,ico,png,svg,jpg,jpeg,webmanifest}`。
- runtimeCaching: document は NetworkFirst（cacheName `html-cache`, maxEntries 10, maxAge 30日）。
- manifest: name `小6数学トレーニング`, short_name `数学トレ`, display `standalone`。
- オフライン: 問題生成・採点・履歴閲覧が可能。
- 更新反映: SW autoUpdate に依存。古い画面が表示される可能性あり（キャッシュクリア/再読み込みで対処）。

## 8. テストと品質確認

- フレームワーク: Vitest 2.1.5（環境 `node`、`.test.ts`/`.test.tsx` 対象）。
- 型チェック: `pnpm run typecheck` = `tsc -b`。
- テスト: `pnpm test` = `vitest run`。
- ビルド: `pnpm run build` = `tsc -b && vite build`。
- Lint: `pnpm run lint` = `eslint .`。
- 一括: `pnpm run verify` = typecheck → test → build → lint → `git diff --check`。
- E2E: `node scripts/e2e-acceptance.mjs`（dev サーバー + Chrome 必須）。
- 監査スクリプト: `scripts/_compare.mjs`, `scripts/_compare_shots/`（未追跡）。

### テストで確認できるもの / できないもの

- 確認できる: ユニットテスト、型チェック、ビルド、Lint、メンテナンスモード分岐。
- 確認できない: 実ブラウザのレイアウト、PWA 更新、IndexedDB 移行の実機動作、E2E は別途実行が必要。

> テスト件数・成功状況は、今回の調査ではコマンドを実行していないため未記録（設定ファイルから確認できる内容のみ記載）。

## 9. 開発環境と主要コマンド

- Node: CI では 22（`.github/workflows/ci.yml`）。Vercel は 24.x。
- パッケージマネージャ: pnpm（`pnpm-lock.yaml` のみ。`package-lock.json` 不可）。
- CI: push/PR to `main` で typecheck/test/build。
- 主要コマンド:
  - `pnpm install --frozen-lockfile`
  - `pnpm dev`
  - `pnpm run typecheck`
  - `pnpm test`
  - `pnpm run build`
  - `pnpm run lint`
  - `pnpm run verify`

## 10. GitHubへの反映とVercel公開手順

1. ローカルで変更・テスト。
2. `pnpm run verify` 成功。
3. 明示ファイルのみ `git add` → `git commit`（バージョン変更は `package.json` のみ等）。
4. `git push origin main`。
5. GitHub CI 成功確認。
6. Vercel が `main` を自動ビルド（または手動デプロイ）。
7. 本番 URL でバージョン表示・主要フローをブラウザ確認。
8. PWA キャッシュが古い場合は Service Worker 更新・ハードリロード。

### 公開判定条件（AGENTS.md）

- ローカル `pnpm run verify` 成功
- GitHub CI 成功
- Vercel 本番ビルド成功
- 公開バージョン/アセット検証
- 実ブラウザでの主要フロー確認

## 11. 既知の問題と未確認事項

- `COVERAGE.md` は古い（7タイプ）。実装は 96+ タイプ。
- `アプリ内部構造・動作仕様書.md` は v1.0.0 時点の古い仕様（HEAD 399f584 前提）。現行 v2.2.0 と乖離。
- Vercel デプロイ済みコミット SHA: 未確認。
- 本番表示バージョンが `2.1.2`（v2.2.0 コードと不一致）: 本番未反映またはキャッシュの可能性。
- Git タグなし（バージョン管理は package.json のみ）。
- ブラウザ表示バージョンの最終確認: 未実施（ローカル監査未完了）。
- 監査レポート `scripts/_compare_shots/report.json` は v2.1.2 のみ。

## 12. 今後のAI作業で守るべき安全ルール

- アプリ機能変更・push・deploy・commit・バージョン変更・データ変更は、ユーザーの明示指示なしに行わない。
- `git reset --hard`, `git clean`, 強制 push 禁止。
- 秘密情報（APIキー等）を仕様書・コードに書かない。
- メンテナンスモードゲートを削除・バイパスしない。
- 未確認事項は「未確認」と記載し、推測で埋めない。
- 既存の未追跡ファイルを勝手に整理しない。

---

*以上*
