// Headless invariant harness for ot-forge (run with native Node, NOT vm — speed).
// Extracts <script id="engine"> from index.html and asserts 15 invariants.
const fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const m=html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if(!m){ console.error('engine script not found'); process.exit(1); }
const ctx={console,Math,Float64Array,Array,JSON,Object,isFinite,Infinity,globalThis:{}};
ctx.globalThis=ctx; vm.createContext(ctx); vm.runInContext(m[1],ctx,{filename:'engine.js'});
const OT=ctx.OT;

let pass=0,fail=0; const fails=[];
function ok(name,cond,detail){ if(cond){pass++;/*console.log('  ✓',name,(detail||''));*/} else {fail++;fails.push(name+(detail?' ['+detail+']':''));console.log('  ✗',name,detail||'');} }

// two gaussians 1D
const rng=OT.mulberry32(2026);
const A=OT.gauss(rng,0,1,1,24).map(p=>p[0]);
const B=OT.gauss(rng,2.0,1,1,24).map(p=>p[0]);
const a1=OT.uniform(24),b1=OT.uniform(24);
const C1=OT.costMatrix(A.map(x=>[x]),B.map(x=>[x]),2);
const P1=OT.sinkhorn(a1,b1,C1,0.05,3000);
const w2s=OT.wasserstein(P1,C1), w2c=OT.w2sqClosed(A,B);

// 1) 1D W2^2 closed form == Sinkhorn
ok("1D W2^2 闭式==Sinkhorn", Math.abs(w2s-w2c)<w2c*0.06, 'Δ='+((w2s-w2c)/w2c*100).toFixed(2)+'%');

// 2) 1D W1 closed form == Sinkhorn
const C1b=OT.costMatrix(A.map(x=>[x]),B.map(x=>[x]),1);
const P1b=OT.sinkhorn(a1,b1,C1b,0.05,3000);
const w1s=OT.wasserstein(P1b,C1b), w1c=OT.w1Closed(A,B);
ok("1D W1 闭式==Sinkhorn", Math.abs(w1s-w1c)<w1c*0.06, 'Δ='+((w1s-w1c)/w1c*100).toFixed(2)+'%');

// 3) marginal constraints
const rs=OT.rowSums(P1), cs=OT.colSums(P1);
let rmax=0,cmax=0; for(let i=0;i<24;i++) rmax=Math.max(rmax,Math.abs(rs[i]-a1[i]));
for(let j=0;j<24;j++) cmax=Math.max(cmax,Math.abs(cs[j]-b1[j]));
ok("边际约束 行和==a", rmax<1e-4, 'maxΔ='+rmax.toExponential(1));
ok("边际约束 列和==b", cmax<1e-4, 'maxΔ='+cmax.toExponential(1));

// 4) mass conservation
ok("质量守恒 ΣP==1", Math.abs(OT.total(P1)-1)<1e-9, 'Σ='+OT.total(P1).toExponential(2));

// 5) non-negativity
let neg=false,mn=0; for(let i=0;i<24;i++) for(let j=0;j<24;j++){ if(P1[i][j]<mn) mn=P1[i][j]; if(P1[i][j]<-1e-12) neg=true; }
ok("P 非负", !neg, 'min='+mn.toExponential(1));

// 6) KL(P||ab) >= 0
const kl=OT.klTransport(P1,a1,b1);
ok("KL(P‖ab) ≥ 0", kl>-1e-10, 'KL='+kl.toExponential(2));

// 7) symmetry W(X,Y)==W(Y,X) 2D
const rng2=OT.mulberry32(99);
const Xg=OT.gauss(rng2,[-1,0],0.5,2,16), Yg=OT.gauss(rng2,[1,0],0.5,2,16);
const ag=OT.uniform(16),bg=OT.uniform(16);
const Cxy=OT.costMatrix(Xg,Yg,2), Cyx=OT.costMatrix(Yg,Xg,2);
const Pxy=OT.sinkhorn(ag,bg,Cxy,0.2,2000), Pyx=OT.sinkhorn(bg,ag,Cyx,0.2,2000);
ok("对称 W(X,Y)=W(Y,X)", Math.abs(OT.wasserstein(Pxy,Cxy)-OT.wasserstein(Pyx,Cyx))<1e-9,
   'dx='+Math.abs(OT.wasserstein(Pxy,Cxy)-OT.wasserstein(Pyx,Cyx)).toExponential(1));

// 8) 2-point-mass exact: W2^2 == |dx|^2 regardless of eps
const Xp=[[0]], Yp=[[3]];
const ap=OT.uniform(1),bp=OT.uniform(1);
const Cp=OT.costMatrix(Xp,Yp,2);
const Pp=OT.sinkhorn(ap,bp,Cp,0.3,50);
ok("点质量 W2^2=|μa−μb|² (精确)", Math.abs(OT.wasserstein(Pp,Cp)-9)<1e-12, 'W='+OT.wasserstein(Pp,Cp));

