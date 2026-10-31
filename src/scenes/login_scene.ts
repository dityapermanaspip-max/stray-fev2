import Phaser from 'phaser';
import { SceneKeys } from '../keys.ts';

// Dev join until accounts exist: type a player name, no password. The name is remembered in this browser.

const NAME = /^[A-Za-z0-9_]{2,24}$/;
const STORE_KEY = 'runstray.devName';

function remembered(): string {
  try {
    return localStorage.getItem(STORE_KEY) ?? '';
  } catch {
    return '';
  }
}

function remember(name: string): void {
  try {
    localStorage.setItem(STORE_KEY, name);
  } catch {
    // storage blocked: the name is just not remembered
  }
}

export class LoginScene extends Phaser.Scene {
  private form?: HTMLFormElement;

  constructor() {
    super(SceneKeys.Login);
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.form?.remove());
    const form = document.createElement('form');
    form.className = 'dev-join';
    const input = document.createElement('input');
    input.name = 'name';
    input.autocomplete = 'off';
    input.maxLength = 24;
    input.placeholder = 'name';
    input.value = remembered();
    const go = document.createElement('button');
    go.type = 'submit';
    go.textContent = '→';
    form.append(input, go);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!NAME.test(name)) {
        input.classList.add('bad');
        return;
      }
      remember(name);
      this.scene.start(SceneKeys.Field, { name });
    });
    input.addEventListener('input', () => input.classList.remove('bad'));
    document.body.append(form);
    this.form = form;
    input.focus();
  }
}
