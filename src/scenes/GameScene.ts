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

type GamePhase = 'ready' | 'playing' | 'tongueLaunched' | 'resolving' | 'gameOver';
type Judgment = 'PERFECT' | 'CLOSE' | 'MISS';

type TargetState = {
  x: number;
  y: number;
  baseY: number;
  speed: number;
  hitZoneWidth: number;
  walkTime: number;
  stride: number;
  hesitationTimer: number;
  nextHesitationAt: number;
  visual: Phaser.GameObjects.Graphics;
};

type TongueState = {
  tip: Phaser.Math.Vector2;
  velocity: Phaser.Math.Vector2;
  line: Phaser.GameObjects.Graphics;
  path: Phaser.Math.Vector2[];
  age: number;
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
  private playerTorso!: Phaser.GameObjects.Graphics;
  private playerEyes!: Phaser.GameObjects.Graphics;
  private gameOverPanel?: Phaser.GameObjects.Container;
  private skylineLayer!: Phaser.GameObjects.Container;
  private officeLayer!: Phaser.GameObjects.Container;
  private elapsed = 0;

  constructor() {
    super('GameScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#F5F0E8');
    this.drawOfficeBackground();
    this.drawPlayerDesk();
    this.createUi();
    this.input.on('pointerdown', () => this.handleAction());
    this.input.keyboard?.on('keydown-SPACE', () => this.handleAction());
    this.spawnTarget();
  }

  update(_time: number, deltaMs: number) {
    this.elapsed += deltaMs / 1000;
    this.updateParallax();

    if (this.phase === 'gameOver' || this.phase === 'resolving') return;

    const delta = deltaMs / 1000;
    this.updateTarget(delta);

    if (this.phase === 'tongueLaunched') {
      this.updateTongue(delta);
    }
  }

  private drawOfficeBackground() {
    const back = this.add.graphics();
    back.fillGradientStyle(0xf8f1df, 0xf8f1df, 0xe9dfd2, 0xe9dfd2, 1);
    back.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.skylineLayer = this.add.container(0, 0);
    const windows = this.add.graphics();
    windows.fillStyle(0xcfe9f4, 1);
    windows.fillRoundedRect(38, 120, 314, 150, 18);
    windows.lineStyle(4, 0xfffbef, 0.9);
    windows.strokeRoundedRect(38, 120, 314, 150, 18);
    windows.lineBetween(143, 120, 143, 270);
    windows.lineBetween(248, 120, 248, 270);
    windows.lineBetween(38, 195, 352, 195);
    windows.fillStyle(0x91a8bd, 0.42);
    [60, 94, 168, 204, 286, 318].forEach((x, i) => {
      windows.fillRoundedRect(x, 218 - (i % 3) * 16, 24 + (i % 2) * 12, 52 + (i % 3) * 14, 4);
    });
    this.skylineLayer.add(windows);

    this.officeLayer = this.add.container(0, 0);
    const office = this.add.graphics();
    office.fillStyle(0xdccdbb, 1);
    office.fillRect(0, 635, GAME_WIDTH, 209);
    office.fillStyle(0xcab9a7, 0.45);
    for (let y = 668; y < GAME_HEIGHT; y += 34) office.fillRect(0, y, GAME_WIDTH, 2);

    // Muted cubicles, desks, chairs, monitors, cooler, plants, poster, and cabinet.
    office.fillStyle(0xd8c8b4, 1);
    office.fillRoundedRect(214, 330, 138, 82, 8);
    office.fillRoundedRect(20, 370, 118, 76, 8);
    office.fillStyle(0xbfae9c, 1);
    office.fillRoundedRect(224, 394, 118, 16, 8);
    office.fillRoundedRect(28, 434, 104, 14, 7);
    office.fillStyle(0x3f4f60, 0.75);
    office.fillRoundedRect(248, 350, 38, 24, 4);
    office.fillRoundedRect(58, 391, 34, 22, 4);
    office.fillStyle(0x68798b, 0.7);
    office.fillRoundedRect(292, 376, 42, 44, 12);
    office.fillRoundedRect(96, 414, 38, 42, 12);
    office.fillStyle(0xaed8e6, 1);
    office.fillRoundedRect(22, 282, 32, 72, 10);
    office.fillStyle(0xf6fbff, 0.92);
    office.fillCircle(38, 292, 16);
    office.fillStyle(0x88b58f, 1);
    office.fillRoundedRect(322, 285, 10, 38, 5);
    office.fillCircle(314, 291, 13);
    office.fillCircle(337, 287, 12);
    office.fillStyle(0xd16f5e, 1);
    office.fillRoundedRect(72, 288, 74, 50, 6);
    office.fillStyle(0xfff5dc, 1);
    office.fillRoundedRect(78, 294, 62, 38, 4);
    office.fillStyle(0x1a0a2e, 0.6);
    office.fillRect(88, 307, 42, 4);
    office.fillRect(94, 318, 30, 4);
    office.fillStyle(0x9daeb9, 1);
    office.fillRoundedRect(302, 456, 56, 112, 8);
    office.lineStyle(2, 0x7f909b, 0.8);
    office.lineBetween(302, 492, 358, 492);
    office.lineBetween(302, 530, 358, 530);
    office.fillStyle(0x71818c, 0.8);
    office.fillRoundedRect(326, 474, 10, 3, 2);
    office.fillRoundedRect(326, 512, 10, 3, 2);
    office.fillRoundedRect(326, 550, 10, 3, 2);
    this.officeLayer.add(office);
  }

  private drawPlayerDesk() {
    const deskBack = this.add.graphics();
    deskBack.fillStyle(0xbd7a4a, 1);
    deskBack.fillRoundedRect(0, 566, 150, 116, 12);
    deskBack.fillStyle(0x965835, 1);
    deskBack.fillRoundedRect(0, 566, 158, 20, 10);
    deskBack.fillStyle(0xfff2d3, 1);
    deskBack.fillRoundedRect(114, 594, 18, 24, 5);
    deskBack.fillStyle(0x1a0a2e, 0.18);
    deskBack.fillRoundedRect(116, 598, 24, 12, 6);
    deskBack.fillStyle(0xf5f0e8, 1);
    deskBack.fillRoundedRect(24, 596, 44, 26, 4);
    deskBack.fillRoundedRect(36, 602, 44, 26, 4);
    deskBack.fillStyle(0x253348, 1);
    deskBack.fillRoundedRect(52, 574, 48, 32, 5);
    deskBack.fillStyle(0x8bd0e6, 1);
    deskBack.fillRoundedRect(57, 579, 38, 22, 3);
    deskBack.fillStyle(0x253348, 1);
    deskBack.fillRoundedRect(68, 606, 16, 8, 3);
    deskBack.fillStyle(0xf1d6bb, 1);
    deskBack.fillRoundedRect(44, 618, 64, 12, 5);

    this.playerTorso = this.add.graphics();
    this.playerEyes = this.add.graphics();
    this.drawPlayer(0);

    const deskFront = this.add.graphics();
    deskFront.fillStyle(0xd58b54, 1);
    deskFront.fillRoundedRect(0, 628, 164, 126, 16);
    deskFront.fillStyle(0xa8643e, 0.32);
    deskFront.fillRoundedRect(18, 654, 44, 70, 8);
    deskFront.fillRoundedRect(82, 654, 44, 70, 8);
  }

  private drawPlayer(recoil: number) {
    this.playerTorso.clear();
    this.playerEyes.clear();
    const recoilX = -recoil;
    this.playerTorso.fillStyle(0x5446a8, 1);
    this.playerTorso.fillRoundedRect(42 + recoilX, PLAYER_Y - 18, 70, 62, 20);
    this.playerTorso.fillStyle(0xf2b28c, 1);
    this.playerTorso.fillCircle(76 + recoilX, PLAYER_Y - 58, 31);
    this.playerTorso.fillStyle(0x4b2a24, 1);
    this.playerTorso.fillCircle(61 + recoilX, PLAYER_Y - 75, 13);
    this.playerTorso.fillCircle(89 + recoilX, PLAYER_Y - 76, 15);
    this.playerEyes.fillStyle(0xffffff, 1);
    this.playerEyes.fillCircle(65 + recoilX, PLAYER_Y - 60, 7);
    this.playerEyes.fillCircle(86 + recoilX, PLAYER_Y - 60, 7);
    this.playerEyes.fillStyle(0x1a0a2e, 1);
    this.playerEyes.fillCircle(68 + recoilX, PLAYER_Y - 59, 3);
    this.playerEyes.fillCircle(89 + recoilX, PLAYER_Y - 59, 3);
  }

  private createUi() {
    const cardStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '16px',
      fontStyle: '800',
      color: '#1A0A2E',
    };
    this.drawUiCard(14, 18, 96, 46, 'SCORE');
    this.drawUiCard(147, 18, 96, 46, 'MISSES');
    this.drawUiCard(280, 18, 96, 46, 'STREAK');
    this.scoreText = this.add.text(62, 40, '', cardStyle).setOrigin(0.5);
    this.missesText = this.add.text(195, 40, '', cardStyle).setOrigin(0.5);
    this.streakText = this.add.text(328, 40, '', cardStyle).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 96, 'LICK IT', {
      fontSize: '38px',
      fontStyle: '900',
      color: '#1A0A2E',
      stroke: '#FFFFFF',
      strokeThickness: 5,
    }).setOrigin(0.5);
    this.judgmentText = this.add.text(GAME_WIDTH / 2, 158, '', {
      fontSize: '46px',
      fontStyle: '900',
      color: '#FF4D4D',
      stroke: '#FFFFFF',
      strokeThickness: 7,
    }).setOrigin(0.5).setAlpha(0);
    this.hintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 54, 'Tap, click, or press Space when the walk lines up', {
      fontSize: '15px',
      fontStyle: '700',
      color: '#1A0A2E',
      align: 'center',
      wordWrap: { width: 330 },
    }).setOrigin(0.5).setAlpha(0.72);
    this.updateUi();
  }

  private drawUiCard(x: number, y: number, width: number, height: number, label: string) {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.88);
    g.fillRoundedRect(x, y, width, height, 14);
    g.lineStyle(2, 0xffc9a8, 0.95);
    g.strokeRoundedRect(x, y, width, height, 14);
    this.add.text(x + width / 2, y + 10, label, {
      fontSize: '9px',
      fontStyle: '900',
      color: '#B76D54',
    }).setOrigin(0.5);
  }

  private spawnTarget() {
    this.cleanupTarget();
    this.cleanupTongue();

    const y = Phaser.Math.Between(TARGET_MIN_Y, TARGET_MAX_Y);
    const speed = Phaser.Math.Between(TARGET_SPEED_RANGE.min, TARGET_SPEED_RANGE.max);
    const hitZoneWidth = Phaser.Math.Between(HIT_ZONE_WIDTH - 8, HIT_ZONE_WIDTH + 10);
    const visual = this.add.graphics();
    this.target = {
      x: TARGET_START_X,
      y,
      baseY: y,
      speed,
      hitZoneWidth,
      walkTime: Phaser.Math.FloatBetween(0, Math.PI * 2),
      stride: Phaser.Math.FloatBetween(0.85, 1.2),
      hesitationTimer: 0,
      nextHesitationAt: Phaser.Math.FloatBetween(1.4, 3.4),
      visual,
    };
    this.phase = 'playing';
    this.drawTargetSilhouette(this.target);
  }

  private updateTarget(delta: number) {
    if (!this.target) return;

    this.target.walkTime += delta * this.target.stride * 7.6;
    this.target.nextHesitationAt -= delta;
    if (this.target.nextHesitationAt <= 0 && this.target.hesitationTimer <= 0) {
      this.target.hesitationTimer = Phaser.Math.FloatBetween(0.08, 0.2);
      this.target.nextHesitationAt = Phaser.Math.FloatBetween(1.7, 3.8);
    }
    if (this.target.hesitationTimer > 0) this.target.hesitationTimer -= delta;

    const hesitationFactor = this.target.hesitationTimer > 0 ? 0.34 : 1;
    this.target.x -= this.target.speed * hesitationFactor * delta;
    this.target.y = this.target.baseY + Math.sin(this.target.walkTime * 2) * 3;
    this.drawTargetSilhouette(this.target);

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
    this.tweens.addCounter({
      from: 12,
      to: 0,
      duration: 170,
      ease: 'Back.easeOut',
      onUpdate: tween => this.drawPlayer(tween.getValue() ?? 0),
    });
    const line = this.add.graphics();
    this.tongue = {
      tip: TONGUE_ORIGIN.clone(),
      velocity: new Phaser.Math.Vector2(TONGUE_LAUNCH_SPEED, TONGUE_UPWARD_VELOCITY),
      line,
      path: [TONGUE_ORIGIN.clone()],
      age: 0,
    };
  }

  private updateTongue(delta: number) {
    if (!this.tongue || !this.target) return;

    this.tongue.age += delta;
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
    const wobble = Math.sin(this.tongue.age * 36) * 3.5;
    this.tongue.line.clear();
    this.tongue.line.lineStyle(18, 0xd93045, 0.26);
    this.tongue.line.beginPath();
    this.tongue.line.moveTo(TONGUE_ORIGIN.x - 2, TONGUE_ORIGIN.y + 2);
    for (const point of points) this.tongue.line.lineTo(point.x, point.y + wobble * 0.25);
    this.tongue.line.strokePath();

    points.forEach((point, index) => {
      const t = index / Math.max(points.length - 1, 1);
      const radius = Phaser.Math.Linear(14, 6, t);
      const offsetY = Math.sin(index * 0.95 + this.tongue!.age * 28) * (1 - t) * 2.4;
      this.tongue!.line.fillStyle(0xff4d4d, 1);
      this.tongue!.line.fillCircle(point.x, point.y + offsetY, radius);
      this.tongue!.line.fillStyle(0xff8a80, 0.45);
      this.tongue!.line.fillCircle(point.x - radius * 0.22, point.y + offsetY - radius * 0.22, radius * 0.38);
    });

    this.tongue.line.fillStyle(0xff6b6b, 1);
    this.tongue.line.fillEllipse(this.tongue.tip.x, this.tongue.tip.y, 18, 13);
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

  private drawTargetSilhouette(target: TargetState) {
    const g = target.visual;
    const step = target.walkTime;
    const legSwing = Math.sin(step) * 15 * target.stride;
    const armSwing = Math.sin(step + Math.PI) * 8;
    const hipShift = Math.sin(step * 2) * 2;
    const shoulderTilt = Math.sin(step) * 2.5;
    const x = target.x;
    const y = target.y;

    g.clear();
    g.fillStyle(0x1a0a2e, 1);
    g.lineStyle(10, 0x1a0a2e, 1);
    g.lineBetween(x - 9 + hipShift, y + 28, x - 21 + legSwing, y + 68);
    g.lineBetween(x + 8 + hipShift, y + 28, x + 18 - legSwing, y + 68);
    g.lineStyle(7, 0x1a0a2e, 1);
    g.lineBetween(x - 13, y - 11 + shoulderTilt, x - 24 + armSwing, y + 26);
    g.lineBetween(x + 13, y - 11 - shoulderTilt, x + 24 - armSwing, y + 26);
    g.fillEllipse(x, y - 47, 30, 32);
    g.fillEllipse(x, y - 5, 38, 72);
    g.fillEllipse(x - 12 + hipShift, y + 23, 22, 36);
    g.fillEllipse(x + 12 + hipShift, y + 23, 22, 36);
    g.fillEllipse(x, y - 31, 18, 16);
    g.fillStyle(0x0f061b, 1);
    g.fillEllipse(x - 21 + legSwing, y + 70, 22, 9);
    g.fillEllipse(x + 18 - legSwing, y + 70, 22, 9);
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
    const color = judgment === 'MISS' ? '#1A0A2E' : judgment === 'CLOSE' ? '#F29E38' : '#FF4D4D';
    this.judgmentText.setText(judgment).setColor(color).setAlpha(1).setScale(0.35).setAngle(-4);
    this.tweens.add({
      targets: this.judgmentText,
      scale: 1.15,
      angle: 2,
      duration: 130,
      ease: 'Back.easeOut',
      yoyo: true,
      onComplete: () => {
        this.tweens.add({
          targets: this.judgmentText,
          scale: 0.95,
          alpha: 0,
          y: 142,
          duration: TARGET_SPAWN_TIMING - 180,
          ease: 'Bounce.easeOut',
          onComplete: () => this.judgmentText.setY(158),
        });
      },
    });
  }

  private showGameOver() {
    this.phase = 'gameOver';
    this.cleanupTarget();
    this.cleanupTongue();
    const panelBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 330, 250, 0xffffff, 0.96)
      .setStrokeStyle(4, 0xffc9a8, 1);
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 74, 'GAME OVER', {
      fontSize: '34px', fontStyle: '900', color: '#1A0A2E', stroke: '#FFFFFF', strokeThickness: 4
    }).setOrigin(0.5);
    const finalScore = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 16, `Final score: ${this.score}`, {
      fontSize: '22px', fontStyle: '800', color: '#1A0A2E'
    }).setOrigin(0.5);
    const restart = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 58, 'Tap, click, or press Space\nto restart', {
      fontSize: '18px', fontStyle: '700', color: '#B76D54', align: 'center'
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
    this.scoreText?.setText(`${this.score}`);
    this.missesText?.setText(`${this.misses}/${MAX_MISSES}`);
    this.streakText?.setText(`${this.streak}`);
  }

  private updateParallax() {
    this.skylineLayer.x = Math.sin(this.elapsed * 0.25) * 2;
    this.officeLayer.x = Math.sin(this.elapsed * 0.18) * 1.2;
  }

  private cleanupTarget() {
    this.target?.visual.destroy();
    this.target = undefined;
  }

  private cleanupTongue() {
    this.tongue?.line.destroy();
    this.tongue = undefined;
  }
}
