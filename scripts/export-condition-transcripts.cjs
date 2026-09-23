const fs=require('node:fs'),path=require('node:path'),N=require('../study-narration.js');
const dir=path.join(__dirname,'../audio/condition-scripts');fs.mkdirSync(dir,{recursive:true});
for(const c of ['natural','statutory'])for(const k of ['none','procedural','substantive','decisional'])fs.writeFileSync(path.join(dir,`${c}-${k}.txt`),N.paragraphsFor(c,k).join('\n\n')+'\n');
