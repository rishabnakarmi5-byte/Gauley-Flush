import type { Action, State } from '../engine/types';

export type PublicState = Omit<State, 'recentIds'> & { status: 'idle' | 'boot' | 'betting' | 'claimed' };

export interface Snapshot {
  t: 'state';
  state: PublicState;
  /** seat ids with at least one live socket */
  connected: string[];
  /** seats this socket may act for */
  you: string[];
  serverNow: number;
}

export type ServerMsg =
  | Snapshot
  | { t: 'ack'; actionId: string; ok: true; duplicate?: boolean }
  | { t: 'ack'; actionId: string; ok: false; error: string; code: string }
  | { t: 'seat'; seat: string; token: string; name: string }
  | { t: 'closed'; reason: string };

export type ClientMsg =
  | { t: 'hello'; tokens: { seat: string; token: string }[] }
  | { t: 'act'; actionId: string; action: Action }
  | { t: 'addLocal'; actionId: string; name: string };

export interface JoinResponse {
  code: string;
  seat: string;
  token: string;
  recovered?: boolean;
}
export interface ConfigResponse {
  googleClientId: string;
}

export const CODE_RE = /^[A-HJ-NP-Z]{4}$/;
export const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
