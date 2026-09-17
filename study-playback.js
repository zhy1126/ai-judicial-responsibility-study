(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyPlayback=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function fraction(position,duration,completed=false){return completed?1:Number.isFinite(duration)&&duration>0?Math.max(0,Math.min(1,(Number(position)||0)/duration)):0;}
 function reveal(paragraphs,progress){const parts=paragraphs.map(p=>Array.from(p));let remaining=Math.floor(parts.reduce((n,p)=>n+p.length,0)*Math.max(0,Math.min(1,Number(progress)||0)));const result=[];for(const p of parts){if(remaining<=0)break;result.push(p.slice(0,remaining).join(''));remaining-=p.length;}return result;}
 return {VERSION:'progressive-narration-2026-09-17-v1',fraction,reveal};
});
