import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

describe('app entry flow', () => {
  it('starts at the shared home quiz entry and keeps maintenance mode as the top-level gate', () => {
    const html = renderToStaticMarkup(<App maintenanceMode={false} />);
    expect(html).toContain('問題を解く');
    expect(html).toContain('管理者タブ');
    expect(html).not.toContain('管理者パスワードを入力してください。');
    expect(html).not.toContain('ぶんやをえらぶ');

    const maintenanceHtml = renderToStaticMarkup(<App maintenanceMode />);
    expect(maintenanceHtml).toContain('maintenance-page');
    expect(maintenanceHtml).not.toContain('問題を解く');
  });
});
