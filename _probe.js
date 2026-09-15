// _probe.js — dump internal state as ASCII so we can SEE the plan is sane (not just "runs").
const fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const m=html.match(/<script id="engine">([\s\S]*?)<\/script>/);
const ctx={console,Math,Float64Array,Array,JSON,Object,isFinite,Infinity,globalThis:{}};
ctx.globalThis=ctx; vm.createContext(ctx); vm.runInContext(m[1],ctx,{});
const OT=ctx.OT;

const rng=OT.mulberry32(2026);
const X=OT.gauss(rng,[-1.6,0.4],0.45,2,16);
const Y=OT.gauss(rng,[1.6,-0.4],0.45,2,16);
const a=OT.uniform(16), b=OT.uniform(16);
const C=OT.costMatrix(X,Y,2);
const P=OT.sinkhorn(a,b,C,0.1,5000);

let out='';
out+='=== 传输计划 P (16×16, 行=源X 列=目标Y) ===\n';
out+='    '+Array.from({length:16},(_,j)=>(j%10)).join(' ')+'\n';
for(let i=0;i<16;i++){
  let row='';
  for(let j=0;j<16;j++){ const p=P[i][j]; row+= (p>0.04?'#':p>0.01?':':p>0.002?'.':' '); }
  out+=(''+i).padStart(2)+' |'+row+'|\n';
}
out+='  (# >0.04  : >0.01  . >0.002)\n\n';

const rs=OT.rowSums(P), cs=OT.colSums(P);
let rmax=0,cmax=0; for(let i=0;i<16;i++) rmax=Math.max(rmax,Math.abs(rs[i]-a[i]));
for(let j=0;j<16;j++) cmax=Math.max(cmax,Math.abs(cs[j]-b[j]));
out+='W2^2 = '+OT.wasserstein(P,C).toFixed(4)+'\n';
out+='行和最大偏差 = '+rmax.toExponential(2)+'\n';
out+='列和最大偏差 = '+cmax.toExponential(2)+'\n';
out+='KL(P‖ab)   = '+OT.klTransport(P,a,b).toExponential(3)+'  (≥0)\n\n';

out+='=== ε → 正则化代价 (<P,C> 随 ε 增大单调上升) ===\n';
const epsArr=[], costArr=[];
for(let e=2.0;e>=0.02;e-=0.2){ epsArr.push(+e.toFixed(2)); costArr.push(OT.wasserstein(OT.sinkhorn(a,b,C,e,2000),C)); }
const W=60;
for(let k=0;k<epsArr.length;k++){
  const e=epsArr[k], c=costArr[k];
  out+=('ε='+e.toFixed(2)).padStart(7)+' |'+'#'.repeat(Math.round(c/W*60))+' '+c.toFixed(2)+'\n';
}

fs.writeFileSync(path.join(__dirname,'_probe.txt'),out);
console.log(out);
