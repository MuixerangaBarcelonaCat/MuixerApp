import { buildPasswordResetEmail } from './password-reset.template';

describe('buildPasswordResetEmail', () => {
  it('includes the reset URL in both the html and text bodies', () => {
    const resetUrl = 'https://domini.cat/reset-password?token=abc123';

    const { subject, html, text } = buildPasswordResetEmail(resetUrl);

    expect(subject).toMatch(/contrasenya/i);
    expect(html).toContain(resetUrl);
    expect(text).toContain(resetUrl);
  });
});
