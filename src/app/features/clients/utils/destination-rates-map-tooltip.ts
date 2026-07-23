const STATE_PIN_ICON = `
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="display:block;flex-shrink:0;color:#64748b;">
    <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
  </svg>
`;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Tooltip de estado: nombre + pin + cantidad de destinos (tarifas). */
export function formatDestinationRatesStateTooltipHtml(
  stateName: string,
  destinationCount: number,
): string {
  if (destinationCount <= 0) {
    return '';
  }
  const countLabel =
    destinationCount === 1 ? '1 destino' : `${destinationCount} destinos`;
  return `
    <div style="min-width:8.5rem;max-width:14rem;padding:0.15rem 0;">
      <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.35rem;">
        <span style="font-size:0.875rem;font-weight:700;color:#0f172a;line-height:1.25;">${escapeHtml(stateName)}</span>
        ${STATE_PIN_ICON}
      </div>
      <div style="font-size:0.8125rem;font-weight:600;color:#334155;font-variant-numeric:tabular-nums;">
        ${countLabel}
      </div>
    </div>
  `;
}
