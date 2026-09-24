-- 1回答 = 1行。同一回答の再送は primary key により一度だけ受け入れる。
create table public.daily_answer_events (
  submission_id text primary key,
  answered_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint daily_answer_events_submission_id_length
    check (char_length(submission_id) between 1 and 200)
);

create index daily_answer_events_answered_at_idx
  on public.daily_answer_events (answered_at);

-- ブラウザーが直接テーブルを読み書きできないようにする。
alter table public.daily_answer_events enable row level security;
revoke all on table public.daily_answer_events from anon, authenticated;

-- 公開anon keyから呼び出せるのは、この1関数の投入だけ。
-- answered_at は回答確定時にブラウザーが記録したISO 8601 timestamp。
create or replace function public.record_daily_answer(
  p_submission_id text,
  p_answered_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_submission_id is null
     or char_length(p_submission_id) not between 1 and 200
     or p_answered_at is null then
    raise exception 'invalid daily answer payload' using errcode = '22023';
  end if;

  insert into public.daily_answer_events (submission_id, answered_at)
  values (p_submission_id, p_answered_at)
  on conflict (submission_id) do nothing;
end;
$$;

revoke all on function public.record_daily_answer(text, timestamptz) from public;
grant execute on function public.record_daily_answer(text, timestamptz)
  to anon, authenticated;

-- 通知の二重送信を防ぐためのサーバー専用テーブル。
-- service_role 以外からは直接アクセスできない。
create table public.daily_report_deliveries (
  report_date date primary key,
  claimed_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz
);

alter table public.daily_report_deliveries enable row level security;
revoke all on table public.daily_report_deliveries from anon, authenticated;
