import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const defaults=JSON.parse((await readFile('config.js','utf8')).replace(/^window.COACH_CONFIG\s*=\s*/, '').replace(/;\s*$/, ''));
const url=process.env.SUPABASE_URL??defaults.supabaseUrl, key=process.env.SUPABASE_PUBLISHABLE_KEY??defaults.supabasePublishableKey;
if(Boolean(url)!==Boolean(key))throw new Error('Configure SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY ensemble.');
if(url&&!/^https:\/\/[a-z0-9.-]+\/?$/i.test(url))throw new Error('SUPABASE_URL doit être une URL HTTPS sans chemin.');
if(key&&!key.startsWith('sb_publishable_')){
  let role;try{role=JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role}catch{}
  if(role!=='anon')throw new Error('Utilise une clé publique publishable ou anon, jamais une clé secrète/service_role.');
}
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
const files=['accueil.html','experience.css','profile.js','nutrition.js','nutrition.css','barcode.js','index.html','connexion.html','auth.css','auth.js','app.css','coach-domain.js','coach-profile.js','coach-engine.js','coach-storage.js','app.js','cloud.js','cloud.css','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','supabase.js','THIRD_PARTY_NOTICES.txt'];
for(const file of files)await copyFile(file,'dist/'+file);
await writeFile('dist/config.js','window.COACH_CONFIG = '+JSON.stringify({supabaseUrl:url.replace(/\/$/,''),supabasePublishableKey:key})+';\n');
const hash=createHash('sha256');for(const file of [...files,'config.js'])hash.update(await readFile('dist/'+file));
const revision=hash.digest('hex').slice(0,16);
await writeFile('dist/sw.js',(await readFile('sw.js','utf8')).replace('__BUILD__',revision));
console.log(url?'Projet construit avec connexion activée.':'Projet construit en mode local. Configure les deux variables Vercel pour activer les comptes.');
