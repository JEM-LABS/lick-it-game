import Phaser from 'phaser';
import './style.css';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#F5F0E8',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 390,
    height: 844,
  },
  fps: {
    target: 60,
    forceSetTimeOut: true,
  },
  scene: [GameScene],
};

new Phaser.Game(config);
