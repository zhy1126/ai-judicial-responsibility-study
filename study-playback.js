(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyPlayback=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function fraction(position,duration,completed=false){return completed?1:Number.isFinite(duration)&&duration>0?Math.max(0,Math.min(1,(Number(position)||0)/duration)):0;}
 function reveal(paragraphs,progress){const parts=paragraphs.map(p=>Array.from(p));let remaining=Math.floor(parts.reduce((n,p)=>n+p.length,0)*Math.max(0,Math.min(1,Number(progress)||0)));const result=[];for(const p of parts){if(remaining<=0)break;result.push(p.slice(0,remaining).join(''));remaining-=p.length;}return result;}
 function validCues(cues){return Array.isArray(cues)&&cues.length>1&&cues.every((c,i)=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.start>=0&&c.end>c.start&&(!i||c.start>=cues[i-1].end));}
 function audioReady(config,version,expectedVersion,baseUrl){
  if(version!==expectedVersion)return false;
  try{return ['natural','statutory'].every(c=>['none','procedural','substantive','decisional'].every(k=>{
   const clip=config?.[c]?.[k];return clip&&typeof clip.src==='string'&&Boolean(clip.src)&&new URL(clip.src,baseUrl).origin===new URL(baseUrl).origin&&validCues(clip.cues)&&clip.cues.length===(c==='natural'?6:7)&&Number.isFinite(clip.duration)&&clip.duration>=clip.cues.at(-1).end;
  }));}catch{return false;}
 }
 function revealTimed(paragraphs,cues,position,completed=false){
  if(!validCues(cues)||cues.length!==paragraphs.length)return [];
  if(completed)return [...paragraphs];
  const result=[];for(let i=0;i<paragraphs.length;i++){
   const c=cues[i];if(position<=c.start)break;
   const part=reveal([paragraphs[i]],fraction(position-c.start,c.end-c.start));if(part.length)result.push(part[0]);
   if(position<c.end)break;
  }return result;
 }
 return {VERSION:'condition-timed-narration-2026-09-23-v1',fraction,reveal,validCues,audioReady,revealTimed};
});
