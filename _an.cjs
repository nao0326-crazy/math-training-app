const fs = require('fs');
const j = JSON.parse(fs.readFileSync('_va_raw.json', 'utf8'));
const g = {};
for (const m of j.mismatches) {
  const t = m.split(':')[0];
  const v = (m.match(/"variant":"([a-z_]+)"/) || [])[1] || '-';
  const k = t + '/' + v;
  g[k] = (g[k] || 0) + 1;
}
console.log(JSON.stringify(g, null, 1));
console.log('--- percentage mismatches (unique variants) ---');
for (const m of j.mismatches) {
  if (!m.startsWith('percentage')) continue;
  console.log(m.slice(0, 260));
}
