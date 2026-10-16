import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getPending, prepareLegacy, removeTask } = vi.hoisted(() => ({
  getPending: vi.fn(),
  prepareLegacy: vi.fn(),
  removeTask: vi.fn(),
}));

vi.mock('../storage/db', () => ({
  getPendingDailyAnswerSyncTasks: getPending,
  prepareLegacyDailyAnswerSyncTasks: prepareLegacy,
  removeDailyAnswerSyncTask: removeTask,
}));

import { runDailyAnswerSync } from './dailyAnswerSync';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('runDailyAnswerSync mode gating', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');
    getPending.mockReset();
    prepareLegacy.mockReset().mockResolvedValue(undefined);
    removeTask.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('does not start queue preparation while admin mode is active', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await runDailyAnswerSync(() => false);

    expect(prepareLegacy).not.toHaveBeenCalled();
    expect(getPending).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('checks the live mode again after delayed legacy preparation', async () => {
    const preparation = deferred<void>();
    prepareLegacy.mockReturnValueOnce(preparation.promise);
    getPending.mockResolvedValue([]);
    let adminMode = false;
    const sync = runDailyAnswerSync(() => !adminMode);
    await vi.waitFor(() => expect(prepareLegacy).toHaveBeenCalledOnce());

    adminMode = true;
    preparation.resolve();
    await sync;

    expect(getPending).not.toHaveBeenCalled();

    adminMode = false;
    await runDailyAnswerSync(() => !adminMode);
    expect(prepareLegacy).toHaveBeenCalledTimes(2);
    expect(getPending).toHaveBeenCalledOnce();
  });

  it('acknowledges an in-flight successful task and stops before the next task', async () => {
    const firstResponse = deferred<Response>();
    const fetch = vi.fn().mockReturnValue(firstResponse.promise);
    vi.stubGlobal('fetch', fetch);
    getPending.mockResolvedValue([
      { submissionId: 'normal-1', answeredAt: '2026-10-09T00:00:00.000Z' },
      { submissionId: 'normal-2', answeredAt: '2026-10-09T00:01:00.000Z' },
    ]);
    let adminMode = false;
    const sync = runDailyAnswerSync(() => !adminMode);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    adminMode = true;
    firstResponse.resolve(new Response(null, { status: 204 }));
    await sync;

    expect(removeTask).toHaveBeenCalledOnce();
    expect(removeTask).toHaveBeenCalledWith('normal-1');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
