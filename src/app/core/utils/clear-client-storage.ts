/** Limpia sessionStorage, localStorage y cookies del origen actual. */
export function clearAllBrowserStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore private mode / blocked storage */
  }
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  clearAllCookies();
}

function clearAllCookies(): void {
  if (typeof document === 'undefined') {
    return;
  }
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  const domainVariants = new Set<string>(['', hostname]);
  if (parts.length >= 2) {
    domainVariants.add(`.${parts.slice(-2).join('.')}`);
  }

  const raw = document.cookie;
  if (!raw) {
    return;
  }

  for (const entry of raw.split(';')) {
    const name = entry.split('=')[0]?.trim();
    if (!name) {
      continue;
    }
    for (const domain of domainVariants) {
      const domainAttr = domain ? `;domain=${domain}` : '';
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/${domainAttr}`;
    }
  }
}
