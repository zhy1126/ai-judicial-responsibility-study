const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const N=require('../study-narration.js'),P=require('../study-playback.js'),body=require('./fixtures/narration-0916.json');
const conditions=['none','procedural','substantive','decisional'];
const intros={
 none:'审理这个案件时，我没有使用 AI。这些材料的整理、证据分析和裁判判断，都是由我完成的。',
 procedural:'审理这个案件时，我使用 AI 整理材料、核对流程。证据分析、法律适用和裁判判断，由我完成。',
 substantive:'审理这个案件时，我使用 AI 辅助分析证据和法律适用。我结合这些分析，确定裁判结果，AI 没有提供具体的裁判结果建议。',
 decisional:'审理这个案件时，我使用 AI 分析证据和法律适用，并参考它提出的裁判结果建议和裁判主文草案，形成最终裁判。'
};
function config(){const s={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../audio-config.js'),'utf8'),s);return s.window;}
test('each of eight narratives starts with exactly its approved spoken manipulation and retains case body',()=>{
 for(const c of Object.keys(body))for(const k of conditions){const p=N.paragraphsFor(c,k);assert.equal(p[0],intros[k]);assert.deepEqual(p.slice(1),body[c]);}
 assert.throws(()=>N.paragraphsFor('natural','invalid'));
});
test('all eight audio assets and matching transcripts have ordered paragraph timing',()=>{
 const a=config();assert.equal(a.STUDY_AUDIO_VERSION,N.VERSION);const urls=[];
 for(const c of Object.keys(body))for(const k of conditions){const clip=a.STUDY_AUDIO[c][k],p=N.paragraphsFor(c,k);assert.ok(clip.src.endsWith('.mp3'));assert.ok(fs.statSync(path.join(__dirname,'..',clip.src)).size>100000);urls.push(clip.src);assert.equal(clip.cues.length,p.length);let end=0;for(const cue of clip.cues){assert.ok(cue.start>=end);assert.ok(cue.end>cue.start);end=cue.end;}assert.ok(clip.duration>=end);assert.equal(fs.readFileSync(path.join(__dirname,'../audio/condition-scripts',`${c}-${k}.txt`),'utf8').trim(),p.join('\n\n'));}
 assert.equal(new Set(urls).size,8);
 assert.equal(P.audioReady(a.STUDY_AUDIO,a.STUDY_AUDIO_VERSION,N.VERSION,'https://example.org/'),true);
});
test('incomplete, old, foreign-origin or malformed audio configuration cannot enable partial experimental conditions',()=>{
 const a=config();assert.equal(P.audioReady(a.STUDY_AUDIO,'old',N.VERSION,'https://example.org/'),false);
 const partial=JSON.parse(JSON.stringify(a.STUDY_AUDIO));delete partial.natural.none;assert.equal(P.audioReady(partial,N.VERSION,N.VERSION,'https://example.org/'),false);
 const foreign=JSON.parse(JSON.stringify(a.STUDY_AUDIO));foreign.natural.none={...foreign.natural.none,src:'https://elsewhere.org/test.mp3'};assert.equal(P.audioReady(foreign,N.VERSION,N.VERSION,'https://example.org/'),false);
 assert.equal(P.audioReady({natural:'old.mp3',statutory:'old.mp3'},N.VERSION,N.VERSION,'https://example.org/'),false);
});
test('timed disclosure stays within spoken paragraph, freezes in silence and finishes only at its own end',()=>{
 const ps=['开场说明','案件正文'],cues=[{start:0.2,end:8},{start:8.6,end:140}];
 assert.deepEqual(P.revealTimed(ps,cues,0),[]);assert.deepEqual(P.revealTimed(ps,cues,8),[ps[0]]);assert.deepEqual(P.revealTimed(ps,cues,8.4),[ps[0]]);assert.deepEqual(P.revealTimed(ps,cues,74.3),[ps[0],'案件']);assert.deepEqual(P.revealTimed(ps,cues,140),ps);assert.deepEqual(P.revealTimed(ps,cues,0,true),ps);
 assert.deepEqual(P.revealTimed(ps,[],120),[]);
});
