import Phaser from 'phaser';

// Milestone 1 tuning constants. Adjust these first when playtesting the feel.
const TONGUE_LAUNCH_SPEED = 860;
const TONGUE_UPWARD_VELOCITY = -420;
const GRAVITY = 1350;
const TARGET_SPEED_RANGE = { min: 150, max: 230 };
const HIT_ZONE_WIDTH = 42;
const MAX_MISSES = 5;
const TARGET_SPAWN_TIMING = 650;

const GAME_WIDTH = 390;
const GAME_HEIGHT = 844;
const PLAYER_X = 58;
const PLAYER_Y = 548;
const TONGUE_ORIGIN = new Phaser.Math.Vector2(86, 520);
const TARGET_RADIUS = 38;
const TARGET_START_X = GAME_WIDTH + 72;
const TARGET_MIN_Y = 300;
const TARGET_MAX_Y = 590;
const PERFECT_RATIO = 0.42;
const DEBUG_HIT_ZONE = true;

type GamePhase = 'ready' | 'playing' | 'tongueLaunched' | 'resolving' | 'gameOver';
type Judgment = 'PERFECT' | 'CLOSE' | 'MISS';

type TargetState = {
  x: number;
  y: number;
  speed: number;
  hitZoneWidth: number;
  body: Phaser.GameObjects.Arc;
  gap: Phaser.GameObjects.Rectangle;
};

type TongueState = {
  tip: Phaser.Math.Vector2;
  velocity: Phaser.Math.Vector2;
  line: Phaser.GameObjects.Graphics;
  path: Phaser.Math.Vector2[];
};

export class GameScene extends Phaser.Scene {
  private phase: GamePhase = 'ready';
  private target?: TargetState;
  private tongue?: TongueState;
  private score = 0;
  private misses = 0;
  private streak = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private missesText!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;
  private judgmentText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private gameOverPanel?: Phaser.GameObjects.Container;

  constructor() {
    super('GameScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#F5F0E8');
    this.drawStaticPrototypeArt();
    this.createUi();
    this.input.on('pointerdown', () => this.handleAction());
    this.input.keyboard?.on('keydown-SPACE', () => this.handleAction());
    this.spawnTarget();
  }

  update(_time: number, deltaMs: number) {
    if (this.phase === 'gameOver' || this.phase === 'resolving') return;

    const delta = deltaMs / 1000;
    this.updateTarget(delta);

    if (this.phase === 'tongueLaunched') {
      this.updateTongue(delta);
    }
  }

  private drawStaticPrototypeArt() {
    const g = this.add.graphics();
    g.fillStyle(0x1a0a2e, 1);
    g.fillRoundedRect(28, PLAYER_Y - 52, 72, 104, 28);
    g.fillStyle(0xf5f0e8, 1);
    g.fillCircle(55, PLAYER_Y - 18, 7);
    g.fillCircle(78, PLAYER_Y - 18, 7);
    g.fillStyle(0x1a0a2e, 0.08);
    g.fillRoundedRect(18, PLAYER_Y + 58, 96, 12, 6);

    this.add.text(GAME_WIDTH / 2, 78, 'LICK IT', {
      fontSize: '38px',
      fontStyle: '900',
      color: '#1A0A2E',
      letterSpacing: 2,
    }).setOrigin(0.5);
  }

