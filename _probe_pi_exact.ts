const PI = 3.14;
function piArea(radius: number): number { return Math.round(radius * radius * PI * 100) / 100; }

// Exact math: area = 3.14 * r^2. For r = d/2 => 157*d^2/200 ; for integer r => 157*r^2/50
function exactRound2(num: bigint, den: bigint): number {
  // round-half-up of (num/den) to 2 decimals
  const scaled = num * 100n;
  const rounded = (scaled * 2n + den) / (den * 2n); // floor(x + 0.5)
  return Number(rounded) / 100;
}

console.log('--- integer radius: exact vs piArea ---');
let badR = 0;
for (let r = 1; r <= 40; r++) {
  const got = piArea(r);
  const want = exactRound2(157n * BigInt(r * r), 50n);
  if (Math.abs(got - want) > 1e-9) { badR++; console.log(`r=${r} got=${got} exact=${want} exactRaw=${(157*r*r/50)}`); }
}
console.log('integer-radius mismatches:', badR);

console.log('--- half radius (diameter): exact vs piArea ---');
let badD = 0;
for (let d = 2; d <= 60; d++) {
  const r = d / 2;
  const got = piArea(r);
  const want = exactRound2(157n * BigInt(d * d), 200n);
  if (Math.abs(got - want) > 1e-9) { badD++; console.log(`d=${d} r=${r} got=${got} exact=${want}`); }
}
console.log('half-radius mismatches:', badD);

console.log('--- boundary cases (|got-exact| == 0.005) ---');
for (let d = 2; d <= 60; d++) {
  const r = d / 2;
  const got = piArea(r);
  const raw = 3.14 * r * r;
  const diff = Math.abs(got - raw);
  if (diff >= 0.005 - 1e-12) {
    const want = exactRound2(157n * BigInt(d * d), 200n);
    console.log(`d=${d} r=${r} got=${got} raw=${raw} diff=${diff} exactRounded=${want} matchesExact=${Math.abs(got-want)<1e-9}`);
  }
}
