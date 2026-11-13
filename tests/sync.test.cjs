const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const gs = fs.readFileSync(path.join(__dirname,'../Code.gs'),'utf8');
function fn(name) {
 const re = new RegExp('^    (?:async )?function '+name+'\\([^]*?^    }','m');
 const m=html.match(re); assert.ok(m,name); return m[0];
}
function context(names, values) {
 const c=vm.createContext({console,Date,...values});
 vm.runInContext(names.map(fn).join('\n'),c); return c;
}
test('fresh server score defeats stale dashboard local score',()=>{
 const c=context(['boardEntry','boardStatusUpper'],{getMatch:()=>({id:'SM-01'}),getSession:()=>({peranan:'MASTER_ADMIN'}),publicLive:{data:{A:{matchId:'SM-01',status:'LIVE',skorP1:3,skorP2:1}}},publicLiveFresh:()=>true,COURT_STATUS:{LIVE:'LIVE',SEDIA:'SEDIA',TAMAT:'TAMAT'},COURT_PHASE_LABELS:{},BOARD_LOCAL_GRACE_MS:20000});
 assert.equal(c.boardEntry({id:'A',matchSemasa:'SM-01',status:'LIVE',skorLiveP1:1,skorLiveP2:0}).skorP1,3);
});
test('pending referee score stays visible until acknowledged',()=>{
 const c=context(['boardEntry','boardStatusUpper'],{getMatch:()=>({id:'SM-01'}),getSession:()=>({peranan:'PENGADIL',userId:'REF-001'}),COURT_STATUS:{LIVE:'LIVE',SEDIA:'SEDIA',TAMAT:'TAMAT'},COURT_PHASE_LABELS:{},publicLive:{data:{A:{matchId:'SM-01',status:'LIVE',skorP1:2}}}});
 assert.equal(c.boardEntry({id:'A',pengadilId:'REF-001',status:'LIVE',skorLiveP1:3}).skorP1,3);
});
test('version checks use active URL, never cached version or automatic deployment switch',async()=>{
 let saved=0; const c=context(['autoPickGasUrl','cmpVersi'],{getGasUrl:()=> 'active',navigator:{onLine:true},pingGasUrl:async u=>({url:u,versi:'1.9.7'}),gasHealth:{},GAS_MIN_VERSI:'1.9.7',warnOldGas:()=>{},saveState:()=>saved++});
 await c.autoPickGasUrl(); assert.equal(c.gasHealth.versi,'1.9.7'); assert.equal(c.gasHealth.lama,false); assert.equal(saved,0);
});
test('response from old URL cannot change current version',async()=>{
 let url='old'; const c=context(['autoPickGasUrl','cmpVersi'],{getGasUrl:()=>url,navigator:{onLine:true},pingGasUrl:async()=>{url='new';return {versi:'1.8.0'}},gasHealth:{versi:'1.9.7'},warnOldGas:()=>{throw Error('wrong warning')},GAS_MIN_VERSI:'1.9.7'});
 await c.autoPickGasUrl(); assert.equal(c.gasHealth.versi,'1.9.7');
});
test('acknowledged goal invalidates pre-write read and queues new read',()=>{
 const c=context(['requestFreshPublicLive'],{publicLive:{seq:4,busy:true},fetchPublicLive:()=>{throw Error('overlapping read')}});
 c.requestFreshPublicLive(); assert.equal(c.publicLive.seq,5); assert.equal(c.publicLive.refreshQueued,true);
});
test('reload restores referee score and phase from server when nothing pending',()=>{
 const court={id:'A',pengadilId:'REF-001'}, match={id:'SM-01'};
 const c=context(['restoreOwnedCourtFromLive','boardStatusUpper'],{getSession:()=>({peranan:'PENGADIL',userId:'REF-001'}),state:{courts:[court]},publicLive:{data:{A:{matchId:'SM-01',status:'LIVE',skorP1:4,skorP2:2,fasaMasa:'Separuh 2',fasaMulaPada:'2026-11-13T23:00:00Z'}}},livePushTimers:{},livePushChain:{},livePushRetry:{},getMatch:()=>match,COURT_STATUS:{LIVE:'LIVE'},MATCH_STATUS:{LIVE:'LIVE'},phaseKeyFromLabel:()=> 'SEPARUH 2',saveState:()=>{},renderRefDesk:()=>{},BOARD_LOCAL_GRACE_MS:20000});
 c.restoreOwnedCourtFromLive(); assert.equal(court.skorLiveP1,4); assert.equal(match.skorP2,2); assert.equal(court.fasaMulaPada,'2026-11-13T23:00:00Z');
 c.livePushTimers.A=1; c.publicLive.data.A.skorP1=0; c.restoreOwnedCourtFromLive(); assert.equal(court.skorLiveP1,4);
});
test('cache rebuild serializes with score writes and flushes Sheets first',()=>{
 const c=vm.createContext({console,SpreadsheetApp:{flush:()=>order.push('flush')},CacheService:{getScriptCache:()=>({put:()=>order.push('version')})},papanLive_:()=>{order.push('read');return{}},simpanPapan_:()=>order.push('cache'),bustPapanCache_:()=>{},PAPAN_CACHE_VER:'version'}); const order=[];
 const extract=gs.match(/^function segarkanPapan_\([^]*?^}/m)[0]; vm.runInContext(extract,c); c.segarkanPapan_(); assert.deepEqual(order,['flush','version','read','cache']);
 const cached=gs.match(/^function papanLiveCached_\([^]*?^}/m)[0]; assert.ok(cached.includes('getScriptLock()')); assert.ok(!cached.includes('getUserLock'));
});
test('phase anchor survives score and resume writes',()=>{
 const c=vm.createContext({console}); vm.runInContext(gs,c);
 assert.ok(vm.runInContext("UPDATABLE.includes('fasaMulaPada') && DATE_FIELDS.includes('fasaMulaPada') && LOCK_PROTECTED_FIELDS.includes('fasaMulaPada')",c));
 assert.equal(vm.runInContext("API_VERSI",c),'1.9.7');
});
test('scripts are syntactically valid',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 for(const script of scripts) new vm.Script(script[1]); new vm.Script(gs); new vm.Script(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'));
});