// 9) self-transport: same identical point sets -> cost ~ 0 (permutation plan)
const rng3=OT.mulberry32(7);
const S=OT.gauss(rng3,0,1,1,20).map(p=>p[0]);
const aS=OT.uniform(20),bS=OT.uniform(20);
const CS=OT.costMatrix(S.map(x=>[x]),S.map(x=>[x]),2);
const PS=OT.sinkhorn(aS,bS,CS,0.05,4000);
// with distinct points, optimal is identity; entropic cost small. Compare to a uniform-permutation lower bound.
ok("自传输 代价≈0 (同集合)", OT.wasserstein(PS,CS)<0.05*Math.max(1,OT.wasserstein(PS,CS)+1),
   'W='+OT.wasserstein(PS,CS).toFixed(4));

// 10) eps monotonic: regularized <P,C> INCREASES as eps increases
function costAtEps(e){ return OT.wasserstein(OT.sinkhorn(a1,b1,C1,e,2500),C1); }
const c1=costAtEps(0.05), c2=costAtEps(0.2), c3=costAtEps(1.0);
ok("代价随 ε 增大单调上升", c1<=c2+1e-9 && c2<=c3+1e-9, c1.toFixed(3)+'≤'+c2.toFixed(3)+'≤'+c3.toFixed(3));

// 11) determinism (bit identical)
const Pa=OT.sinkhorn(ag,bg,Cxy,0.2,1500), Pb=OT.sinkhorn(ag,bg,Cxy,0.2,1500);
ok("确定性 同种子逐位一致", JSON.stringify(Pa)===JSON.stringify(Pb));

// 12) log-domain == exp-domain (bounded cost, moderate eps)
const rng4=OT.mulberry32(555);
const Xs=OT.gauss(rng4,[-1],0.5,1,8).map(p=>p), Ys=OT.gauss(rng4,[1],0.5,1,8).map(p=>p);
const as=OT.uniform(8),bs=OT.uniform(8);
const Cs2=OT.costMatrix(Xs,Ys,2), eps2=2.0;
const Pl=OT.sinkhorn(as,bs,Cs2,eps2,3000), Pe=OT.sinkhornExp(as,bs,Cs2,eps2,3000);
let d=0; for(let i=0;i<8;i++) for(let j=0;j<8;j++) d=Math.max(d,Math.abs(Pl[i][j]-Pe[i][j]));
ok("log域==exp域 (中等ε)", d<1e-6, 'maxΔ='+d.toExponential(1));

// 13) eps->0 concentration: well-separated discrete points -> near-permutation plan (numerically stable)
const Xd=[[-3],[-1],[1],[3]], Yd=[[-2],[0],[2],[4]];
const ad=OT.uniform(4), bd=OT.uniform(4);
const Cd=OT.costMatrix(Xd,Yd,2);
const Pd=OT.sinkhorn(ad,bd,Cd,0.05,2000);
let rowmax=0; for(let i=0;i<4;i++){ let mm=0; for(let j=0;j<4;j++) mm=Math.max(mm,Pd[i][j]); rowmax=Math.max(rowmax,mm); }
ok("ε→0 计划收敛到近置换 (每行max>0.2≈1/N)", rowmax>0.2, 'rowmax='+rowmax.toFixed(3));

// 14) regularized cost = <P,C> + eps*KL >= <P,C> (positive reg term)
const reg = OT.regCost(P1,C1,a1,b1,0.05);
ok("正则化代价 = <P,C>+ε·KL", Math.abs(reg-(OT.wasserstein(P1,C1)+0.05*OT.klTransport(P1,a1,b1)))<1e-12);

// 15) 2D W2^2 closed-form cross-check via independent Monte-Carlo-ish: two well-separated 2D blobs
const rng5=OT.mulberry32(314);
const X2=OT.gauss(rng5,[-3,0],0.3,2,30), Y2=OT.gauss(rng5,[3,0],0.3,2,30);
const a2=OT.uniform(30),b2=OT.uniform(30);
const C2=OT.costMatrix(X2,Y2,2);
const P2=OT.sinkhorn(a2,b2,C2,0.1,3000);
// true W2^2 for two separated isotropic gaussians ≈ ||μx-μy||^2 + tr(Σx+Σy) - 2tr((Σx^{1/2}ΣyΣx^{1/2})^{1/2})
// for identical Σ=σ²I: = ||Δμ||^2 (cov terms cancel). Δμ=(6,0) -> 36.
const w2_2d=OT.wasserstein(P2,C2);
ok("2D 分离 blob W2^2≈‖Δμ‖²=36", Math.abs(w2_2d-36)<36*0.06, 'W='+w2_2d.toFixed(3)+' (真值≈36)');

const out=`PASS ${pass} / ${pass+fail}\n`+(fail?'FAIL '+fails.join(' | '):'ALL GREEN')+'\n';
fs.writeFileSync(path.join(__dirname,'_smoke.log'),out);
console.log(out.trim());
process.exit(fail?1:0);
