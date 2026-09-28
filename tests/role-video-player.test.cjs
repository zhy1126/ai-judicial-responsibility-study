const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const exists=fs.existsSync(require('node:path').join(__dirname,'../role-video-player.js'));
const Player=exists?require('../role-video-player.js'):null;
function harness(){
 assert.ok(Player,'role-video playback controller must report loading and retry states');
 const listeners={},timers=new Map();let counter=0,pending=[];
 const video={paused:true,ended:false,currentTime:0,error:null,readyState:0,loads:0,addEventListener(k,fn){(listeners[k]||=[]).push(fn)},removeEventListener(){},setAttribute(){},load(){this.loads++},pause(){this.paused=true;this.emit('pause')},play(){this.paused=false;this.emit('play');return new Promise((resolve,reject)=>pending.push({resolve,reject}))},emit(k){for(const fn of listeners[k]||[])fn()}};
 const button={textContent:'',addEventListener(k,fn){this[k]=fn},removeEventListener(){}},status={textContent:''},seen=[];
 const player=Player.create({video,button,status,onStatus:s=>seen.push(s),setTimeout:fn=>{timers.set(++counter,fn);return counter},clearTimeout:id=>timers.delete(id)});
 return {player,video,button,status,seen,pending,timers,expire(){for(const [id,fn]of [...timers]){timers.delete(id);fn()}}};
}
test('a pending mobile play shows loading until actual playback and supports retry',async()=>{
 const h=harness();h.player.reset();h.button.click();assert.match(h.status.textContent,/加载/);assert.doesNotMatch(h.status.textContent,/正在播放/);
 h.expire();assert.match(h.button.textContent,/重新加载/);assert.match(h.status.textContent,/网络|加载/);
 const old=h.pending[0];h.button.click();assert.equal(h.video.loads,1);
 old.reject(Object.assign(Error('canceled'),{name:'AbortError'}));await Promise.resolve();
 h.video.emit('playing');h.pending[1].resolve();await Promise.resolve();assert.match(h.status.textContent,/正在播放/);assert.equal(h.video.muted,true);assert.equal(h.video.playsInline,true);
});
test('pause/resume does not reload and stale promises after leaving cannot alter a new case',async()=>{
 const h=harness();h.player.reset();h.button.click();h.video.emit('playing');h.pending[0].resolve();await Promise.resolve();h.button.click();assert.equal(h.video.paused,true);assert.match(h.button.textContent,/继续/);
 h.button.click();assert.equal(h.video.loads,0);h.player.stop();h.player.reset();
 h.pending[1].reject(Error('old clip failure'));await Promise.resolve();assert.doesNotMatch(h.status.textContent,/失败|无法/);assert.equal(h.timers.size,0);
});
test('error and buffering status are separate from the reading gate',()=>{
 const h=harness();h.player.reset();h.button.click();h.video.error={code:2};h.video.emit('error');assert.match(h.button.textContent,/重试/);assert.match(h.status.textContent,/文字/);
 h.video.error=null;h.button.click();assert.equal(h.video.loads,1);h.video.emit('playing');h.video.emit('waiting');h.expire();assert.match(h.button.textContent,/重新加载/);
});
test('stalled downloads cannot report playback failure while buffered frames advance',()=>{
 const h=harness();h.player.reset();h.button.click();h.video.emit('playing');h.video.readyState=4;h.video.emit('stalled');h.expire();assert.match(h.status.textContent,/正在播放/);
 h.video.readyState=2;h.video.emit('waiting');h.video.currentTime=3;h.video.emit('timeupdate');h.expire();assert.match(h.status.textContent,/正在播放/);
});
