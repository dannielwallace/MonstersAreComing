import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(): void {
    this.add.text(32, 32, 'Caravan Greybox', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '24px',
    });
  }
}
