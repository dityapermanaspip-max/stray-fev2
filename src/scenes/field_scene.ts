import Phaser from 'phaser';
import type { Room } from '@colyseus/sdk';
import type { AskAnswer, AskView, EncounterNotice, FieldLine, FieldView, GatherNotice, TravelOrder } from '../../../stray-bev1/shared/field.ts';
import type { MapView } from '../../../stray-bev1/shared/map.ts';
import { FieldKeys, nextTile } from '../field/field_keys.ts';
import { ActorBody, loadActors } from '../field/actor.ts';
import { fadeBuildings } from '../field/buildings.ts';
import { drawField } from '../field/ground_tiles.ts';
import { depthAt, pickTile, tileCenter } from '../field/iso.ts';
import { heightAt, markTarget } from '../field/marks.ts';
import { drawNpcs } from '../field/npcs.ts';
import { SceneKeys } from '../keys.ts';
import { joinField, whereIs, type Seat } from '../net/game_net.ts';
import { AskPanel, gatheredText } from '../town/ask_panel.ts';
import { ServicePanel } from '../town/service_panel.ts';
import { TalkPanel } from '../town/talk_panel.ts';
import { StatusWindow } from '../town/status_panel.ts';
import { MAP_CLOSED } from './world_map_scene.ts';
import type { TalkView } from '../../../stray-bev1/shared/talk.ts';
import type { CompanionRequest, DropRequest, EatRequest, FormationRequest, GearRequest, LoadoutRequest, PartyView, ServiceRequest, ServiceView, StatusPanel } from '../../../stray-bev1/shared/town.ts';

// The field: draws the tile grid the server sent, the players the server moves, and sends "walk to tile".
// The client never decides where anyone is; it only animates between the tiles the server reports.

type FieldData = { name: string };
type Shown = { actor: ActorBody; body: Phaser.GameObjects.Container; x: number; y: number };
type SyncedPlayer = { name: string; x: number; y: number; walking: boolean; stepMs: number; connected: boolean };

const LINE_MS = 4000;
const RETRY_MS = 2000;
const ENCOUNTER_MS = 900; // the encounter line shows before the battle opens
const ZOOM = { min: 0.5, max: 2, step: 0.1 };
const KEY_STEP_MS = 120; // least time between keyboard steps sent

export class FieldScene extends Phaser.Scene {
  private name = '';
  private room?: Room;
  private view?: FieldView;
  private shown = new Map<string, Shown>();
  private line?: Phaser.GameObjects.Text;
  private lineTimer?: Phaser.Time.TimerEvent;
  private travelling = false;
  private service?: ServicePanel;
  private askPanel?: AskPanel;
  private talk?: TalkPanel;
  private status?: StatusWindow;
  private keys?: FieldKeys;
  private mapButton?: HTMLButtonElement;
  private mapOpen = false;
  private lastKeyStep = 0;

  constructor() {
    super(SceneKeys.Field);
  }

  init(data: FieldData): void {
    this.name = data.name;
    this.room = undefined;
    this.view = undefined;
    this.shown = new Map();
    this.travelling = false;
    this.mapOpen = false;
    this.lastKeyStep = 0;
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
    this.talk = new TalkPanel((req) => void this.ask<TalkView>('talk_act', req).then((v) => v && this.talk?.show(v)));
    this.askPanel = new AskPanel((yes) => this.room?.send('answer', { yes } satisfies AskAnswer));
    this.status = new StatusWindow(() => void this.refreshStatus('status'), {
      loadout: (req: LoadoutRequest) => void this.refreshStatus('loadout', req),
      gear: (req: GearRequest) => void this.refreshStatus('gear', req),
      formation: (req: FormationRequest) => void this.refreshStatus('formation', req),
      eat: (req: EatRequest) => void this.refreshStatus('eat', req),
      drop: (req: DropRequest) => void this.refreshStatus('drop', req),
      party: () => void this.ask<PartyView>('party').then((v) => v && this.status?.showParty(v)),
      companion: (req: CompanionRequest) => void this.refreshStatus('companion', req),
    });
    this.keys = new FieldKeys({
      confirm: () => this.askPanel?.choose(true),
      cancel: () => this.cancel(),
      map: () => (this.mapOpen ? this.closeMap() : void this.openMap()),
      status: () => (this.status?.visible ? this.status.hide() : void this.refreshStatus('status')),
      zoom: (dir) => this.zoomBy(dir),
    });
    this.mapButton = Object.assign(document.createElement('button'), { type: 'button', className: 'map-toggle', textContent: '◈' });
    this.mapButton.addEventListener('click', () => (this.mapOpen ? this.closeMap() : void this.openMap()));
    document.body.append(this.mapButton);
    void this.connect();
  }

