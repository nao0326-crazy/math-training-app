import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import VerificationCodePage from './VerificationCodePage';

describe('admin password screen', () => {
  it('uses a text input so the leading zero is retained', () => {
    const html = renderToStaticMarkup(
      <VerificationCodePage onVerified={vi.fn()} onBack={vi.fn()} />,
    );
    expect(html).toContain('type="text"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).not.toContain('type="number"');
  });
});
