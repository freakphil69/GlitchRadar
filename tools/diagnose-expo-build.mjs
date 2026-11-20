import fs from 'node:fs';
const token=process.env.EXPO_TOKEN;
if(!token)throw new Error('EXPO_TOKEN missing; no build was started.');
function clean(value){return String(value).split(token).join('[REDACTED]').replace(/https?:\/\/[^\s"'<>]+/g,'[URL removed]').replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[JWT removed]').replace(/\b(?:expo|sk|ghp|github_pat)_[A-Za-z0-9_-]+/g,'[credential removed]').replace(/((?:token|password|secret|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,'$1[REDACTED]');}
function notice(title,text){const escape=s=>s.replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');console.log('::notice title='+title+'::'+escape(clean(text).slice(0,5500)));}
async function graphql(query,variables){
  const response=await fetch('https://api.expo.dev/graphql',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('Expo API HTTP '+response.status);
  const body=await response.json();if(body.errors)throw new Error(clean(JSON.stringify(body.errors)));return body.data;
}
const query='query($appId: String!) { app { byId(appId: $appId) { builds(limit: 3, offset: 0, filter: {platform: ANDROID}) { id status error { errorCode message } logFiles } } } }';
const data=await graphql(query,{appId:'ee978e42-a28b-4f71-9c24-dd62e8933c6a'});
const builds=data.app.byId.builds;
const build=builds.find(b=>b.status==='ERRORED')||builds[0];
if(!build)throw new Error('No Android build found.');
notice('Expo build result',JSON.stringify({id:build.id,status:build.status,error:build.error}));
const excerpts=[];
for(const [index,url] of (build.logFiles||[]).entries()){
  const parsed=new URL(url);if(parsed.protocol!=='https:')continue;
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)continue;
    const raw=await response.text();const lines=raw.split(/\r?\n/).map(line=>{try{const row=JSON.parse(line);return typeof row.msg==='string'?row.msg:typeof row.message==='string'?row.message:line;}catch{return line;}});
    const hits=[];
    for(let i=0;i<lines.length;i++)if(/npm (?:ERR!|error)|error:|FAILURE:|What went wrong|Could not resolve|Execution failed|Cannot find|does not exist|Missing:|BUILD FAILED|Exception|Unsupported|incompatible/i.test(lines[i]))hits.push(clean(lines.slice(Math.max(0,i-1),Math.min(lines.length,i+3)).join('\n')).slice(0,1400));
    const unique=[...new Set(hits)].slice(-12);if(unique.length){excerpts.push({log:index,messages:unique});for(let n=0;n<unique.length;n+=3)notice('Expo log '+index+' part '+n,unique.slice(n,n+3).join('\n---\n'));}
  }catch(error){notice('Log read issue',error instanceof Error?error.message:'Log unavailable');}
}
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Existing Android build diagnosis\n\n'+clean(JSON.stringify({id:build.id,status:build.status,error:build.error,excerpts},null,2))+'\n');
