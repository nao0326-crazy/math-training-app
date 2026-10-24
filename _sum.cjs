const fs=require('fs');
const d=JSON.parse(fs.readFileSync('_base_va.json','utf8'));
console.log('total',d.totalGenerated,'ok',d.ok,'mismatch',d.mismatch,'skipped',d.skipped);
const bad=d.perTypeWithCoverage.filter(r=>r.mismatch>0);
console.log(JSON.stringify(bad,null,1));
