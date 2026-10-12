// Paper Tide - Main Game Engine
import {
  GameState, Scene, Face, Creature, Particle, Vec2, Vec3,
  WeatherType, TimeOfDay, CreatureType, CreatureMood,
  PAPER_COLORS, TUNABLE, FoldStep
} from './types';
import {
  SeededRNG, v2Dist, v2Sub, v2Norm, v2Scale, v2Add, v2Lerp,
  pointToLineDist, splitPolygon, generateName, clamp, easeOutElastic, noise2D
} from './utils';
import { patterns, getPattern, getUnlockedPatterns } from './patterns';
import { renderPaper, renderDesk, renderDiorama, renderTitle } from './renderer';
import { audio } from './audio';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState;
  private time = 0;
  private lastTime = 0;
  private particles: Particle[] = [];
  private animFrame = 0;
  private rng: SeededRNG;
  private mousePos: Vec2 = { x: 0, y: 0 };
  private isDragging = false;
  private dragStart: Vec2 = { x: 0, y: 0 };
  private foldStartPos: Vec2 | null = null;
  private hoveredCreature: string | null = null;
  private dragCreature: string | null = null;
  private sunClicks = 0;
  private plantGrown = false;
  private rainStopFn: (() => void) | null = null;
  private cameraBreath = 0;
  private transitionProgress = 0;
  private transitioning = false;
  private transitionTarget: Scene = 'desk';
  private onStateChange: (() => void) | null = null;
  private foldSnapAnimating = false;
  private foldSnapTarget = 0;
  private foldSnapStart = 0;
  private foldSnapTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.rng = new SeededRNG(Date.now());
    
    this.state = {
      scene: 'title',
      previousScene: 'title',
      paper: {
        faces: [],
        creases: [],
        currentStep: 0,
        foldProgress: 0,
        isFolding: false,
        foldAxis: null,
        foldAngle: 0,
        cameraRotation: { x: 0.3, y: 0.5 },
        cameraZoom: 1,
      },
      creatures: [],
      weather: 'clear',
      weatherIntensity: 0,
      timeOfDay: 'morning',
      timeProgress: 0.3,
      unlockedPatterns: ['plane', 'boat'],
      selectedPattern: null,
      selectedColor: PAPER_COLORS[0],
      foldHistory: [],
      redoStack: [],
      craneCount: 0,
      seed: Math.floor(Math.random() * 100000),
      settings: {
        muted: false,
        volume: 0.5,
        reducedMotion: false,
        highContrast: false,
        colorblind: false,
      },
    };
    
    this.loadState();
    this.setupInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setStateChangeCallback(cb: () => void) {
    this.onStateChange = cb;
  }

  private notifyStateChange() {
    if (this.onStateChange) this.onStateChange();
  }

  private loadState() {
    try {
      const saved = localStorage.getItem('paper-tide-save');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.unlockedPatterns) this.state.unlockedPatterns = data.unlockedPatterns;
        if (data.craneCount) this.state.craneCount = data.craneCount;
        if (data.seed) this.state.seed = data.seed;
        if (data.settings) this.state.settings = { ...this.state.settings, ...data.settings };
      }
    } catch { /* ignore */ }
  }

  private saveState() {
    try {
      localStorage.setItem('paper-tide-save', JSON.stringify({
        unlockedPatterns: this.state.unlockedPatterns,
        craneCount: this.state.craneCount,
        seed: this.state.seed,
        settings: this.state.settings,
      }));
    } catch { /* ignore */ }
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  private setupInput() {
    this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(this.getPos(e)));
    this.canvas.addEventListener('mousemove', (e) => this.onPointerMove(this.getPos(e)));
    this.canvas.addEventListener('mouseup', (e) => this.onPointerUp(this.getPos(e)));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) this.onPointerDown(this.getTouchPos(e));
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) this.onPointerMove(this.getTouchPos(e));
    }, { passive: false });
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.onPointerUp(this.mousePos);
    }, { passive: false });
    
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  private getPos(e: MouseEvent): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private getTouchPos(e: TouchEvent): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  }

  private onPointerDown(pos: Vec2) {
    this.mousePos = pos;
    this.isDragging = true;
    this.dragStart = { ...pos };
    audio.init();
    audio.resume();
    
    if (this.state.scene === 'title') {
      this.transitionTo('desk');
      audio.startAmbience();
      return;
    }
    
    if (this.state.scene === 'desk') {
      // Check if clicking on the paper area for folding
      const rect = this.canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2 - 20;
      const paperSize = Math.min(rect.width, rect.height) * 0.45;
      
      if (this.state.selectedPattern && !this.isPatternComplete()) {
        // In folding mode - start fold
        this.foldStartPos = this.screenToPaper(pos, cx, cy, paperSize);
        this.state.paper.isFolding = true;
        audio.playCrinkle(0.3);
      }
    }
    
    if (this.state.scene === 'diorama') {
      // Check creature click
      const creature = this.getClickedCreature(pos);
      if (creature) {
        this.dragCreature = creature.id;
        creature.state = 'hovered';
        if (creature.type === 'frog') {
          audio.playHop();
        } else if (creature.type === 'crane') {
          audio.playFlutter();
        } else if (creature.type === 'fish') {
          audio.playPlip();
        }
      }
    }
  }

  private onPointerMove(pos: Vec2) {
    this.mousePos = pos;
    
    if (this.state.scene === 'desk' && this.isDragging && this.state.selectedPattern && this.state.paper.isFolding) {
      // Calculate fold progress based on drag distance
      const rect = this.canvas.getBoundingClientRect();
      const paperSize = Math.min(rect.width, rect.height) * 0.45;
      
      const dragDist = v2Dist(this.dragStart, pos);
      const progress = clamp(dragDist / (paperSize * 0.4), 0, 1.2);
      this.state.paper.foldProgress = progress;
      
      // Map progress to fold angle with easing
      const easedProgress = progress < 1 ? progress * progress : 1 + (progress - 1) * 0.5;
      this.state.paper.foldAngle = easedProgress * Math.PI;
      
      // Play crinkle based on speed
      if (Math.random() < 0.1 && progress > 0.1) {
        audio.playCrinkle(0.2 + progress * 0.3);
      }
    }
    
    if (this.state.scene === 'diorama' && this.dragCreature) {
      const creature = this.state.creatures.find(c => c.id === this.dragCreature);
      if (creature) {
        creature.position = { ...pos };
      }
    }
    
    // Check creature hover in diorama
    if (this.state.scene === 'diorama' && !this.dragCreature) {
      const creature = this.getClickedCreature(pos);
      if (this.hoveredCreature) {
        const prev = this.state.creatures.find(c => c.id === this.hoveredCreature);
        if (prev) prev.state = prev.state === 'hopping' ? 'hopping' : 'idle';
      }
      if (creature) {
        creature.state = 'hovered';
        this.hoveredCreature = creature.id;
        this.canvas.style.cursor = 'grab';
      } else {
        this.hoveredCreature = null;
        this.canvas.style.cursor = 'default';
      }
    }
  }

  private onPointerUp(pos: Vec2) {
    if (this.state.scene === 'desk' && this.state.selectedPattern && this.state.paper.isFolding) {
      this.completeFold();
    }
    
    if (this.dragCreature) {
      const creature = this.state.creatures.find(c => c.id === this.dragCreature);
      if (creature) {
        creature.state = 'idle';
      }
      this.dragCreature = null;
    }
    
    this.isDragging = false;
    this.foldStartPos = null;
    
    // Check sun click (easter egg)
    if (this.state.scene === 'diorama') {
      const rect = this.canvas.getBoundingClientRect();
      const sunX = rect.width * 0.75;
      const sunY = rect.height * 0.15;
      if (v2Dist(pos, { x: sunX, y: sunY }) < 35) {
        this.sunClicks++;
        if (this.sunClicks >= 5) {
          this.sunClicks = 0;
          // Trigger sun origami animation
          this.spawnParticles(pos, 8, ['#f4ca6a', '#f4ead5', '#d4a843']);
        }
      }
    }
  }

  private onWheel(e: WheelEvent) {
    if (this.state.scene === 'desk') {
      this.state.paper.cameraZoom = clamp(this.state.paper.cameraZoom - e.deltaY * 0.001, 0.5, 2);
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'p') {
      if (this.state.scene === 'paused') {
        this.state.scene = this.state.previousScene;
      } else if (this.state.scene !== 'title') {
        this.state.previousScene = this.state.scene;
        this.state.scene = 'paused';
      }
      this.notifyStateChange();
    }
    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      this.undo();
    }
    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      this.redo();
    }
    // Weather shortcuts
    if (e.key === '1') this.setWeather('clear');
    if (e.key === '2') this.setWeather('rain');
    if (e.key === '3') this.setWeather('wind');
    if (e.key === '4') this.setWeather('snow');
  }

  private screenToPaper(screenPos: Vec2, cx: number, cy: number, paperSize: number): Vec2 {
    return {
      x: (screenPos.x - cx + paperSize / 2) / paperSize,
      y: (screenPos.y - cy + paperSize / 2) / paperSize,
    };
  }

  private getClickedCreature(pos: Vec2): Creature | null {
    for (const c of this.state.creatures) {
      if (v2Dist(pos, c.position) < 20 * c.scale) {
        return c;
      }
    }
    return null;
  }

  // Folding logic
  private completeFold() {
    const pattern = getPattern(this.state.selectedPattern!);
    if (!pattern) return;
    
    const step = pattern.steps[this.state.paper.currentStep];
    if (!step) return;
    
    const progress = this.state.paper.foldProgress;
    
    // More forgiving threshold - snap at 60% progress
    if (progress > 0.6) {
      // Snap the fold closed with elastic animation
      this.foldSnapAnimating = true;
      this.foldSnapTarget = Math.PI; // Full fold
      this.foldSnapStart = this.state.paper.foldAngle;
      this.foldSnapTime = 0;
      
      audio.playSnap();
      
      // Advance to next step
      this.state.paper.currentStep++;
      this.state.paper.foldProgress = 0;
      this.state.paper.foldAngle = 0;
      this.state.paper.isFolding = false;
      
      // Check if pattern is complete
      if (this.state.paper.currentStep >= pattern.steps.length) {
        this.onPatternComplete(pattern.id);
      }
      
      // Spawn sparkle particles
      const rect = this.canvas.getBoundingClientRect();
      this.spawnParticles(
        { x: rect.width / 2, y: rect.height / 2 },
        8,
        ['#f4ca6a', '#f4ead5', this.state.selectedColor]
      );
    } else {
      // Relax back with a gentle animation
      this.state.paper.foldProgress = 0;
      this.state.paper.foldAngle = 0;
      this.state.paper.isFolding = false;
    }
    
    this.notifyStateChange();
  }

  private onPatternComplete(patternId: string) {
    // Unlock next pattern
    const pattern = getPattern(patternId);
    if (pattern) {
      // Find patterns that unlock after this one
      for (const p of patterns) {
        if (p.unlockAfter === patternId && !this.state.unlockedPatterns.includes(p.id)) {
          this.state.unlockedPatterns.push(p.id);
        }
      }
    }
    
    // Track crane count
    if (patternId === 'crane') {
      this.state.craneCount++;
      if (this.state.craneCount >= TUNABLE.GOLDEN_CRANE_THRESHOLD) {
        // Golden crane easter egg!
        this.spawnGoldenCrane();
      }
    }
    
    this.saveState();
    this.notifyStateChange();
  }

  // Public API
  selectPattern(patternId: string) {
    if (!this.state.unlockedPatterns.includes(patternId)) return;
    
    this.state.selectedPattern = patternId;
    this.state.paper.currentStep = 0;
    this.state.paper.foldProgress = 0;
    this.state.paper.foldAngle = 0;
    this.state.paper.isFolding = false;
    this.state.paper.faces = this.createFacesForPattern(patternId);
    this.notifyStateChange();
  }

  selectColor(color: string) {
    this.state.selectedColor = color;
    // Update existing faces
    for (const face of this.state.paper.faces) {
      face.color = color;
    }
    this.notifyStateChange();
  }

  releaseCreature() {
    if (!this.state.selectedPattern) return;
    const pattern = getPattern(this.state.selectedPattern);
    if (!pattern) return;
    
    audio.playSplash();
    
    const rect = this.canvas.getBoundingClientRect();
    const waterY = rect.height * 0.55;
    
    // Position creature based on type
    let spawnPos = { x: rect.width * 0.5, y: waterY + 15 };
    if (pattern.creatureType === 'crane') {
      spawnPos = { x: rect.width * 0.5, y: rect.height * 0.25 };
    } else if (pattern.creatureType === 'plane') {
      spawnPos = { x: -30, y: rect.height * 0.3 };
    }
    
    const creature = this.createCreature(pattern.creatureType, spawnPos);
    this.state.creatures.push(creature);
    
    // Spawn release particles (paper confetti burst)
    this.spawnParticles(
      { x: rect.width / 2, y: rect.height / 2 },
      20,
      [this.state.selectedColor, '#f4ead5', '#d4a843', shadeColor(this.state.selectedColor, 1.3)]
    );
    
    // Extra splash particles at water level for boats/fish
    if (pattern.creatureType === 'boat' || pattern.creatureType === 'fish') {
      for (let i = 0; i < 8; i++) {
        this.particles.push({
          position: { x: rect.width / 2 + (Math.random() - 0.5) * 40, y: waterY },
          velocity: { x: (Math.random() - 0.5) * 60, y: -40 - Math.random() * 40 },
          life: 1, maxLife: 1,
          color: 'rgba(150, 200, 220, 0.7)',
          size: 3 + Math.random() * 3,
          type: 'splash',
          rotation: 0,
          rotationSpeed: 0,
        });
      }
    }
    
    // Retire oldest if over cap
    if (this.state.creatures.length > TUNABLE.MAX_CREATURES) {
      this.state.creatures.shift();
    }
    
    // Transition to diorama with a gentle lift
    this.transitionTo('diorama');
    this.notifyStateChange();
  }

  goToDesk() {
    this.transitionTo('desk');
    this.state.selectedPattern = null;
    this.state.paper.faces = [];
    this.state.paper.currentStep = 0;
    this.notifyStateChange();
  }

  goToDiorama() {
    this.transitionTo('diorama');
    this.notifyStateChange();
  }

  resetPaper() {
    audio.playBell();
    this.state.selectedPattern = null;
    this.state.paper.faces = [];
    this.state.paper.currentStep = 0;
    this.state.paper.foldProgress = 0;
    this.state.paper.foldAngle = 0;
    this.state.foldHistory = [];
    this.state.redoStack = [];
    this.notifyStateChange();
  }

  setWeather(weather: WeatherType) {
    this.state.weather = weather;
    this.state.weatherIntensity = weather === 'clear' ? 0 : 1;
    
    if (this.rainStopFn) {
      this.rainStopFn();
      this.rainStopFn = null;
    }
    
    if (weather === 'rain') {
      this.rainStopFn = audio.playRainLoop(1) || null;
    }
    
    this.notifyStateChange();
  }

  setTimeOfDay(tod: TimeOfDay) {
    this.state.timeOfDay = tod;
    this.notifyStateChange();
  }

  setMuted(muted: boolean) {
    this.state.settings.muted = muted;
    audio.setMuted(muted);
    this.saveState();
    this.notifyStateChange();
  }

  undo() {
    if (this.state.paper.currentStep > 0) {
      this.state.paper.currentStep--;
      this.state.paper.foldProgress = 0;
      this.state.paper.foldAngle = 0;
      this.notifyStateChange();
    }
  }

  redo() {
    const pattern = getPattern(this.state.selectedPattern || '');
    if (pattern && this.state.paper.currentStep < pattern.steps.length) {
      this.state.paper.currentStep++;
      this.notifyStateChange();
    }
  }

  getCurrentStep(): FoldStep | null {
    if (!this.state.selectedPattern) return null;
    const pattern = getPattern(this.state.selectedPattern);
    if (!pattern) return null;
    return pattern.steps[this.state.paper.currentStep] || null;
  }

  isPatternComplete(): boolean {
    if (!this.state.selectedPattern) return false;
    const pattern = getPattern(this.state.selectedPattern);
    if (!pattern) return false;
    return this.state.paper.currentStep >= pattern.steps.length;
  }

  // Creature creation
  private createCreature(type: CreatureType, pos: Vec2): Creature {
    const moods: CreatureMood[] = ['curious', 'sleepy', 'playful'];
    return {
      id: `creature_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      position: pos,
      velocity: { x: 0, y: 0 },
      color: this.state.selectedColor,
      mood: this.rng.pick(moods),
      name: generateName(this.rng),
      age: 0,
      state: 'idle',
      stateTimer: 0,
      scale: 0.8 + Math.random() * 0.4,
      rotation: 0,
      bobPhase: Math.random() * Math.PI * 2,
      faces: [],
    };
  }

  private createFacesForPattern(patternId: string): Face[] {
    const color = this.state.selectedColor;
    // Create a simple set of faces representing the folded paper
    const faces: Face[] = [];
    let id = 0;
    
    switch (patternId) {
      case 'plane':
        faces.push(
          { id: id++, vertices: [{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 0.5 }], color, parentId: null, layerIndex: 0 },
          { id: id++, vertices: [{ x: 0.5, y: 0 }, { x: 0, y: 0.5 }, { x: 0.5, y: 0.5 }], color, parentId: null, layerIndex: 0 },
          { id: id++, vertices: [{ x: 0, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0.5, y: 0.5 }], color: shadeColor(color, 0.9), parentId: null, layerIndex: 1 },
          { id: id++, vertices: [{ x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0.5, y: 0.5 }], color: shadeColor(color, 0.9), parentId: null, layerIndex: 1 },
        );
        break;
      case 'boat':
        faces.push(
          { id: id++, vertices: [{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }, { x: 0.7, y: 0.8 }, { x: 0.3, y: 0.8 }], color, parentId: null, layerIndex: 0 },
          { id: id++, vertices: [{ x: 0.5, y: 0.2 }, { x: 0.7, y: 0.5 }, { x: 0.3, y: 0.5 }], color: shadeColor(color, 1.1), parentId: null, layerIndex: 1 },
          { id: id++, vertices: [{ x: 0.3, y: 0.5 }, { x: 0.5, y: 0.2 }, { x: 0.2, y: 0.5 }], color: shadeColor(color, 0.85), parentId: null, layerIndex: 0 },
          { id: id++, vertices: [{ x: 0.7, y: 0.5 }, { x: 0.5, y: 0.2 }, { x: 0.8, y: 0.5 }], color: shadeColor(color, 0.85), parentId: null, layerIndex: 0 },
        );
        break;
      case 'crane':
        faces.push(
          { id: id++, vertices: [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }, { x: 0.7, y: 0.6 }, { x: 0.3, y: 0.6 }], color, parentId: null, layerIndex: 0 },
          { id: id++, vertices: [{ x: 0.3, y: 0.5 }, { x: 0.1, y: 0.3 }, { x: 0.2, y: 0.5 }], color: shadeColor(color, 1.1), parentId: null, layerIndex: 1 },
          { id: id++, vertices: [{ x: 0.7, y: 0.5 }, { x: 0.9, y: 0.3 }, { x: 0.8, y: 0.5 }], color: shadeColor(color, 1.1), parentId: null, layerIndex: 1 },
          { id: id++, vertices: [{ x: 0.5, y: 0.4 }, { x: 0.6, y: 0.2 }, { x: 0.55, y: 0.35 }], color: shadeColor(color, 0.9), parentId: null, layerIndex: 2 },
          { id: id++, vertices: [{ x: 0.3, y: 0.6 }, { x: 0.2, y: 0.75 }, { x: 0.4, y: 0.65 }], color: shadeColor(color, 0.85), parentId: null, layerIndex: 0 },
          { id: id++, vertices: [{ x: 0.7, y: 0.6 }, { x: 0.8, y: 0.75 }, { x: 0.6, y: 0.65 }], color: shadeColor(color, 0.85), parentId: null, layerIndex: 0 },
        );
        break;
      case 'fish':
        faces.push(
          { id: id++, vertices: [{ x: 0.2, y: 0.4 }, { x: 0.7, y: 0.35 }, { x: 0.7, y: 0.65 }, { x: 0.2, y: 0.6 }], color, parentId: null, layerIndex: 0 },
          { id: id++, vertices: [{ x: 0.7, y: 0.35 }, { x: 0.9, y: 0.3 }, { x: 0.85, y: 0.5 }], color: shadeColor(color, 0.9), parentId: null, layerIndex: 1 },
          { id: id++, vertices: [{ x: 0.7, y: 0.65 }, { x: 0.9, y: 0.7 }, { x: 0.85, y: 0.5 }], color: shadeColor(color, 0.9), parentId: null, layerIndex: 1 },
        );
        break;
      case 'frog':
        faces.push(
          { id: id++, vertices: [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.7, y: 0.7 }, { x: 0.3, y: 0.7 }], color, parentId: null, layerIndex: 0 },
          { id: id++, vertices: [{ x: 0.3, y: 0.3 }, { x: 0.5, y: 0.15 }, { x: 0.4, y: 0.3 }], color: shadeColor(color, 1.1), parentId: null, layerIndex: 1 },
          { id: id++, vertices: [{ x: 0.7, y: 0.3 }, { x: 0.5, y: 0.15 }, { x: 0.6, y: 0.3 }], color: shadeColor(color, 1.1), parentId: null, layerIndex: 1 },
          { id: id++, vertices: [{ x: 0.3, y: 0.7 }, { x: 0.2, y: 0.85 }, { x: 0.4, y: 0.75 }], color: shadeColor(color, 0.85), parentId: null, layerIndex: 0 },
          { id: id++, vertices: [{ x: 0.7, y: 0.7 }, { x: 0.8, y: 0.85 }, { x: 0.6, y: 0.75 }], color: shadeColor(color, 0.85), parentId: null, layerIndex: 0 },
        );
        break;
      default:
        faces.push({
          id: 0,
          vertices: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }],
          color, parentId: null, layerIndex: 0
        });
    }
    
    return faces;
  }

  private spawnGoldenCrane() {
    const rect = this.canvas.getBoundingClientRect();
    const crane = this.createCreature('crane', { x: rect.width / 2, y: rect.height * 0.3 });
    crane.color = '#d4a843';
    crane.scale = 1.5;
    crane.name = 'Golden';
    crane.mood = 'playful';
    this.state.creatures.push(crane);
    this.spawnParticles({ x: rect.width / 2, y: rect.height * 0.3 }, 20, ['#d4a843', '#f4ca6a', '#f4ead5']);
  }

  // Particle system
  private spawnParticles(pos: Vec2, count: number, colors: string[]) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 50 + Math.random() * 100;
      this.particles.push({
        position: { ...pos },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed - 30 },
        life: 1,
        maxLife: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 4,
        type: Math.random() > 0.5 ? 'confetti' : 'splash',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 5,
      });
    }
  }

  private spawnWeatherParticles() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    
    switch (this.state.weather) {
      case 'rain':
        if (Math.random() < 0.3) {
          this.particles.push({
            position: { x: Math.random() * w, y: -10 },
            velocity: { x: -20, y: 300 + Math.random() * 200 },
            life: 1, maxLife: 1,
            color: '#8ab4d4',
            size: 8 + Math.random() * 4,
            type: 'rain',
            rotation: 0.1,
            rotationSpeed: 0,
          });
        }
        break;
      case 'snow':
        if (Math.random() < 0.15) {
          this.particles.push({
            position: { x: Math.random() * w, y: -10 },
            velocity: { x: Math.sin(this.time) * 20, y: 30 + Math.random() * 30 },
            life: 1, maxLife: 1,
            color: '#f0f0fa',
            size: 2 + Math.random() * 3,
            type: 'snow',
            rotation: 0,
            rotationSpeed: Math.random() * 2,
          });
        }
        break;
      case 'starfall':
        if (Math.random() < 0.05) {
          this.particles.push({
            position: { x: Math.random() * w, y: -10 },
            velocity: { x: (Math.random() - 0.5) * 20, y: 20 + Math.random() * 20 },
            life: 1, maxLife: 1,
            color: '#f4ca6a',
            size: 4 + Math.random() * 3,
            type: 'star',
            rotation: Math.random() * Math.PI,
            rotationSpeed: (Math.random() - 0.5) * 2,
          });
        }
        break;
    }
  }

  // Scene transitions
  private transitionTo(scene: Scene) {
    this.transitioning = true;
    this.transitionTarget = scene;
    this.transitionProgress = 0;
  }

  // Creature behavior update
  private updateCreatures(dt: number) {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const waterTop = h * 0.55;
    
    for (const creature of this.state.creatures) {
      creature.age += dt;
      creature.stateTimer += dt;
      
      // Mood-based speed modifier
      const speedMod = creature.mood === 'playful' ? 1.3 : creature.mood === 'sleepy' ? 0.6 : 1;
      
      switch (creature.type) {
        case 'boat':
          this.updateBoat(creature, dt, w, waterTop, speedMod);
          break;
        case 'crane':
          this.updateCrane(creature, dt, w, h, speedMod);
          break;
        case 'fish':
          this.updateFish(creature, dt, w, h, waterTop, speedMod);
          break;
        case 'frog':
          this.updateFrog(creature, dt, w, h, waterTop, speedMod);
          break;
        case 'plane':
          this.updatePlane(creature, dt, w, h, speedMod);
          break;
      }
      
      // Keep in bounds
      creature.position.x = clamp(creature.position.x, 20, w - 20);
      creature.position.y = clamp(creature.position.y, 20, h - 20);
    }
  }

  private updateBoat(c: Creature, dt: number, w: number, waterTop: number, speedMod: number) {
    if (c.state === 'idle') {
      // Drift with waves
      c.velocity.x = Math.sin(this.time * 0.5 + c.bobPhase) * 10 * speedMod;
      c.velocity.y = 0;
      c.rotation = Math.sin(this.time * 0.8 + c.bobPhase) * 0.05;
      
      // Stay on water
      c.position.y = waterTop + 15;
      
      // Random direction change
      if (c.stateTimer > 5 + Math.random() * 5) {
        c.stateTimer = 0;
        c.velocity.x = (Math.random() - 0.5) * 20 * speedMod;
      }
    }
    
    // Wind effect
    if (this.state.weather === 'wind') {
      c.velocity.x += 15 * dt;
      c.rotation += Math.sin(this.time * 3) * 0.02;
    }
    
    c.position.x += c.velocity.x * dt;
    
    // Wrap around
    if (c.position.x > w + 30) c.position.x = -30;
    if (c.position.x < -30) c.position.x = w + 30;
  }

  private updateCrane(c: Creature, dt: number, w: number, h: number, speedMod: number) {
    if (c.state === 'idle') {
      // Soar in circles
      const cx = w * 0.5;
      const cy = h * 0.25;
      const radius = 80 + c.bobPhase * 20;
      
      c.position.x = cx + Math.cos(this.time * 0.3 * speedMod + c.bobPhase) * radius;
      c.position.y = cy + Math.sin(this.time * 0.2 * speedMod + c.bobPhase) * radius * 0.3;
      c.rotation = Math.cos(this.time * 0.3 * speedMod + c.bobPhase) * 0.2;
    }
    
    // Flock loosely with other cranes
    for (const other of this.state.creatures) {
      if (other.id !== c.id && other.type === 'crane') {
        const dist = v2Dist(c.position, other.position);
        if (dist < 100 && dist > 30) {
          const dir = v2Norm(v2Sub(other.position, c.position));
          c.position.x += dir.x * 5 * dt;
          c.position.y += dir.y * 5 * dt;
        }
      }
    }
  }

  private updateFish(c: Creature, dt: number, w: number, h: number, waterTop: number, speedMod: number) {
    if (c.state === 'idle') {
      // Swim in arcs
      c.velocity.x = Math.cos(this.time * 0.8 + c.bobPhase) * 30 * speedMod;
      c.velocity.y = Math.sin(this.time * 0.5 + c.bobPhase) * 10;
      c.rotation = Math.atan2(c.velocity.y, c.velocity.x);
      
      c.position.x += c.velocity.x * dt;
      c.position.y = waterTop + 30 + Math.sin(this.time + c.bobPhase) * 15;
    }
    
    // Wrap around
    if (c.position.x > w + 20) c.position.x = -20;
    if (c.position.x < -20) c.position.x = w + 20;
    
    // School with same color
    for (const other of this.state.creatures) {
      if (other.id !== c.id && other.type === 'fish' && other.color === c.color) {
        const dist = v2Dist(c.position, other.position);
        if (dist < 60 && dist > 20) {
          const dir = v2Norm(v2Sub(other.position, c.position));
          c.position.x += dir.x * 3 * dt;
        }
      }
    }
  }

  private updateFrog(c: Creature, dt: number, w: number, h: number, waterTop: number, speedMod: number) {
    if (c.state === 'idle') {
      c.position.y = waterTop - 5;
      
      // Random hop
      if (c.stateTimer > 3 + Math.random() * 4) {
        c.state = 'hopping';
        c.stateTimer = 0;
        c.velocity.x = (Math.random() - 0.5) * 100 * speedMod;
        audio.playHop();
      }
    } else if (c.state === 'hopping') {
      c.position.x += c.velocity.x * dt;
      c.velocity.x *= 0.95;
      
      if (c.stateTimer > 0.5) {
        c.state = 'idle';
        c.stateTimer = 0;
      }
    }
    
    // React to tap
    if (c.state === 'hovered') {
      c.state = 'hopping';
      c.velocity.x = (Math.random() - 0.5) * 150;
      c.stateTimer = 0;
    }
    
    c.position.x = clamp(c.position.x, 40, w - 40);
  }

  private updatePlane(c: Creature, dt: number, w: number, h: number, speedMod: number) {
    if (c.state === 'idle') {
      // Glide in long curves
      c.velocity.x = 60 * speedMod;
      c.velocity.y = Math.sin(this.time * 0.5 + c.bobPhase) * 20;
      c.rotation = Math.atan2(c.velocity.y, c.velocity.x) * 0.3;
      
      c.position.x += c.velocity.x * dt;
      c.position.y += c.velocity.y * dt;
      
      // Eventually land
      if (c.age > 15) {
        c.position.y += 20 * dt;
        if (c.position.y > h * 0.55) {
          c.position.y = h * 0.55 + 15;
          c.type = 'boat'; // Convert to boat on landing
        }
      }
    }
    
    if (c.position.x > w + 30) {
      c.position.x = -30;
    }
  }

  // Main update loop
  update(dt: number) {
    this.time += dt;
    this.cameraBreath += dt * TUNABLE.CAMERA_BREATH_SPEED;
    
    // Update time of day
    this.state.timeProgress += dt * 0.005;
    if (this.state.timeProgress > 1) this.state.timeProgress = 0;
    
    // Update time of day based on progress
    const todKeys: TimeOfDay[] = ['dawn', 'morning', 'noon', 'golden', 'dusk', 'night'];
    const todIndex = Math.floor(this.state.timeProgress * todKeys.length);
    this.state.timeOfDay = todKeys[todIndex % todKeys.length];
    
    // Transition
    if (this.transitioning) {
      this.transitionProgress += dt * 2;
      if (this.transitionProgress >= 1) {
        this.transitioning = false;
        this.state.scene = this.transitionTarget;
        this.notifyStateChange();
      }
    }
    
    // Fold snap animation
    if (this.foldSnapAnimating) {
      this.foldSnapTime += dt * 4;
      if (this.foldSnapTime >= 1) {
        this.foldSnapAnimating = false;
        this.state.paper.foldAngle = this.foldSnapTarget;
      } else {
        const t = easeOutElastic(this.foldSnapTime);
        this.state.paper.foldAngle = this.foldSnapStart + (this.foldSnapTarget - this.foldSnapStart) * t;
      }
    }
    
    // Update creatures
    this.updateCreatures(dt);
    
    // Weather particles
    this.spawnWeatherParticles();
    
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.velocity.y += 100 * dt; // gravity
      p.rotation += p.rotationSpeed * dt;
      p.life -= dt * (p.type === 'rain' ? 0.5 : 1);
      
      if (p.life <= 0 || p.position.y > this.canvas.getBoundingClientRect().height + 20) {
        this.particles.splice(i, 1);
      }
    }
    
    // Cap particles
    if (this.particles.length > 200) {
      this.particles.splice(0, this.particles.length - 200);
    }
  }

  // Main render
  render() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    
    this.ctx.clearRect(0, 0, w, h);
    
    switch (this.state.scene) {
      case 'title':
        renderTitle(this.ctx, w, h, this.time);
        break;
        
      case 'desk':
        this.renderDeskScene(w, h);
        break;
        
      case 'diorama':
        renderDiorama(
          this.ctx, w, h, this.time,
          this.state.timeOfDay,
          this.state.weather,
          this.state.weatherIntensity,
          this.state.creatures,
          this.particles,
          this.cameraBreath,
          this.state.seed,
        );
        break;
        
      case 'paused':
        // Render previous scene dimmed
        if (this.state.previousScene === 'diorama') {
          renderDiorama(this.ctx, w, h, this.time, this.state.timeOfDay, this.state.weather, this.state.weatherIntensity, this.state.creatures, this.particles, this.cameraBreath, this.state.seed);
        } else {
          this.renderDeskScene(w, h);
        }
        // Dim overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, w, h);
        // Pause text
        this.ctx.font = 'italic 32px Georgia, serif';
        this.ctx.fillStyle = '#f4ead5';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Paused', w / 2, h / 2);
        this.ctx.font = '14px Georgia, serif';
        this.ctx.fillStyle = 'rgba(244, 234, 213, 0.6)';
        this.ctx.fillText('Press Esc to resume', w / 2, h / 2 + 30);
        break;
    }
    
    // Transition overlay
    if (this.transitioning) {
      const alpha = Math.sin(this.transitionProgress * Math.PI) * 0.3;
      this.ctx.fillStyle = `rgba(244, 234, 213, ${alpha})`;
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  private renderDeskScene(w: number, h: number) {
    renderDesk(this.ctx, w, h, this.time);
    
    // Render paper model if pattern selected
    if (this.state.selectedPattern && this.state.paper.faces.length > 0) {
      const cx = w / 2;
      const cy = h / 2 - 20;
      
      // Determine which faces to fold based on current step
      const foldFaceIds = new Set<number>();
      const pattern = getPattern(this.state.selectedPattern);
      let foldAxis: Vec3 | null = null;
      
      if (pattern && this.state.paper.isFolding) {
        const step = pattern.steps[this.state.paper.currentStep];
        if (step) {
          // Calculate fold axis from crease line
          foldAxis = {
            x: (step.creaseStart.x + step.creaseEnd.x) / 2,
            y: (step.creaseStart.y + step.creaseEnd.y) / 2,
            z: step.creaseEnd.x - step.creaseStart.x,
          };
          
          // Fold faces on one side of the crease
          for (let i = 0; i < this.state.paper.faces.length; i++) {
            const face = this.state.paper.faces[i];
            const faceCenterX = face.vertices.reduce((s, v) => s + v.x, 0) / face.vertices.length;
            const faceCenterY = face.vertices.reduce((s, v) => s + v.y, 0) / face.vertices.length;
            
            // Determine which side of crease this face is on
            const creaseDir = { x: step.creaseEnd.x - step.creaseStart.x, y: step.creaseEnd.y - step.creaseStart.y };
            const toFace = { x: faceCenterX - step.creaseStart.x, y: faceCenterY - step.creaseStart.y };
            const cross = creaseDir.x * toFace.y - creaseDir.y * toFace.x;
            
            if (step.type === 'valley' ? cross > 0 : cross < 0) {
              foldFaceIds.add(face.id);
            }
          }
        }
      } else if (pattern) {
        // Not actively folding - show completed folds
        for (let i = 0; i < this.state.paper.faces.length; i++) {
          if (i >= this.state.paper.faces.length / 2) {
            foldFaceIds.add(this.state.paper.faces[i].id);
          }
        }
      }
      
      const hintCrease = this.getCurrentStep();
      
      renderPaper(
        this.ctx,
        this.state.paper.faces,
        this.state.paper.cameraRotation,
        this.state.paper.cameraZoom,
        cx, cy,
        foldAxis,
        this.state.paper.foldAngle,
        foldFaceIds,
        this.time,
        hintCrease && !this.isPatternComplete() ? { start: hintCrease.creaseStart, end: hintCrease.creaseEnd } : null,
        this.state.paper.foldProgress,
      );
    }
  }

  // Game loop
  start() {
    const loop = (timestamp: number) => {
      const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
      this.lastTime = timestamp;
      
      this.update(dt);
      this.render();
      
      this.animFrame = requestAnimationFrame(loop);
    };
    this.lastTime = performance.now();
    this.animFrame = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.animFrame);
  }

  getState(): GameState {
    return this.state;
  }
}

function shadeColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(Math.min(255, r * factor));
  const ng = Math.round(Math.min(255, g * factor));
  const nb = Math.round(Math.min(255, b * factor));
  return '#' + [nr, ng, nb].map(c => c.toString(16).padStart(2, '0')).join('');
}
