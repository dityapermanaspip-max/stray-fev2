import Phaser from 'phaser';
import type { Room } from '@colyseus/sdk';
import type { EncounterNotice, FieldLine, FieldView, TravelOrder } from '../../../stray-bev1/shared/field.ts';
import { drawGround } from '../field/ground.ts';
import { depthAt, pickTile, tileCenter } from '../field/iso.ts';
import { SceneKeys } from '../keys.ts';
import { joinField, whereIs, type Seat } from '../net/game_net.ts';
import { ServicePanel } from '../town/service_panel.ts';
import { StatusWindow } from '../town/status_panel.ts';
import type { GearRequest, LoadoutRequest, ServiceRequest, ServiceView, StatusPanel } from '../../../stray-bev1/shared/town.ts';

// The field: draws the tile grid the server sent, the players the server moves, and sends "walk to tile".
// The client never decides where anyone is; it only animates between the tiles the server reports.

type FieldData = { name: string };
type Shown = { body: Phaser.GameObjects.Container; x: number; y: number };
type SyncedPlayer = { name: string; x: number; y: number; walking: boolean; stepMs: number; connected: boolean };

const LINE_MS = 4000;
const RETRY_MS = 2000;
const ENCOUNTER_MS = 900; // the encounter line shows before the battle opens
const ZOOM = { min: 0.5, max: 2, step: 0.1 };
const SELF_COLOR = 0xf5d06f;
const OTHER_COLOR = 0x9ec5f0;

export class FieldScene extends Phaser.Scene {
  private name = '';
  private room?: Room;
  private view?: FieldView;
  private shown = new Map<string, Shown>();
  private line?: Phaser.GameObjects.Text;
  private lineTimer?: Phaser.Time.TimerEvent;
  private travelling = false;
  private service?: ServicePanel;
  private status?: StatusWindow;

  constructor() {
    super(SceneKeys.Field);
  }

