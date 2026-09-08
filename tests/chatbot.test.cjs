const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const mobile of [false,true]){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
   await page.goto(base+`/?view=participant&preview=1&role=public&condition=${mobile?'decisional':'none'}&case=${mobile?'statutory':'natural'}`);
   await page.locator('#consent-checkbox').check();await page.locator('#start-study').click();
   for(const tab of ['overview','evidence','task']){
    await page.locator(`[data-tab=${tab}]`).click();
    await page.locator('#dossier-content').evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'));});await page.locator('#dossier-confirm').check();
   }
   await page.locator('#to-replay').click();assert.equal(await page.locator('.chat-message').count(),0);
   const paragraphs=await page.evaluate(()=>StudyDialogue.messagesFor(state.caseType,state.condition).map(m=>m.text));
   await page.locator('#playback-toggle').click();await page.clock.runFor(300);
   const early=await page.locator('.typewriter-text').first().textContent();assert.ok(early.length>0&&early.length<paragraphs[0].length,'text must stream within a bubble');
   const firstThree=paragraphs.slice(0,3).reduce((ms,p)=>ms+[...p].length*50+1200,0);
   await page.clock.runFor(firstThree+500);
   assert.ok(await page.locator('.chat-message').count()>=4);
   assert.equal(await page.locator('.chat-message.judge').count()>0,true);
   assert.equal(await page.locator(mobile?'.chat-message.ai':'.chat-message.clerk').count()>0,true);
   assert.ok(!(await page.locator('body').textContent()).includes('衡度研究室'));
   assert.equal(await page.locator('.brand-seal').count(),0);
   assert.equal(await page.locator('.typewriter-text').first().textContent(),paragraphs[0]);
   await page.locator('#chat-stream').evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});
   await page.clock.runFor(1000);assert.equal(await page.locator('#chat-stream').evaluate(el=>el.scrollTop),0,'reading history must not jump to latest');
   assert.equal(await page.locator('#chat-latest').isVisible(),true);await page.locator('#chat-latest').click();
   assert.ok(await page.locator('#chat-stream').evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop<=2));
   const smallScroll=await page.locator('#chat-stream').evaluate(el=>{el.scrollTop-=30;el.dispatchEvent(new Event('scroll'));return el.scrollTop;});
   await page.clock.runFor(500);assert.equal(await page.locator('#chat-stream').evaluate(el=>el.scrollTop),smallScroll,'even a small upward scroll must pause auto-follow');
   await page.locator('#chat-latest').click();
   await page.locator('#playback-toggle').click();const paused=await page.locator('#chat-messages').textContent();
   await page.clock.runFor(1000);assert.equal(await page.locator('#chat-messages').textContent(),paused);
   await page.reload();assert.equal(await page.locator('#chat-messages').textContent(),paused,'refresh reconstructs full history and current partial message');
   assert.equal(await page.locator('#to-decision').isDisabled(),true);
   await page.screenshot({path:`../../work/chatbot-${mobile?'mobile':'desktop'}.png`,fullPage:true,animations:'disabled'});
   await page.locator('#playback-toggle').click();await page.clock.runFor(120000);
   assert.deepEqual(await page.locator('.typewriter-text').allTextContents(),paragraphs,'complete conversation keeps every scripted exchange');
   await page.locator('#transcript-confirm').check();assert.equal(await page.locator('#to-decision').isDisabled(),false);
   await page.reload();assert.deepEqual(await page.locator('.typewriter-text').allTextContents(),paragraphs);
   await page.locator('#playback-restart').click();assert.equal(await page.locator('.chat-message').count(),1);assert.equal(await page.locator('#to-decision').isDisabled(),true);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Passed: chatbot bubbles, progressive text, full history, pause/reload, scroll-back without jumping, latest-message control, restart/completion gate, desktop/mobile layout.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
