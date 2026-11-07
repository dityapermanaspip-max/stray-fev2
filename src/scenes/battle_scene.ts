import Phaser from 'phaser';
import type { Room } from '@colyseus/sdk';
import type {
  ActRequest, AutoRequest, SetTargetRequest, BattleEventView, BattleLine, BattleGearView, BattleMoveView, BattleResultView, BattleView,
} from '../../../stray-bev1/shared/battle.ts';
import { drawBoard, fitBoard } from '../battle/board.ts';
import { cheer, counter, dodge, fall, floatNumber, jolt, layout, lunge, makeToken, moveTo, pose, setWord, type Token } from '../battle/fighters.ts';
import { loadActors } from '../field/actor.ts';
import { loadCreatures } from '../battle/creature_art.ts';
import { BattleOverlay } from '../battle/overlay.ts';
import { SceneKeys } from '../keys.ts';
import { joinBattle, type Seat } from '../net/game_net.ts';

// The private battle on a flat 7 x 11 board (battle/board.ts). The server runs the gauges and every roll; this scene
// shows fighters and their poses, damage and heal numbers, body words only when a tier changes, and sentences, and
// sends "use this move on that target".

type BattleData = { name: string; seat: Seat };

const BACK_MS = 2500; // after a lost connection with no result, back to the field

export class BattleScene extends Phaser.Scene {
  private name = '';
  private room?: Room;
  private view?: BattleView;
  private tokens = new Map<string, Token>();
  private overlay?: BattleOverlay;
  private lastMove: string | null = null;
  private wantGear = false; // the menu asked for the gear list
  private lock: string | null = null; // the remembered foe target (the server keeps the real one)
  private queued: string | null = null;
  private ready = false;
  private finished = false;

  constructor() {
    super(SceneKeys.Battle);
  }

  init(): void {
    this.room = undefined;
    this.view = undefined;
    this.tokens = new Map();
    this.overlay = undefined;
    this.lastMove = null;
    this.lock = null;
    this.queued = null;
    this.ready = false;
    this.finished = false;
  }

  create(data: BattleData): void {
    this.name = data.name;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.cameras.main.setBackgroundColor('#1a1d16');
    this.scale.on(Phaser.Scale.Events.RESIZE, this.relayout, this);
    window.addEventListener('keydown', this.onKey);
    void this.connect(data.seat);
  }

  private async connect(seat: Seat): Promise<void> {
    try {
      const [{ room, view }] = await Promise.all([joinBattle(seat), loadActors(this)]);
      if (!this.scene.isActive()) return void room.leave();
      this.room = room;
      this.view = view;
      await loadActors(this, view.fighters.flatMap((f) => (f.figure ? [f.figure.sheet] : []))); // vices and the boss
      await drawBoard(this, view.ground);
      await loadCreatures(this, view.fighters);
      for (const f of view.fighters) this.addToken(f);
      this.relayout();
      this.overlay = new BattleOverlay(view.moves, view.slots, { pick: (m) => this.pick(m), done: () => this.toField(), auto: (on) => this.setAuto(on), flee: () => this.room?.send('flee'), menu: () => { this.wantGear = true; this.room?.send('gear_view'); }, wear: (ref) => this.room?.send('gear', { wear: ref }), remove: (slot) => this.room?.send('gear', { remove: slot }) });
      this.overlay.setParty(view.fighters);
      this.updateReach();
      this.ready = view.ready;
      this.mark();
      room.onMessage('events', (events: BattleEventView[]) => events.forEach((e) => this.onEvent(e)));
      room.onMessage('gear_view', (v: BattleGearView) => { if (this.wantGear) this.overlay?.gear.show(v); this.wantGear = false; }); // the reply after a swap leaves the panel closed
      room.onMessage('line', (line: BattleLine) => line.text && this.overlay?.say(line.text, null));
      room.onMessage('result', (r: BattleResultView) => this.onResult(r));
      room.onLeave(() => {
        if (this.room === room && !this.finished && this.scene.isActive()) this.time.delayedCall(BACK_MS, () => this.toField());
      });
    } catch (err) {
      console.warn(`battle join failed: ${(err as Error).message}`);
      this.time.delayedCall(BACK_MS, () => this.toField());
    }
  }

  private addToken(f: BattleView['fighters'][number]): void {
    const t = makeToken(this, f, this.view!.formation);
    t.hit.on(Phaser.Input.Events.POINTER_DOWN, () => this.target(t));
    this.tokens.set(f.id, t);
  }

  // Front-row moves are greyed while you stand behind a living front row of your own side (same rule as the server).
  private updateReach(): void {
    const me = this.view && this.tokens.get(this.view.you)?.fighter;
    const all = [...this.tokens.values()].map((t) => t.fighter);
    this.overlay?.reach(!!me && me.row === 'back' && all.some((f) => f.side === me.side && f.row === 'front' && !f.downed));
  }

