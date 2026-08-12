export function buildPasswordResetEmail(resetUrl: string): { subject: string; html: string; text: string } {
  const subject = 'Recuperació de contrasenya';
  const text = `S'ha sol·licitat un canvi de contrasenya per al compte.\n\nEstabliu una contrasenya nova en este enllaç (caduca d'ací a una hora):\n${resetUrl}\n\nSi no heu sol·licitat eixe canvi, podeu ignorar este correu.`;
  const html = `
    <p>S'ha sol·licitat un canvi de contrasenya per al compte.</p>
    <p><a href="${resetUrl}">Establiu una contrasenya nova</a> (l'enllaç caduca d'ací a una hora).</p>
    <p>Si no heu sol·licitat eixe canvi, podeu ignorar este correu.</p>
  `.trim();

  return { subject, html, text };
}
