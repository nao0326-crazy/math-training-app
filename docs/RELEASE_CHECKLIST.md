# リリースチェックリスト (RELEASE_CHECKLIST)

本チェックリストは、機能変更の監査からバージョン更新・GitHub反映・Vercel公開・公開後確認までの手順を定義する。
作成日: 2026-10-28。調査・ドキュメント作成のみ。公開処理は実施しない。

## 0. 前提

- パッケージマネージャ: pnpm（`pnpm-lock.yaml` のみ）。
- ブランチ: `main`。
- リモート: https://github.com/nao0326-crazy/math-training-app.git
- 本番URL: https://math-training-app-three.vercel.app

## 1. 機能変更の監査

### 条件
- 変更対象のコード・テストを把握している。

### コマンド
- `pnpm run typecheck`
- `pnpm test`
- `pnpm run build`
- `pnpm run lint`
- `git diff --check`
- または `pnpm run verify`（上記を順次実行）

### 成功判定
- すべて成功（exit code 0）。

### 失敗時
- エラーを修正して再実行。部分的な成功を完了とみなさない。

## 2. ローカルブラウザ監査

### 条件
- `pnpm dev` で開発サーバー起動。

### 確認項目
- 空データ状態・データあり状態。
- 7/30/90日切替、問題タイプ集計、期間比較。
- カテゴリ→練習設定遷移。
- コンソールエラー・レイアウト崩れ。
- メンテナンスモード true/false の両方。

### 成功判定
- 上記すべて問題なし。

### 失敗時
- 修正後、再監査。

## 3. バージョン更新

### 条件
- 機能変更が完了し、監査合格。

### 手順
- `package.json` の `version` のみ更新（例: 2.2.0 → 2.2.1）。
- `vite.config.ts` は `packageJson.version` を参照するため変更不要。

### コマンド
- `git diff package.json`

### 成功判定
- バージョン番号が意図通り。

### 失敗時
- 修正して再確認。

## 4. コミット

### 条件
- `pnpm run verify` 成功。

### コマンド
- `git add <明示ファイル>`
- `git commit -m "..."`
- `git status`

### 成功判定
- コミット成功、作業ツリークリーン（未追跡除く）。

### 失敗時
- 原因を確認し、再試行。

## 5. GitHub反映

### 条件
- コミット完了。

### コマンド
- `git push origin main`
- `git rev-parse HEAD` と `git rev-parse origin/main` の一致確認

### 成功判定
- push成功、SHA一致。

### 失敗時
- 認証・ネットワークを確認。強制pushは禁止。

## 6. GitHub CI確認

### 条件
- push完了。

### 確認
- GitHub Actions の typecheck/test/build が成功。

### 成功判定
- すべて成功。

### 失敗時
- ログを確認し、修正後に再push。

## 7. Vercel公開

### 条件
- GitHub CI成功。

### 手順
- Vercelが `main` を自動ビルド（または手動デプロイ）。
- ビルドコマンド `npm run build`、出力 `dist`、Node 24.x。

### 成功判定
- Vercelデプロイ readyState `READY`。

### 失敗時
- Vercelログを確認し、修正。

## 8. 公開後確認

### 条件
- デプロイ完了。

### 確認項目
- 本番URLでバージョン表示が更新されている。
- 主要フロー（ホーム、練習、履歴、成長）が動作。
- PWAキャッシュが古い場合はService Worker更新・ハードリロード。
- コンソールエラーなし。

### 成功判定
- 上記すべて問題なし。

### 失敗時
- キャッシュクリア、再デプロイ、または調査。

## 9. メンテナンスモード確認

### 条件
- 公開前。

### 確認
- `VITE_MAINTENANCE_MODE=true` で `MaintenancePage` のみ表示。
- `VITE_MAINTENANCE_MODE=false` で通常アプリ表示。

### 成功判定
- 両方正常。

### 失敗時
- `src/App.tsx`, `src/utils/maintenanceMode.ts` を確認。

## 10. 失敗時の安全な復旧

- `git reset --hard`, `git clean`, 強制pushは禁止。
- 変更をrevertする場合は明示的なコミットで対応。
- IndexedDBのユーザーデータは変更・削除しない。
- 秘密情報は出力しない。

---

*以上*
