/**
 * Resuelve una variable CSS (p. ej. --mat-sys-primary) a "rgb(...)"/"rgba(...)".
 * Chart.js pinta en <canvas> y no entiende var(--...) ni light-dark(...):
 * se aplica la variable a un elemento de prueba y se lee el color ya calculado.
 */
export function resolveCssColor(host: HTMLElement, variable: string, alpha = 1): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${variable})`;
  probe.style.display = 'none';
  host.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  return alpha === 1 ? rgb : rgb.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
}