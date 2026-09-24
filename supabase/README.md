# Supabase + LINE Messaging API の日次通知セットアップ

## 概要

- 既存PWAはIndexedDBへ回答履歴を保存する。
- 回答確定後だけ、公開anon keyで `record_daily_answer` RPCを呼び出す。
- Supabase Postgresへ回答イベントを保存する。`submission_id`で再送を冪等化する。
- Supabase Cronは毎日 `00:00 UTC`（`08:00 Asia/Tokyo`）にEdge Functionを起動する。
- Edge Functionが前日のイベント数を数え、LINE公式Messaging APIへpushする。

## 1. Supabase側

1. 新規Supabaseプロジェクトを作成または既存プロジェクトを使用。
2. `supabase/migrations/20260924090000_daily_study_report.sql` をSQL Editorで実行する。
   - CLIを使う場合は`npx supabase db push`。
3. Database > Extensionsで `pg_cron` と `pg_net` を有効化する。
4. LINE DevelopersでMessaging APIチャンネルを有効化し、Official Accountを準備する。
5. 通知先ユーザーがOfficial Accountを友だち追加し、送信先User ID（`U...`）を取得する。
6. プロジェクトのEdge Functionでsecretを設定する（実際の値はGitへ入力しない）。

   ```text
   LINE_CHANNEL_ACCESS_TOKEN=<LINE Messaging APIのchannel access token>
   LINE_USER_ID=<送信先のU...>
   DAILY_REPORT_CRON_SECRET=<32 bytes以上のランダム値>
   ```

   `SUPABASE_SERVICE_ROLE_KEY` はSupabaseがEdge Functionへ自動設定する。プロジェクトで上書きしない。

## 2. pg_cron の登録

Supabase SQL Editorで、**自分のプロジェクトURLとランダム値だけをローカルで置き換えて**実行する。GitHubへコミットしない。

```sql
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'daily_report_function_base_url'
);

select vault.create_secret(
  'REPLACE_WITH_THE_SAME_RANDOM_SECRET_AS_THE_EDGE_FUNCTION',
  'daily_report_cron_secret'
);

select cron.schedule(
  'daily-study-report',
  '0 0 * * *', -- 00:00 UTC = 08:00 Asia/Tokyo
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'daily_report_function_base_url'
    ) || '/functions/v1/daily-study-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-daily-report-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'daily_report_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
```

同じ名前のjobをもう一度登録すると上書きされる。Functionは秘密headerを検証するため、ブラウザーの公開anon keyだけでは呼び出せない。

## 3. 既存PWAへの公開設定

ローカルでは、Gitignore済みの `.env.local` を作る。Vercelでは、Project Settings > Environment Variablesに**公開値だけ**登録する。

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

`VITE_`値はブラウザーのバンドルに含まれる。Supabase の anon/publishable keyのみを渡し、`SUPABASE_SERVICE_ROLE_KEY`、LINE channel access token、cron secretは渡さない。

## 4. デプロイと確認

```bash
npm run build
npx supabase functions deploy daily-study-report
```

1. ブラウザーで1問答える。
2. Supabase SQL Editorで確認する。

   ```sql
   select submission_id, answered_at
   from public.daily_answer_events
   order by created_at desc
   limit 10;
   ```

3. 翌朝8時JSTの翌日、Edge Function LogsとLINEで通知を確認する。
4. `cron.job_run_details` でJobの実行履歴を確認する。

## 注意事項

- 通知対象はEdge Functionが起動する時刻の**前日のAsia/Tokyo日付**。9月24日8時なら9月23日分。
- 回答送信直後にブラウザーが閉じた場合は、IndexedDBのoutboxに残り、次回起動・オンライン復帰時に再送する。
- 個人利用向けのPWAであり、認証をしていないため、匿名でRPCを直接呼ぶ人による集計の改ざんは防止しない。公開利用にする場合はユーザー認証を別途追加する。
