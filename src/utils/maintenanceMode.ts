/**
 * Viteの公開環境変数からメンテナンス表示を判定する。
 * VITE_値はブラウザーに公开されるが、このフラグには秘密情報を含めない。
 */
export function isMaintenanceMode(
  value: string | boolean | undefined = import.meta.env.VITE_MAINTENANCE_MODE,
): boolean {
  if (typeof value === 'boolean') return value;
  return value?.trim().toLowerCase() === 'true';
}
