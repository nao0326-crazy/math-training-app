const ADMIN_PASSWORD = '0326';

export function isAdminPasswordValid(password: string): boolean {
  return password === ADMIN_PASSWORD;
}
