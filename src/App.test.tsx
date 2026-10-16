import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

function render(maintenanceMode: boolean): string {
  return renderToStaticMarkup(createElement(App, { maintenanceMode }));
}

describe('App mode boundary', () => {
  it('renders only the maintenance page when maintenance mode is enabled', () => {
    const markup = render(true);

    expect(markup).toContain('現在、このアプリは一時的に公開を停止しています。');
    expect(markup).not.toContain('app-header');
    expect(markup).not.toContain('学習履歴');
    expect(markup).not.toContain('管理者モード');
  });

  it('starts in normal mode and shows the package version when maintenance is disabled', () => {
    const markup = render(false);

    expect(markup).toContain('app-header');
    expect(markup).toContain(`v${__APP_VERSION__}`);
    expect(markup).toContain('どの分野を勉強しますか？');
    expect(markup).not.toContain('admin-category');
  });
});
