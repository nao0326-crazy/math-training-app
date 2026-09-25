/**
 * 回答済み問題のサーバー同期
 *
 * - 通知サービスの秘密情報・Supabase service-role key はここには置かない
 * - ブラウザーに置くのは VITE_SUPABASE_URL と公開 anon/publishable key のみ
 * - 同一 submissionId は Supabase 側で一度だけ受け入れる
 */

import {
  getPendingDailyAnswerSyncTasks,
  prepareLegacyDailyAnswerSyncTasks,
  removeDailyAnswerSyncTask,
} from '../storage/db';

interface PublicSupabaseConfig {
  url: string;
  anonKey: string;
}

const RECORD_ANSWER_RPC = '/rest/v1/rpc/record_daily_answer';
let syncPromise: Promise<void> | null = null;
let legacyPreparationFinished = false;

function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ''), anonKey };
}

async function postAnswerEvent(
  config: PublicSupabaseConfig,
  task: { submissionId: string; answeredAt: string },
): Promise<void> {
  const response = await fetch(`${config.url}${RECORD_ANSWER_RPC}`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      p_submission_id: task.submissionId,
      p_answered_at: task.answeredAt,
    }),
  });

  if (!response.ok) {
    throw new Error(`日次集計の同期に失敗しました (${response.status})`);
  }
}

/**
 * 回答1件の再送を試行する。
 * ネットワーク障害時は outbox を残し、次回起動・オンライン復帰・定期同期で再試行する。
 */
export function runDailyAnswerSync(): Promise<void> {
  if (syncPromise) return syncPromise;

  const config = getPublicSupabaseConfig();
  if (!config) return Promise.resolve();

  syncPromise = (async () => {
    try {
      if (!legacyPreparationFinished) {
        await prepareLegacyDailyAnswerSyncTasks();
        legacyPreparationFinished = true;
      }

      const tasks = await getPendingDailyAnswerSyncTasks();
      for (const task of tasks) {
        try {
          await postAnswerEvent(config, task);
          await removeDailyAnswerSyncTask(task.submissionId);
        } catch {
          // 先頭の未送信 task から再試行する。UIの学習操作は止めない。
          return;
        }
      }
    } catch {
      // IndexedDB やネットワークの一時障害は、次回同期で回復する。
    }
  })().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}

/** 新しい回答に付けるサーバー同期用の冪等ID */
export function createDailyAnswerSubmissionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `answer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
