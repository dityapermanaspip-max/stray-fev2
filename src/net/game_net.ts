import { Client, type Room } from '@colyseus/sdk';
import type { BattleView } from '../../../stray-bev1/shared/battle.ts';
import { FIELD_ROOM, type FieldView, type JoinOptions, type WhereAnswer } from '../../../stray-bev1/shared/field.ts';

// Talks to the game server (stray-bev1: npm run game). Dev join: a name, no password, local only.
// 127.0.0.1 rather than localhost: on Windows localhost may resolve to ::1, and the server binds IPv4.

const GAME_URL = import.meta.env.VITE_GAME_URL ?? 'http://127.0.0.1:2567';
const client = new Client(GAME_URL);

export async function whereIs(name: string): Promise<WhereAnswer> {
  const res = await fetch(`${GAME_URL}/dev/where?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`where failed (${res.status})`);
  return res.json() as Promise<WhereAnswer>;
}

export type FieldSession = { room: Room; view: FieldView };

export async function joinField(name: string, ref: string): Promise<FieldSession> {
  const options: JoinOptions = { name, ref };
  const room = await client.joinOrCreate(FIELD_ROOM, options);
  const view = (await room.request('view')) as FieldView;
  return { room, view };
}

export type BattleSession = { room: Room; view: BattleView };
export type Seat = Parameters<typeof client.consumeSeatReservation>[0];

// The field room reserved this seat in a private battle room when the creatures jumped out.
export async function joinBattle(seat: Seat): Promise<BattleSession> {
  const room = await client.consumeSeatReservation(seat);
  const view = (await room.request('view')) as BattleView;
  return { room, view };
}
