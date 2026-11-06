/** Varsayılan: her 10 çözümde 50 puan düşer; taban 100. */
export const DEFAULT_DECAY_SOLVES = 10;
export const DEFAULT_DECAY_DROP = 50;
export const PARTICIPANTS = 50;

export function resolveDecay(initial, opts = {}) {
  const points = Math.max(50, Math.round(Number(initial) || 100));
  const decaySolves = Math.max(
    1,
    Math.round(Number(opts.decaySolves) || DEFAULT_DECAY_SOLVES)
  );
  const decayDrop = Math.max(
    0,
    Math.round(Number(opts.decayDrop) || DEFAULT_DECAY_DROP)
  );
  const minPoints = Math.max(
    50,
    Math.round(Number(opts.minPoints) > 0 ? Number(opts.minPoints) : 100)
  );
  return { points, decaySolves, decayDrop, minPoints };
}

export function minPointsFor(initial, opts = {}) {
  return resolveDecay(initial, opts).minPoints;
}

/**
 * Doğrusal düşüş: her çözümde (decayDrop / decaySolves) puan iner.
 * Örn. her 10 çözümde 50 düş → 10. çözümde −50, 20. çözümde −100 (tabanın altına inmez).
 */
export function dynamicPoints(initial, solves, opts = {}) {
  const { points, decaySolves, decayDrop, minPoints } = resolveDecay(
    initial,
    opts
  );
  const n = Math.max(0, Number(solves) || 0);
  if (n <= 0) return points;
  const dropped = (decayDrop / decaySolves) * n;
  return Math.max(minPoints, Math.ceil(points - dropped));
}

export function getLevel(score) {
  if (score >= 5200) return 6;
  if (score >= 4000) return 5;
  if (score >= 2800) return 4;
  if (score >= 1800) return 3;
  if (score >= 1000) return 2;
  return 1;
}
