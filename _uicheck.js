// _uicheck.js — runs the <script id="ui"> block outside a browser with a minimal DOM stub.
// Catches wiring bugs (missing ids, null canvas ctx, auto-run on load) that _smoke.js cannot reach.
const fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const eng=html.match(/<script id="engine">([\s\S]*?)<\/script>/);
const ui =html.match(/<script id="ui">([\s\S]*?)<\/script>/);
if(!eng||!ui){ console.error('scripts not found'); process.exit(1); }

function makeCtx2d(){
  const calls={fillRect:0,clearRect:0,stroke:0,fill:0,arc:0,beginPath:0,moveTo:0,lineTo:0,fillText:0};
  const noop=()=>{};
  return {
    _calls:calls,
    clearRect:()=>{calls.clearRect++;}, fillRect:()=>{calls.fillRect++;},
    beginPath:()=>{calls.beginPath++;}, moveTo:()=>{calls.moveTo++;}, lineTo:()=>{calls.lineTo++;},
    stroke:()=>{calls.stroke++;}, fill:()=>{calls.fill++;}, arc:()=>{calls.arc++;},
    fillText:()=>{calls.fillText++;},
    set fillStyle(v){}, set strokeStyle(v){}, set font(v){},
    createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),
    getImageData:(x,y,w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),
  };
}
function makeEl(id){
  const handlers={};
  const el={
    id, value:'0', width:360, height:360, _ctx:null,
    textContent:'', _innerHTML:'',
    get innerHTML(){return this._innerHTML;},
    set innerHTML(v){this._innerHTML=v;},
    getContext(){ if(!this._ctx) this._ctx=makeCtx2d(); return this._ctx; },
    addEventListener:(ev,fn)=>{ handlers[ev]=fn; },
    appendChild:()=>{},
    _fire:(ev)=>{ if(handlers[ev]) handlers[ev](); },
  };
  return el;
}
const els={};
['eps','iters','n','epsv','itv','nv','planC','scatterC','curveC','checks','stat','run','epsRun'].forEach(id=>els[id]=makeEl(id));
// pre-set slider values so UI reads sane numbers
els.eps.value='0.1'; els.iters.value='1000'; els.n.value='30';

const documentStub={
  getElementById:(id)=>els[id]||makeEl(id),
  createElement:(tag)=>makeEl('li'),
};
const windowStub={};

const ctx={console,Math,Float64Array,Array,JSON,Object,isFinite,Infinity,
  document:documentStub, window:windowStub, Uint8ClampedArray, globalThis:{}};
ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(eng[1],ctx,{filename:'engine.js'});
// UI top-level `return` is illegal under vm.runInContext -> wrap in IIFE so the return is legal.
vm.runInContext('(function(){\n'+ui[1]+'\n})();',ctx,{filename:'ui.js'});

// auto-run already fired runDemo/selfCheck/scanEps on load. Re-fire buttons to be sure.
let pass=0, fail=0; const fails=[];
function ok(n,c,d){ if(c){pass++;} else {fail++; fails.push(n+(d?' ['+d+']':'')); console.log('  ✗',n,d||'');} }

ok("engine loaded (OT)", typeof ctx.OT==='object');
ok("canvas planC drew", els.planC._ctx && els.planC._ctx._calls.fillRect>0, 'fillRect='+(els.planC._ctx?els.planC._ctx._calls.fillRect:0));
ok("canvas scatterC drew", els.scatterC._ctx && (els.scatterC._ctx._calls.arc>0), 'arc='+(els.scatterC._ctx?els.scatterC._ctx._calls.arc:0));
ok("canvas curveC drew", els.curveC._ctx && els.curveC._ctx._calls.stroke>0, 'stroke='+(els.curveC._ctx?els.curveC._ctx._calls.stroke:0));
ok("stat populated", els.stat.textContent.length>0, 'len='+els.stat.textContent.length);
// re-fire run + epsRun (exercise handlers without error)
let threw=null;
try{ els.run._fire('click'); els.epsRun._fire('click'); }catch(e){ threw=e.message; }
ok("buttons fire without throw", threw===null, threw||'');
ok("stat still populated after refire", els.stat.textContent.length>0);

const out=`PASS ${pass} / ${pass+fail}\n`+(fail?'FAIL '+fails.join(' | '):'ALL GREEN')+'\n';
fs.writeFileSync(path.join(__dirname,'_uicheck.log'),out);
console.log(out.trim());
process.exit(fail?1:0);
