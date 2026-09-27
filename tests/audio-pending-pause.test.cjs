const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8775';
(async()=>{const browser=await chromium.launch({headless:true});let release;try{
 const page=await browser.newPage(),requests=[];const hold=new Promise(r=>{release=r;});
 await page.route('**/audio/recordings/*.mp3',async route=>{
  requests.push(route.request().url());await hold;
  await route.fulfill({contentType:'audio/mpeg',body:fs.readFileSync(path.join(__dirname,'../audio/recordings',path.basename(new URL(route.request().url()).pathname)))}).catch(()=>{});
 });
 await page.addInitScript(()=>{
  window.mediaTrace=[];const play=HTMLMediaElement.prototype.play,load=HTMLMediaElement.prototype.load;
  HTMLMediaElement.prototype.play=function(){return play.call(this).catch(e=>{if(this.id==='judgment-audio')mediaTrace.push({event:'play-reject',name:e.name});throw e;});};
  HTMLMediaElement.prototype.load=function(){if(this.id==='judgment-audio')mediaTrace.push({event:'load'});return load.call(this);};
 });
 await page.goto(base+'/?view=participant&preview=1&role=judge&case=natural&condition=procedural');
 await page.locator('#consent-checkbox').check();await page.locator('[name=backgroundChoice][value=judge]').check();await page.locator('#start-study').click();await page.locator('#role-dialog[open]').waitFor();
 await page.evaluate(()=>{document.querySelector('#role-dialog').close();setStep('replay');});
 await page.locator('#playback-toggle').click();await page.waitForFunction(()=>!document.querySelector('#judgment-audio').paused);
 await page.locator('#playback-toggle').click();await page.waitForFunction(()=>mediaTrace.some(e=>e.event==='play-reject'&&e.name==='AbortError'));
 const after=await page.evaluate(()=>({status:state.audio.status,paused:document.querySelector('#judgment-audio').paused,error:document.querySelector('#judgment-audio').error}));
 assert.equal(after.paused,true);assert.equal(after.error,null);assert.notEqual(after.status,'error','normal pause must not be treated as a media failure');
 await page.locator('#playback-toggle').click();await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>mediaTrace.filter(e=>e.event==='load').length),0,'resume must keep the current resource loading');assert.equal(requests.length,1);
 release();await page.waitForFunction(()=>document.querySelector('#judgment-audio').currentTime>0.5);
 assert.equal(await page.locator('#playback-speed').inputValue(),'1.5');
 console.log('PASS: native AbortError during pending play is not a failure; pause/resume keeps one MP3 request and advances after loading.');
}finally{release?.();await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
