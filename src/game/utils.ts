// Paper Tide - Math Utilities, Noise, and Helpers
import { Vec2, Vec3 } from './types';

export function vec2(x: number, y: number): Vec2 { return { x, y }; }
export function vec3(x: number, y: number, z: number): Vec3 { return { x, y, z }; }

export function v2Add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; }
export function v2Sub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; }
export function v2Scale(v: Vec2, s: number): Vec2 { return { x: v.x * s, y: v.y * s }; }
export function v2Dot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y; }
export function v2Len(v: Vec2): number { return Math.sqrt(v.x * v.x + v.y * v.y); }
export function v2Norm(v: Vec2): Vec2 { const l = v2Len(v); return l > 0 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 }; }
export function v2Dist(a: Vec2, b: Vec2): number { return v2Len(v2Sub(a, b)); }
export function v2Lerp(a: Vec2, b: Vec2, t: number): Vec2 { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
export function v2Perp(v: Vec2): Vec2 { return { x: -v.y, y: v.x }; }
export function v2Rotate(v: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

export function v3Add(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
export function v3Sub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
export function v3Scale(v: Vec3, s: number): Vec3 { return { x: v.x * s, y: v.y * s, z: v.z * s }; }
export function v3Cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
export function v3Dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
export function v3Len(v: Vec3): number { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
export function v3Norm(v: Vec3): Vec3 { const l = v3Len(v); return l > 0 ? { x: v.x / l, y: v.y / l, z: v.z / l } : { x: 0, y: 0, z: 0 }; }
export function v3Lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

export function rotateAroundAxis(point: Vec3, axis: Vec3, axisOrigin: Vec3, angle: number): Vec3 {
  const translated = v3Sub(point, axisOrigin);
  const k = v3Norm(axis);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const dot = v3Dot(k, translated);
  const cross = v3Cross(k, translated);
  const rotated = v3Add(v3Add(v3Scale(translated, cosA), v3Scale(cross, sinA)), v3Scale(k, dot * (1 - cosA)));
  return v3Add(rotated, axisOrigin);
}

// Project 3D to 2D with perspective
export function project3D(point: Vec3, camRot: Vec2, zoom: number, cx: number, cy: number): Vec2 {
  // Apply camera rotation
  let x = point.x, y = point.y, z = point.z;
  
  // Rotate around Y axis (horizontal)
  const cosY = Math.cos(camRot.x), sinY = Math.sin(camRot.x);
  const rx = x * cosY + z * sinY;
  const rz = -x * sinY + z * cosY;
  x = rx; z = rz;
  
  // Rotate around X axis (vertical)
  const cosX = Math.cos(camRot.y), sinX = Math.sin(camRot.y);
  const ry = y * cosX - z * sinX;
  const rz2 = y * sinX + z * cosX;
  y = ry; z = rz2;
  
  // Perspective projection
  const fov = 800 * zoom;
  const distance = 400;
  const scale = fov / (distance + z);
  
  return { x: cx + x * scale, y: cy - y * scale };
}

// Seeded random number generator
export class SeededRNG {
  private seed: number;
  constructor(seed: number) { this.seed = seed; }
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (this.seed >>> 0) / 0xFFFFFFFF;
  }
  range(min: number, max: number): number { return min + this.next() * (max - min); }
  int(min: number, max: number): number { return Math.floor(this.range(min, max)); }
  pick<T>(arr: T[]): T { return arr[this.int(0, arr.length)]; }
}

// Simplex-like noise
export function noise2D(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const hash = (a: number, b: number) => {
    let h = (a * 374761393 + b * 668265263 + 1013904223) & 0xFFFFFFFF;
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF;
    return (h & 0xFFFF) / 0xFFFF;
  };
  const n00 = hash(xi, yi), n10 = hash(xi + 1, yi);
  const n01 = hash(xi, yi + 1), n11 = hash(xi + 1, yi + 1);
  const nx0 = n00 + (n10 - n00) * u;
  const nx1 = n01 + (n11 - n01) * u;
  return (nx0 + (nx1 - nx0) * v) * 2 - 1;
}

export function fbm(x: number, y: number, octaves: number = 4): number {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise2D(x * freq, y * freq);
    amp *= 0.5; freq *= 2;
  }
  return val;
}

// Line intersection
export function lineIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null {
  const d1 = v2Sub(p2, p1), d2 = v2Sub(p4, p3);
  const cross = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(cross) < 0.0001) return null;
  const d3 = v2Sub(p3, p1);
  const t = (d3.x * d2.y - d3.y * d2.x) / cross;
  const u = (d3.x * d1.y - d3.y * d1.x) / cross;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return v2Add(p1, v2Scale(d1, t));
  }
  return null;
}

// Point to line distance
export function pointToLineDist(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = v2Sub(b, a);
  const ap = v2Sub(p, a);
  const t = Math.max(0, Math.min(1, v2Dot(ap, ab) / v2Dot(ab, ab)));
  const proj = v2Add(a, v2Scale(ab, t));
  return v2Dist(p, proj);
}

// Check if point is inside polygon
export function pointInPolygon(p: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Polygon splitting by line
export function splitPolygon(vertices: Vec2[], lineStart: Vec2, lineEnd: Vec2): [Vec2[], Vec2[]] | null {
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  const lineDir = v2Sub(lineEnd, lineStart);
  const lineNorm = v2Perp(lineDir);
  
  const sides: number[] = vertices.map(v => {
    const d = v2Dot(v2Sub(v, lineStart), lineNorm);
    return d > 0.001 ? 1 : d < -0.001 ? -1 : 0;
  });
  
  let hasLeft = false, hasRight = false;
  for (const s of sides) {
    if (s > 0) hasLeft = true;
    if (s < 0) hasRight = true;
  }
  
  if (!hasLeft || !hasRight) return null;
  
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const si = sides[i], sj = sides[j];
    
    if (si >= 0) left.push(vertices[i]);
    if (si <= 0) right.push(vertices[i]);
    
    if ((si > 0 && sj < 0) || (si < 0 && sj > 0)) {
      const inter = lineIntersect(vertices[i], vertices[j], lineStart, lineEnd);
      if (inter) {
        left.push(inter);
        right.push(inter);
      }
    }
  }
  
  if (left.length < 3 || right.length < 3) return null;
  return [left, right];
}

// Color utilities
export function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');
}

export function shadeColor(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

export function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

// Easing functions
export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
}

export function easeOutBack(t: number): number {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// Name generation
const CREATURE_NAMES = [
  'Pip', 'Moss', 'Drift', 'Sail', 'Wisp', 'Flick', 'Dot', 'Breeze',
  'Puddle', 'Reef', 'Coral', 'Shell', 'Tide', 'Wave', 'Gale', 'Mist',
  'Fern', 'Petal', 'Ember', 'Dusk', 'Dawn', 'Lark', 'Sage', 'Brook',
  'Hazel', 'Clover', 'Ivy', 'Willow', 'Russet', 'Amber', 'Pearl', 'Opal'
];

export function generateName(rng: SeededRNG): string {
  return rng.pick(CREATURE_NAMES);
}
