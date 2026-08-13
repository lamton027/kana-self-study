const N = 32;

export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function pathLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += dist(points[i - 1], points[i]);
  return length;
}

export function resample(points, count = N) {
  if (!points.length)
    return [];
  if (points.length === 1)
    return Array.from({ length: count }, () => ({ ...points[0] }));

  const total = pathLength(points);
  if (total === 0)
    return Array.from({ length: count }, () => ({ ...points[0] }));

  const step = total / (count - 1);
  const out = [{ ...points[0] }];
  let accumulated = 0;
  let index = 1;
  let prev = points[0];

  for (let s = 1; s < count - 1; s++) {
    const target = s * step;
    while (index < points.length && accumulated + dist(prev, points[index]) < target) {
      accumulated += dist(prev, points[index]);
      prev = points[index];
      index++;
    }
    if (index >= points.length) {
      out.push({ ...points[points.length - 1] });
      continue;
    }
    const segment = dist(prev, points[index]);
    const t = segment === 0 ? 0 : (target - accumulated) / segment;
    out.push({
      x: prev.x + (points[index].x - prev.x) * t,
      y: prev.y + (points[index].y - prev.y) * t,
    });
  }

  out.push({ ...points[points.length - 1] });
  return out;
}

export const MATCH_DEFAULTS = {
  startMax: 24,
  endMax: 30,
  avgMax: 20,
  lengthMin: 0.4,
  lengthMax: 2.4,
};

export function matchStroke(userPoints, templatePoints, options = MATCH_DEFAULTS) {
  if (!userPoints || userPoints.length < 3 || !templatePoints || templatePoints.length < 2)
    return { ok: false, reason: "too-short" };

  const user = resample(userPoints);
  const template = resample(templatePoints);
  const start = dist(user[0], template[0]);
  const end = dist(user[user.length - 1], template[template.length - 1]);
  const reversedStart = dist(user[0], template[template.length - 1]);

  if (reversedStart + 6 < start)
    return { ok: false, reason: "reversed" };

  let avg = 0;
  for (let i = 0; i < user.length; i++)
    avg += dist(user[i], template[i]);
  avg /= user.length;

  const ratio = pathLength(userPoints) / Math.max(pathLength(templatePoints), 1);
  if (start > options.startMax)
    return { ok: false, reason: "start", start, avg, end, ratio };
  if (end > options.endMax)
    return { ok: false, reason: "end", start, avg, end, ratio };
  if (avg > options.avgMax)
    return { ok: false, reason: "shape", start, avg, end, ratio };
  if (ratio < options.lengthMin || ratio > options.lengthMax)
    return { ok: false, reason: "length", start, avg, end, ratio };

  return { ok: true, start, avg, end, ratio };
}
