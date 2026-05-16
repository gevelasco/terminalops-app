/**
 * Descarga local de demostración (sin API de storage). En producción sustituir
 * por URL firmada o streaming del binario real.
 */
export function downloadMockFleetDocument(doc: Document, displayName: string): void {
  const raw = displayName.trim() || 'documento';
  const safe = raw.replace(/[\\/:*?"<>|]+/g, '_');
  const blob = new Blob(
    [
      'Archivo de demostración (TerminalOps).\n' +
        'En producción aquí se descargaría el documento desde almacenamiento seguro.\n\n' +
        `Nombre registrado: ${raw}\n`,
    ],
    { type: 'text/plain;charset=utf-8' },
  );
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = /\.[a-z0-9]{2,5}$/i.test(safe) ? safe : `${safe}.txt`;
  a.style.display = 'none';
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
  URL.revokeObjectURL(url);
}