  private relayout(): void {
    fitBoard(this);
    if (this.view) layout([...this.tokens.values()], this.view.formation);
  }

  // A move from the menu goes at once on the remembered target; the server keeps it, picks a random one when it
  // dies, and refuses with a line if the move cannot reach it. Click a foe to change the target.
  private pick(move: BattleMoveView): void {
    if (this.finished || !this.view) return;
    this.lastMove = move.move;
    this.act(move.move);
  }

  // Enter or Space repeats the last move.
  private onKey = (e: KeyboardEvent) => {
    if ((e.code !== 'Enter' && e.code !== 'Space') || !this.lastMove || this.finished || !this.ready) return;
    e.preventDefault();
    this.act(this.lastMove);
  };

  private target(t: Token): void {
    if (this.finished || t.fighter.downed || t.fighter.side !== 'enemy') return;
    this.showLock(t.fighter.id);
    this.room?.send('set_target', { target: t.fighter.id } satisfies SetTargetRequest);
  }

  private showLock(id: string): void {
    this.lock = id;
    for (const t of this.tokens.values()) {
      if (t.fighter.side !== 'enemy') continue;
      t.ring.setVisible(t.fighter.id === id && !t.fighter.downed).setStrokeStyle(4, 0xf5d06f, 0.9);
    }
  }

  // The dice: the server fights for the party leader by the AI's rule while it is on.
  private setAuto(on: boolean): void {
    this.room?.send('auto', { on } satisfies AutoRequest);
  }

  private act(move: string): void {
    const msg: ActRequest = { move };
    this.room?.send('act', msg);
    this.queued = move; // the server answers with a line if it refuses; the 'use' event clears it
    this.ready = false;
    this.mark();
  }

  private mark(): void {
    this.overlay?.mark({ ready: this.ready, choosing: null, queued: this.queued });
    const me = this.view && this.tokens.get(this.view.you);
    if (me) me.ring.setVisible(this.ready).setStrokeStyle(3, 0xf5d06f, 1);
  }

  private onEvent(e: BattleEventView): void {
    const at = (id: string) => this.tokens.get(id);
    const nameOf = (id: string) => at(id)?.fighter.name ?? null;
    switch (e.type) {
      case 'use': {
        const actor = at(e.actor);
        if (actor) lunge(this, actor);
        if (e.actor === this.view?.you) this.queued = null;
        this.mark();
        break;
      }
      case 'damage': { const t = at(e.target); if (t) floatNumber(this, t, e.amount, e.outcome); break; }
      case 'heal': { const t = at(e.target); if (t) floatNumber(this, t, e.amount, 'heal'); break; }
      case 'miss': { const t = at(e.target); if (t) dodge(this, t); break; }
      case 'interrupt': { const t = at(e.entity); if (t) { jolt(this, t, 8); pose(t, 'stagger'); } break; }
      case 'counter': { const t = at(e.entity); if (t) counter(this, t); break; }
      case 'line': this.overlay?.say(e.text, nameOf(e.entity)); break;
      case 'tier': { const t = at(e.entity); if (t) setWord(this, t, e.resource, e.word); this.overlay?.refreshParty(); break; }
      case 'downed': {
        const t = at(e.entity);
        if (t) {
          fall(t);
          this.updateReach();
          this.overlay?.refreshParty();
        }
        break;
      }
      case 'moved': {
        const t = at(e.entity);
        if (t && this.view) moveTo(this, t, e.slot, e.row, this.view.formation);
        this.updateReach();
        break;
      }
      case 'learned': this.overlay?.say(`✦ ${e.name}`, null); break;
      case 'ready': this.ready = true; this.mark(); break;
      case 'lock': if (e.entity === this.view?.you && at(e.target)?.fighter.side === 'enemy') this.showLock(e.target); break;
      case 'order': this.overlay?.order(e.ids.flatMap((id) => at(id)?.fighter ?? []).filter((f) => !f.downed)); break;
      case 'end': this.finished = true; this.overlay?.lock(); break;
    }
  }

  private onResult(r: BattleResultView): void {
    this.finished = true;
    this.ready = false;
    this.mark();
    this.cameras.main.flash(250, r.won || r.fled ? 255 : 120, r.won || r.fled ? 240 : 40, r.won || r.fled ? 200 : 40);
    if (r.won) cheer([...this.tokens.values()]);
    this.overlay?.result(r);
  }

  // Back to the field: the server already saved where the player stands (or wakes).
  private toField(): void {
    if (!this.scene.isActive()) return;
    this.scene.start(SceneKeys.Field, { name: this.name });
  }

  private onShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.relayout, this);
    window.removeEventListener('keydown', this.onKey);
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.overlay?.destroy();
    this.overlay = undefined;
    const room = this.room;
    this.room = undefined;
    void room?.leave();
  }
}