  private async connect(): Promise<void> {
    try {
      await loadActors(this); // a failed sheet leaves the round tokens
      const where = await whereIs(this.name);
      const { room, view } = await joinField(this.name, where.ref);
      if (!this.scene.isActive()) return void room.leave();
      this.room = room;
      this.view = view;
      void drawField(this, view);
      await loadActors(this, view.npcs.flatMap((n) => (n.look ? [n.look] : [])));
      drawNpcs(this, view);
      room.onMessage('line', (line: FieldLine) => this.showLine(line));
      room.onMessage('travel', (order: TravelOrder) => this.travel(order));
      room.onMessage('encounter', (notice: EncounterNotice) => this.encounter(notice));
      room.onMessage('talk', (v: TalkView) => this.talk?.show(v));
      room.onMessage('service', (v: ServiceView) => (this.talk?.hide(), this.service?.show(v)));
      room.onMessage('ask', (v: AskView) => this.askPanel?.show(v));
      room.onMessage('gathered', (n: GatherNotice) => this.showLine({ key: 'gathered', text: gatheredText(n) }));
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

  private async refreshStatus(type: string, payload?: LoadoutRequest | GearRequest | EatRequest | FormationRequest | DropRequest | CompanionRequest | ServiceRequest): Promise<void> {
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
    this.keyWalk(players.get(this.room!.sessionId));
    fadeBuildings(this, this.shown.get(this.room!.sessionId)?.body);
  }

  // Held arrow / WASD keys: one tile at a time, sent when the last step is done. A blocked diagonal tries its sides.
  private keyWalk(me: SyncedPlayer | undefined): void {
    const step = this.keys?.step();
    if (!step || !me || me.walking || this.mapOpen || this.travelling || this.time.now - this.lastKeyStep < KEY_STEP_MS) return;
    const tile = nextTile(this.view!, me, step);
    if (!tile) return this.keys?.took(); // a tap into a wall is dropped
    this.lastKeyStep = this.time.now;
    this.keys?.took();
    this.walkTo(tile);
  }

  private walkTo(tile: { x: number; y: number }): void {
    this.room?.send('walk', tile);
    this.service?.hide(); // walking away from a door closes it
    this.talk?.hide(); // and ends a talk
    this.askPanel?.hide(); // and drops the question (the server drops it too)
  }

  // Esc: close the map, else say no to the question, else close the door panel, else the status window.
  private cancel(): void {
    if (this.mapOpen) return this.closeMap();
    if (this.askPanel?.visible) return this.askPanel.choose(false);
    if (this.talk?.visible) return this.talk.hide();
    if (this.service?.visible) return this.service.hide();
    if (this.status?.visible) this.status.hide();
  }

  private async openMap(): Promise<void> {
    if (this.mapOpen) return;
    const view = await this.ask<MapView>('map');
    if (!view || this.mapOpen || !this.scene.isActive()) return;
    this.mapOpen = true;
    this.keys?.clear();
    this.scene.launch(SceneKeys.WorldMap, { view });
    this.scene.get(SceneKeys.WorldMap).events.once(MAP_CLOSED, () => { this.mapOpen = false; });
  }

  private closeMap(): void {
    if (!this.mapOpen) return;
    this.mapOpen = false;
    this.scene.stop(SceneKeys.WorldMap);
  }

  private syncPlayer(id: string, p: SyncedPlayer): void {
    let s = this.shown.get(id);
    if (!s) {
      const actor = new ActorBody(this, p.name, id === this.room!.sessionId);
      s = { actor, body: actor.root, x: p.x, y: p.y };
      const at = tileCenter(p.x, p.y, heightAt(this.view!, p.x, p.y));
      s.body.setPosition(at.x, at.y).setDepth(depthAt(p.x, p.y));
      this.shown.set(id, s);
      if (id === this.room!.sessionId) this.cameras.main.startFollow(s.body, true, 0.15, 0.15);
    }
    s.body.setAlpha(p.connected ? 1 : 0.4);
    s.actor.walk(p.walking || this.tweens.isTweening(s.body));
    if (s.x === p.x && s.y === p.y) return;
    s.actor.face(p.x - s.x, p.y - s.y);
    s.x = p.x;
    s.y = p.y;
    const to = tileCenter(p.x, p.y, heightAt(this.view!, p.x, p.y));
    this.tweens.killTweensOf(s.body);
    s.body.setDepth(Math.max(s.body.depth, depthAt(p.x, p.y)));
    this.tweens.add({
      targets: s.body, x: to.x, y: to.y, duration: Math.max(p.stepMs, 1), ease: 'Linear',
      onComplete: () => s!.body.setDepth(depthAt(p.x, p.y)),
    });
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    if (!this.room || !this.view || this.travelling || this.mapOpen) return;
    const tile = pickTile(this.view, pointer.worldX, pointer.worldY);
    if (!tile) return;
    this.walkTo(tile);
    markTarget(this, this.view, tile.x, tile.y);
  }

  private onWheel(_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void {
    if (!this.mapOpen) this.zoomBy(dy > 0 ? -1 : 1);
  }

  private zoomBy(dir: 1 | -1): void {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom + dir * ZOOM.step, ZOOM.min, ZOOM.max));
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
    this.askPanel?.destroy();
    this.talk?.destroy();
    this.status?.destroy();
    this.keys?.destroy();
    this.mapButton?.remove();
    if (this.mapOpen) this.scene.stop(SceneKeys.WorldMap);
    if (!this.travelling) void this.room?.leave();
  }
}
