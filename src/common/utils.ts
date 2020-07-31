export function timestampFromBlockTime(blockTime: number | string): string {
  return new Date(Number(blockTime) * 1000).toISOString();
}

export function dateFromBlockTime(blockTime: number | string): string {
  return new Date(Number(blockTime) * 1000).toISOString().slice(0, 10);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
