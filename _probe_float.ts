const r = 18.5;
console.log('generator piArea =', Math.round(r*r*3.14*100)/100);
console.log('verifier 3.14*r*r =', 3.14*r*r);
console.log('diff =', Math.abs(Math.round(r*r*3.14*100)/100 - (3.14*r*r)));
console.log('diff < 0.005 ?', Math.abs(Math.round(r*r*3.14*100)/100 - (3.14*r*r)) < 0.005);
console.log('---- 40/100*20 =', 40/100*20, ' 112*75/100 =', 112*75/100);
