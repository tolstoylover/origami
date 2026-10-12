// Paper Tide - Renderer (Paper 3D, Diorama, Creatures)
import {
  Face, Creature, Particle, WaveLayer, Vec2, Vec3,
  WeatherType, TimeOfDay, PAPER_COLORS, TUNABLE
} from './types';
import {
  project3D, v3Cross, v3Norm, v3Sub, shadeColor, hexToRgb, rgbToHex,
  lerpColor, noise2D, SeededRNG, clamp, easeOutElastic
} from './utils';

// Paper grain texture (pre-rendered)
let grainCanvas: HTMLCanvasElement | null = null;
let deskCanvas: HTMLCanvasElement | null = null;

function getGrainTexture(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = 256;
  grainCanvas.height = 256;
  const ctx = grainCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(256, 256);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 15;
    imgData.data[i] = 200 + noise;
    imgData.data[i + 1] = 190 + noise;
    imgData.data[i + 2] = 170 + noise;
    imgData.data[i + 3] = 30;
  }
  ctx.putImageData(imgData, 0, 0);
  return grainCanvas;
}

function getDeskTexture(): HTMLCanvasElement {
  if (deskCanvas) return deskCanvas;
  deskCanvas = document.createElement('canvas');
  deskCanvas.width = 512;
  deskCanvas.height = 512;
  const ctx = deskCanvas.getContext('2d')!;
  
  // Wood base
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#8a6a4a');
  grad.addColorStop(0.5, '#9a7a5a');
  grad.addColorStop(1, '#7a5a3a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  
  // Wood grain lines
  ctx.strokeStyle = 'rgba(60, 40, 20, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    const y = i * 13 + Math.random() * 5;
    ctx.moveTo(0, y);
    for (let x = 0; x < 512; x += 20) {
      ctx.lineTo(x, y + Math.sin(x * 0.02) * 3 + Math.random() * 2);
    }
    ctx.stroke();
  }
  
  // Subtle noise overlay
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0}, ${Math.random() > 0.5 ? 255 : 0}, ${Math.random() > 0.5 ? 255 : 0}, 0.02)`;
    ctx.fillRect(x, y, 1, 1);
  }
  
  return deskCanvas;
}

// Render the paper model in 3D
export function renderPaper(
  ctx: CanvasRenderingContext2D,
  faces: Face[],
  camRot: Vec2,
  zoom: number,
  cx: number,
  cy: number,
  foldAxis: Vec3 | null,
  foldAngle: number,
  foldFaceIds: Set<number>,
  time: number,
  hintCrease: { start: Vec2; end: Vec2 } | null,
  foldProgress: number,
) {
  const scale = 200 * zoom;
  
  // Transform faces to 3D
  const projected: { face: Face; points: Vec2[]; depth: number; normal: Vec3 }[] = [];
  
  for (const face of faces) {
    let verts: Vec3[] = face.vertices.map(v => {
      let v3: Vec3 = {
        x: (v.x - 0.5) * scale,
        y: (v.y - 0.5) * scale,
        z: face.layerIndex * 0.5
      };
      
      // Apply fold rotation
      if (foldAxis && foldFaceIds.has(face.id) && foldAngle !== 0) {
        const axisOrigin = {
          x: (foldAxis.x - 0.5) * scale,
          y: (foldAxis.y - 0.5) * scale,
          z: 0
        };
        const axis = { x: foldAxis.z, y: 0, z: -foldAxis.x + foldAxis.y };
        const axisNorm = v3Norm(axis);
        v3 = rotateAroundAxis(v3, axisNorm, axisOrigin, foldAngle);
      }
      
      // Subtle paper curl near crease
      if (foldAxis && foldFaceIds.has(face.id) && foldAngle !== 0) {
        const curlAmount = Math.sin(foldAngle * 0.5) * 2;
        v3.z += curlAmount * noise2D(v.x * 3, v.y * 3);
      }
      
      return v3;
    });
    
    // Project to 2D
    const points = verts.map(v => project3D(v, camRot, zoom, cx, cy));
    
    // Calculate face normal for shading
    if (verts.length >= 3) {
      const e1 = v3Sub(verts[1], verts[0]);
      const e2 = v3Sub(verts[2], verts[0]);
      const normal = v3Norm(v3Cross(e1, e2));
      
      // Calculate depth (average z after rotation)
      const avgZ = verts.reduce((s, v) => s + v.z, 0) / verts.length;
      
      projected.push({ face, points, depth: avgZ, normal });
    }
  }
  
  // Sort by depth (painter's algorithm)
  projected.sort((a, b) => b.depth - a.depth);
  
  // Light direction (soft, from upper-left)
  const lightDir = v3Norm({ x: -0.3, y: 0.5, z: 0.8 });
  
  // Draw faces
  for (const { face, points, normal } of projected) {
    if (points.length < 3) continue;
    
    // Calculate shading based on normal
    const dot = Math.max(0, normal.x * lightDir.x + normal.y * lightDir.y + normal.z * lightDir.z);
    const shade = 0.6 + dot * 0.4;
    const shadedColor = shadeColor(face.color, shade);
    
    // Draw shadow
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(points[0].x + 3, points[0].y + 3);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x + 3, points[i].y + 3);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    
    // Draw face
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    
    ctx.fillStyle = shadedColor;
    ctx.fill();
    
    // Paper grain overlay
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.clip();
    const grain = getGrainTexture();
    const bounds = getBounds(points);
    ctx.drawImage(grain, bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.restore();
    
    // Edge highlight (subtle)
    ctx.strokeStyle = shadeColor(face.color, shade * 1.1);
    ctx.lineWidth = 0.5;
    ctx.stroke();
    
    // Inner fold crease line (papercraft detail)
    if (points.length >= 3) {
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = shadeColor(face.color, 0.7);
      ctx.lineWidth = 0.5;
      // Draw a line from center to one vertex (suggesting a fold)
      const centerX = points.reduce((s, p) => s + p.x, 0) / points.length;
      const centerY = points.reduce((s, p) => s + p.y, 0) / points.length;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo((points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  
  // Draw hint crease if provided
  if (hintCrease) {
    const start = project3D(
      { x: (hintCrease.start.x - 0.5) * scale, y: (hintCrease.start.y - 0.5) * scale, z: 5 },
      camRot, zoom, cx, cy
    );
    const end = project3D(
      { x: (hintCrease.end.x - 0.5) * scale, y: (hintCrease.end.y - 0.5) * scale, z: 5 },
      camRot, zoom, cx, cy
    );
    
    const pulse = 0.5 + Math.sin(time * 3) * 0.3;
    ctx.save();
    
    // Outer glow
    ctx.setLineDash([8, 5]);
    ctx.strokeStyle = `rgba(212, 168, 67, ${pulse * 0.3})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // Main dashed line
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = `rgba(90, 74, 58, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // Arrow indicators at ends
    const dir = { x: end.x - start.x, y: end.y - start.y };
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    if (len > 0) {
      const ndir = { x: dir.x / len, y: dir.y / len };
      const perp = { x: -ndir.y, y: ndir.x };
      
      // Start arrow
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(90, 74, 58, ${pulse * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(start.x + ndir.x * 8, start.y + ndir.y * 8);
      ctx.lineTo(start.x + perp.x * 5, start.y + perp.y * 5);
      ctx.lineTo(start.x - perp.x * 5, start.y - perp.y * 5);
      ctx.closePath();
      ctx.fill();
      
      // End arrow
      ctx.beginPath();
      ctx.moveTo(end.x - ndir.x * 8, end.y - ndir.y * 8);
      ctx.lineTo(end.x + perp.x * 5, end.y + perp.y * 5);
      ctx.lineTo(end.x - perp.x * 5, end.y - perp.y * 5);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.restore();
  }
  
  // Draw fold progress indicator
  if (foldProgress > 0 && foldProgress < 1.2) {
    const barWidth = 140;
    const barHeight = 6;
    const barX = cx - barWidth / 2;
    const barY = cy + scale * 0.6 + 25;
    
    // Background bar
    ctx.save();
    ctx.fillStyle = 'rgba(138, 106, 74, 0.2)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 3);
    ctx.fill();
    
    // Progress fill
    const progressWidth = Math.min(foldProgress, 1) * barWidth;
    const progressColor = foldProgress > 0.6 ? 'rgba(90, 140, 74, 0.8)' : 'rgba(90, 74, 58, 0.7)';
    ctx.fillStyle = progressColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY, progressWidth, barHeight, 3);
    ctx.fill();
    
    // Snap threshold marker
    ctx.fillStyle = 'rgba(212, 168, 67, 0.6)';
    ctx.fillRect(barX + barWidth * 0.6 - 1, barY - 2, 2, barHeight + 4);
    
    // Label
    ctx.font = '10px Georgia';
    ctx.fillStyle = 'rgba(90, 74, 58, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText(foldProgress > 0.6 ? 'Release to fold!' : 'Drag to fold...', cx, barY + barHeight + 14);
    ctx.restore();
  }
}

function rotateAroundAxis(point: Vec3, axis: Vec3, origin: Vec3, angle: number): Vec3 {
  const translated = { x: point.x - origin.x, y: point.y - origin.y, z: point.z - origin.z };
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const { x: kx, y: ky, z: kz } = axis;
  const dot = translated.x * kx + translated.y * ky + translated.z * kz;
  const crossX = ky * translated.z - kz * translated.y;
  const crossY = kz * translated.x - kx * translated.z;
  const crossZ = kx * translated.y - ky * translated.x;
  
  return {
    x: translated.x * cos + crossX * sin + kx * dot * (1 - cos) + origin.x,
    y: translated.y * cos + crossY * sin + ky * dot * (1 - cos) + origin.y,
    z: translated.z * cos + crossZ * sin + kz * dot * (1 - cos) + origin.z,
  };
}

function getBounds(points: Vec2[]): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Render the desk scene
export function renderDesk(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
) {
  const desk = getDeskTexture();
  ctx.drawImage(desk, 0, 0, width, height);
  
  // Warm ambient light overlay
  ctx.save();
  ctx.globalAlpha = 0.08;
  const ambientGrad = ctx.createRadialGradient(width * 0.3, height * 0.2, 0, width * 0.3, height * 0.2, width * 0.8);
  ambientGrad.addColorStop(0, '#f4ca6a');
  ambientGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = ambientGrad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  
  // Paper shadow on desk
  const paperSize = Math.min(width, height) * 0.45;
  const paperX = width / 2 - paperSize / 2;
  const paperY = height / 2 - paperSize / 2 - 20;
  
  // Multi-layer shadow for depth
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.roundRect(paperX + 8, paperY + 8, paperSize, paperSize, 2);
  ctx.fill();
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.roundRect(paperX + 4, paperY + 4, paperSize, paperSize, 2);
  ctx.fill();
  ctx.restore();
  
  // Paper sheet with subtle texture
  ctx.fillStyle = '#f4ead5';
  ctx.beginPath();
  ctx.roundRect(paperX, paperY, paperSize, paperSize, 1);
  ctx.fill();
  
  // Paper fiber texture
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.clip();
  const grain = getGrainTexture();
  ctx.drawImage(grain, paperX, paperY, paperSize, paperSize);
  ctx.restore();
  
  // Paper edge highlights (top and left lit)
  ctx.strokeStyle = 'rgba(255, 255, 250, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(paperX, paperY + paperSize);
  ctx.lineTo(paperX, paperY);
  ctx.lineTo(paperX + paperSize, paperY);
  ctx.stroke();
  
  // Bottom and right shadow edges
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paperX + paperSize, paperY);
  ctx.lineTo(paperX + paperSize, paperY + paperSize);
  ctx.lineTo(paperX, paperY + paperSize);
  ctx.stroke();
  
  // Subtle corner curl (bottom-right)
  ctx.save();
  ctx.globalAlpha = 0.06;
  const curlGrad = ctx.createRadialGradient(
    paperX + paperSize, paperY + paperSize, 0,
    paperX + paperSize, paperY + paperSize, paperSize * 0.15
  );
  curlGrad.addColorStop(0, '#000');
  curlGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = curlGrad;
  ctx.fillRect(paperX + paperSize * 0.85, paperY + paperSize * 0.85, paperSize * 0.15, paperSize * 0.15);
  ctx.restore();
  
  // Coffee ring stain (easter egg)
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = '#6a4a2a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(width * 0.82, height * 0.25, 25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = '#6a4a2a';
  ctx.beginPath();
  ctx.arc(width * 0.82, height * 0.25, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  
  // Pencil
  ctx.save();
  ctx.translate(width * 0.15, height * 0.8);
  ctx.rotate(-0.2);
  // Pencil shadow
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#000';
  ctx.fillRect(2, 2, 80, 6);
  ctx.globalAlpha = 1;
  // Pencil body
  ctx.fillStyle = '#d4a843';
  ctx.fillRect(0, -3, 80, 6);
  // Pencil stripe
  ctx.fillStyle = '#b08a32';
  ctx.fillRect(0, -1, 80, 2);
  // Eraser
  ctx.fillStyle = '#d48a8a';
  ctx.fillRect(75, -3, 10, 6);
  // Metal band
  ctx.fillStyle = '#a0a0a0';
  ctx.fillRect(73, -3, 3, 6);
  // Tip
  ctx.fillStyle = '#f4ead5';
  ctx.beginPath();
  ctx.moveTo(85, -3);
  ctx.lineTo(92, 0);
  ctx.lineTo(85, 3);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.moveTo(90, -1);
  ctx.lineTo(93, 0);
  ctx.lineTo(90, 1);
  ctx.fill();
  ctx.restore();
  
  // Small paper scraps (decoration)
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#ede0c8';
  ctx.translate(width * 0.85, height * 0.75);
  ctx.rotate(0.4);
  ctx.fillRect(0, 0, 15, 10);
  ctx.restore();
  
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#e8d8c0';
  ctx.translate(width * 0.88, height * 0.78);
  ctx.rotate(-0.3);
  ctx.fillRect(0, 0, 12, 8);
  ctx.restore();
}

// Time of day palettes
const TIME_PALETTES: Record<TimeOfDay, { sky: string[]; water: string[]; sun: string; ambient: string }> = {
  dawn: { sky: ['#2a1f3a', '#5a3a5a', '#c77a5a', '#f4c87a'], water: ['#3a4a6a', '#5a6a8a'], sun: '#f4c87a', ambient: '#c77a5a' },
  morning: { sky: ['#6a8ab4', '#8aaad4', '#b4d4e4', '#e4f0f4'], water: ['#4a7a9a', '#6a9aba'], sun: '#fff4d4', ambient: '#8aaad4' },
  noon: { sky: ['#4a8ac4', '#6aaae4', '#9acaf4', '#d4eaf8'], water: ['#3a7aaa', '#5a9aca'], sun: '#fff8e4', ambient: '#6aaae4' },
  golden: { sky: ['#4a3a5a', '#8a5a4a', '#d48a4a', '#f4ca6a'], water: ['#5a5a4a', '#8a7a5a'], sun: '#f4ca6a', ambient: '#d48a4a' },
  dusk: { sky: ['#1a1a3a', '#3a2a4a', '#6a3a5a', '#c46a5a'], water: ['#2a3a5a', '#4a4a6a'], sun: '#c46a5a', ambient: '#6a3a5a' },
  night: { sky: ['#0a0a1a', '#1a1a2a', '#1a2a3a', '#2a3a4a'], water: ['#1a2a3a', '#2a3a4a'], sun: '#d4d4e4', ambient: '#2a3a4a' },
};

// Render the diorama
export function renderDiorama(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  timeOfDay: TimeOfDay,
  weather: WeatherType,
  weatherIntensity: number,
  creatures: Creature[],
  particles: Particle[],
  cameraBreath: number,
  seed: number,
) {
  const palette = TIME_PALETTES[timeOfDay];
  const rng = new SeededRNG(seed);
  
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.6);
  palette.sky.forEach((c, i) => skyGrad.addColorStop(i / (palette.sky.length - 1), c));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);
  
  // Stars (visible at night and dusk)
  if (timeOfDay === 'night' || timeOfDay === 'dusk') {
    ctx.save();
    const starAlpha = timeOfDay === 'night' ? 0.8 : 0.3;
    ctx.globalAlpha = starAlpha;
    const starRng = new SeededRNG(seed + 100);
    for (let i = 0; i < 40; i++) {
      const sx = starRng.next() * width;
      const sy = starRng.next() * height * 0.45;
      const ss = 0.5 + starRng.next() * 1.5;
      const twinkle = 0.5 + Math.sin(time * 2 + i * 0.5) * 0.5;
      
      ctx.globalAlpha = starAlpha * twinkle;
      ctx.fillStyle = '#f4f0e8';
      ctx.beginPath();
      ctx.arc(sx, sy, ss, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  
  // Sun/Moon
  const sunX = width * 0.75 + Math.sin(cameraBreath * 0.5) * 5;
  const sunY = height * 0.15 + Math.cos(cameraBreath * 0.3) * 3;
  const sunSize = timeOfDay === 'night' ? 18 : 28;
  
  ctx.save();
  ctx.globalAlpha = timeOfDay === 'night' ? 0.85 : 0.9;
  ctx.fillStyle = palette.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Moon craters at night
  if (timeOfDay === 'night') {
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#b4b4c4';
    ctx.beginPath();
    ctx.arc(sunX - 5, sunY - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sunX + 4, sunY + 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sunX + 2, sunY - 6, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Sun glow
  ctx.globalAlpha = 0.2;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, sunSize, sunX, sunY, sunSize * 3);
  sunGlow.addColorStop(0, palette.sun);
  sunGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(sunX - sunSize * 3, sunY - sunSize * 3, sunSize * 6, sunSize * 6);
  ctx.restore();
  
  // Paper clouds
  const cloudCount = weather === 'fog' ? 8 : 4;
  for (let i = 0; i < cloudCount; i++) {
    const cx = ((i * 200 + time * (20 + i * 5) + rng.next() * 300) % (width + 200)) - 100;
    const cy = height * 0.1 + rng.next() * height * 0.15;
    const cw = 60 + rng.next() * 80;
    const ch = 20 + rng.next() * 15;
    
    ctx.save();
    ctx.globalAlpha = weather === 'fog' ? 0.6 : 0.7;
    ctx.fillStyle = timeOfDay === 'night' ? '#3a4a5a' : '#f0e8d8';
    
    // Paper cloud shape (scalloped)
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw * 0.5, ch * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - cw * 0.25, cy + ch * 0.1, cw * 0.35, ch * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + cw * 0.25, cy + ch * 0.05, cw * 0.3, ch * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Cloud shadow
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx + 3, cy + 5, cw * 0.5, ch * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  
  // Water/waves
  const waterTop = height * 0.55;
  const waterGrad = ctx.createLinearGradient(0, waterTop, 0, height);
  waterGrad.addColorStop(0, palette.water[0]);
  waterGrad.addColorStop(1, palette.water[1]);
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, waterTop, width, height - waterTop);
  
  // Wave layers with papercraft scalloped edges
  const waveLayers: WaveLayer[] = [
    { y: waterTop, speed: 0.8, amplitude: 8, color: lerpColor(palette.water[0], '#ffffff', 0.15), phase: 0 },
    { y: waterTop + 25, speed: 0.6, amplitude: 7, color: lerpColor(palette.water[0], palette.water[1], 0.25), phase: 1.5 },
    { y: waterTop + 50, speed: 0.5, amplitude: 6, color: lerpColor(palette.water[0], palette.water[1], 0.45), phase: 3 },
    { y: waterTop + 75, speed: 0.4, amplitude: 5, color: lerpColor(palette.water[0], palette.water[1], 0.65), phase: 4.5 },
    { y: waterTop + 100, speed: 0.3, amplitude: 4, color: palette.water[1], phase: 6 },
  ];
  
  for (let wi = 0; wi < waveLayers.length; wi++) {
    const wave = waveLayers[wi];
    ctx.beginPath();
    ctx.moveTo(0, height);
    
    // Scalloped wave edge
    for (let x = 0; x <= width; x += 3) {
      const baseY = wave.y + Math.sin(x * 0.015 + time * wave.speed + wave.phase) * wave.amplitude
        + Math.sin(x * 0.008 + time * wave.speed * 0.7) * wave.amplitude * 0.5;
      // Add scallop pattern
      const scallop = Math.sin(x * 0.08 + time * 0.5 + wi) * 2;
      ctx.lineTo(x, baseY + scallop);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = wave.color;
    ctx.fill();
    
    // Paper fold line on wave crest (papercraft detail)
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    for (let x = 0; x <= width; x += 3) {
      const baseY = wave.y + Math.sin(x * 0.015 + time * wave.speed + wave.phase) * wave.amplitude
        + Math.sin(x * 0.008 + time * wave.speed * 0.7) * wave.amplitude * 0.5;
      const scallop = Math.sin(x * 0.08 + time * 0.5 + wi) * 2;
      if (x === 0) ctx.moveTo(x, baseY + scallop - 1);
      else ctx.lineTo(x, baseY + scallop - 1);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    
    // Subtle shadow under wave
    if (wi < waveLayers.length - 1) {
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      for (let x = 0; x <= width; x += 4) {
        const baseY = wave.y + Math.sin(x * 0.015 + time * wave.speed + wave.phase) * wave.amplitude
          + Math.sin(x * 0.008 + time * wave.speed * 0.7) * wave.amplitude * 0.5;
        const scallop = Math.sin(x * 0.08 + time * 0.5 + wi) * 2;
        if (x === 0) ctx.moveTo(x, baseY + scallop + 3);
        else ctx.lineTo(x, baseY + scallop + 3);
      }
      for (let x = width; x >= 0; x -= 4) {
        const baseY = wave.y + Math.sin(x * 0.015 + time * wave.speed + wave.phase) * wave.amplitude
          + Math.sin(x * 0.008 + time * wave.speed * 0.7) * wave.amplitude * 0.5;
        const scallop = Math.sin(x * 0.08 + time * 0.5 + wi) * 2;
        ctx.lineTo(x, baseY + scallop + 8);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  
  // Light reflections on water
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 8; i++) {
    const rx = (i * width / 8 + time * 15) % width;
    const ry = waterTop + 20 + Math.sin(time + i) * 10;
    const rw = 20 + Math.sin(time * 0.5 + i) * 10;
    ctx.fillStyle = palette.sun;
    ctx.beginPath();
    ctx.ellipse(rx, ry, rw, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  
  // Cliffs (left side)
  drawCliff(ctx, 0, waterTop - 40, width * 0.12, height - waterTop + 40, palette, time);
  
  // Lighthouse
  drawLighthouse(ctx, width * 0.08, waterTop - 60, time, palette);
  
  // Pier (right side)
  drawPier(ctx, width * 0.75, waterTop + 10, width * 0.2, time);
  
  // Small island (middle distance)
  const islandX = width * 0.45;
  const islandY = waterTop + 5;
  ctx.save();
  ctx.fillStyle = timeOfDay === 'night' ? '#2a3a2a' : '#5a7a4a';
  ctx.beginPath();
  ctx.ellipse(islandX, islandY, 25, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Palm tree on island
  ctx.strokeStyle = timeOfDay === 'night' ? '#3a2a1a' : '#6a4a2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(islandX, islandY - 3);
  ctx.quadraticCurveTo(islandX + 3, islandY - 20, islandX + 2, islandY - 30);
  ctx.stroke();
  // Palm fronds
  ctx.fillStyle = timeOfDay === 'night' ? '#2a4a2a' : '#4a8a3a';
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + time * 0.2;
    ctx.save();
    ctx.translate(islandX + 2, islandY - 30);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(8, 0, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  
  // Reeds
  for (let i = 0; i < 6; i++) {
    const rx = width * 0.02 + i * 15;
    const ry = waterTop + 5;
    const rh = 30 + rng.next() * 20;
    const sway = Math.sin(time * 1.5 + i) * 3;
    
    ctx.save();
    ctx.strokeStyle = timeOfDay === 'night' ? '#2a4a3a' : '#5a8a5a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.quadraticCurveTo(rx + sway, ry - rh * 0.5, rx + sway * 1.5, ry - rh);
    ctx.stroke();
    ctx.restore();
  }
  
  // Draw creatures
  for (const creature of creatures) {
    renderCreature(ctx, creature, time, waterTop, palette, weather);
  }
  
  // Draw particles
  for (const p of particles) {
    renderParticle(ctx, p, time);
  }
  
  // Fog overlay
  if (weather === 'fog') {
    ctx.save();
    ctx.globalAlpha = 0.3 * weatherIntensity;
    const fogGrad = ctx.createLinearGradient(0, height * 0.4, 0, height * 0.7);
    fogGrad.addColorStop(0, 'transparent');
    fogGrad.addColorStop(0.5, timeOfDay === 'night' ? '#2a3a4a' : '#d4d4d4');
    fogGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, height * 0.3, width, height * 0.5);
    ctx.restore();
  }
  
  // Whale easter egg (rare)
  if (timeOfDay === 'dusk' && Math.sin(time * 0.1) > 0.95) {
    drawWhale(ctx, width, waterTop + 60, time);
  }
}

function drawCliff(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, palette: any, _time: number) {
  ctx.save();
  ctx.fillStyle = shadeColor(palette.ambient, 0.6);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y);
  ctx.quadraticCurveTo(x + w * 0.5, y - 10, x + w, y + 20);
  ctx.lineTo(x + w * 0.8, y + h);
  ctx.closePath();
  ctx.fill();
  
  // Cliff texture
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = shadeColor(palette.ambient, 0.4);
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const ly = y + 10 + i * (h / 6);
    ctx.moveTo(x + 5, ly);
    ctx.lineTo(x + w * 0.7, ly + 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLighthouse(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, palette: any) {
  ctx.save();
  // Base
  ctx.fillStyle = '#f4ead5';
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 40);
  ctx.lineTo(x - 5, y);
  ctx.lineTo(x + 5, y);
  ctx.lineTo(x + 8, y + 40);
  ctx.closePath();
  ctx.fill();
  
  // Red stripe
  ctx.fillStyle = '#c74b3f';
  ctx.fillRect(x - 6, y + 10, 12, 8);
  ctx.fillRect(x - 7, y + 25, 14, 8);
  
  // Light
  const lightPulse = 0.5 + Math.sin(time * 2) * 0.3;
  ctx.globalAlpha = lightPulse;
  ctx.fillStyle = '#f4ca6a';
  ctx.beginPath();
  ctx.arc(x, y - 3, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Light beam
  ctx.globalAlpha = lightPulse * 0.15;
  ctx.fillStyle = '#f4ca6a';
  ctx.beginPath();
  ctx.moveTo(x, y - 3);
  ctx.lineTo(x + 80, y - 30);
  ctx.lineTo(x + 80, y + 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPier(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, time: number) {
  ctx.save();
  const bob = Math.sin(time * 0.5) * 1;
  
  // Pier planks
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(x, y + bob, w, 6);
  
  // Pier posts
  ctx.fillStyle = '#6a4a3a';
  for (let i = 0; i < 3; i++) {
    const px = x + i * (w / 2);
    ctx.fillRect(px, y + bob, 4, 30);
  }
  
  // Rope
  ctx.strokeStyle = '#a08060';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + bob - 2);
  ctx.quadraticCurveTo(x + w / 2, y + bob + 5, x + w, y + bob - 2);
  ctx.stroke();
  ctx.restore();
}

function renderCreature(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  time: number,
  waterTop: number,
  palette: any,
  weather: WeatherType,
) {
  const { position, type, color, scale, rotation, bobPhase } = creature;
  const bob = Math.sin(time * 2 + bobPhase) * 3;
  const x = position.x;
  const y = type === 'boat' || type === 'fish' ? waterTop + 15 + bob : position.y + bob * 0.5;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  
  // Wind tilt
  if (weather === 'wind') {
    ctx.rotate(Math.sin(time * 3) * 0.05);
  }
  
  switch (type) {
    case 'boat':
      drawBoat(ctx, color);
      break;
    case 'crane':
      drawCrane(ctx, color, time, creature);
      break;
    case 'fish':
      drawFish(ctx, color, time, creature);
      break;
    case 'frog':
      drawFrog(ctx, color, time, creature);
      break;
    case 'plane':
      drawPlane(ctx, color, time);
      break;
  }
  
  ctx.restore();
  
  // Name tag on hover (we'll show it always for now, very subtle)
  if (creature.state === 'hovered') {
    ctx.save();
    ctx.font = '10px Georgia';
    ctx.fillStyle = 'rgba(90, 74, 58, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(creature.name, x, y - 20 * scale);
    ctx.restore();
  }
}

function drawBoat(ctx: CanvasRenderingContext2D, color: string) {
  // Hull
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-14, 8);
  ctx.lineTo(14, 8);
  ctx.lineTo(18, 0);
  ctx.lineTo(12, -2);
  ctx.lineTo(-12, -2);
  ctx.closePath();
  ctx.fill();
  
  // Sail
  ctx.fillStyle = shadeColor(color, 1.2);
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(0, -20);
  ctx.lineTo(10, -5);
  ctx.closePath();
  ctx.fill();
  
  // Mast
  ctx.strokeStyle = shadeColor(color, 0.7);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(0, -22);
  ctx.stroke();
  
  // Paper fold lines
  ctx.strokeStyle = shadeColor(color, 0.85);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-14, 4);
  ctx.lineTo(14, 4);
  ctx.stroke();
}

function drawCrane(ctx: CanvasRenderingContext2D, color: string, time: number, creature: Creature) {
  const wingFlap = Math.sin(time * 4 + creature.bobPhase) * 0.3;
  
  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Wings
  ctx.save();
  ctx.rotate(wingFlap);
  ctx.fillStyle = shadeColor(color, 1.1);
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(-18, -8);
  ctx.lineTo(-12, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  
  ctx.save();
  ctx.rotate(-wingFlap);
  ctx.fillStyle = shadeColor(color, 1.1);
  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.lineTo(18, -8);
  ctx.lineTo(12, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  
  // Neck and head
  ctx.fillStyle = shadeColor(color, 0.9);
  ctx.beginPath();
  ctx.moveTo(6, -2);
  ctx.lineTo(12, -8);
  ctx.lineTo(14, -7);
  ctx.lineTo(8, -1);
  ctx.closePath();
  ctx.fill();
  
  // Beak
  ctx.fillStyle = '#d4a843';
  ctx.beginPath();
  ctx.moveTo(14, -7);
  ctx.lineTo(17, -8);
  ctx.lineTo(14, -6);
  ctx.closePath();
  ctx.fill();
  
  // Tail
  ctx.fillStyle = shadeColor(color, 0.8);
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-12, 3);
  ctx.lineTo(-10, -1);
  ctx.closePath();
  ctx.fill();
}

function drawFish(ctx: CanvasRenderingContext2D, color: string, time: number, creature: Creature) {
  const tailWag = Math.sin(time * 5 + creature.bobPhase) * 0.2;
  
  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Tail
  ctx.save();
  ctx.translate(-10, 0);
  ctx.rotate(tailWag);
  ctx.fillStyle = shadeColor(color, 0.9);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, -5);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-8, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  
  // Eye
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.arc(5, -1, 1.5, 0, Math.PI * 2);
  ctx.fill();
  
  // Fin
  ctx.fillStyle = shadeColor(color, 1.1);
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(-3, -8);
  ctx.lineTo(3, -4);
  ctx.closePath();
  ctx.fill();
}

function drawFrog(ctx: CanvasRenderingContext2D, color: string, time: number, creature: Creature) {
  const hop = creature.state === 'hopping' ? Math.abs(Math.sin(time * 8)) * 10 : 0;
  
  ctx.save();
  ctx.translate(0, -hop);
  
  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Back legs (spring)
  ctx.fillStyle = shadeColor(color, 0.8);
  ctx.beginPath();
  ctx.moveTo(-5, 4);
  ctx.lineTo(-8, 8);
  ctx.lineTo(-3, 8);
  ctx.lineTo(-3, 4);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(5, 4);
  ctx.lineTo(8, 8);
  ctx.lineTo(3, 8);
  ctx.lineTo(3, 4);
  ctx.closePath();
  ctx.fill();
  
  // Eyes
  ctx.fillStyle = shadeColor(color, 1.3);
  ctx.beginPath();
  ctx.arc(-3, -5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(3, -5, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Pupils
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.arc(-3, -5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(3, -5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

function drawPlane(ctx: CanvasRenderingContext2D, color: string, time: number) {
  // Fuselage
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-10, -3);
  ctx.lineTo(-12, 0);
  ctx.lineTo(-10, 3);
  ctx.closePath();
  ctx.fill();
  
  // Wings
  ctx.fillStyle = shadeColor(color, 1.1);
  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.lineTo(-5, -12);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-2, 0);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.lineTo(-5, 12);
  ctx.lineTo(-8, 10);
  ctx.lineTo(-2, 0);
  ctx.closePath();
  ctx.fill();
  
  // Tail
  ctx.fillStyle = shadeColor(color, 0.9);
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-14, -4);
  ctx.lineTo(-13, 0);
  ctx.closePath();
  ctx.fill();
  
  // Fold line
  ctx.strokeStyle = shadeColor(color, 0.8);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-12, 0);
  ctx.stroke();
}

function renderParticle(ctx: CanvasRenderingContext2D, p: Particle, _time: number) {
  ctx.save();
  ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
  ctx.translate(p.position.x, p.position.y);
  ctx.rotate(p.rotation);
  
  switch (p.type) {
    case 'confetti':
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      break;
    case 'rain':
      ctx.strokeStyle = 'rgba(150, 180, 200, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(0, p.size);
      ctx.stroke();
      break;
    case 'snow':
      ctx.fillStyle = 'rgba(240, 240, 250, 0.8)';
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'star':
      ctx.fillStyle = p.color;
      drawStar(ctx, 0, 0, p.size, p.size * 0.5, 4);
      break;
    case 'splash':
      ctx.fillStyle = 'rgba(150, 200, 220, 0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, p.size * (1 - p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, points: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawWhale(ctx: CanvasRenderingContext2D, width: number, y: number, time: number) {
  const whaleX = width * 0.5 + Math.sin(time * 0.2) * width * 0.3;
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#1a2a3a';
  ctx.beginPath();
  ctx.ellipse(whaleX, y, 80, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tail
  ctx.beginPath();
  ctx.moveTo(whaleX - 70, y);
  ctx.lineTo(whaleX - 100, y - 15);
  ctx.lineTo(whaleX - 95, y);
  ctx.lineTo(whaleX - 100, y + 15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Title screen
export function renderTitle(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
) {
  // Background gradient (dawn sky)
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#1a1530');
  grad.addColorStop(0.3, '#3a2a4a');
  grad.addColorStop(0.5, '#6a4a5a');
  grad.addColorStop(0.7, '#c77a5a');
  grad.addColorStop(0.85, '#e4a060');
  grad.addColorStop(1, '#f4c87a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  
  // Floating paper particles in the sky
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const px = ((i * 137 + time * 8) % (width + 40)) - 20;
    const py = height * 0.1 + Math.sin(time * 0.3 + i * 2) * 30 + i * 25;
    const pSize = 3 + Math.sin(i) * 2;
    const rot = time * 0.5 + i;
    const alpha = 0.15 + Math.sin(time + i) * 0.1;
    
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#f4ead5';
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.fillRect(-pSize, -pSize * 0.5, pSize * 2, pSize);
    ctx.restore();
  }
  ctx.restore();
  
  // Distant paper mountains/hills
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#4a3a5a';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.65);
  for (let x = 0; x <= width; x += 20) {
    const y = height * 0.6 + Math.sin(x * 0.005) * 20 + Math.sin(x * 0.012) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height * 0.7);
  ctx.lineTo(0, height * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  
  // Animated paper boat
  const boatX = width / 2 + Math.sin(time * 0.5) * 30;
  const boatY = height * 0.6 + Math.sin(time * 1.5) * 5;
  
  ctx.save();
  ctx.translate(boatX, boatY);
  ctx.rotate(Math.sin(time * 0.8) * 0.05);
  
  // Simple boat shape
  ctx.fillStyle = '#f4ead5';
  ctx.beginPath();
  ctx.moveTo(-25, 0);
  ctx.lineTo(-20, 10);
  ctx.lineTo(20, 10);
  ctx.lineTo(25, 0);
  ctx.lineTo(15, -3);
  ctx.lineTo(-15, -3);
  ctx.closePath();
  ctx.fill();
  
  // Sail
  ctx.fillStyle = '#ede0c8';
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(0, -30);
  ctx.lineTo(15, -8);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
  
  // Water
  ctx.fillStyle = 'rgba(58, 74, 106, 0.5)';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.65);
  for (let x = 0; x <= width; x += 4) {
    const y = height * 0.65 + Math.sin(x * 0.02 + time) * 5 + Math.sin(x * 0.01 + time * 0.7) * 3;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  
  // Title
  ctx.save();
  ctx.font = 'italic 48px Georgia, serif';
  ctx.fillStyle = '#f4ead5';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 10;
  ctx.fillText('Paper Tide', width / 2, height * 0.3);
  ctx.restore();
  
  // Subtitle
  ctx.save();
  ctx.font = '16px Georgia, serif';
  ctx.fillStyle = 'rgba(244, 234, 213, 0.7)';
  ctx.textAlign = 'center';
  const pulse = 0.5 + Math.sin(time * 2) * 0.3;
  ctx.globalAlpha = pulse;
  ctx.fillText('Click anywhere to begin', width / 2, height * 0.42);
  ctx.restore();
  
  // Small tagline
  ctx.save();
  ctx.font = 'italic 13px Georgia, serif';
  ctx.fillStyle = 'rgba(244, 234, 213, 0.5)';
  ctx.textAlign = 'center';
  ctx.fillText('Fold. Release. Drift.', width / 2, height * 0.88);
  ctx.restore();
}
