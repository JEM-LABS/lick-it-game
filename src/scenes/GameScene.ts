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
    back.fillGradientStyle(0xfaf4e8, 0xfaf4e8, 0xeee4d8, 0xeee4d8, 1);
    back.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.skylineLayer = this.add.container(0, 0);
    const skyline = this.add.graphics();
    skyline.fillStyle(0xcbe7f2, 1);
    skyline.fillRoundedRect(18, 100, 354, 190, 22);
    skyline.fillStyle(0x93aabd, 0.42);
    const buildings = [
      [38, 218, 28, 72], [72, 196, 34, 94], [112, 232, 24, 58], [148, 208, 38, 82],
      [198, 184, 44, 106], [250, 224, 30, 66], [292, 198, 36, 92], [334, 232, 24, 58],
    ];
    buildings.forEach(([x, y, w, h]) => {
      skyline.fillRoundedRect(x, y, w, h, 5);
      skyline.fillStyle(0xf7f1e8, 0.28);
      for (let wy = y + 10; wy < y + h - 8; wy += 16) skyline.fillRect(x + 7, wy, w - 14, 3);
      skyline.fillStyle(0x93aabd, 0.42);
    });
    this.skylineLayer.add(skyline);

    this.officeLayer = this.add.container(0, 0);
    const office = this.add.graphics();

    // Window frames, wall trim, and ceiling lights.
    office.lineStyle(6, 0xffffff, 0.96);
    office.strokeRoundedRect(18, 100, 354, 190, 22);
    office.lineStyle(3, 0xffffff, 0.86);
    office.lineBetween(106, 100, 106, 290);
    office.lineBetween(195, 100, 195, 290);
    office.lineBetween(284, 100, 284, 290);
    office.lineBetween(18, 195, 372, 195);
    office.fillStyle(0xd9cfc2, 1);
    office.fillRoundedRect(0, 304, GAME_WIDTH, 9, 4);
    office.fillRoundedRect(0, 632, GAME_WIDTH, 12, 6);
    office.fillStyle(0xffffff, 0.82);
    office.fillRoundedRect(46, 50, 104, 12, 6);
    office.fillRoundedRect(240, 50, 104, 12, 6);
    office.fillStyle(0xf4d991, 0.18);
    office.fillEllipse(98, 76, 140, 52);
    office.fillEllipse(292, 76, 140, 52);

    // Carpet floor with perspective lines.
    office.fillStyle(0xd6cfc2, 1);
    office.fillRect(0, 644, GAME_WIDTH, 200);
    office.lineStyle(2, 0xc8bcaf, 0.5);
    for (let y = 676; y < GAME_HEIGHT; y += 34) office.lineBetween(0, y, GAME_WIDTH, y);
    for (let x = -10; x < GAME_WIDTH + 30; x += 52) office.lineBetween(x, 644, x - 42, GAME_HEIGHT);

    // Rear cubicle banks and desks are pushed to the sides so the target lane remains clean.
    office.fillStyle(0xd6dbdf, 1);
    office.fillRoundedRect(8, 342, 126, 100, 12);
    office.fillRoundedRect(258, 326, 124, 102, 12);
    office.fillStyle(0xc1c9cf, 1);
    office.fillRoundedRect(20, 352, 102, 12, 6);
    office.fillRoundedRect(270, 336, 100, 12, 6);
    office.fillStyle(0xdabf91, 1);
    office.fillRoundedRect(24, 418, 100, 18, 9);
    office.fillRoundedRect(274, 402, 96, 18, 9);
    office.fillStyle(0x3f4b56, 0.82);
    office.fillRoundedRect(50, 382, 38, 25, 5);
    office.fillRoundedRect(304, 364, 38, 25, 5);
    office.fillStyle(0x9cd8e9, 0.9);
    office.fillRoundedRect(56, 387, 26, 14, 3);
    office.fillRoundedRect(310, 369, 26, 14, 3);
    office.fillStyle(0x515b65, 0.72);
    office.fillRoundedRect(92, 426, 42, 46, 14);
    office.fillRoundedRect(238, 410, 44, 46, 14);
    office.fillStyle(0x303941, 0.5);
    office.fillRoundedRect(102, 464, 22, 8, 4);
    office.fillRoundedRect(248, 448, 24, 8, 4);

    // Edge props: water cooler, plants, poster, and filing cabinet.
    office.fillStyle(0xaed9e8, 1);
    office.fillRoundedRect(20, 282, 34, 72, 11);
    office.fillStyle(0xf9feff, 0.95);
    office.fillCircle(37, 292, 17);
    office.fillStyle(0x7db48b, 1);
    office.fillRoundedRect(328, 282, 10, 38, 5);
    office.fillCircle(316, 290, 14);
    office.fillCircle(340, 286, 14);
    office.fillCircle(331, 275, 12);
    office.fillStyle(0xc9905f, 1);
    office.fillRoundedRect(318, 318, 30, 20, 5);
    office.fillStyle(0xcf7566, 1);
    office.fillRoundedRect(69, 284, 78, 54, 7);
    office.fillStyle(0xfff9e8, 1);
    office.fillRoundedRect(76, 291, 64, 40, 5);
    office.fillStyle(0x6b7780, 0.82);
    office.fillRect(88, 305, 42, 4);
    office.fillRect(95, 317, 30, 4);
    office.fillStyle(0xa5afb7, 1);
    office.fillRoundedRect(306, 470, 56, 116, 9);
    office.lineStyle(2, 0x87939b, 0.85);
    office.lineBetween(306, 508, 362, 508);
    office.lineBetween(306, 546, 362, 546);
    office.fillStyle(0x74818a, 0.85);
    office.fillRoundedRect(330, 490, 10, 3, 2);
    office.fillRoundedRect(330, 528, 10, 3, 2);
    office.fillRoundedRect(330, 566, 10, 3, 2);

    // Low foreground office shapes give depth without covering play.
    office.fillStyle(0xdabf91, 0.95);
    office.fillRoundedRect(190, 706, 182, 44, 14);
    office.fillStyle(0x48535d, 0.38);
    office.fillRoundedRect(222, 674, 42, 40, 13);
    office.fillRoundedRect(302, 674, 42, 40, 13);
    office.fillStyle(0xd6dbdf, 0.88);
    office.fillRoundedRect(206, 596, 144, 58, 11);
    office.fillStyle(0xc1c9cf, 0.96);
    office.fillRoundedRect(216, 606, 124, 10, 5);
    office.fillStyle(0xdabf91, 0.9);
    office.fillRoundedRect(202, 642, 152, 18, 9);

    this.officeLayer.add(office);
  }

  private drawPlayerDesk() {
    const deskBack = this.add.graphics();
    deskBack.fillStyle(0x000000, 0.12);
    deskBack.fillEllipse(78, 750, 166, 28);
    deskBack.fillStyle(0xd39156, 1);
    deskBack.fillRoundedRect(0, 566, 162, 124, 18);
    deskBack.fillStyle(0xab673f, 1);
    deskBack.fillRoundedRect(0, 566, 170, 23, 12);
    deskBack.fillStyle(0x2d3a4a, 1);
    deskBack.fillRoundedRect(48, 572, 58, 38, 6);
    deskBack.fillStyle(0x9dd8ea, 1);
    deskBack.fillRoundedRect(55, 579, 44, 24, 4);
    deskBack.fillStyle(0x2d3a4a, 1);
    deskBack.fillRoundedRect(70, 610, 16, 8, 3);
    deskBack.fillStyle(0xf0d1b5, 1);
    deskBack.fillRoundedRect(40, 621, 68, 13, 6);
    deskBack.fillStyle(0xfff1d6, 1);
    deskBack.fillRoundedRect(116, 594, 20, 26, 6);
    deskBack.fillStyle(0x8c5334, 0.28);
    deskBack.fillRoundedRect(119, 599, 25, 12, 6);
    deskBack.fillStyle(0xfff9ee, 1);
    deskBack.fillRoundedRect(20, 598, 46, 28, 5);
    deskBack.fillRoundedRect(34, 606, 48, 28, 5);
    deskBack.fillStyle(0xb7c1c8, 1);
    deskBack.fillRect(27, 607, 28, 3);
    deskBack.fillRect(41, 616, 30, 3);

    this.playerTorso = this.add.graphics();
    this.playerEyes = this.add.graphics();
    this.drawPlayer(0);

    const deskFront = this.add.graphics();
    deskFront.fillStyle(0xe29b60, 1);
    deskFront.fillRoundedRect(0, 628, 170, 128, 18);
    deskFront.fillStyle(0xb66f45, 0.34);
    deskFront.fillRoundedRect(18, 656, 48, 72, 9);
    deskFront.fillRoundedRect(88, 656, 48, 72, 9);
    deskFront.fillStyle(0xffc37e, 0.28);
    deskFront.fillRoundedRect(12, 638, 138, 8, 4);
  }

  private drawPlayer(recoil: number) {
    this.playerTorso.clear();
    this.playerEyes.clear();
    const recoilX = -recoil;
    this.playerTorso.fillStyle(0x000000, 0.12);
    this.playerTorso.fillEllipse(78 + recoilX, PLAYER_Y + 36, 78, 22);
    this.playerTorso.fillStyle(0x5a4fcf, 1);
    this.playerTorso.fillRoundedRect(39 + recoilX, PLAYER_Y - 18, 76, 66, 22);
    this.playerTorso.fillStyle(0x4439a5, 1);
    this.playerTorso.fillRoundedRect(50 + recoilX, PLAYER_Y + 8, 54, 38, 16);
    this.playerTorso.fillStyle(0xf1b28f, 1);
    this.playerTorso.fillCircle(77 + recoilX, PLAYER_Y - 58, 32);
    this.playerTorso.fillStyle(0x3f241e, 1);
    this.playerTorso.fillCircle(58 + recoilX, PLAYER_Y - 77, 14);
    this.playerTorso.fillCircle(76 + recoilX, PLAYER_Y - 84, 16);
    this.playerTorso.fillCircle(94 + recoilX, PLAYER_Y - 76, 15);
    this.playerEyes.fillStyle(0xffffff, 1);
    this.playerEyes.fillCircle(65 + recoilX, PLAYER_Y - 60, 8);
    this.playerEyes.fillCircle(88 + recoilX, PLAYER_Y - 60, 8);
    this.playerEyes.fillStyle(0x1a0a2e, 1);
    this.playerEyes.fillCircle(69 + recoilX, PLAYER_Y - 59, 3.5);
    this.playerEyes.fillCircle(92 + recoilX, PLAYER_Y - 59, 3.5);
    this.playerEyes.lineStyle(3, 0x3f241e, 1);
    this.playerEyes.lineBetween(58 + recoilX, PLAYER_Y - 72, 72 + recoilX, PLAYER_Y - 68);
    this.playerEyes.lineBetween(82 + recoilX, PLAYER_Y - 68, 98 + recoilX, PLAYER_Y - 72);
  }

  private createUi() {
    const cardStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '18px',
      fontStyle: '900',
      color: '#1A0A2E',
    };
    this.drawUiCard(12, 16, 100, 50, 'SCORE');
    this.drawUiCard(145, 16, 100, 50, 'MISSES');
    this.drawUiCard(278, 16, 100, 50, 'STREAK');
    this.scoreText = this.add.text(62, 42, '', cardStyle).setOrigin(0.5);
    this.missesText = this.add.text(195, 42, '', cardStyle).setOrigin(0.5);
    this.streakText = this.add.text(328, 42, '', cardStyle).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 98, 'LICK IT', {
      fontSize: '42px',
      fontStyle: '900',
      color: '#1A0A2E',
      stroke: '#FFFFFF',
      strokeThickness: 7,
      shadow: { offsetX: 0, offsetY: 4, color: '#000000', blur: 0, fill: true },
    }).setOrigin(0.5);
    this.judgmentText = this.add.text(GAME_WIDTH / 2, 158, '', {
      fontSize: '48px',
      fontStyle: '900',
      color: '#FF4D4D',
      stroke: '#FFFFFF',
      strokeThickness: 8,
    }).setOrigin(0.5).setAlpha(0);
    this.hintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 54, 'Tap, click, or press Space when the walk lines up', {
      fontSize: '15px',
      fontStyle: '800',
      color: '#1A0A2E',
      align: 'center',
      wordWrap: { width: 330 },
    }).setOrigin(0.5).setAlpha(0.76);
    this.updateUi();
  }

  private drawUiCard(x: number, y: number, width: number, height: number, label: string) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.12);
    g.fillRoundedRect(x + 3, y + 5, width, height, 16);
    g.fillStyle(0xffffff, 0.94);
    g.fillRoundedRect(x, y, width, height, 16);
    g.lineStyle(3, 0xffc7a0, 0.95);
    g.strokeRoundedRect(x, y, width, height, 16);
    g.fillStyle(0xffefe4, 0.95);
    g.fillRoundedRect(x + 6, y + 6, width - 12, 15, 8);
    this.add.text(x + width / 2, y + 13, label, {
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
    this.tongue.line.clear();

    // Soft shadow/elastic body with a chunky base and tapered, glossy tip.
    this.tongue.line.fillStyle(0xb9273c, 0.24);
    this.tongue.line.fillCircle(TONGUE_ORIGIN.x - 4, TONGUE_ORIGIN.y + 4, 18);
    points.forEach((point, index) => {
      const t = index / Math.max(points.length - 1, 1);
      const radius = Phaser.Math.Linear(16, 5.5, t);
      const wobble = Math.sin(index * 1.1 + this.tongue!.age * 30) * (1 - t) * 4;
      this.tongue!.line.fillStyle(0xff4d4d, 1);
      this.tongue!.line.fillCircle(point.x, point.y + wobble, radius);
      this.tongue!.line.fillStyle(0xff8a80, 0.42);
      this.tongue!.line.fillCircle(point.x - radius * 0.25, point.y + wobble - radius * 0.25, radius * 0.38);
    });

    this.tongue.line.lineStyle(5, 0xffb0a8, 0.42);
    this.tongue.line.beginPath();
    this.tongue.line.moveTo(TONGUE_ORIGIN.x, TONGUE_ORIGIN.y - 3);
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i];
      const wobble = Math.sin(i * 1.1 + this.tongue.age * 30) * 1.8;
      this.tongue.line.lineTo(point.x, point.y - 3 + wobble);
    }
    this.tongue.line.strokePath();
    this.tongue.line.fillStyle(0xff6b6b, 1);
    this.tongue.line.fillEllipse(this.tongue.tip.x, this.tongue.tip.y, 20, 14);
    this.tongue.line.fillStyle(0xffc1b8, 0.55);
    this.tongue.line.fillEllipse(this.tongue.tip.x - 4, this.tongue.tip.y - 3, 7, 4);
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
    const legSwing = Math.sin(step) * 17 * target.stride;
    const backLegSwing = Math.sin(step + Math.PI) * 14 * target.stride;
    const armSwing = Math.sin(step + Math.PI) * 9;
    const hipShift = Math.sin(step * 2) * 3;
    const shoulderTilt = Math.sin(step) * 3;
    const x = target.x;
    const y = target.y;

    g.clear();
    g.fillStyle(0x000000, 0.16);
    g.fillEllipse(x, y + 76, 72, 13);
    g.fillStyle(0x12061f, 1);
    g.lineStyle(11, 0x12061f, 1);
    g.lineBetween(x - 10 + hipShift, y + 30, x - 23 + legSwing, y + 70);
    g.lineBetween(x + 11 + hipShift, y + 30, x + 23 + backLegSwing, y + 70);
    g.lineStyle(7, 0x12061f, 1);
    g.lineBetween(x - 14, y - 13 + shoulderTilt, x - 26 + armSwing, y + 25);
    g.lineBetween(x + 14, y - 13 - shoulderTilt, x + 26 - armSwing, y + 25);
    g.fillEllipse(x, y - 50, 28, 33);
    g.fillEllipse(x + 1, y - 8, 34, 68);
    g.fillEllipse(x - 13 + hipShift, y + 23, 25, 39);
    g.fillEllipse(x + 14 + hipShift, y + 23, 25, 39);
    g.fillEllipse(x - 9, y - 24, 17, 22);
    g.fillEllipse(x + 10, y - 24, 17, 22);
    g.fillStyle(0x08030e, 1);
    g.fillEllipse(x - 23 + legSwing, y + 72, 24, 9);
    g.fillEllipse(x + 23 + backLegSwing, y + 72, 24, 9);
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
