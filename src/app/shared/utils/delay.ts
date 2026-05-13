/** Deterministic mock latency for repositories */
export function mockDelayMs(ms = 280): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
