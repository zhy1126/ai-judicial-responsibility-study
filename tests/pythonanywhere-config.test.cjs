const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const config=fs.readFileSync(require.resolve('../collection-config.js'),'utf8');
function settings(search=''){const context={window:{},location:{search},URLSearchParams};vm.runInNewContext(config,context);return context.window.STUDY_COLLECTION;}
test('both published entries use PythonAnywhere with formal collection by default',()=>{
 const c=settings();assert.equal(c.baseUrl,'https://zhy031126.pythonanywhere.com');assert.equal(c.enabled,true);assert.equal(c.mode,'formal');
 assert.equal(new URL(c.adminUrl).hostname,'www.pythonanywhere.com');
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');assert.match(html,/connect-src 'self' https:\/\/zhy031126\.pythonanywhere\.com;/);
});
test('explicit pilot links keep browser progress and test submissions separate',()=>{
 assert.equal(settings('?test=1').mode,'pilot');assert.equal(settings('?test=0').mode,'formal');
 assert.equal(settings('?revision=old-link').mode,'formal');
});
