import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const action = process.argv[2] || 'check';
if (!['check','preview','production'].includes(action)) throw new Error('check | preview | production');
const read = p => JSON.parse(readFileSync(p,'utf8'));
if (!existsSync('app.json') || !existsSync('eas.json')) throw new Error('Im frontend-Verzeichnis starten.');
const app = read('app.json').expo; const eas = read('eas.json');
if (app.android?.package !== 'glitchradar.app' || app.extra?.eas?.projectId !== 'ee978e42-a28b-4f71-9c24-dd62e8933c6a') throw new Error('App-Identität stimmt nicht. Nicht automatisch überschreiben.');
if (eas.build?.preview?.android?.buildType !== 'apk' || eas.build?.production?.android?.buildType !== 'app-bundle') throw new Error('APK-/AAB-Profile prüfen.');
if (!read('package.json').scripts?.['test:beta']) throw new Error('Beta-Testskript fehlt.');
let url;
try { url = new URL((process.env.EXPO_PUBLIC_BACKEND_URL || '').trim()); } catch { throw new Error('Echte EXPO_PUBLIC_BACKEND_URL lokal und in EAS setzen, ohne /api.'); }
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['','/'].includes(url.pathname) || ['localhost','127.0.0.1','example.com'].includes(url.hostname)) throw new Error('Echten HTTPS-Backend-Ursprung ohne Pfad setzen.');
if (!existsSync('node_modules')) throw new Error('Projektabhängigkeiten zuerst installieren.');
for (const asset of [app.icon,app.android?.adaptiveIcon?.foregroundImage,...(app.plugins || []).filter(p => Array.isArray(p) && p[0] === 'expo-font').flatMap(p => p[1]?.fonts || []),...(app.plugins || []).filter(p => Array.isArray(p) && p[0] === 'expo-splash-screen').map(p => p[1]?.image)].filter(Boolean)) if (!existsSync(asset)) throw new Error('Asset fehlt: ' + asset);
function run(command,args) {
  console.log('>',command,...args);
  const result = spawnSync(command,args,{stdio:'inherit',shell:process.platform === 'win32'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run('npx',['--no-install','tsc','--noEmit']);
run('npm',['run','lint']);
run('npm',['run','test:beta']);
run('npx',['expo-doctor']);
run('npx',['--no-install','expo','export','--platform','android','--output-dir','.release-check/android']);
console.log('Lokale Prüfungen erfolgreich. Kein Ersatz für nativen Build, Gerätetest oder Storeprüfung.');
if (action !== 'check') {
  if (process.env.GLITCHRADAR_ALLOW_BUILD !== 'YES') throw new Error('Cloud-Build gesperrt. Kosten/Kontingent prüfen; GLITCHRADAR_ALLOW_BUILD=YES setzen.');
  run('eas',['whoami']);
  run('eas',['build','--platform','android','--profile',action]);
}
