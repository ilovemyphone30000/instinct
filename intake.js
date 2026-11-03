// Unlisted intake page: adds tracks to the REC list through the same shared log API as the main site.
// The password is typed here (or reused from the main site in this browser); the API url + key come out of the
// decrypted data file at runtime and are never written into this source.
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const ss={get(k){try{return sessionStorage.getItem(k)}catch(e){return null}},set(k,v){try{sessionStorage.setItem(k,v)}catch(e){}}};
const b64=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));
async function decrypt(enc,pw){
  const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(enc.s),iterations:enc.i,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(enc.v)},key,b64(enc.c))));
}
const sha=async t=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))].map(x=>x.toString(16).padStart(2,'0')).join('');
// same cache key and shape as the main site, so a tab that is already unlocked opens instantly
async function open(pw){
  const enc=await fetch('data.enc.json?'+Date.now()).then(r=>r.json());
  const h=await sha(pw+'|'+enc.b);const c=ss.get('instinct_cache');
  if(c&&enc.b){try{const o=JSON.parse(c);if(o.h===h)return o.d}catch(e){}}
  const d=await decrypt(enc,pw);if(enc.b)ss.set('instinct_cache',JSON.stringify({h,d}));return d;
}
const akey=n=>String(n).split(/,| & | feat\.? | x /i)[0].trim().toLowerCase();
const trkId=u=>{const m=/track\/([A-Za-z0-9]{22})/.exec(u||'');return m?m[1]:''};
const songKey=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;

let DATA=null,API=null,ROWS=[],BUSY=false;
const URL_RE=/https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2,5}\/)?track\/([A-Za-z0-9]{22})\S*/i;

