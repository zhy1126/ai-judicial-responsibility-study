import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url),dialogue=require('../study-dialogue.js');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'audio/scripts'),{recursive:true});
const recordings=[];
for(const caseType of ['natural','statutory'])for(const condition of ['none','procedural','substantive','decisional']){
 const messages=dialogue.messagesFor(caseType,condition);
 const segments=messages.map((m,i)=>({index:i+1,role:m.role,speaker:dialogue.SPEAKERS[m.role].name,stage:m.stage,text:m.text}));
 const name=`${caseType}-${condition}`;
 await writeFile(path.join(root,`audio/scripts/${name}.txt`),segments.map(m=>`【${m.index} · ${m.speaker} · ${m.stage}】\n${m.text}`).join('\n\n')+'\n');
 recordings.push({caseType,condition,filename:`${name}-dialogue-v1.mp3`,segments});
}
await writeFile(path.join(root,'audio/dialogue-manifest.json'),JSON.stringify({version:dialogue.VERSION,recordings},null,2)+'\n');
console.log('Exported 8 dialogue scripts and 104 speaker-labelled audio segments.');
