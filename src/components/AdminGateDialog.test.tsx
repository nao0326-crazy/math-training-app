import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AdminGateDialog from './AdminGateDialog';

describe('AdminGateDialog', () => {
  it('renders a password input so leading zeroes remain part of the input string', () => {
    const markup = renderToStaticMarkup(
      createElement(AdminGateDialog, {
        onResolved: () => {},
        onClose: () => {},
      }),
    );

    expect(markup).toContain('type="password"');
    expect(markup).toContain('placeholder="パスワード"');
  });
});