// one line -> {artist, song, url, date, err}
function parseLine(line){
  const r={raw:line,artist:'',song:'',url:'',date:today(),err:''};
  let rest=line;const m=URL_RE.exec(line);
  if(m){r.url='https://open.spotify.com/track/'+m[1];rest=line.replace(m[0],' ')}
  const parts=rest.split(/\s+[-–—|]\s+/).map(x=>x.replace(/^[\s\-–—|,]+|[\s\-–—|,]+$/g,'')).filter(Boolean);
  if(parts.length&&/^\d{4}-\d{2}-\d{2}$/.test(parts[parts.length-1])){const d=parts.pop();if(!validDate(d)){r.err='bad date '+d;return r}r.date=d}
  if(m){r.artist=parts[0]||'';r.song=parts.slice(1).join(' - ')}
  else{if(parts.length<2){r.err='need "Artist - Song" or a track link';return r}r.artist=parts[0];r.song=parts.slice(1).join(' - ')}
  return r;
}
async function oembedSong(url){
  try{const j=await (await fetch('https://open.spotify.com/oembed?url='+encodeURIComponent(url))).json();return j.title||''}catch(e){return ''}
}
function inBase(r){
  if(!DATA)return false;const id=trkId(r.url),k=r.artist?akey(r.artist)+'|'+songKey(r.song):'';
  return DATA.songs.some(s=>(id&&trkId(s.track)===id)||(k&&s.song&&akey(s.artist)+'|'+songKey(s.song)===k));
}
function paint(){
  $('#tb').innerHTML=ROWS.map((r,i)=>{
    const art=r.needArtist?`<input data-i="${i}" class="ai" value="${esc(r.artist)}" placeholder="artist" aria-label="artist for ${esc(r.song)}">`:esc(r.artist);
    const st=r.status==='ok'?`<span class="ok">added</span> <button class="s" data-u="${i}">undo</button>`
      :r.status==='undone'?'<span class="m">removed</span>'
      :r.status==='dup'?`<span class="m">${esc(r.msg||'duplicate, skipped')}</span>`
      :r.status==='err'?`<span class="bad">${esc(r.msg)}</span>`
      :r.status==='busy'?'<span class="m">…</span>':'<span class="m">ready</span>';
    return `<tr><td>${art}</td><td>${esc(r.song)}${r.url?` <a class="m" href="${esc(r.url)}" target="_blank" rel="noopener">link</a>`:''}</td><td class="m">${esc(r.date)}</td><td>${st}</td></tr>`}).join('');
  const todo=ROWS.filter(r=>!r.status&&!r.err);
  $('#go').disabled=BUSY||!todo.length||!todo.every(r=>r.artist.trim()&&r.song.trim());
  const n=k=>ROWS.filter(r=>r.status===k).length;
  $('#sum').textContent=ROWS.length?`${ROWS.length} lines · ${n('ok')} added · ${n('dup')} skipped · ${n('err')} errors`:'';
}
async function preview(){
  const lines=$('#ta').value.split('\n').map(x=>x.trim()).filter(Boolean);
  $('#prev').disabled=true;$('#sum').textContent='reading…';
  ROWS=[];
  for(const l of lines){
    const r=parseLine(l);
    if(r.err){r.status='err';r.msg=r.err}
    else{
      if(r.url&&!r.song){r.song=await oembedSong(r.url);if(!r.song){r.status='err';r.msg='could not read that track from Spotify'}}
      if(!r.status&&inBase(r)){r.status='dup';r.msg='already on the site'}
      else if(!r.status&&!r.artist)r.needArtist=true;
    }
    ROWS.push(r);
  }
  $('#prev').disabled=false;paint();
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function send(o){
  for(let t=0;t<7;t++){
    let j;try{j=await (await fetch(API.url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({k:API.key,...o})})).json()}
    catch(e){j={error:'offline'}}
    if(j.error==='slow down'){await wait(4000*(t+1));continue}
    return j;
  }
  return {error:'still rate-limited, try again in a minute'};
}
async function add(){
  const ini=$('#ini').value.trim().slice(0,24);
  if(!ini){$('#ini').focus();$('#sum').textContent='put initials in first';return}
  ls.set('instinct_intake_ini',ini);BUSY=true;
  for(const r of ROWS){
    if(r.status||r.err)continue;
    r.artist=r.artist.trim();r.status='busy';paint();
    const j=await send({type:'rec',a:akey(r.artist),n:r.artist,i:ini,x:r.url+'|'+r.song+'|'+r.date});
    if(j.ok&&j.deduped){r.status='dup';r.msg='duplicate, skipped'}
    else if(j.ok){r.status='ok';r.id=j.id;r.ini=ini}
    else{r.status='err';r.msg=j.error||'error'}
    paint();
  }
  BUSY=false;paint();
}
async function undo(r){
  const j=await send({type:'unrec',a:akey(r.artist),n:r.artist,i:r.ini,x:r.id});
  if(j.ok){r.status='undone'}else{r.status='err';r.msg=j.error||'error'}
  paint();
}
function start(d){
  DATA=d;API=d.api||null;
  $('#gate').hidden=true;$('#app').hidden=false;
  $('#ini').value=ls.get('instinct_intake_ini')||'';
  if(!API){$('#sum').textContent='this build has no team backend - nothing can be added';$('#prev').disabled=true}
  $('#ta').focus();
}
$('#prev').addEventListener('click',preview);
$('#go').addEventListener('click',add);
$('#tb').addEventListener('input',e=>{if(e.target.classList.contains('ai')){ROWS[+e.target.dataset.i].artist=e.target.value;paint0()}});
// re-enable the add button while typing an artist without rebuilding (and so unfocusing) the table
function paint0(){const todo=ROWS.filter(r=>!r.status&&!r.err);$('#go').disabled=BUSY||!todo.length||!todo.every(r=>r.artist.trim()&&r.song.trim())}
$('#tb').addEventListener('click',e=>{const b=e.target.closest('[data-u]');if(b)undo(ROWS[+b.dataset.u])});
// brute-force brake, same idea as the main site
let FAILS=+(ss.get('instinct_fails')||0),LOCK=+(ss.get('instinct_lock')||0);
function lockTick(){const left=Math.ceil((LOCK-Date.now())/1000),i=$('#pw');if(left>0){i.disabled=true;$('#err').textContent='try again in '+left+'s';setTimeout(lockTick,500)}else if(i.disabled){i.disabled=false;$('#err').textContent='';i.focus()}}
$('#gate').addEventListener('submit',async e=>{
  e.preventDefault();if(Date.now()<LOCK)return;$('#err').textContent='decrypting…';
  try{const pw=$('#pw').value;const d=await open(pw);ls.set('instinct_pw',pw);FAILS=0;ss.set('instinct_fails','0');start(d)}
  catch(x){FAILS++;ss.set('instinct_fails',String(FAILS));$('#err').textContent='wrong password';$('#pw').select();
    if(FAILS>=3){LOCK=Date.now()+Math.min(60,Math.pow(2,FAILS-2))*1000;ss.set('instinct_lock',String(LOCK));lockTick()}}
});
(async()=>{lockTick();const pw=ls.get('instinct_pw');
  if(pw){try{start(await open(pw));return}catch(e){}}
  $('#pw').focus()})();
