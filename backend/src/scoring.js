export const PARTICIPANTS = 50;
export const DECAY = 40;

export function minPointsFor(initial) {
  return Math.max(50, Math.round(initial * 0.2));
}

export function dynamicPoints(initial, solves) {
  const minimum = minPointsFor(initial);
  if (solves <= 0) return initial;
  const value =
    ((minimum - initial) / (DECAY * DECAY)) * (solves * solves) + initial;
  return Math.max(minimum, Math.ceil(value));
}

export function getLevel(score) {
  if (score >= 5200) return 6;
  if (score >= 4000) return 5;
  if (score >= 2800) return 4;
  if (score >= 1800) return 3;
  if (score >= 1000) return 2;
  return 1;
}
