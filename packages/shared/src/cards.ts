// カード表現: rank 2..14 (11=J, 12=Q, 13=K, 14=A), suit s/h/d/c
export type Suit = 's' | 'h' | 'd' | 'c';

export interface Card {
  rank: number;
  suit: Suit;
}

export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
export const RANK_CHARS = '23456789TJQKA';

export function cardId(c: Card): string {
  return RANK_CHARS[c.rank - 2] + c.suit;
}

export function parseCard(id: string): Card {
  const rank = RANK_CHARS.indexOf(id[0]) + 2;
  const suit = id[1] as Suit;
  if (rank < 2 || !SUITS.includes(suit)) throw new Error(`invalid card: ${id}`);
  return { rank, suit };
}

export function parseCards(ids: string): Card[] {
  return ids.trim().split(/\s+/).map(parseCard);
}

export function rankLabel(rank: number): string {
  return RANK_CHARS[rank - 2];
}

export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  }
  return deck;
}

export function shuffle(deck: Card[], rng: () => number = Math.random): Card[] {
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}
