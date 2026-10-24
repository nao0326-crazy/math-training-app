const PI=3.14;
function piArea(r){return Math.round(r*r*PI*100)/100;}
let bad=[];
for(let r=2;r<=30;r++){
  const area=piArea(r), exact=PI*r*r, diff=Math.abs(area-exact);
  if(!(diff<0.005)) bad.push({r,area,exact,diff});
}
console.log('circle_area_radius boundary failures:', JSON.stringify(bad));
let bad2=[];
for(let d=4;d<=40;d++){
  const r=d/2, area=piArea(r), exact=PI*r*r, diff=Math.abs(area-exact);
  if(!(diff<0.005)) bad2.push({d,area,exact,diff:+diff.toFixed(12)});
}
console.log('circle_area_diameter boundary failures:', JSON.stringify(bad2));
