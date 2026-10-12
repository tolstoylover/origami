// Paper Tide - Fold Pattern Definitions
import { Pattern, Vec2 } from './types';

// All coordinates are normalized to [0,1] range on a square sheet
// Crease lines go from start to end, with mountain/valley type

export const patterns: Pattern[] = [
  {
    id: 'plane',
    name: 'Paper Plane',
    icon: '✈',
    creatureType: 'plane',
    hiddenMessage: 'May your folds carry you far.',
    steps: [
      {
        creaseStart: { x: 0.5, y: 0 },
        creaseEnd: { x: 0.5, y: 1 },
        type: 'valley',
        targetAngle: Math.PI,
        hint: 'Fold in half lengthwise',
      },
      {
        creaseStart: { x: 0.5, y: 0 },
        creaseEnd: { x: 0, y: 0.3 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold top corner down to center',
      },
      {
        creaseStart: { x: 0.5, y: 0 },
        creaseEnd: { x: 1, y: 0.3 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold other corner to center',
      },
      {
        creaseStart: { x: 0.5, y: 0.15 },
        creaseEnd: { x: 0, y: 0.55 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold edge to center again',
      },
      {
        creaseStart: { x: 0.5, y: 0.15 },
        creaseEnd: { x: 1, y: 0.55 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold other edge to center',
      },
    ],
  },
  {
    id: 'boat',
    name: 'Paper Boat',
    icon: '⛵',
    creatureType: 'boat',
    hiddenMessage: 'Set sail on paper tides.',
    steps: [
      {
        creaseStart: { x: 0, y: 0.5 },
        creaseEnd: { x: 1, y: 0.5 },
        type: 'valley',
        targetAngle: Math.PI,
        hint: 'Fold in half horizontally',
      },
      {
        creaseStart: { x: 0.5, y: 0 },
        creaseEnd: { x: 0.2, y: 0.5 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold left corner down',
      },
      {
        creaseStart: { x: 0.5, y: 0 },
        creaseEnd: { x: 0.8, y: 0.5 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold right corner down',
      },
      {
        creaseStart: { x: 0, y: 0.7 },
        creaseEnd: { x: 1, y: 0.7 },
        type: 'valley',
        targetAngle: Math.PI * 0.4,
        hint: 'Fold bottom strip up',
      },
      {
        creaseStart: { x: 0, y: 0.7 },
        creaseEnd: { x: 1, y: 0.7 },
        type: 'mountain',
        targetAngle: -Math.PI * 0.3,
        hint: 'Fold other strip up',
      },
      {
        creaseStart: { x: 0.3, y: 0.3 },
        creaseEnd: { x: 0.7, y: 0.3 },
        type: 'valley',
        targetAngle: Math.PI * 0.6,
        hint: 'Open and shape the hull',
      },
      {
        creaseStart: { x: 0.2, y: 0.5 },
        creaseEnd: { x: 0.8, y: 0.5 },
        type: 'valley',
        targetAngle: Math.PI * 0.4,
        hint: 'Flatten the bottom',
      },
      {
        creaseStart: { x: 0.1, y: 0.6 },
        creaseEnd: { x: 0.9, y: 0.6 },
        type: 'valley',
        targetAngle: Math.PI * 0.3,
        hint: 'Spread the sail wide',
      },
    ],
  },
  {
    id: 'crane',
    name: 'Paper Crane',
    icon: '🕊',
    creatureType: 'crane',
    unlockAfter: 'boat',
    hiddenMessage: 'A thousand folds, a thousand wishes.',
    steps: [
      {
        creaseStart: { x: 0, y: 0 },
        creaseEnd: { x: 1, y: 1 },
        type: 'valley',
        targetAngle: Math.PI,
        hint: 'Diagonal fold corner to corner',
      },
      {
        creaseStart: { x: 1, y: 0 },
        creaseEnd: { x: 0, y: 1 },
        type: 'valley',
        targetAngle: Math.PI,
        hint: 'Fold the other diagonal',
      },
      {
        creaseStart: { x: 0.5, y: 0 },
        creaseEnd: { x: 0.5, y: 1 },
        type: 'mountain',
        targetAngle: -Math.PI,
        hint: 'Fold in half vertically',
      },
      {
        creaseStart: { x: 0.25, y: 0.25 },
        creaseEnd: { x: 0.75, y: 0.75 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Squash fold the top layer',
      },
      {
        creaseStart: { x: 0.3, y: 0.5 },
        creaseEnd: { x: 0.7, y: 0.5 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold edges to center',
      },
      {
        creaseStart: { x: 0.5, y: 0.3 },
        creaseEnd: { x: 0.5, y: 0.7 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold up to form the neck',
      },
      {
        creaseStart: { x: 0.35, y: 0.5 },
        creaseEnd: { x: 0.65, y: 0.5 },
        type: 'mountain',
        targetAngle: -Math.PI * 0.4,
        hint: 'Fold the head down',
      },
      {
        creaseStart: { x: 0.2, y: 0.4 },
        creaseEnd: { x: 0.8, y: 0.4 },
        type: 'valley',
        targetAngle: Math.PI * 0.6,
        hint: 'Shape the left wing',
      },
      {
        creaseStart: { x: 0.2, y: 0.6 },
        creaseEnd: { x: 0.8, y: 0.6 },
        type: 'valley',
        targetAngle: Math.PI * 0.6,
        hint: 'Shape the right wing',
      },
      {
        creaseStart: { x: 0.15, y: 0.5 },
        creaseEnd: { x: 0.85, y: 0.5 },
        type: 'valley',
        targetAngle: Math.PI * 0.3,
        hint: 'Spread the wings wide',
      },
    ],
  },
  {
    id: 'fish',
    name: 'Paper Fish',
    icon: '🐟',
    creatureType: 'fish',
    unlockAfter: 'boat',
    hiddenMessage: 'Swim through folded seas.',
    steps: [
      {
        creaseStart: { x: 0.5, y: 0 },
        creaseEnd: { x: 0.5, y: 1 },
        type: 'valley',
        targetAngle: Math.PI,
        hint: 'Fold in half lengthwise',
      },
      {
        creaseStart: { x: 0.5, y: 0 },
        creaseEnd: { x: 0.1, y: 0.5 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold top to form the head',
      },
      {
        creaseStart: { x: 0.5, y: 1 },
        creaseEnd: { x: 0.1, y: 0.5 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold bottom to form the head',
      },
      {
        creaseStart: { x: 0.8, y: 0.2 },
        creaseEnd: { x: 0.8, y: 0.8 },
        type: 'valley',
        targetAngle: Math.PI * 0.4,
        hint: 'Fold the tail fin',
      },
      {
        creaseStart: { x: 0.85, y: 0.15 },
        creaseEnd: { x: 0.85, y: 0.85 },
        type: 'mountain',
        targetAngle: -Math.PI * 0.3,
        hint: 'Split the tail',
      },
      {
        creaseStart: { x: 0.3, y: 0.3 },
        creaseEnd: { x: 0.3, y: 0.7 },
        type: 'valley',
        targetAngle: Math.PI * 0.3,
        hint: 'Shape the body',
      },
    ],
  },
  {
    id: 'frog',
    name: 'Paper Frog',
    icon: '🐸',
    creatureType: 'frog',
    unlockAfter: 'crane',
    hiddenMessage: 'Hop with joy, little one.',
    steps: [
      {
        creaseStart: { x: 0.5, y: 0 },
        creaseEnd: { x: 0.5, y: 1 },
        type: 'valley',
        targetAngle: Math.PI,
        hint: 'Fold in half lengthwise',
      },
      {
        creaseStart: { x: 0, y: 0 },
        creaseEnd: { x: 0.5, y: 0.3 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold top-left corner in',
      },
      {
        creaseStart: { x: 1, y: 0 },
        creaseEnd: { x: 0.5, y: 0.3 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold top-right corner in',
      },
      {
        creaseStart: { x: 0, y: 0.5 },
        creaseEnd: { x: 0.5, y: 0.5 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold left side to center',
      },
      {
        creaseStart: { x: 1, y: 0.5 },
        creaseEnd: { x: 0.5, y: 0.5 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold right side to center',
      },
      {
        creaseStart: { x: 0.2, y: 0.7 },
        creaseEnd: { x: 0.8, y: 0.7 },
        type: 'valley',
        targetAngle: Math.PI * 0.5,
        hint: 'Fold bottom up for legs',
      },
      {
        creaseStart: { x: 0.2, y: 0.85 },
        creaseEnd: { x: 0.8, y: 0.85 },
        type: 'mountain',
        targetAngle: -Math.PI * 0.5,
        hint: 'Fold legs down again',
      },
      {
        creaseStart: { x: 0.3, y: 0.6 },
        creaseEnd: { x: 0.7, y: 0.6 },
        type: 'valley',
        targetAngle: Math.PI * 0.4,
        hint: 'Form the spring - press to hop!',
      },
    ],
  },
];

export function getPattern(id: string): Pattern | undefined {
  return patterns.find(p => p.id === id);
}

export function getUnlockedPatterns(unlocked: string[]): Pattern[] {
  return patterns.filter(p => !p.unlockAfter || unlocked.includes(p.unlockAfter));
}

// Generate initial paper face (single square)
export function createInitialPaper(): { vertices: Vec2[] } {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
  };
}
