(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.StudyRoleVideo=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 function create({video,button,status,onStatus=()=>{},setTimeout:schedule=globalThis.setTimeout,clearTimeout:cancel=globalThis.clearTimeout,timeoutMs=8000}){
  let active=false,phase='ready',generation=0,timer=null,lastTime=0;
  const labels={ready:['播放情境短片','可点击播放，或先阅读上方情境文字。'],loading:['取消加载','短片正在加载，请稍候…'],playing:['暂停短片','短片正在播放。'],paused:['继续播放','短片已暂停。'],buffering:['暂停短片','正在缓冲，请稍候…'],slow:['重新加载短片','短片加载较慢，可重新加载；也可阅读情境文字后继续。'],error:['重试播放短片','短片暂时无法播放，请重试或使用视频上的播放按钮；也可阅读情境文字后继续。'],ended:['重新观看','短片已播放完毕。']};
  function clear(){if(timer!==null)cancel(timer);timer=null;}
  function show(next){if(!active)return;const changed=phase!==next;phase=next;button.textContent=labels[next][0];status.textContent=labels[next][1];if(changed)onStatus(next);}
  function wait(next){clear();show(next);const current=generation;timer=schedule(()=>{timer=null;if(active&&current===generation)show('slow');},timeoutMs);}
  function pause(){generation++;clear();video.pause();show('paused');}
  function stop(){active=false;generation++;clear();video.pause();}
  function reset(){stop();lastTime=video.currentTime||0;active=true;video.muted=true;video.defaultMuted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');show('ready');}
  async function toggle(){
   if(!active)return;
   const reload=phase==='slow'||phase==='error'||Boolean(video.error);
   if(!reload&&!video.paused){pause();return;}
   generation++;
   if(reload){video.pause();video.load();}
   const current=generation;
   video.muted=true;video.playsInline=true;wait('loading');
   try{await video.play();if(active&&generation===current&&!video.paused){clear();show('playing');}}
   catch(error){if(!active||generation!==current)return;clear();show(error?.name==='AbortError'?'paused':'error');}
  }
  const handlers={
   play:()=>{if(active)wait('loading');},
   playing:()=>{if(active&&!video.paused){clear();show('playing');}},
   waiting:()=>{if(active&&!video.paused)wait('buffering');},
   stalled:()=>{if(active&&!video.paused&&video.readyState<3)wait('buffering');},
   timeupdate:()=>{const now=video.currentTime||0;if(active&&!video.paused&&now>lastTime){clear();show('playing');}lastTime=now;},
   pause:()=>{if(active&&video.paused){generation++;clear();show(video.ended?'ended':'paused');}},
   ended:()=>{clear();show('ended');},
   error:()=>{if(active){generation++;clear();show('error');}}
  };
  // Native controls use the same state feedback as the external button.
  for(const [event,handler]of Object.entries(handlers))video.addEventListener(event,handler);
  button.addEventListener('click',toggle);
  return {reset,stop,pause,destroy(){stop();for(const [event,handler]of Object.entries(handlers))video.removeEventListener(event,handler);button.removeEventListener('click',toggle);}};
 }
 return {create};
});
