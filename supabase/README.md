# Supabase回答同期セットアップ

## 概要

- 既存PWAは回答確定時にIndexedDBの`answers`と`dailySync`へ保存する。
- `dailySync`の回答イベントは、公開anon/publishable keyでSupabase RPCへ送信する。
- Supabaseの`public.daily_answer_events`へ回答イベントを保存し、`submission_id`で再送を冪等化する。
- この回答同期にブラウザーの常駐処理や外部通知サービスは使用しない。

## 1. Supabase側

1. Supabaseプロジェクトを作成または既存プロジェクトを選択する。
2. 次のmigrationをSQL Editorで実行する。

   ```text
   supabase/migrations/20260924090000_daily_study_report.sql
   ```

   CLIを使う場合は`npx supabase db push`も利用できる。
3. 実行後、次のオブジェクトが存在することを確認する。

   - `public.daily_answer_events`
   - `public.record_daily_answer(text, timestamptz)`

確認SQL:

```sql
select to_regclass('public.daily_answer_events');

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'record_daily_answer';
```

## 2. PWA / Vercelの公開設定

ローカルではGitignore対象の`.env.local`に公開値を設定する。VercelではProduction、必要ならPreviewに同じ値を登録する。

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

`VITE_`値はブラウザーのバンドルに公開される。`SUPABASE_SERVICE_ROLE_KEY`その他の秘密情報は、PWAやVercelのブラウザ向け環境変数へ設定しない。

## 3. 動作確認

1. ブラウザで1問回答する。
2. ネットワークで`/rest/v1/rpc/record_daily_answer`を確認する。
3. Supabase SQL Editorで確認する。

```sql
select
  submission_id,
  answered_at,
  created_at
from public.daily_answer_events
order by created_at desc
limit 10;
```

回答確定直後にネットワークが利用できない場合は、IndexedDBの`dailySync`にタスクが残り、次回起動・オンライン復帰・定期同期時に再送される。

## 注意事項

- migrationの`daily_answer_events`と`record_daily_answer()`は回答同期に必須のため削除しない。
- 同じ`submission_id`の再送は`on conflict (submission_id) do nothing`により1行だけ登録される。
- 回答同期は認証していない公開個人利用向けの設計です。複数ユーザー向けに公開する場合は、別途認証・ユーザー分離を追加する。
