import Phaser from 'phaser';
import type {
  SceneStageSnapshot,
  SceneStageSpotViewModel,
  SceneStageVisual,
} from './sceneStageModel';

const worldWidth = 1200;
const worldHeight = 675;
const backgroundBleedX = 44;
const backgroundWidth = worldWidth + backgroundBleedX * 2;
const backgroundHeight = backgroundWidth * (9 / 16);
const backgroundBleedY = (backgroundHeight - worldHeight) / 2;
const backgroundKey = 'investigation-office-background';
const maximumLookX = 26;
const maximumLookY = 9;

export type SceneStageIntent = {
  type: 'examine-spot';
  spotId: string;
};

export type SceneStageCue = {
  type: 'spot-examined';
  spotId: string;
  evidenceName?: string;
  newlyAvailableSpotIds: readonly string[];
};

interface SceneStageCallbacks {
  onIntent: (intent: SceneStageIntent) => void;
}

interface AmbientNodes {
  sources: AudioScheduledSourceNode[];
  gain: GainNode;
}

interface HotspotDisplay {
  container: Phaser.GameObjects.Container;
  marker: Phaser.GameObjects.Shape;
  x: number;
  y: number;
  fixed: boolean;
}

type ViewMode = 'entering' | 'overview' | 'focused' | 'returning';

class InvestigationScene extends Phaser.Scene {
  private snapshot?: SceneStageSnapshot;
  private readonly onIntent: SceneStageCallbacks['onIntent'];
  private readonly reducedMotion: boolean;
  private readonly coarsePointer: boolean;
  private readonly visual?: SceneStageVisual;
  private ready = false;
  private busy = false;
  private backgroundLoadFailed = false;
  private viewMode: ViewMode = 'entering';
  private sceneLayer?: Phaser.GameObjects.Container;
  private hotspotLayer?: Phaser.GameObjects.Container;
  private foregroundLayer?: Phaser.GameObjects.Container;
  private offsiteLayer?: Phaser.GameObjects.Container;
  private instruction?: Phaser.GameObjects.Text;
  private hotspotTweens: Phaser.Tweens.Tween[] = [];
  private readonly hotspotDisplays = new Map<string, HotspotDisplay>();
  private lookTargetX = 0;
  private lookTargetY = 0;
  private lookCurrentX = 0;
  private lookCurrentY = 0;
  private audioEnabled = false;
  private ambientNodes?: AmbientNodes;

  constructor(
    callbacks: SceneStageCallbacks,
    reducedMotion: boolean,
    visual?: SceneStageVisual,
  ) {
    super('investigation-stage');
    this.onIntent = callbacks.onIntent;
    this.reducedMotion = reducedMotion;
    this.coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    this.visual = visual;
  }

