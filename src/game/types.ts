// Paper Tide - Type Definitions

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Face {
  id: number;
  vertices: Vec2[];
  color: string;
  parentId: number | null;
  layerIndex: number;
  creaseId?: number;
}

export interface CreaseLine {
  id: number;
  start: Vec2;
  end: Vec2;
  type: 'mountain' | 'valley';
  faceIds: number[];
}

export interface FoldStep {
  creaseStart: Vec2;
  creaseEnd: Vec2;
  type: 'mountain' | 'valley';
  targetAngle: number;
  hint: string;
  movingFaceIds?: number[];
}

export interface Pattern {
  id: string;
  name: string;
  icon: string;
  steps: FoldStep[];
  unlockAfter?: string;
  creatureType: CreatureType;
  hiddenMessage?: string;
}

export type CreatureType = 'boat' | 'crane' | 'fish' | 'frog' | 'plane';

export type CreatureMood = 'curious' | 'sleepy' | 'playful';

export interface Creature {
  id: string;
  type: CreatureType;
  position: Vec2;
  velocity: Vec2;
  color: string;
  mood: CreatureMood;
  name: string;
  age: number;
  state: string;
  stateTimer: number;
  target?: Vec2;
  faces: Face[];
  scale: number;
  rotation: number;
  bobPhase: number;
}

export type WeatherType = 'clear' | 'rain' | 'wind' | 'fog' | 'snow' | 'starfall';

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'golden' | 'dusk' | 'night';

export type Scene = 'title' | 'desk' | 'diorama' | 'paused';

export interface GameState {
  scene: Scene;
  previousScene: Scene;
  paper: PaperState;
  creatures: Creature[];
  weather: WeatherType;
  weatherIntensity: number;
  timeOfDay: TimeOfDay;
  timeProgress: number;
  unlockedPatterns: string[];
  selectedPattern: string | null;
  selectedColor: string;
  foldHistory: FoldAction[];
  redoStack: FoldAction[];
  craneCount: number;
  seed: number;
  settings: Settings;
}

export interface PaperState {
  faces: Face[];
  creases: CreaseLine[];
  currentStep: number;
  foldProgress: number;
  isFolding: boolean;
  foldAxis: Vec3 | null;
  foldAngle: number;
  cameraRotation: Vec2;
  cameraZoom: number;
}

export interface FoldAction {
  type: 'fold' | 'split';
  creaseId: number;
  angle: number;
  previousFaces: Face[];
  newFaces: Face[];
}

export interface Settings {
  muted: boolean;
  volume: number;
  reducedMotion: boolean;
  highContrast: boolean;
  colorblind: boolean;
}

export interface Particle {
  position: Vec2;
  velocity: Vec2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'confetti' | 'rain' | 'snow' | 'star' | 'splash';
  rotation: number;
  rotationSpeed: number;
}

export interface WaveLayer {
  y: number;
  speed: number;
  amplitude: number;
  color: string;
  phase: number;
}

export const PAPER_COLORS = [
  '#4a5899', // indigo
  '#c74b3f', // vermilion
  '#3a8a7a', // sea-teal
  '#d4a843', // mustard
  '#d48a8a', // blush
  '#7a9a6a', // sage
  '#f4ead5', // cream
  '#2a2a3a', // midnight
];

export const TUNABLE = {
  MAX_CREATURES: 30,
  MAX_FACES: 64,
  FOLD_SNAP_THRESHOLD: 0.85,
  WAVE_SPEED: 0.3,
  PARALLAX_STRENGTH: 0.15,
  SHADOW_SOFTNESS: 4,
  CREATURE_RETIRE_AGE: 120,
  GOLDEN_CRANE_THRESHOLD: 25,
  FOLD_SPEED_SENSITIVITY: 0.005,
  CAMERA_BREATH_SPEED: 0.001,
  CAMERA_BREATH_AMOUNT: 2,
};
