/* Temporary sequential text presentation while the complete audio set is pending. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyStream=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create({paragraphs,initial,now=Date.now,setInterval=globalThis.setInterval,clearInterval=globalThis.clearInterval,onUpdate}){
    const nodes=paragraphs.map(text=>[...text]);
    const durations=nodes.map(chars=>chars.length*50+1200);
    const total=durations.reduce((a,b)=>a+b,0);
    let elapsedMs=Math.max(0,Math.min(total,Number(initial?.elapsedMs)||0)),timer=null,last=0;
    function view(){
      let remaining=elapsedMs,index=0;
      while(index<nodes.length&&remaining>=durations[index])remaining-=durations[index++];
      const completed=elapsedMs>=total;
      return {index,text:completed?'':nodes[index].slice(0,Math.floor(remaining/50)).join(''),completed,running:timer!==null,progress:total?elapsedMs/total:1};
    }
    function publish(){onUpdate(view());}
    function tick(){
      // A sleeping device or stalled event loop must not count unseen paragraphs.
      const next=now();elapsedMs=Math.min(total,elapsedMs+Math.min(100,Math.max(0,next-last)));last=next;
      if(elapsedMs>=total){clearInterval(timer);timer=null;}publish();
    }
    function pause(){if(timer===null)return;tick();if(timer!==null)clearInterval(timer);timer=null;publish();}
    function start(){if(timer!==null||elapsedMs>=total)return;last=now();timer=setInterval(tick,50);publish();}
    function reset(){pause();elapsedMs=0;publish();}
    publish();
    return {start,pause,reset,getSnapshot:()=>({elapsedMs,completed:elapsedMs>=total})};
  }
  return {create};
});
