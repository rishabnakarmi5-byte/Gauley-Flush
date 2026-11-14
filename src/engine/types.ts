export type Status = 'idle' | 'boot' | 'betting' | 'claimed';
export type Phase = 'open' | 'settled';

export interface Settings {
  boot: number;
  chips: number[];
  maxBet: number;
}

export interface Player {
  id: string;
  name: string;
  net: number;
  left: boolean;
  classic: boolean;
  avatar?: string;
}

export interface LogEntry {
  n: number;
  type: 'boot' | 'bet' | 'pack';
  by: string;
  amount: number;
  /** table stake before this entry (used by undo) */
  prevStake: number;
}

export interface Hand {
  no: number;
  status: 'boot' | 'betting' | 'claimed';
  /** seat ids that booted (participants) in boot order */
  boots: string[];
  sitOut: string[];
  contrib: Record<string, number>;
  packed: string[];
  seen: string[];
  stake: number;
  log: LogEntry[];
  claimBy: string | null;
  startedAt: number;
}

export interface HandRecord {
  no: number;
  result: 'won' | 'void';
  how?: 'claim' | 'last';
  winner: string | null;
  pot: number;
  participants: { id: string; contrib: number; packed: boolean }[];
  at: number;
}

export interface FeedItem {
  id: number;
  t: number;
  type: string;
  by?: string;
  to?: string;
  amount?: number;
  text?: string;
}

export interface LastAward {
  hand: Hand;
  winner: string;
  pot: number;
  how: 'claim' | 'last';
}

export interface EndVote {
  by: string;
  agree: string[];
}

export interface State {
  version: number;
  code: string;
  hostId: string;
  phase: Phase;
  settings: Settings;
  players: Player[];
  nextSeat: number;
  hand: Hand | null;
  handNo: number;
  pot: number;
  history: HandRecord[];
  feed: FeedItem[];
  nextFeed: number;
  lastAward: LastAward | null;
  endVote: EndVote | null;
  paid: Record<string, boolean>;
  thanks: Record<string, 'yes' | 'no'>;
  /** server-only: recent actionIds for de-duplication (stripped from broadcasts) */
  recentIds: string[];
  createdAt: number;
}

export type Action =
  | { type: 'join'; by: string; id: string; name: string; avatar?: string }
  | { type: 'removePlayer'; by: string; target: string }
  | { type: 'transferHost'; by: string; target: string }
  | { type: 'settings'; by: string; boot?: number; chips?: number[]; maxBet?: number }
  | { type: 'setClassic'; by: string; seat: string; on: boolean }
  | { type: 'newHand'; by: string }
  | { type: 'boot'; by: string; seat: string }
  | { type: 'sitOut'; by: string; seat: string }
  | { type: 'bet'; by: string; seat: string; amount: number }
  | { type: 'seeCards'; by: string; seat: string }
  | { type: 'pack'; by: string; seat: string }
  | { type: 'packFor'; by: string; seat: string }
  | { type: 'undo'; by: string; seat: string }
  | { type: 'claim'; by: string; seat: string }
  | { type: 'withdrawClaim'; by: string; seat: string }
  | { type: 'confirmClaim'; by: string; seat: string }
  | { type: 'rejectClaim'; by: string; seat: string }
  | { type: 'voidHand'; by: string }
  | { type: 'undoAward'; by: string }
  | { type: 'proposeEnd'; by: string; seat: string }
  | { type: 'agreeEnd'; by: string; seat: string }
  | { type: 'cancelEnd'; by: string }
  | { type: 'forceEnd'; by: string }
  | { type: 'reopen'; by: string }
  | { type: 'markPaid'; by: string; seat: string; key: string; paid: boolean }
  | { type: 'thanks'; by: string; seat: string; choice: 'yes' | 'no' }
  | { type: 'sync'; by: 'system' };

export type ActionEnvelope = Action & { actionId?: string };

export interface Ctx {
  now: number;
  /** seat ids with a live connection; undefined = everyone counts as connected */
  connected?: string[];
}

export type Result =
  | { ok: true; state: State; duplicate?: boolean; error?: undefined; code?: undefined }
  | { ok: false; error: string; code: string; state?: undefined; duplicate?: undefined };

export interface Transfer {
  from: string;
  to: string;
  amount: number;
  key: string;
}
