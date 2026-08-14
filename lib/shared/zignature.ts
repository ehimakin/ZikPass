import { stableStringify } from "@/lib/shared/utils";

export interface ZignaturePoint {
  x: number;
  y: number;
}

export interface ZignatureGenerationOptions {
  width?: number;
  height?: number;
  variant?: "full" | "compact";
}

interface HarmonicTerm {
  amplitude: number;
  frequency: number;
  phase: number;
}

interface LoopDescriptor {
  centerT: number;
  radiusT: number;
  width: number;
  height: number;
  direction: 1 | -1;
}

const FULL_DIMENSIONS = {
  width: 320,
  height: 96,
  samples: 58,
  paddingX: 20,
  paddingY: 18
};

const COMPACT_DIMENSIONS = {
  width: 220,
  height: 72,
  samples: 44,
  paddingX: 16,
  paddingY: 14
};

export function buildCredentialZignatureSeedInput(input: {
  credentialId: string;
  subjectPublicKey?: JsonWebKey;
}): string {
  return input.subjectPublicKey
    ? `${input.credentialId}:${stableStringify(input.subjectPublicKey)}`
    : input.credentialId;
}

export function generateZignaturePathData(
  seedInput: string,
  options?: ZignatureGenerationOptions
): string {
  return pointsToCubicBezierPath(generateZignaturePoints(seedInput, options));
}

export function generateZignaturePoints(
  seedInput: string,
  options?: ZignatureGenerationOptions
): ZignaturePoint[] {
  const variant = options?.variant ?? "full";
  const defaults = variant === "compact" ? COMPACT_DIMENSIONS : FULL_DIMENSIONS;
  const width = options?.width ?? defaults.width;
  const height = options?.height ?? defaults.height;
  const paddingX = defaults.paddingX;
  const paddingY = defaults.paddingY;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;
  const samples = defaults.samples;
  const rng = createMulberry32(hashStringToSeed(seedInput));

  const baseline = height * randomBetween(rng, 0.5, 0.6);
  const tilt = randomBetween(rng, -0.06, 0.06) * usableHeight;
  const midLift = randomBetween(rng, -0.02, 0.035) * usableHeight;
  const harmonics: HarmonicTerm[] = [
    {
      amplitude: randomBetween(rng, 0.15, 0.21) * usableHeight,
      frequency: randomBetween(rng, 0.72, 1.12),
      phase: randomBetween(rng, 0, Math.PI * 2)
    },
    {
      amplitude: randomBetween(rng, 0.08, 0.14) * usableHeight,
      frequency: randomBetween(rng, 1.6, 2.4),
      phase: randomBetween(rng, 0, Math.PI * 2)
    },
    {
      amplitude: randomBetween(rng, 0.04, 0.08) * usableHeight,
      frequency: randomBetween(rng, 2.8, 4.2),
      phase: randomBetween(rng, 0, Math.PI * 2)
    }
  ];
  const loops = buildLoopDescriptors(rng, usableWidth, usableHeight, variant);

  return Array.from({ length: samples }, (_, index) => {
    const t = index / (samples - 1);
    const centeredT = t - 0.5;
    const openingEase = smoothStep(0, 0.12, t);
    const closingEase = 1 - smoothStep(0.88, 1, t);
    const edgeEase = Math.min(openingEase, closingEase);
    const harmonicWave = harmonics.reduce((sum, term) => {
      return sum + term.amplitude * Math.sin(Math.PI * 2 * term.frequency * t + term.phase);
    }, 0);
    const flourish =
      Math.sin(Math.PI * t) * midLift + Math.sin(Math.PI * 2 * (t + 0.08)) * usableHeight * 0.015;
    const drift = tilt * centeredT;
    const loopOffset = loops.reduce(
      (sum, loop) => {
        const local = getLocalLoopProgress(t, loop);
        if (local === null) {
          return sum;
        }

        const angle = local * Math.PI * 2;
        const envelope = Math.pow(Math.sin(Math.PI * local), 0.22);

        return {
          x: sum.x + Math.sin(angle) * loop.width * envelope,
          y: sum.y + loop.direction * (1 - Math.cos(angle)) * loop.height * 0.5 * envelope
        };
      },
      { x: 0, y: 0 }
    );
    const x = clamp(paddingX + usableWidth * t + loopOffset.x, paddingX, width - paddingX);
    const y = clamp(
      baseline + drift + edgeEase * (harmonicWave * 0.88 + flourish) + loopOffset.y,
      paddingY,
      height - paddingY
    );

    return {
      x: roundTo(x, 2),
      y: roundTo(y, 2)
    };
  });
}

function pointsToCubicBezierPath(points: ZignaturePoint[]): string {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x} ${point.y}`;
  }

  const tension = 0.92;
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    path += ` C ${roundTo(cp1x, 2)} ${roundTo(cp1y, 2)}, ${roundTo(cp2x, 2)} ${roundTo(cp2y, 2)}, ${p2.x} ${p2.y}`;
  }

  return path;
}

function buildLoopDescriptors(
  rng: () => number,
  usableWidth: number,
  usableHeight: number,
  variant: NonNullable<ZignatureGenerationOptions["variant"]>
): LoopDescriptor[] {
  const count = variant === "compact" ? 1 : rng() > 0.45 ? 2 : 1;

  if (count === 1) {
    return [
      {
        centerT: randomBetween(rng, 0.42, 0.62),
        radiusT: randomBetween(rng, 0.11, 0.15),
        width: randomBetween(rng, 0.07, 0.1) * usableWidth,
        height: randomBetween(rng, 0.17, 0.24) * usableHeight,
        direction: rng() > 0.5 ? 1 : -1
      }
    ];
  }

  return [
    {
      centerT: randomBetween(rng, 0.34, 0.46),
      radiusT: randomBetween(rng, 0.085, 0.12),
      width: randomBetween(rng, 0.05, 0.075) * usableWidth,
      height: randomBetween(rng, 0.12, 0.18) * usableHeight,
      direction: rng() > 0.4 ? 1 : -1
    },
    {
      centerT: randomBetween(rng, 0.56, 0.7),
      radiusT: randomBetween(rng, 0.085, 0.12),
      width: randomBetween(rng, 0.045, 0.07) * usableWidth,
      height: randomBetween(rng, 0.1, 0.16) * usableHeight,
      direction: rng() > 0.6 ? -1 : 1
    }
  ];
}

function getLocalLoopProgress(t: number, loop: LoopDescriptor): number | null {
  const start = loop.centerT - loop.radiusT;
  const end = loop.centerT + loop.radiusT;

  if (t < start || t > end) {
    return null;
  }

  return (t - start) / (end - start);
}

function hashStringToSeed(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createMulberry32(seed: number): () => number {
  let current = seed >>> 0;

  return () => {
    current = (current + 0x6d2b79f5) >>> 0;
    let output = Math.imul(current ^ (current >>> 15), current | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function roundTo(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}
