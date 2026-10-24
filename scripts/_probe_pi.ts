const PI = 3.14;
function piArea(radius) { return Math.round(radius * radius * PI * 100) / 100; }
let worst = 0, worstCase = null, exact005 = 0;
for (let d = 4; d <= 40; d++) {
  const r = d / 2;
  const area = piArea(r);
  const exact = 3.14 * r * r;
  const diff = Math.abs(area - exact);
  if (diff > worst) { worst = diff; worstCase = { d, area, exact, diff }; }
  if (Math.abs(diff - 0.005) < 1e-9) exact005++;
}
console.log('worst diff', JSON.stringify(worstCase));
console.log('cases with diff exactly 0.005:', exact005);
for (const d of [5, 7, 9, 11]) {
  const r = d/2; const area = piArea(r); const exact = 3.14*r*r;
  console.log(`d=${d} area=${area} exact=${exact} diff=${Math.abs(area-exact)}  lt005=${Math.abs(area-exact)<0.005}  le005eps=${Math.abs(area-exact)<=0.005+1e-9}`);
}