  init(data: FieldData): void {
    this.name = data.name;
    this.room = undefined;
    this.view = undefined;
    this.shown = new Map();
    this.travelling = false;
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.cameras.main.setBackgroundColor('#101418');
    this.line = this.add.text(0, 0, '', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#f2ead8',
      backgroundColor: '#000000aa', padding: { x: 14, y: 8 }, wordWrap: { width: 520 },
    }).setScrollFactor(0).setDepth(1e6).setOrigin(0.5, 1).setVisible(false);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.placeLine, this);
    this.placeLine();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointer, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    this.service = new ServicePanel((req) => void this.ask<ServiceView>('service', req).then((v) => v && this.service?.show(v)));
    this.status = new StatusWindow(() => void this.refreshStatus('status'), {
      loadout: (req: LoadoutRequest) => void this.refreshStatus('loadout', req),
      gear: (req: GearRequest) => void this.refreshStatus('gear', req),
    });
    void this.connect();
  }

  private async connect(): Promise<void> {
    try {
      const where = await whereIs(this.name);
      const { room, view } = await joinField(this.name, where.ref);
      if (!this.scene.isActive()) return void room.leave();
      this.room = room;
      this.view = view;
      drawGround(this, view);
      room.onMessage('line', (line: FieldLine) => this.showLine(line));
      room.onMessage('travel', (order: TravelOrder) => this.travel(order));
      room.onMessage('encounter', (notice: EncounterNotice) => this.encounter(notice));
      room.onMessage('service', (v: ServiceView) => this.service?.show(v));
      room.onLeave(() => {
        if (this.room === room && !this.travelling && this.scene.isActive()) this.scene.start(SceneKeys.Login);
      });
    } catch (err) {
      console.warn(`field join failed: ${(err as Error).message}`);
      this.time.delayedCall(RETRY_MS, () => this.scene.start(SceneKeys.Login));
    }
  }

  // Requests answered by the field room (status window, town doors). Null when the room said no.
  private async ask<T>(type: string, payload?: unknown): Promise<T | null> {
    if (!this.room || this.travelling) return null;
    try {
      return ((await this.room.request(type, payload)) as T | null) ?? null;
    } catch (err) {
      console.warn(`${type} failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async refreshStatus(type: string, payload?: LoadoutRequest | GearRequest | ServiceRequest): Promise<void> {
    const panel = await this.ask<StatusPanel>(type, payload);
    if (panel) this.status?.show(panel);
  }

  update(): void {
    const players = this.room?.state?.players as Map<string, SyncedPlayer> | undefined;
    if (!players || !this.view) return;
    const seen = new Set<string>();
    players.forEach((p, id) => {
      seen.add(id);
      this.syncPlayer(id, p);
    });
    for (const [id, s] of this.shown) {
      if (!seen.has(id)) {
        s.body.destroy();
        this.shown.delete(id);
      }
    }
  }

  private heightAt(x: number, y: number): number {
    return this.view!.tiles[y * this.view!.width + x]?.h ?? 0;
  }

  private syncPlayer(id: string, p: SyncedPlayer): void {
    let s = this.shown.get(id);
    if (!s) {
      s = { body: this.makeBody(p.name, id === this.room!.sessionId), x: p.x, y: p.y };
      const at = tileCenter(p.x, p.y, this.heightAt(p.x, p.y));
      s.body.setPosition(at.x, at.y).setDepth(depthAt(p.x, p.y));
      this.shown.set(id, s);
      if (id === this.room!.sessionId) this.cameras.main.startFollow(s.body, true, 0.15, 0.15);
    }
    s.body.setAlpha(p.connected ? 1 : 0.4);
    if (s.x === p.x && s.y === p.y) return;
    s.x = p.x;
    s.y = p.y;
    const to = tileCenter(p.x, p.y, this.heightAt(p.x, p.y));
    this.tweens.killTweensOf(s.body);
    s.body.setDepth(Math.max(s.body.depth, depthAt(p.x, p.y)));
    this.tweens.add({
      targets: s.body, x: to.x, y: to.y, duration: Math.max(p.stepMs, 1), ease: 'Linear',
      onComplete: () => s!.body.setDepth(depthAt(p.x, p.y)),
    });
  }

  // Placeholder body: a shadow, a round token and the name above it.
  private makeBody(name: string, self: boolean): Phaser.GameObjects.Container {
    const shadow = this.add.ellipse(0, 0, 28, 12, 0x000000, 0.35);
    const token = this.add.circle(0, -16, 11, self ? SELF_COLOR : OTHER_COLOR).setStrokeStyle(2, 0x1b1b1b);
    const label = this.add.text(0, -34, name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1);
    return this.add.container(0, 0, [shadow, token, label]);
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    if (!this.room || !this.view || this.travelling) return;
    const tile = pickTile(this.view, pointer.worldX, pointer.worldY);
    if (!tile) return;
    this.room.send('walk', tile);
    this.service?.hide(); // walking away from a door closes it
    this.markTarget(tile.x, tile.y);
  }

  private markTarget(x: number, y: number): void {
    const at = tileCenter(x, y, this.heightAt(x, y));
    const ring = this.add.ellipse(at.x, at.y, 40, 20).setStrokeStyle(2, 0xffffff, 0.9).setDepth(depthAt(x, y) - 1);
    this.tweens.add({ targets: ring, alpha: 0, scale: 1.4, duration: 500, onComplete: () => ring.destroy() });
  }

  private onWheel(_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom - Math.sign(dy) * ZOOM.step, ZOOM.min, ZOOM.max));
  }

  private placeLine(): void {
    this.line?.setPosition(this.scale.width / 2, this.scale.height - 24);
  }

  private showLine(line: FieldLine): void {
    if (!line.text || !this.line) return;
    this.line.setText(line.text).setVisible(true);
    this.lineTimer?.remove();
    this.lineTimer = this.time.delayedCall(LINE_MS, () => this.line?.setVisible(false));
  }

  // Creatures jumped out and the server stopped the walk: a jolt, the line, then off to the battle room.
  // The server saved this tile; the field is joined fresh when the battle is over.
  private encounter(notice: EncounterNotice): void {
    this.cameras.main.shake(180, 0.006);
    this.showLine({ key: notice.key, text: notice.text });
    if (!notice.seat || this.travelling) return;
    this.travelling = true;
    const left = this.room?.leave() ?? Promise.resolve();
    // A plain timer: the seat is reserved now, so the handoff must not stall with the frame loop.
    const shown = new Promise<void>((done) => setTimeout(done, ENCOUNTER_MS));
    void Promise.all([left.catch(() => undefined), shown])
      .then(() => this.scene.start(SceneKeys.Battle, { name: this.name, seat: notice.seat as Seat }));
  }

  // The server already saved the new spot; leave this room and join the next field fresh.
  private travel(_order: TravelOrder): void {
    if (this.travelling) return;
    this.travelling = true;
    const left = this.room?.leave() ?? Promise.resolve(); // leave at once; the fade is only for show
    this.cameras.main.fadeOut(250);
    const faded = new Promise<void>((done) => this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, done));
    void Promise.all([left.catch(() => undefined), faded]).then(() => this.scene.restart({ name: this.name }));
  }

  private onShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.placeLine, this);
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.service?.destroy();
    this.status?.destroy();
    if (!this.travelling) void this.room?.leave();
  }
}
