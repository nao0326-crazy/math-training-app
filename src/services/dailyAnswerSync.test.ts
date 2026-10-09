import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  getPendingDailyAnswerSyncTasks: vi.fn(),
  prepareLegacyDailyAnswerSyncTasks: vi.fn(),
  removeDailyAnswerSyncTask: vi.fn(),
}));

vi.mock('../storage/db', () => dbMocks);

async function importSyncService() {
  vi.resetModules();
  return import('./dailyAnswerSync');
}

describe('daily answer sync mode gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');
    dbMocks.prepareLegacyDailyAnswerSyncTasks.mockResolvedValue(true);
    dbMocks.getPendingDailyAnswerSyncTasks.mockResolvedValue([]);
    dbMocks.removeDailyAnswerSyncTask.mockResolvedValue(undefined);
  });

  it('does not start DB or network work when the gate is closed', async () => {
    const { runDailyAnswerSync } = await importSyncService();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await runDailyAnswerSync(() => false);

    expect(dbMocks.prepareLegacyDailyAnswerSyncTasks).not.toHaveBeenCalled();
    expect(dbMocks.getPendingDailyAnswerSyncTasks).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not process pending tasks if the gate closes during legacy preparation', async () => {
    const { runDailyAnswerSync } = await importSyncService();
    let canContinue = true;
    dbMocks.prepareLegacyDailyAnswerSyncTasks.mockImplementationOnce(async (gate) => {
      canContinue = false;
      return gate();
    });

    await runDailyAnswerSync(() => canContinue);

    expect(dbMocks.getPendingDailyAnswerSyncTasks).not.toHaveBeenCalled();
  });

  it('removes an acknowledged task and stops before sending another after gate closure', async () => {
    const { runDailyAnswerSync } = await importSyncService();
    let canContinue = true;
    let resolveResponse!: (response: { ok: boolean }) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    dbMocks.getPendingDailyAnswerSyncTasks.mockResolvedValue([
      { submissionId: 'first', answeredAt: '2026-10-09T00:00:00.000Z' },
      { submissionId: 'second', answeredAt: '2026-10-09T00:01:00.000Z' },
    ]);

    const sync = runDailyAnswerSync(() => canContinue);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    canContinue = false;
    resolveResponse({ ok: true });
    await sync;

    expect(dbMocks.removeDailyAnswerSyncTask).toHaveBeenCalledOnce();
    expect(dbMocks.removeDailyAnswerSyncTask).toHaveBeenCalledWith('first');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
