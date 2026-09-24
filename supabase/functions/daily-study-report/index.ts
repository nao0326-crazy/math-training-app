import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  formatDailyStudyMessage,
  getPreviousDateKeyInTokyo,
} from '../_shared/dailyReport.ts';

const REPORT_SECRET_HEADER = 'x-daily-report-secret';

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sendLinePushMessage(
  accessToken: string,
  userId: string,
  text: string,
): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LINE Messaging API failed (${response.status}): ${body.slice(0, 300)}`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const expectedSecret = Deno.env.get('DAILY_REPORT_CRON_SECRET');
  const suppliedSecret = request.headers.get(REPORT_SECRET_HEADER);
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const lineAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
  const lineUserId = Deno.env.get('LINE_USER_ID');
  if (!supabaseUrl || !serviceRoleKey || !lineAccessToken || !lineUserId) {
    return jsonResponse({ error: 'server_configuration_missing' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const reportDate = getPreviousDateKeyInTokyo(new Date());
  const start = new Date(`${reportDate}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  try {
    // 同じ日にFunctionが二重起動しても、1日1回だけ送信する。
    const { data: existing, error: existingError } = await supabase
      .from('daily_report_deliveries')
      .select('report_date, sent_at')
      .eq('report_date', reportDate)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return jsonResponse({
        status: existing.sent_at ? 'already_sent' : 'already_claimed',
        reportDate,
      });
    }

    const { error: claimError } = await supabase
      .from('daily_report_deliveries')
      .insert({ report_date: reportDate });
    if (claimError) {
      if (claimError.code === '23505') {
        return jsonResponse({ status: 'already_claimed', reportDate });
      }
      throw claimError;
    }

    try {
      const { count, error: countError } = await supabase
        .from('daily_answer_events')
        .select('*', { count: 'exact', head: true })
        .gte('answered_at', start.toISOString())
        .lt('answered_at', end.toISOString());
      if (countError) throw countError;

      const answerCount = count ?? 0;
      await sendLinePushMessage(
        lineAccessToken,
        lineUserId,
        formatDailyStudyMessage(answerCount),
      );

      const { error: updateError } = await supabase
        .from('daily_report_deliveries')
        .update({ sent_at: new Date().toISOString() })
        .eq('report_date', reportDate);
      if (updateError) throw updateError;

      return jsonResponse({ status: 'sent', reportDate, count: answerCount });
    } catch (error) {
      // 送信失敗時はclaimを解放し、同じ日の手動再実行で再送できるようにする。
      await supabase
        .from('daily_report_deliveries')
        .delete()
        .eq('report_date', reportDate);
      throw error;
    }
  } catch (error) {
    // 秘密情報をレスポンスやログへ出さない。
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error('daily study report failed:', message);
    return jsonResponse({ error: 'daily_report_failed' }, 500);
  }
});
