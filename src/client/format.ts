import type { FeedItem, Player } from '../engine/types';

export const fmt = (n: number) => `Rs ${Math.round(n).toLocaleString('en-IN')}`;
export const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : fmt(0));
export const initials = (name: string) => [...name.trim()][0]?.toUpperCase() ?? '?';

export function feedText(f: FeedItem, name: (id?: string) => string): string {
  const who = name(f.by);
  switch (f.type) {
    case 'join': return `${who} pulled up a chair`;
    case 'leave': return `${who} left the table`;
    case 'host': return `${who} is now the host`;
    case 'settings': return 'Host tweaked the rules';
    case 'newHand': return `New hand. Boot is ${fmt(f.amount ?? 0)}`;
    case 'boot': return `${who} booted ${fmt(f.amount ?? 0)}`;
    case 'sitOut': return `${who} is sitting this one out`;
    case 'bet': return `${who} chaal ${fmt(f.amount ?? 0)}`;
    case 'see': return `${who} peeked at their cards`;
    case 'pack': return `${who} packed`;
    case 'undo': return `${who} took back ${f.text === 'pack' ? 'their pack' : fmt(f.amount ?? 0)}`;
    case 'claim': return `${who} says "I won!"`;
    case 'withdraw': return `${who} withdrew the claim`;
    case 'reject': return `${who} rejected ${name(f.to)}'s claim`;
    case 'win': return `${who} takes ${fmt(f.amount ?? 0)}${f.text === 'last' ? ' (everyone else packed)' : ''}`;
    case 'void': return 'Hand voided. Everyone refunded';
    case 'undoAward': return 'Last award undone';
    case 'proposeEnd': return `${who} wants to end the game`;
    case 'cancelEnd': return 'End-game vote cancelled';
    case 'settled': return 'Table settled. Time to pay up';
    case 'reopen': return 'Table reopened. One more round?';
    default: return f.type;
  }
}

export const nameOf = (players: Player[]) => (id?: string) => players.find((p) => p.id === id)?.name ?? '?';