  preload(): void {
    if (!this.visual?.backgroundUrl) return;
    this.load.once('loaderror', (file: { key?: string }) => {
      if (file.key === backgroundKey) this.backgroundLoadFailed = true;
    });
    this.load.image(backgroundKey, this.visual.backgroundUrl);
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);
    this.createPerspectiveStage();
    this.installLookControls();
    this.ready = true;
    this.renderSnapshot();
    this.playEntrance();
  }

  update(_time: number, delta: number): void {
    if (this.viewMode !== 'overview') return;
    const interpolation = 1 - Math.exp(-delta * 0.008);
    this.lookCurrentX += (this.lookTargetX - this.lookCurrentX) * interpolation;
    this.lookCurrentY += (this.lookTargetY - this.lookCurrentY) * interpolation;
    this.applyLook();
  }

  setSnapshot(snapshot: SceneStageSnapshot): void {
    this.snapshot = snapshot;
    this.renderSnapshot();
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    if (busy) this.resetLook(false);
  }

  setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;
    if (enabled) this.startAmbient();
    else this.stopAmbient();
  }

  playCue(cue: SceneStageCue): void {
    if (!this.ready || !this.snapshot) return;
    const display = this.hotspotDisplays.get(cue.spotId);
    if (!display) return;
    const ring = this.add
      .circle(display.x, display.y, 26, 0x8fc7ff, 0.08)
      .setStrokeStyle(3, 0xb9dcff, 0.95)
      .setDepth(62);
    if (display.fixed) ring.setScrollFactor(0);
    const notice = this.add
      .text(
        display.x,
        Math.max(48, display.y - 54),
        cue.evidenceName ? `증거 확보 · ${cue.evidenceName}` : '조사 기록 갱신',
        {
          color: '#f1f7ff',
          fontFamily: 'Pretendard, Arial, sans-serif',
          fontSize: '16px',
          fontStyle: 'bold',
          backgroundColor: '#071019e8',
          padding: { x: 12, y: 7 },
          align: 'center',
          wordWrap: { width: 310 },
        },
      )
      .setOrigin(0.5)
      .setDepth(63);
    if (display.fixed) notice.setScrollFactor(0);

    if (this.reducedMotion) {
      this.time.delayedCall(900, () => {
        ring.destroy();
        notice.destroy();
      });
    } else {
      this.tweens.add({
        targets: ring,
        scale: 2.1,
        alpha: 0,
        duration: 720,
        ease: 'Cubic.Out',
        onComplete: () => ring.destroy(),
      });
      this.tweens.add({
        targets: notice,
        y: notice.y - 14,
        alpha: 0,
        delay: 520,
        duration: 720,
        ease: 'Sine.In',
        onComplete: () => notice.destroy(),
      });
    }
    for (const spotId of cue.newlyAvailableSpotIds) this.flashNewSpot(spotId);
    this.playTone(660, 0.09);
  }

  shutdownAudio(): void {
    this.stopAmbient();
  }

  private createPerspectiveStage(): void {
    this.add.rectangle(0, 0, worldWidth, worldHeight, 0x05080c).setOrigin(0);
    this.sceneLayer = this.add.container(0, 0).setDepth(1);

    if (
      !this.backgroundLoadFailed &&
      this.visual?.backgroundUrl &&
      this.textures.exists(backgroundKey)
    ) {
      const background = this.add
        .image(worldWidth / 2, worldHeight / 2, backgroundKey)
        .setDisplaySize(backgroundWidth, backgroundHeight);
      this.sceneLayer.add(background);
    } else {
      this.drawFallbackOffice(this.sceneLayer);
    }

    const blueWash = this.add
      .rectangle(0, 0, worldWidth, worldHeight, 0x071321, 0.12)
      .setOrigin(0);
    this.sceneLayer.add(blueWash);
    this.createRainLayer(this.sceneLayer);

    this.hotspotLayer = this.add.container(0, 0).setDepth(18);
    this.sceneLayer.add(this.hotspotLayer);
    this.foregroundLayer = this.createForegroundLayer();
    this.offsiteLayer = this.add.container(0, 0).setDepth(70).setScrollFactor(0);

    this.instruction = this.add
      .text(
        24,
        22,
        this.coarsePointer
          ? '화면을 드래그하거나 아래 목록으로 조사하세요'
          : '마우스를 움직여 현장을 둘러보세요',
        {
          color: '#a9bfd1',
          fontFamily: 'Pretendard, Arial, sans-serif',
          fontSize: '14px',
          backgroundColor: '#071019b8',
          padding: { x: 10, y: 6 },
        },
      )
      .setDepth(75)
      .setScrollFactor(0)
      .setAlpha(0);

    this.add
      .rectangle(0, 0, worldWidth, 36, 0x020406, 0.34)
      .setOrigin(0)
      .setDepth(55)
      .setScrollFactor(0);
    this.add
      .rectangle(0, worldHeight - 50, worldWidth, 50, 0x020406, 0.46)
      .setOrigin(0)
      .setDepth(55)
      .setScrollFactor(0);
  }

  private drawFallbackOffice(layer: Phaser.GameObjects.Container): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x0a1119, 1).fillRect(0, 0, worldWidth, worldHeight);
    graphics.fillStyle(0x1e3446, 0.9).fillRect(330, 95, 560, 260);
    graphics.fillStyle(0x88a9bd, 0.26).fillRect(344, 109, 532, 232);
    graphics.lineStyle(5, 0x101b25, 1);
    graphics.lineBetween(520, 109, 520, 341);
    graphics.lineBetween(700, 109, 700, 341);
    graphics.fillStyle(0x11171d, 1).fillRect(560, 345, 400, 190);
    graphics.fillStyle(0x161d24, 1).fillRect(950, 120, 180, 380);
    graphics.fillStyle(0x070b0f, 1).fillRect(80, 160, 170, 340);
    graphics.fillStyle(0x06090d, 0.9).fillTriangle(0, 0, 165, 0, 0, worldHeight);
    graphics.fillTriangle(worldWidth, 0, worldWidth - 165, 0, worldWidth, worldHeight);
    layer.add(graphics);
  }

  private createRainLayer(layer: Phaser.GameObjects.Container): void {
    if (this.reducedMotion) return;
    const rain = this.add.container(0, 0).setAlpha(0.24);
    for (let index = 0; index < 26; index += 1) {
      const x = 344 + ((index * 79) % 520);
      const y = 118 + ((index * 47) % 205);
      const length = 10 + (index % 4) * 5;
      rain.add(this.add.line(0, 0, x, y, x - 3, y + length, 0xb8d5e8, 0.2));
    }
    layer.add(rain);
    this.tweens.add({
      targets: rain,
      y: 28,
      alpha: { from: 0.12, to: 0.28 },
      duration: 1450,
      repeat: -1,
      ease: 'Linear',
    });
  }

  private createForegroundLayer(): Phaser.GameObjects.Container {
    const layer = this.add.container(0, 0).setDepth(48);
    const leftEdge = this.add.rectangle(0, 0, 42, worldHeight, 0x010204, 0.38).setOrigin(0);
    const rightEdge = this.add
      .rectangle(worldWidth - 42, 0, 42, worldHeight, 0x010204, 0.38)
      .setOrigin(0);
    const topEdge = this.add.rectangle(0, 0, worldWidth, 22, 0x010204, 0.28).setOrigin(0);
    layer.add([leftEdge, rightEdge, topEdge]);
    return layer;
  }

  private installLookControls(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.viewMode !== 'overview' || this.busy) return;
      const horizontal = Phaser.Math.Clamp(pointer.x / worldWidth, 0, 1) * 2 - 1;
      const vertical = Phaser.Math.Clamp(pointer.y / worldHeight, 0, 1) * 2 - 1;
      this.lookTargetX = Math.abs(horizontal) < 0.08 ? 0 : horizontal;
      this.lookTargetY = Math.abs(vertical) < 0.12 ? 0 : vertical;
    });
    this.input.on('gameout', () => this.resetLook(false));
  }

  private playEntrance(): void {
    if (!this.sceneLayer || !this.foregroundLayer) return;
    if (this.reducedMotion) {
      this.viewMode = 'overview';
      this.instruction?.setAlpha(0.8);
      return;
    }

    this.viewMode = 'entering';
    this.sceneLayer.setPosition(-worldWidth * 0.04, -worldHeight * 0.04).setScale(1.08);
    const leftDoor = this.add
      .rectangle(0, 0, worldWidth * 0.51, worldHeight, 0x020304, 0.98)
      .setOrigin(0)
      .setDepth(100);
    const rightDoor = this.add
      .rectangle(worldWidth * 0.49, 0, worldWidth * 0.51, worldHeight, 0x020304, 0.98)
      .setOrigin(0)
      .setDepth(100);
    this.cameras.main.fadeIn(420, 0, 0, 0);
    this.tweens.add({
      targets: this.sceneLayer,
      x: 0,
      y: 0,
      scale: 1,
      duration: 1250,
      ease: 'Cubic.easeOut',
    });
    this.tweens.add({
      targets: leftDoor,
      x: -worldWidth * 0.49,
      duration: 1050,
      ease: 'Cubic.easeInOut',
      onComplete: () => leftDoor.destroy(),
    });
    this.tweens.add({
      targets: rightDoor,
      x: worldWidth,
      duration: 1050,
      ease: 'Cubic.easeInOut',
      onComplete: () => rightDoor.destroy(),
    });
    this.time.delayedCall(1300, () => {
      this.viewMode = 'overview';
      this.tweens.add({
        targets: this.instruction,
        alpha: 0.8,
        duration: 400,
        yoyo: true,
        hold: 2200,
        onComplete: () => this.instruction?.setAlpha(0.34),
      });
    });
  }

  private applyLook(): void {
    if (!this.sceneLayer || !this.foregroundLayer) return;
    this.sceneLayer.setPosition(
      -this.lookCurrentX * maximumLookX,
      -this.lookCurrentY * maximumLookY,
    );
    this.foregroundLayer.setPosition(
      -this.lookCurrentX * maximumLookX * 1.45,
      -this.lookCurrentY * maximumLookY * 1.25,
    );
  }

  private resetLook(immediate: boolean): void {
    this.lookTargetX = 0;
    this.lookTargetY = 0;
    if (!immediate) return;
    this.lookCurrentX = 0;
    this.lookCurrentY = 0;
    this.applyLook();
  }

  private renderSnapshot(): void {
    if (
      !this.ready ||
      !this.snapshot ||
      !this.hotspotLayer ||
      !this.offsiteLayer
    ) {
      return;
    }
    for (const tween of this.hotspotTweens) tween.destroy();
    this.hotspotTweens = [];
    this.hotspotDisplays.clear();
    this.hotspotLayer.removeAll(true);
    this.offsiteLayer.removeAll(true);

    const roomSpots = this.snapshot.spots.filter((spot) => spot.zone === 'room');
    const offsiteSpots = this.snapshot.spots.filter((spot) => spot.zone === 'offsite');
    for (const spot of roomSpots) this.createRoomHotspot(spot);
    this.createOffsiteRail(offsiteSpots);
  }

  private createRoomHotspot(spot: SceneStageSpotViewModel): void {
    if (!this.hotspotLayer || !this.snapshot) return;
    const x = this.backgroundX(spot.x);
    const y = this.backgroundY(spot.y);
    const examined = spot.status === 'examined';
    const marker = this.add
      .circle(0, 0, examined ? 8 : 12, examined ? 0x263746 : 0x10283a, examined ? 0.58 : 0.7)
      .setStrokeStyle(2, examined ? 0x6b8498 : 0xa9d5f5, examined ? 0.36 : 0.9);
    const center = this.add.circle(0, 0, examined ? 2 : 3, examined ? 0x7891a5 : 0xcce8ff, 0.94);
    const label = this.add
      .text(0, 24, spot.label, {
        color: examined ? '#8294a3' : '#edf7ff',
        fontFamily: 'Pretendard, Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        backgroundColor: '#061019e8',
        padding: { x: 8, y: 5 },
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setAlpha(examined ? 0.48 : 0);
    const container = this.add.container(x, y, [marker, center, label]);
    this.hotspotLayer.add(container);
    this.hotspotDisplays.set(spot.id, { container, marker, x, y, fixed: false });

    if (examined || !this.snapshot.interactive) return;
    const hitSize = this.coarsePointer ? 156 : 60;
    const hitTarget = this.add
      .zone(0, 0, hitSize, hitSize)
      .setInteractive({ useHandCursor: true });
    container.addAt(hitTarget, 0);
    hitTarget.on('pointerover', () => {
      if (!this.canInteract(spot)) return;
      this.tweens.killTweensOf([container, label]);
      marker.setFillStyle(0x26648d, 0.9);
      this.tweens.add({ targets: container, scale: 1.12, duration: 130 });
      this.tweens.add({ targets: label, alpha: 1, duration: 130 });
      this.playTone(300, 0.018);
    });
    hitTarget.on('pointerout', () => {
      marker.setFillStyle(0x10283a, 0.7);
      this.tweens.killTweensOf([container, label]);
      this.tweens.add({ targets: container, scale: 1, duration: 130 });
      this.tweens.add({ targets: label, alpha: 0, duration: 160 });
    });
    hitTarget.on('pointerdown', () => this.activateSpot(spot));

    if (!this.reducedMotion) {
      const pulse = this.tweens.add({
        targets: marker,
        scale: 1.32,
        alpha: 0.44,
        duration: 1050,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      this.hotspotTweens.push(pulse);
    }
  }

  private createOffsiteRail(spots: readonly SceneStageSpotViewModel[]): void {
    if (!this.offsiteLayer || spots.length === 0) return;
    const title = this.add.text(24, worldHeight - 34, '외부 조사', {
      color: '#8198aa',
      fontFamily: 'Pretendard, Arial, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
    });
    this.offsiteLayer.add(title);

    spots.forEach((spot, index) => {
      const x = 118 + index * 174;
      const y = worldHeight - 28;
      const examined = spot.status === 'examined';
      const marker = this.add
        .rectangle(0, 0, 156, 30, examined ? 0x111820 : 0x10283a, examined ? 0.62 : 0.84)
        .setStrokeStyle(1, examined ? 0x435564 : 0x668eaa, examined ? 0.38 : 0.8);
      const label = this.add
        .text(0, 0, examined ? `✓ ${spot.label}` : spot.label, {
          color: examined ? '#718392' : '#c3d9e9',
          fontFamily: 'Pretendard, Arial, sans-serif',
          fontSize: '12px',
        })
        .setOrigin(0.5);
      const container = this.add.container(x, y, [marker, label]);
      this.offsiteLayer?.add(container);
      this.hotspotDisplays.set(spot.id, { container, marker, x, y, fixed: true });

      if (examined || !this.snapshot?.interactive) return;
      const hitTarget = this.add
        .zone(0, 0, 168, this.coarsePointer ? 156 : 48)
        .setInteractive({ useHandCursor: true });
      container.addAt(hitTarget, 0);
      hitTarget.on('pointerover', () => {
        if (this.canInteract(spot)) marker.setFillStyle(0x1c4b69, 0.96);
      });
      hitTarget.on('pointerout', () => marker.setFillStyle(0x10283a, 0.84));
      hitTarget.on('pointerdown', () => this.activateSpot(spot));
    });
  }

  private canInteract(spot: SceneStageSpotViewModel): boolean {
    return Boolean(
      this.snapshot?.interactive &&
        spot.status !== 'examined' &&
        !this.busy &&
        this.viewMode === 'overview',
    );
  }

  private activateSpot(spot: SceneStageSpotViewModel): void {
    if (!this.canInteract(spot)) return;
    this.viewMode = 'focused';
    this.resetLook(true);
    const display = this.hotspotDisplays.get(spot.id);
    if (!display) {
      this.viewMode = 'overview';
      return;
    }

    if (!this.reducedMotion && !display.fixed) {
      this.cameras.main.pan(
        display.x,
        display.y,
        380,
        Phaser.Math.Easing.Sine.Out,
        true,
      );
      this.cameras.main.zoomTo(
        spot.focusZoom,
        380,
        Phaser.Math.Easing.Sine.Out,
        true,
      );
    }
    this.playTone(420, 0.045);
    this.onIntent({ type: 'examine-spot', spotId: spot.id });

    const focusDuration = this.reducedMotion || display.fixed ? 120 : 1080;
    this.time.delayedCall(focusDuration, () => this.returnToOverview());
  }

  private returnToOverview(): void {
    if (this.reducedMotion) {
      this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);
      this.cameras.main.setZoom(1);
      this.viewMode = 'overview';
      return;
    }
    this.viewMode = 'returning';
    this.cameras.main.pan(
      worldWidth / 2,
      worldHeight / 2,
      520,
      Phaser.Math.Easing.Sine.InOut,
      true,
    );
    this.cameras.main.zoomTo(1, 520, Phaser.Math.Easing.Sine.InOut, true);
    this.time.delayedCall(540, () => {
      this.viewMode = 'overview';
    });
  }

  private flashNewSpot(spotId: string): void {
    const display = this.hotspotDisplays.get(spotId);
    if (!display) return;
    if (this.reducedMotion) {
      display.marker.setAlpha(1);
      return;
    }
    this.tweens.add({
      targets: display.container,
      scale: 1.45,
      duration: 230,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.Out',
    });
  }

  private backgroundX(ratio: number): number {
    return -backgroundBleedX + ratio * backgroundWidth;
  }

  private backgroundY(ratio: number): number {
    return -backgroundBleedY + ratio * backgroundHeight;
  }

  private webAudioContext(): AudioContext | undefined {
    if (!(this.sound instanceof Phaser.Sound.WebAudioSoundManager)) return;
    return this.sound.context;
  }

  private playTone(frequency: number, volume: number): void {
    if (!this.audioEnabled) return;
    const context = this.webAudioContext();
    if (!context) return;
    void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.17);
  }

  private startAmbient(): void {
    if (this.ambientNodes) return;
    const context = this.webAudioContext();
    if (!context) return;
    void context.resume();
    const gain = context.createGain();
    gain.gain.value = 0.018;
    gain.connect(context.destination);

    const hum = context.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 58;
    hum.connect(gain);
    hum.start();

    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 1337;
    for (let index = 0; index < data.length; index += 1) {
      seed = (seed * 16807) % 2147483647;
      data[index] = (seed / 2147483647) * 2 - 1;
    }
    const rain = context.createBufferSource();
    rain.buffer = buffer;
    rain.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2800;
    const rainGain = context.createGain();
    rainGain.gain.value = 0.42;
    rain.connect(filter).connect(rainGain).connect(gain);
    rain.start();

    this.ambientNodes = { sources: [hum, rain], gain };
  }

  private stopAmbient(): void {
    if (!this.ambientNodes) return;
    for (const source of this.ambientNodes.sources) source.stop();
    this.ambientNodes.gain.disconnect();
    this.ambientNodes = undefined;
  }
}

export class PhaserSceneStage {
  private readonly game: Phaser.Game;
  private readonly scene: InvestigationScene;
  private readonly resizeObserver: ResizeObserver;
  private resizeFrame?: number;
  private destroyed = false;
  private active = true;
  private audioEnabled = false;

  constructor(
    host: HTMLElement,
    callbacks: SceneStageCallbacks,
    visual?: SceneStageVisual,
  ) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.scene = new InvestigationScene(callbacks, reducedMotion, visual);
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: worldWidth,
      height: worldHeight,
      backgroundColor: '#05080c',
      banner: false,
      powerPreference: 'low-power',
      antialias: true,
      scene: [this.scene],
      fps: { target: 30, limit: 30 },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });
    this.resizeObserver = new ResizeObserver(() => {
      if (this.destroyed) return;
      if (this.resizeFrame !== undefined) window.cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = window.requestAnimationFrame(() => {
        if (!this.destroyed) this.game.scale.refresh();
      });
    });
    this.resizeObserver.observe(host);
  }

  update(snapshot: SceneStageSnapshot): void {
    this.scene.setSnapshot(snapshot);
  }

  play(cue: SceneStageCue): void {
    this.scene.playCue(cue);
  }

  setActive(active: boolean): void {
    this.active = active;
    if (active) {
      this.game.loop.wake();
      this.scene.setAudioEnabled(this.audioEnabled);
    } else {
      this.scene.setAudioEnabled(false);
      this.game.loop.sleep();
    }
  }

  setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;
    this.scene.setAudioEnabled(enabled && this.active);
  }

  setBusy(busy: boolean): void {
    this.scene.setBusy(busy);
    this.game.loop.setFPSLimit(busy ? 10 : 30);
  }

  refresh(): void {
    if (!this.destroyed) this.game.scale.refresh();
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver.disconnect();
    if (this.resizeFrame !== undefined) window.cancelAnimationFrame(this.resizeFrame);
    this.scene.shutdownAudio();
    this.game.loop.wake();
    this.game.destroy(true, false);
  }
}
