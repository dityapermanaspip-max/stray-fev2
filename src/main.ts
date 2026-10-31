import Phaser from 'phaser';
import { BattleScene } from './scenes/battle_scene.ts';
import { BootScene } from './scenes/boot_scene.ts';
import { FieldScene } from './scenes/field_scene.ts';
import { LoginScene } from './scenes/login_scene.ts';

// The client only renders server state and sends requests.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, LoginScene, FieldScene, BattleScene],
});
