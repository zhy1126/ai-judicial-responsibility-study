import { mkdir, rm, copyFile, cp, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'_site');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
for(const name of ['index.html','styles.css','app.js','study-core.js','study-content.js','speech-input.js','audio-config.js','404.html','robots.txt','sitemap.xml','.nojekyll']){
 await copyFile(path.join(root,name),path.join(output,name));
}
// Only recordings are public assets; scripts and internal study notes stay out of the site artifact.
try{await access(path.join(root,'audio/recordings'));await cp(path.join(root,'audio/recordings'),path.join(output,'audio/recordings'),{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
console.log('Static site ready in _site.');
