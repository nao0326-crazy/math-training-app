import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from '../App';
import MaintenancePage from '../components/MaintenancePage';
import { isMaintenanceMode } from './maintenanceMode';

describe('isMaintenanceMode', () => {
  it('文字列のtrueだけメンテナンスモードを有効にする', () => {
    expect(isMaintenanceMode('true')).toBe(true);
    expect(isMaintenanceMode(' TRUE ')).toBe(true);
    expect(isMaintenanceMode('false')).toBe(false);
    expect(isMaintenanceMode(undefined)).toBe(false);
  });
});

describe('App maintenance mode', () => {
  it('falseでは通常の学習アプリを表示する', () => {
    const markup = renderToStaticMarkup(createElement(App, { maintenanceMode: false }));

    expect(markup).toContain('学習履歴');
    expect(markup).toContain('学習をはじめる');
    expect(markup).not.toContain('一時的に公開を停止しています');
  });

  it('trueではMaintenancePageだけを表示する', () => {
    const markup = renderToStaticMarkup(createElement(App, { maintenanceMode: true }));

    expect(markup).toContain('現在、このアプリは一時的に公開を停止しています。');
    expect(markup).toContain('しばらくお待ちください。');
    expect(markup).not.toContain('学習履歴');
    expect(markup).not.toContain('学習をはじめる');
    expect(markup).not.toContain('問題を準備しています');
  });

  it('メンテナンス画面自体を単独で静的表示できる', () => {
    const markup = renderToStaticMarkup(createElement(MaintenancePage));

    expect(markup).toContain('小6数学トレーニング');
    expect(markup).toContain('現在、このアプリは一時的に公開を停止しています。');
  });
});
