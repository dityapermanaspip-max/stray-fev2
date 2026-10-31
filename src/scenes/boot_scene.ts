import Phaser from 'phaser';
import { SceneKeys } from '../keys.ts';

// Loads startup-critical assets only. Other scenes lazy-load their own.
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.scene.start(SceneKeys.Login);
  }

  private onShutdown(): void {
    this.time.removeAllEvents();
    this.tweens.killAll();
  }
}
