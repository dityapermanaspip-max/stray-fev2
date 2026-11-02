import Phaser from 'phaser';
import type { Room } from '@colyseus/sdk';
import type {
  ActRequest, BattleEventView, BattleLine, BattleMoveView, BattleResultView, BattleView,
} from '../../../stray-bev1/shared/battle.ts';
import { drawBoard, fitBoard } from '../battle/board.ts';
import { cheer, counter, dodge, fall, floatNumber, jolt, layout, lunge, makeToken, moveTo, pose, setWord, type Token } from '../battle/fighters.ts';
import { loadActors } from '../field/actor.ts';
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
  private choosing: BattleMoveView | null = null;
  private aim: string | null = null; // the target the keyboard points at while choosing
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
    this.choosing = null;
    this.aim = null;
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
      drawBoard(this);
      for (const f of view.fighters) this.addToken(f);
      this.relayout();
      this.overlay = new BattleOverlay(view.moves, view.slots, { pick: (m) => this.pick(m), done: () => this.toField() });
      this.updateReach();
      this.ready = view.ready;
      this.mark();
      room.onMessage('events', (events: BattleEventView[]) => events.forEach((e) => this.onEvent(e)));
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

  // A move from the menu: moves with one target wait for a click on a fighter; the rest go at once.
  private pick(move: BattleMoveView): void {
    if (this.finished || !this.view) return;
    if (this.choosing?.move === move.move) return void this.setChoosing(null);
    const you = this.view.you;
    const firstFoe = [...this.tokens.values()].find((t) => t.fighter.side === 'enemy' && !t.fighter.downed)?.fighter.id;
    switch (move.target) {
      case 'self': case 'all_allies': return this.act(move.move, you);
      case 'all_enemies': return firstFoe ? this.act(move.move, firstFoe) : undefined;
      default: return this.setChoosing(move);
    }
  }

  private setChoosing(move: BattleMoveView | null): void {
    this.choosing = move;
    const allies = move?.target === 'one_ally';
    // A front-row move reaches the foes' back row only once their front row is down (the server checks it too).
    const frontUp = [...this.tokens.values()].some((t) => t.fighter.side === 'enemy' && t.fighter.row === 'front' && !t.fighter.downed);
    for (const t of this.tokens.values()) {
      const reachable = allies || !move?.front || !frontUp || t.fighter.row === 'front';
      const pickable = !!move && !t.fighter.downed && reachable && (allies ? t.fighter.side === 'party' : t.fighter.side === 'enemy');
      t.ring.setVisible(pickable).setStrokeStyle(3, 0xffffff, 0.9);
    }
    this.aim = this.pickable()[0]?.fighter.id ?? null;
    this.showAim();
    this.mark();
  }

  private pickable(): Token[] {
    return [...this.tokens.values()].filter((t) => t.ring.visible);
  }

  private showAim(): void {
    for (const t of this.pickable()) t.ring.setStrokeStyle(t.fighter.id === this.aim ? 5 : 3, t.fighter.id === this.aim ? 0xf5d06f : 0xffffff, 0.9);
  }

  // While a move waits for a target: arrows or Tab move the aim, Enter or Space uses it, Esc puts the move back.
  // The move keys 1-8 are the overlay's.
  private onKey = (e: KeyboardEvent) => {
    if (!this.choosing) return;
    const all = this.pickable();
    const i = all.findIndex((t) => t.fighter.id === this.aim);
    switch (e.code) {
      case 'ArrowRight': case 'ArrowDown': case 'Tab': case 'KeyD': case 'KeyS':
        e.preventDefault();
        this.aim = all[(i + 1) % all.length]?.fighter.id ?? null;
        return this.showAim();
      case 'ArrowLeft': case 'ArrowUp': case 'KeyA': case 'KeyW':
        e.preventDefault();
        this.aim = all[(i - 1 + all.length) % all.length]?.fighter.id ?? null;
        return this.showAim();
      case 'Enter': case 'Space': {
        e.preventDefault();
        const t = all[i];
        if (t) this.target(t);
        return;
      }
      case 'Escape': return this.setChoosing(null);
    }
  };

  private target(t: Token): void {
    if (!this.choosing || !t.ring.visible) return;
    const move = this.choosing.move;
    this.setChoosing(null);
    this.act(move, t.fighter.id);
  }

  private act(move: string, target: string): void {
    const msg: ActRequest = { move, target };
    this.room?.send('act', msg);
    this.queued = move; // the server answers with a line if it refuses; the 'use' event clears it
    this.ready = false;
    this.mark();
  }

  private mark(): void {
    this.overlay?.mark({ ready: this.ready, choosing: this.choosing?.move ?? null, queued: this.queued });
    const me = this.view && this.tokens.get(this.view.you);
    if (me && !this.choosing) me.ring.setVisible(this.ready).setStrokeStyle(3, 0xf5d06f, 1);
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
      case 'tier': { const t = at(e.entity); if (t) setWord(this, t, e.resource, e.word); break; }
      case 'downed': {
        const t = at(e.entity);
        if (t) {
          fall(t);
          this.updateReach();
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
      case 'end': this.finished = true; this.setChoosing(null); this.overlay?.lock(); break;
    }
  }

  private onResult(r: BattleResultView): void {
    this.finished = true;
    this.ready = false;
    this.mark();
    this.cameras.main.flash(250, r.won ? 255 : 120, r.won ? 240 : 40, r.won ? 200 : 40);
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
