import { matchStroke, resample, pathLength } from "./stroke-matcher.js";

function assert(cond, message) {
  if (!cond)
    throw new Error(message);
}

const line = Array.from({ length: 20 }, (_, i) => ({ x: i * 5, y: 10 }));
const close = line.map((p) => ({ x: p.x + 2, y: p.y + 3 }));
const reversed = [...line].reverse();
const elsewhere = Array.from({ length: 20 }, (_, i) => ({ x: 80, y: i * 5 }));

assert(matchStroke(close, line).ok, "near-parallel stroke should pass");
assert(!matchStroke(reversed, line).ok, "reversed stroke should fail");
assert(!matchStroke(elsewhere, line).ok, "orthogonal stroke should fail");
assert(resample(line, 8).length === 8, "resample count");
assert(pathLength(line) > 90 && pathLength(line) < 100, "path length of 19*5");

console.log("stroke-matcher.check: ok");
