export const AFFILIATE_ROW_HEIGHT = 72;
export const AFFILIATE_ROW_GAP = 10.5984;

export function desktopAffiliateCapacity(height: number, navHeight: number) {
  // Leave room for the header and retain the user's 130px offset above navigation.
  const available = Math.max(0, height - navHeight - 130 - 80);
  return Math.max(0, Math.floor((available + AFFILIATE_ROW_GAP) / (AFFILIATE_ROW_HEIGHT + AFFILIATE_ROW_GAP))) * 8;
}

/** Keep the partial row at the top, with full rows of four below. */
export function affiliateRows<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  const first = items.length % 4 || 4;
  if (items.length) rows.push(items.slice(0, first));
  for (let index = first; index < items.length; index += 4) rows.push(items.slice(index, index + 4));
  return rows;
}

export function shuffleAffiliates<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