  private createUi() {
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '20px',
      fontStyle: '700',
      color: '#1A0A2E',
    };
    this.scoreText = this.add.text(24, 24, '', textStyle);
    this.missesText = this.add.text(24, 52, '', textStyle);
    this.streakText = this.add.text(24, 80, '', textStyle);
    this.judgmentText = this.add.text(GAME_WIDTH / 2, 156, '', {
      fontSize: '42px',
      fontStyle: '900',
      color: '#FF4D4D',
    }).setOrigin(0.5).setAlpha(0);
    this.hintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 76, 'Tap, click, or press Space when the gap lines up', {
      fontSize: '16px',
      color: '#1A0A2E',
      align: 'center',
      wordWrap: { width: 330 },
    }).setOrigin(0.5);
    this.updateUi();
  }

  private spawnTarget() {
    this.cleanupTarget();
    this.cleanupTongue();

    const y = Phaser.Math.Between(TARGET_MIN_Y, TARGET_MAX_Y);
    const speed = Phaser.Math.Between(TARGET_SPEED_RANGE.min, TARGET_SPEED_RANGE.max);
    const hitZoneWidth = Phaser.Math.Between(HIT_ZONE_WIDTH - 8, HIT_ZONE_WIDTH + 10);
    const body = this.add.circle(TARGET_START_X, y, TARGET_RADIUS, 0x1a0a2e);
    body.setScale(0.85, 1.25);
    const gap = this.add.rectangle(TARGET_START_X, y, hitZoneWidth, 18, 0xff4d4d, DEBUG_HIT_ZONE ? 0.35 : 0.12);
    gap.setStrokeStyle(2, 0xff4d4d, DEBUG_HIT_ZONE ? 0.75 : 0.2);
    this.target = { x: TARGET_START_X, y, speed, hitZoneWidth, body, gap };
    this.phase = 'playing';
  }

  private updateTarget(delta: number) {
    if (!this.target) return;
    this.target.x -= this.target.speed * delta;
    this.target.body.setPosition(this.target.x, this.target.y);
    this.target.gap.setPosition(this.target.x, this.target.y);

    if (this.target.x < -TARGET_RADIUS) {
      this.resolveShot('MISS');
    }
  }

  private handleAction() {
    if (this.phase === 'gameOver') {
      this.restartGame();
      return;
    }
    if (this.phase !== 'playing') return;

    this.phase = 'tongueLaunched';
    const line = this.add.graphics();
    this.tongue = {
      tip: TONGUE_ORIGIN.clone(),
      velocity: new Phaser.Math.Vector2(TONGUE_LAUNCH_SPEED, TONGUE_UPWARD_VELOCITY),
      line,
      path: [TONGUE_ORIGIN.clone()],
    };
  }

  private updateTongue(delta: number) {
    if (!this.tongue || !this.target) return;

    this.tongue.velocity.y += GRAVITY * delta;
    this.tongue.tip.x += this.tongue.velocity.x * delta;
    this.tongue.tip.y += this.tongue.velocity.y * delta;
    this.tongue.path.push(this.tongue.tip.clone());
    if (this.tongue.path.length > 28) this.tongue.path.shift();

    this.drawTongue();
    this.checkTipCollision();

    if (this.tongue.tip.x > GAME_WIDTH + 28 || this.tongue.tip.y > GAME_HEIGHT + 28 || this.tongue.tip.y < -28) {
      this.resolveShot('MISS');
    }
  }

  private drawTongue() {
    if (!this.tongue) return;
    const points = [TONGUE_ORIGIN, ...this.tongue.path];
    this.tongue.line.clear();
    this.tongue.line.lineStyle(12, 0xff4d4d, 1);
    this.tongue.line.beginPath();
    this.tongue.line.moveTo(TONGUE_ORIGIN.x, TONGUE_ORIGIN.y);
    for (const point of points) this.tongue.line.lineTo(point.x, point.y);
    this.tongue.line.strokePath();
    this.tongue.line.fillStyle(0xff4d4d, 1);
    this.tongue.line.fillCircle(this.tongue.tip.x, this.tongue.tip.y, 9);
  }

  private checkTipCollision() {
    if (!this.tongue || !this.target) return;

    const dx = this.tongue.tip.x - this.target.x;
    const dy = this.tongue.tip.y - this.target.y;
    const inGap = Math.abs(dx) <= this.target.hitZoneWidth / 2 && Math.abs(dy) <= 18;
    if (!inGap) return;

    const centerDistance = Math.hypot(dx / (this.target.hitZoneWidth / 2), dy / 18);
    this.resolveShot(centerDistance <= PERFECT_RATIO ? 'PERFECT' : 'CLOSE');
  }

  private resolveShot(judgment: Judgment) {
    if (this.phase === 'resolving' || this.phase === 'gameOver') return;
    this.phase = 'resolving';

    if (judgment === 'MISS') {
      this.misses += 1;
      this.streak = 0;
    } else {
      this.streak += 1;
      this.score += judgment === 'PERFECT' ? 100 : 50;
      if (this.streak % 3 === 0) this.score += 50;
    }

    this.updateUi();
    this.showJudgment(judgment);

    this.time.delayedCall(TARGET_SPAWN_TIMING, () => {
      if (this.misses >= MAX_MISSES) {
        this.showGameOver();
      } else {
        this.spawnTarget();
      }
    });
  }

  private showJudgment(judgment: Judgment) {
    const color = judgment === 'MISS' ? '#1A0A2E' : '#FF4D4D';
    this.judgmentText.setText(judgment).setColor(color).setAlpha(1).setScale(0.85);
    this.tweens.add({
      targets: this.judgmentText,
      scale: 1,
      alpha: 0,
      duration: TARGET_SPAWN_TIMING,
      ease: 'Cubic.easeOut',
    });
  }

  private showGameOver() {
    this.phase = 'gameOver';
    this.cleanupTarget();
    this.cleanupTongue();
    const panelBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 330, 250, 0xf5f0e8, 0.96)
      .setStrokeStyle(4, 0x1a0a2e, 1);
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 74, 'GAME OVER', {
      fontSize: '34px', fontStyle: '900', color: '#1A0A2E'
    }).setOrigin(0.5);
    const finalScore = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 16, `Final score: ${this.score}`, {
      fontSize: '22px', fontStyle: '700', color: '#1A0A2E'
    }).setOrigin(0.5);
    const restart = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 58, 'Tap, click, or press Space\nto restart', {
      fontSize: '18px', color: '#1A0A2E', align: 'center'
    }).setOrigin(0.5);
    this.gameOverPanel = this.add.container(0, 0, [panelBg, title, finalScore, restart]);
  }

  private restartGame() {
    this.score = 0;
    this.misses = 0;
    this.streak = 0;
    this.gameOverPanel?.destroy(true);
    this.gameOverPanel = undefined;
    this.updateUi();
    this.spawnTarget();
  }

  private updateUi() {
    this.scoreText?.setText(`Score ${this.score}`);
    this.missesText?.setText(`Misses ${this.misses}/${MAX_MISSES}`);
    this.streakText?.setText(`Streak ${this.streak}`);
  }

  private cleanupTarget() {
    this.target?.body.destroy();
    this.target?.gap.destroy();
    this.target = undefined;
  }

  private cleanupTongue() {
    this.tongue?.line.destroy();
    this.tongue = undefined;
  }
}
