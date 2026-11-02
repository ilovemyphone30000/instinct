const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>n==null?'':n>=1e6?(n/1e6).toFixed(1)+'m':n>=1e4?Math.round(n/1e3)+'k':n>=1e3?(n/1e3).toFixed(1)+'k':String(n);
const dstr=iso=>new Date(iso+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
const dlong=iso=>new Date(iso+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
const BK=[[0,1e3,'<1k'],[1e3,5e3,'1–5k'],[5e3,1e4,'5–10k'],[1e4,25e3,'10–25k'],[25e3,5e4,'25–50k'],[5e4,1e9,'50k+']];
const isSP=n=>/^superplaylist #/i.test(n);
const spN=n=>+(n.match(/#(\d+)/)||[0,0])[1];
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const ss={get(k){try{return sessionStorage.getItem(k)}catch(e){return null}},set(k,v){try{sessionStorage.setItem(k,v)}catch(e){}}};

let LF=new Set();try{LF=new Set(JSON.parse(ls.get('instinct_flags')||'[]'))}catch(e){}
const akey=s=>s.artist.split(/,| & | feat\.? | x /i)[0].trim().toLowerCase();
let API=null,TEAM={},LOG=[],VIEWS=[],INI=ls.get('instinct_ini')||'';
const tm=k=>TEAM[k]||(TEAM[k]={flag:null,notes:[],sign:null,watch:null});
const isFlag=s=>!!s.flag||(API?!!(TEAM[akey(s)]&&TEAM[akey(s)].flag):LF.has(akey(s)));
const mine=s=>{const o=TEAM[akey(s)];return !!(o&&o.flag&&INI&&o.flag.i.toLowerCase()===INI.toLowerCase())};
function foldLog(log){const T={};const g=k=>T[k]||(T[k]={flag:null,notes:[],sign:null,watch:null});
  log.forEach(e=>{const o=g(e.a);
    switch(e.y){
      case 'flag':o.flag={i:e.i,t:e.t};break;
      case 'unflag':o.flag=null;break;
      case 'note':o.notes.push({id:e.id,t:e.t,i:e.i,x:e.x});break;
      case 'edit':{const p=String(e.x||'').split('|'),id=p.shift(),t=p.join('|');for(const q of Object.values(T))for(const n of q.notes)if(n.id===id){n.x=t;n.ed=e.t;n.ei=e.i}break}
      case 'ig':{const [u,c]=String(e.x||'').split('|');o.ig={u,c:c?+c:null,i:e.i,t:e.t};break}
      case 'sign':{const p=String(e.x||'').split('|'),v=p.shift();o.sign=v==='reset'?null:{v,ag:p.join('|'),i:e.i,t:e.t};break}
      case 'watch':o.watch={id:String(e.x||'').split('|')[0],name:e.n,i:e.i,t:e.t};break;
      case 'unwatch':o.watch=null;break;
      case 'del':for(const q of Object.values(T))q.notes=q.notes.filter(n=>n.id!==e.x);break;
    }});
  Object.values(T).forEach(o=>o.notes.sort((a,b)=>String(b.t).localeCompare(String(a.t))));return T}
function foldViews(log){const m=new Map();log.forEach(e=>{if(e.y==='view')m.set(e.id,{id:e.id,name:e.n,state:e.x,i:e.i,t:e.t});else if(e.y==='delview')m.delete(e.x)});return [...m.values()].reverse()}
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,4500)}
async function pullTeam(){if(!API)return;try{const r=await fetch(API.url+'?k='+encodeURIComponent(API.key));const j=await r.json();if(j.log){LOG=j.log;TEAM=foldLog(j.log);VIEWS=foldViews(j.log);syncWatch();render();if(HO)redrawPanel();paintFeedBadge()}}catch(e){}}
async function postTeam(o){if(!API)return false;try{const r=await fetch(API.url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({k:API.key,...o})});const j=await r.json();if(j.ok)return true;toast(j.error==='slow down'?'slow down - too many saves a minute':'could not save ('+(j.error||'error')+')');return false}catch(e){toast('could not save - offline?');return false}}
const nameOf=k=>(ALL.find(s=>akey(s)===k)||{}).artist||k;

// ---- series
const gr=(s,k='hist')=>{const c='_g'+k;if(s[c]!==undefined)return s[c];const h=s[k];if(!h||h.length<2)return s[c]=null;const f=h[0][1],l=h[h.length-1][1];return s[c]={f,l,abs:l-f,pct:f?(l-f)/f:null,d0:h[0][0],d1:h[h.length-1][0]}};
const lastPt=(s,k='hist')=>{const h=s[k];return h&&h.length?h[h.length-1]:null};
const TAGN={SP:'SCAN',MP:'REC',WL:'WATCH'};
let TW=null,UPD='';
const DAY=864e5,tms=d=>new Date(d+'T12:00:00').getTime();
const daysAgo=iso=>iso?Math.round((tms(UPD||new Date().toISOString().slice(0,10))-tms(iso))/DAY):999;
// every sparkline shares one date window (the last 28 days up to the newest reading), so lines line up row to row
function tw(){if(TW)return TW;let m=0,e=1e15;ALL.forEach(s=>[s.hist,s.igh].forEach(h=>{if(h&&h.length){m=Math.max(m,tms(h[h.length-1][0]));if(h.length>1)e=Math.min(e,tms(h[0][0]))}}));return TW=[Math.max(m-28*DAY,Math.min(e,m-DAY)),m||1]}
function spark(h,W=44){
  const [T0,T1]=tw(),H=16;
  let pts=h.map(p=>[tms(p[0]),p[1]]);
  if(pts[0][0]<T0){const i=pts.findIndex(p=>p[0]>=T0);
    if(i<0)pts=[[T0,pts[pts.length-1][1]],pts[pts.length-1]];
    else if(i>0){const a=pts[i-1],c=pts[i],f=(T0-a[0])/(c[0]-a[0]);pts=[[T0,a[1]+(c[1]-a[1])*f],...pts.slice(i)]}}
  const v=pts.map(p=>p[1]),lo=Math.min(...v),hi=Math.max(...v),span=Math.max(hi-lo,hi*0.1,1),mid=(hi+lo)/2;
  const X=x=>(x-T0)/(T1-T0)*(W-4)+2,Y=y=>H/2-(y-mid)/span*(H-4);
  const poly=pts.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ');
  const last=pts[pts.length-1],c=v[v.length-1]>v[0]?'#1DB954':v[v.length-1]<v[0]?'#d9342b':'currentColor';
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${poly}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="2.6" fill="${c}"/></svg>`;
}
// full-range chart for the expanded row: its own date axis, first and last labelled
function sparkBig(h,label){
  if(!h||h.length<2)return `<div class="xc"><div class="hn">${label}</div><div class="hn">${h&&h.length?fmt(h[0][1])+' on '+esc(dstr(h[0][0]))+' - one reading so far':'no readings'}</div></div>`;
  const W=240,H=56,P=4,t0=tms(h[0][0]),t1=tms(h[h.length-1][0]),v=h.map(p=>p[1]),lo=Math.min(...v),hi=Math.max(...v),sp=Math.max(hi-lo,1);
  const X=t=>P+(t-t0)/Math.max(t1-t0,1)*(W-2*P),Y=y=>H-P-(y-lo)/sp*(H-2*P);
  const poly=h.map(p=>X(tms(p[0])).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ');
  const dots=h.map(p=>`<circle cx="${X(tms(p[0])).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="2" fill="currentColor"/>`).join('');
  return `<div class="xc"><div class="hn">${label}</div><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} trend"><polyline points="${poly}" fill="none" stroke="currentColor" stroke-width="1.4"/>${dots}</svg><div class="hn">${esc(dstr(h[0][0]))} ${h[0][1].toLocaleString()} → ${esc(dstr(h[h.length-1][0]))} ${h[h.length-1][1].toLocaleString()}</div></div>`;
}
function growHtml(s,k='hist'){
  const g=gr(s,k);if(!g)return '';
  const up=g.abs>0,dn=g.abs<0,p=g.pct==null?'':Math.abs(Math.round(g.pct*100))+'%';
  return `<div class="GR" title="${esc(dstr(g.d0))}: ${g.f.toLocaleString()} → ${esc(dstr(g.d1))}: ${g.l.toLocaleString()} (${g.abs>=0?'+':''}${g.abs.toLocaleString()})">${spark(s[k])}<span class="gp ${up?'up':dn?'dn':''}">${up?'▲':dn?'▼':'–'}${p}</span></div>`;
}
const ageTag=h=>{const p=h&&h.length?h[h.length-1]:null;if(!p)return '';const d=daysAgo(p[0]);return d>=2?`<span class="age${d>10?' old':''}" title="last reading ${esc(dstr(p[0]))} - ${d} days before this build">${d}d</span>`:''};

let REP={},CAPS={},OPEN=new Set(),SPL=[],ALL=[],DAYS=[],HS={},HEALTH=null,
  S={view:'all',q:'',days:new Set(),pls:new Set(),pr:new Set(),sp:new Set(),bk:new Set(),ag:new Set(),sort:'date',dir:-1,sort2:'',dir2:-1,sel:-1,src:'',flag:false,hs:false,mine:false,grp:false},VIEW=[],lastDay=null;
let LIM=120,RN=0,RLAST=null;

const plain=s=>(s.playlists||[]).filter(p=>!isSP(p.t));
const sps=s=>(s.playlists||[]).filter(p=>isSP(p.t));
const igHandle=u=>String(u||'').replace(/^https?:\/\/(www\.)?instagram\.com\//i,'').replace(/[\/?].*$/,'');

// ---- signed state: the ROSTR agency unless a teammate overrode it
function agInfo(s){const o=TEAM[akey(s)],g=o&&o.sign;
  if(g){if(g.v==='signed')return {ag:g.ag||s.ag||'signed',by:g.i,man:true,t:g.t};
        if(g.v==='unsigned'||g.v==='wrong')return {ag:'',by:g.i,man:true,t:g.t,wrong:g.v==='wrong'}}
  return {ag:s.ag||'',agt:s.agt,man:false}}
const agOf=s=>agInfo(s).ag;

function blob(s){if(!s._b)s._b=(s.artist+' '+s.song+' '+(s.press||[]).map(p=>p.t).join(' ')+' '+(s.playlists||[]).map(p=>p.t).join(' ')+' '+(s.ag||'')+' '+(s.agt||'')+' '+igHandle(s.igUrl)).toLowerCase();
  const o=TEAM[akey(s)];return o?s._b+' '+o.notes.map(n=>n.i+' '+n.x).join(' ').toLowerCase()+(o.flag?' flagged '+o.flag.i.toLowerCase():'')+(o.ig?' '+igHandle(o.ig.u).toLowerCase():''):s._b}
function match(s,skip){
  if(S.src&&s.src!==S.src)return false;
  if(S.flag&&!isFlag(s))return false;
  if(S.mine&&!mine(s))return false;
  if(S.hs&&agOf(s))return false;
  const q=S.q.trim().toLowerCase();
  if(q&&!blob(s).includes(q))return false;
  if(skip!=='view'){
    if(S.view==='week'){const c=new Date();c.setDate(c.getDate()-7);if(s.date<c.toISOString().slice(0,10))return false}
    if(S.view==='press'&&!(s.press||[]).length)return false;
    if(S.view==='grow'&&!(gr(s)&&gr(s).pct>=0.1))return false;
    if(S.view==='igrow'&&!(gr(s,'igh')&&gr(s,'igh').pct>=0.1))return false;
  }
  if(skip!=='days'&&S.days.size&&!S.days.has(s.date))return false;
  if(skip!=='pls'&&S.pls.size&&!plain(s).some(p=>S.pls.has(p.t)))return false;
  if(skip!=='pr'&&S.pr.size&&!(s.press||[]).some(p=>S.pr.has(p.t)))return false;
  if(skip!=='sp'&&S.sp.size&&!sps(s).some(p=>S.sp.has(p.t)))return false;
  if(skip!=='ag'&&S.ag.size&&!S.ag.has(agOf(s)||'(none)'))return false;
  if(skip!=='bk'&&S.bk.size&&![...S.bk].some(i=>cur(s)>=BK[i][0]&&cur(s)<BK[i][1]))return false;
  return true;
}
const cur=s=>{const p=lastPt(s);return p?p[1]:s.listeners};
const KEY={iggr:s=>{const g=gr(s,'igh');return g&&g.pct!=null?g.pct:-9},gr:s=>{const g=gr(s);return g&&g.pct!=null?g.pct:-9},date:s=>s.date,artist:s=>s.artist.toLowerCase(),song:s=>s.song.toLowerCase(),listeners:s=>cur(s)??-1,ig:s=>{const p=lastPt(s,'igh');return p?p[1]:(s.ig??-1)},press:s=>(s.press||[]).length,ag:s=>(agOf(s)||'~').toLowerCase(),pls:s=>(s.playlists||[]).length};
function compute(){
  let v=ALL.filter(s=>match(s));
  const k=KEY[S.sort],d=S.dir,k2=S.sort2&&KEY[S.sort2],d2=S.dir2;
  v.sort((a,b)=>{const x=k(a),y=k(b);let r=(x<y?-1:x>y?1:0)*d;if(!r&&k2){const x2=k2(a),y2=k2(b);r=(x2<y2?-1:x2>y2?1:0)*d2}return r||(ALL.indexOf(a)-ALL.indexOf(b))});
  ALL.forEach(s=>s._n=0);
  if(S.grp){const m=new Map();v.forEach(s=>{const key=akey(s),g=m.get(key);if(g)g.n++;else m.set(key,{rep:s,n:1})});v=[...m.values()].map(g=>{g.rep._n=g.n;return g.rep})}
  VIEW=v;
}

const pd=p=>p.d?`<i>${esc(dstr(p.d))}</i>`:'';
const chipsHtml=(arr,cls)=>(arr||[]).map(p=>p.u?`<a class="chip ${cls||p.c}" href="${esc(p.u)}" target="_blank" rel="noopener" title="${esc(p.t)}${p.d?' · '+esc(dlong(p.d)):''}">${esc(p.t)}${pd(p)}</a>`:`<span class="chip ${cls||p.c}">${esc(p.t)}</span>`).join('');
const shList=s=>(s.plays||'').split(/;|\n/).map(x=>x.trim().replace(/^upcoming:\s*/i,'')).filter(Boolean);
const capHtml=x=>{const m=x.match(/^(.+?),\s*([^,]+?)\s+\d+\/\d+\/\d+/);const c=m&&CAPS[(m[1]+'|'+m[2]).toLowerCase()];return c?`<b title="approximate venue capacity">cap ~${c.toLocaleString()}</b>`:''};
const rowKey=s=>s.track||s.artist+s.song;
// instagram cell. A count comes from the sheet, a teammate, or the public logged-out preview read by ig_public.py.
function igHtml(s){
  const k=akey(s),o=TEAM[k],g=o&&o.ig,gi=gr(s,'igh'),lp=lastPt(s,'igh'),n=lp?lp[1]:s.ig,url=s.igUrl||(g&&g.u),h=igHandle(url);
  const w=n?Math.max(2,Math.min(100,Math.sqrt(n/1e5)*100)):0;
  if(n){return `<div class="NG"><a class="num n2" style="--w:${w}%" ${url?`href="${esc(url)}" target="_blank" rel="noopener"`:''} title="${n.toLocaleString()} instagram followers${gi?' (latest, public preview) · '+gi.f.toLocaleString()+' on '+esc(dstr(gi.d0)):''}"><span>${fmt(n)}</span></a>${ageTag(s.igh)}${growHtml(s,'igh')}${API&&g?`<button class="igp" data-act="hist" data-v="${esc(k)}" title="edit Instagram">✎</button>`:''}</div>`}
  if(g&&g.u&&g.c)return `<div class="NG"><a class="num n2" style="--w:${Math.max(2,Math.min(100,Math.sqrt(g.c/1e5)*100))}%" href="${esc(g.u)}" target="_blank" rel="noopener" title="typed in by ${esc(g.i)} ${esc(ago(g.t))}"><span>${fmt(g.c)}</span></a><button class="igp" data-act="hist" data-v="${esc(k)}" title="edit Instagram">✎</button></div>`;
  if(url){return `<div class="NG col"><a class="num n2 hd" style="--w:2%" href="${esc(url)}" target="_blank" rel="noopener" title="open Instagram"><span>@${esc(h)}</span></a><span class="nc" title="${s.igx?'the profile no longer exists under this handle':'followers not read yet - the next daily pass fills it in, or type it in'}">${s.igx?'profile gone':'no count yet'}</span>${API?`<button class="igp on" data-act="igadd" data-v="${esc(k)}" title="type the followers in by hand">✎</button>`:''}</div>`}
  return API?`<button class="iga" data-act="igadd" data-v="${esc(k)}" title="add this artist's Instagram">add instagram</button>`:'<span class="none">–</span>';
}
const mention=x=>esc(x).replace(/(^|\s)@([\w.-]{1,24})/g,(m,a,n)=>`${a}<mark class="${INI&&n.toLowerCase()===INI.toLowerCase()?'me2':''}">@${n}</mark>`);
const noteLine=s=>{const n=(TEAM[akey(s)]||{notes:[]}).notes[0];return n?`<div class="nt"><b>${esc(n.i)}</b> ${mention(n.x)}</div>`:''};
function showsHtml(s){
  const l=shList(s);if(!l.length)return '';
  const k=rowKey(s),o=OPEN.has(k);
  return `<div><button class="shw" data-act="shows" data-v="${esc(k)}" aria-expanded="${o}">${l.length} show${l.length>1?'s':''} ${o?'▴':'▾'}</button></div>${o?`<div class="shwl">${l.map(x=>`<span>${esc(x)}${capHtml(x)}</span>`).join('')}</div>`:''}`;
}
function rostrHtml(s){const a=agInfo(s);
  if(a.ag){return `<a href="${s.rs&&!a.man?'https://www.rostr.cc/artist/'+esc(s.rs):'#'}" target="_blank" rel="noopener" title="${a.man?'set by '+esc(a.by):'open on ROSTR'}">${esc(a.ag)}</a>${a.man?'<span class="hn">set by '+esc(a.by)+'</span>':s.agt?`<span class="hn">${esc(s.agt)}</span>`:''}`}
  if(a.man)return `<span class="hn">${a.wrong?'wrong rostr match':'unsigned'} · ${esc(a.by)}</span>`;
  if(s.rp)return `<a class="soft" href="https://www.rostr.cc/artist/${esc(s.rp)}" target="_blank" rel="noopener" title="profile found, no agency listed">no agency listed</a>`;
  if(s.rn)return '<span class="hn" title="no exact name match on ROSTR - check by hand">no rostr match</span>';
  return ''}
function rowHtml(s,i){
  const g0=gr(s),now=cur(s),k=akey(s),fl=isFlag(s),t=TEAM[k]||{notes:[]};
  const w=now?Math.max(2,Math.min(100,now/1e3)):0;
  const pls=[...plain(s).map(p=>({...p,c:'pl'})),...sps(s).map(p=>({...p,c:'sp'}))];
  const star=s.src==='WL'?'':`<button class="fl${fl?' on':''}${s.flag?' lock':''}" data-act="flag" data-v="${esc(k)}" aria-pressed="${fl}" aria-label="${fl?'unflag':'flag'} ${esc(s.artist)}" title="${s.flag?'artist flagged in the sheet':fl?(API&&t.flag?'flagged by '+esc(t.flag.i)+' - click to unflag':'unflag artist'):'flag artist'}">${fl?'★':'☆'}</button>`;
  return `<div class="row${i===S.sel?' sel':''}${fl?' fg':''}" data-i="${i}">
    <button class="d" data-act="day" data-v="${s.date}" title="filter to ${esc(dlong(s.date))}">${dstr(s.date)}</button>
    <div class="A"><div class="al"><span class="alw">${star}${s.track?`<a class="a" href="${esc(s.track)}" target="_blank" rel="noopener" title="open ${esc(s.song||s.artist)} on spotify">${esc(s.artist)}</a>`:`<span class="a">${esc(s.artist)}</span>`}<button class="tg ${s.src==='MP'?'mp':s.src==='WL'?'wl':'sp'}${S.src===s.src?' on':''}" data-act="src" data-v="${s.src}" title="${s.src==='MP'?'REC':s.src==='WL'?'WATCHLIST':'SCAN'} - click to show only these">${TAGN[s.src]||s.src}</button>${s._n>1?`<button class="rp" data-act="artist" data-v="${esc(s.artist)}" title="${s._n} songs - click to list them">×${s._n}</button>`:''}${REP[k]>1&&!S.grp?`<button class="rp" data-act="hist" data-v="${esc(k)}" title="seen before - show history">↻ ${REP[k]}</button>`:''}${API?`<button class="nb${t.notes.length?' has':''}" data-act="hist" data-v="${esc(k)}" aria-label="team notes for ${esc(s.artist)}" title="team notes">✎${t.notes.length||''}</button>`:''}<button class="xb" data-act="hist" data-v="${esc(k)}" aria-label="open details for ${esc(s.artist)}" title="open details: graphs, playlists, press, shows, notes">▸</button></span></div>${showsHtml(s)}${noteLine(s)}</div>
    <div class="s">${s.track&&s.src!=='WL'?`<a href="${esc(s.track)}" target="_blank" rel="noopener" title="open on spotify">${esc(s.song)}</a>`:esc(s.song)}${s._n>1?` <span class="hn">+${s._n-1} more</span>`:''}</div>
    <div class="L">${now!=null?`<div class="NG"><a class="num n1" style="--w:${w}%" ${s.track?`href="${esc(s.track)}" target="_blank" rel="noopener"`:''} title="${now.toLocaleString()} monthly listeners${g0?' (latest) · '+g0.f.toLocaleString()+' on '+esc(dstr(g0.d0)):''}"><span>${fmt(now)}</span></a>${ageTag(s.hist)}${s.jp?`<span class="jp" title="listeners ${s.jp.f.toLocaleString()} → ${s.jp.t.toLocaleString()} (${esc(dstr(s.jp.d0))} → ${esc(dstr(s.jp.d1))})">▲ JUMP</span>`:''}${growHtml(s)}</div>`:'<span class="none">–</span>'}</div>
    <div class="G">${igHtml(s)}</div>
    <div class="P chips">${chipsHtml(s.press,'pr')}</div>
    <div class="RS">${rostrHtml(s)}</div>
    <div class="PL chips">${chipsHtml(pls)}</div>
  </div>`;
}
function rowsHtml(a,b){
  let h='';
  for(let i=a;i<b&&i<VIEW.length;i++){const s=VIEW[i];
    if(S.sort==='date'&&s.date!==RLAST){
      RLAST=s.date;const n=VIEW.filter(x=>x.date===s.date).length;
      const sp=SPL.find(x=>x.date===s.date);const spu=sp&&'https://open.spotify.com/playlist/'+sp.id;
      h+=`<div class="daycap"><button data-act="day" data-v="${s.date}">${esc(dlong(s.date))}</button><span>${n} ${S.grp?'artist':'song'}${n>1?'s':''}</span>${sp?`<a href="${spu}" target="_blank" rel="noopener">${esc(sp.name)} ↗</a>`:''}</div>`;
    }
    h+=rowHtml(s,i);
  }
  return h;
}
// rows are drawn 120 at a time; the rest arrive as you scroll
function renderRows(){
  RLAST=null;RN=Math.min(VIEW.length,Math.max(LIM,0));
  $('#rows').innerHTML=rowsHtml(0,RN)+(RN<VIEW.length?'<div id="more" class="empty"> </div>':'');
  $('#empty').hidden=VIEW.length>0;
  fitArtist();watchMore();
}
function fitArtist(){let m=0;document.querySelectorAll('#rows .alw').forEach(e=>{m=Math.max(m,e.offsetWidth)});
  document.documentElement.style.setProperty('--aw',innerWidth>900&&m?Math.min(520,Math.ceil(m+20))+'px':'110px')}
let IO=null;
function watchMore(){const m=$('#more');if(!m)return;if(!IO)IO=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))moreRows()},{rootMargin:'800px'});IO.disconnect();IO.observe(m)}
function moreRows(n){const m=$('#more');if(!m)return;const a=RN;LIM=RN=Math.min(VIEW.length,n||RN+120);m.insertAdjacentHTML('beforebegin',rowsHtml(a,RN));fitArtist();if(RN>=VIEW.length)m.remove();else watchMore()}
const FSETS=()=>({'f-pl':S.pls,'f-pr':S.pr,'f-sp':S.sp,'f-ag':S.ag});
function facet(el,items,set,cls){
  el.innerHTML=items.map(([t,c,u])=>`<div class="f ${set.has(t)?'on ':''}${cls}"><button class="l" data-act="f" data-k="${el.id}" data-v="${esc(t)}" aria-pressed="${set.has(t)}">${esc(t)}</button><span class="c">${c}</span>${u?`<a class="o" href="${esc(u)}" target="_blank" rel="noopener" title="open on spotify">↗</a>`:'<span class="o"></span>'}</div>`).join('');
}
function counts(skip,get){
  const m=new Map();
  ALL.filter(s=>match(s,skip)).forEach(s=>get(s).forEach(p=>{const e=m.get(p.t)||[p.t,0,p.u];e[1]++;if(!e[2])e[2]=p.u;m.set(p.t,e)}));
  S[skip]&&[...S[skip]].forEach(t=>{if(!m.has(t))m.set(t,[t,0,null])});
  return [...m.values()];
}
function renderSide(){
  const by=(a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]);
  facet($('#f-pl'),counts('pls',plain).sort(by),S.pls,'');
  facet($('#f-pr'),counts('pr',s=>s.press||[]).sort(by),S.pr,'pk');
  facet($('#f-sp'),counts('sp',sps).sort((a,b)=>spN(b[0])-spN(a[0])),S.sp,'sk');
  facet($('#f-ag'),counts('ag',s=>[{t:agOf(s)||'(none)'}]).sort(by),S.ag,'');
  const bc=BK.map(b=>ALL.filter(s=>match(s,'bk')&&cur(s)>=b[0]&&cur(s)<b[1]).length),mx=Math.max(1,...bc);
  $('#bk').innerHTML=bc.map((c,i)=>`<button data-act="bk" data-v="${i}" class="${S.bk.has(i)?'on':''}" style="height:${Math.max(2,Math.round(c/mx*44))}px" aria-label="${BK[i][2]} listeners: ${c} songs" aria-pressed="${S.bk.has(i)}" title="${c} songs"></button>`).join('');
  $('#bkl').innerHTML=BK.map(b=>`<span>${b[2]}</span>`).join('');
}
const TABS=[['all','all'],['week','last 7 days'],['press','has press'],['grow','monthly listeners 10%+'],['igrow','instagram 10%+']];
function renderTop(){
  document.body.classList.toggle('nosong',!S.flag);
  document.querySelectorAll('.pill[data-act]').forEach(b=>{const on=b.dataset.act==='flagged'?S.flag:b.dataset.act==='hs'?S.hs:false;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
  document.querySelectorAll('[data-tog]').forEach(b=>{const on={mine:S.mine,grp:S.grp}[b.dataset.tog];b.classList.toggle('on',!!on);b.setAttribute('aria-pressed',!!on)});
  const cv=S.view;
  $('#tabs').innerHTML=TABS.map(([k,l])=>{S.view=k;const n=ALL.filter(s=>match(s)).length;return `<button data-act="view" data-v="${k}" class="${cv===k?'on':''}" aria-pressed="${cv===k}">${l}<span class="n">${n}</span></button>`}).join('');
  S.view=cv;
  const act=[];
  if(S.src)act.push(['src',S.src,TAGN[S.src]||S.src]);if(S.flag)act.push(['flag','','flagged']);if(S.mine)act.push(['mine','','my flags']);if(S.hs)act.push(['hs','','hide signed']);if(S.q)act.push(['q','','"'+S.q+'"']);
  S.days.forEach(v=>act.push(['days',v,dstr(v)]));S.pls.forEach(v=>act.push(['pls',v,v]));S.pr.forEach(v=>act.push(['pr',v,v]));S.sp.forEach(v=>act.push(['sp',v,v]));S.ag.forEach(v=>act.push(['ag',v,'agency: '+v]));S.bk.forEach(v=>act.push(['bk',v,BK[v][2]+' listeners']));
  $('#active').innerHTML=act.map(([k,v,l])=>`<button data-act="rm" data-k="${k}" data-v="${esc(v)}" aria-label="remove filter ${esc(l)}">${esc(l)}</button>`).join('')+(act.length?'<button class="clr" data-act="clear">clear all</button>':'');
  $('#cnt').textContent=S.grp?VIEW.length+' artists':VIEW.length+' of '+ALL.length+' songs';
  document.querySelectorAll('#head button').forEach(b=>{const d=b.dataset.sort;b.classList.toggle('s',d===S.sort);b.classList.toggle('asc',d===S.sort&&S.dir===1);b.classList.toggle('s2',d===S.sort2);b.classList.toggle('asc2',d===S.sort2&&S.dir2===1);b.setAttribute('aria-sort',d===S.sort?(S.dir===1?'ascending':'descending'):'none')});
  $('#dens').textContent=document.body.classList.contains('compact')?'comfortable rows':'compact rows';
}
function render(){compute();renderTop();renderSide();renderRows();save()}
const stateObj=()=>({v:S.view,q:S.q,d:[...S.days],p:[...S.pls],r:[...S.pr],s:[...S.sp],b:[...S.bk],a:[...S.ag],o:S.sort,i:S.dir,o2:S.sort2,i2:S.dir2,x:S.src,f:S.flag,h:S.hs,m:S.mine,g:S.grp});
function save(){try{history.replaceState(null,'','#'+encodeURIComponent(JSON.stringify(stateObj())))}catch(e){}}
function applyState(o){S.view=TABS.some(t=>t[0]===o.v)?o.v:'all';S.q=o.q||'';S.days=new Set(o.d);S.pls=new Set(o.p);S.pr=new Set(o.r);S.sp=new Set(o.s);S.bk=new Set(o.b);S.ag=new Set(o.a);S.sort=KEY[o.o]?o.o:'date';S.dir=o.i||-1;S.sort2=KEY[o.o2]?o.o2:'';S.dir2=o.i2||-1;S.src=o.x||'';S.flag=!!o.f;S.hs=!!o.h;S.mine=!!o.m;S.grp=!!o.g;$('#q').value=S.q;LIM=120}
function load(){try{applyState(JSON.parse(decodeURIComponent(location.hash.slice(1))))}catch(e){}}
const clearAll=()=>{S.src='';S.flag=false;S.hs=false;S.mine=false;S.days.clear();S.pls.clear();S.pr.clear();S.sp.clear();S.bk.clear();S.ag.clear();S.q='';S.view='all';$('#q').value='';LIM=120};
let HO=false,PO=null,PM='artist',OPENER=null,SEEN=ls.get('instinct_seen')||'',SEENP='';
const ago=iso=>{const d=new Date(iso);return isNaN(d)?'':d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})};

// ---- panels (artist / activity / digest / watch / help share the #hist modal)
function panelHtml(k){
  const l=ALL.filter(s=>akey(s)===k&&s.src!=='WL').sort((a,b)=>b.date.localeCompare(a.date));
  const o=TEAM[k]||{flag:null,notes:[],sign:null};
  const rep=l[0]||ALL.find(s=>akey(s)===k);if(!rep)return '';
  const g=gr(rep),first=l.length?l[l.length-1].date:rep.date,sheet=l.some(s=>s.flag);
  const rs=l.find(s=>s.ag)||rep,a=agInfo(rep),slug=l.find(s=>s.rs)||l.find(s=>s.rp)||{};
  const agLine=`<div class="hn ag">${a.ag?(rs.rs&&!a.man?`<a href="https://www.rostr.cc/artist/${esc(rs.rs)}" target="_blank" rel="noopener">${esc(a.ag)} ↗</a>`:esc(a.ag)):(a.wrong?'wrong rostr match':a.man?'unsigned (set by team)':rs.rp?'profile on rostr, no agency listed':rs.rn?'no exact match on rostr':'not checked on rostr yet')}${rs.agt&&!a.man?' · '+esc(rs.agt):''}${a.man?' · set by '+esc(a.by)+' '+esc(ago(a.t)):''} <span>(rostr)</span>${slug.rs||slug.rp?` · <a href="https://www.rostr.cc/artist/${esc(slug.rs||slug.rp)}" target="_blank" rel="noopener">matched ${esc(slug.rs||slug.rp)} ↗</a>`:''}</div>`;
  const signForm=API?`<form class="sgf" data-v="${esc(k)}"><input name="ag" placeholder="agency (to mark signed)" maxlength="60" aria-label="agency name" autocomplete="off"><button type="submit">mark signed</button><button type="button" data-act="sign" data-v="${esc(k)}" data-s="unsigned">mark unsigned</button><button type="button" data-act="sign" data-v="${esc(k)}" data-s="wrong">wrong person</button>${o.sign?`<button type="button" data-act="sign" data-v="${esc(k)}" data-s="reset">reset to rostr</button>`:''}</form>`:'';
  const igo=o.ig,igRow=rep.igUrl?igHandle(rep.igUrl):igo&&igo.u?igHandle(igo.u):'',
    igSec=API?`<form class="igf" data-v="${esc(k)}"><span class="hn">instagram${igRow?' · @'+esc(igRow):''}${igo&&igo.c?' · typed in by '+esc(igo.i)+' '+esc(ago(igo.t)):''}</span><input class="igi" name="u" placeholder="handle or link" value="${esc(igRow)}" autocomplete="off" aria-label="instagram handle or link"><input class="igc" name="c" placeholder="followers (optional)" value="${igo&&igo.c?igo.c:''}" autocomplete="off" aria-label="followers"><button type="submit">save</button></form>`:'';
  const flagBtn=sheet?'<span class="hn">flagged in the sheet</span>':API?`<button class="fb${o.flag?' on':''}" data-act="pflag" data-v="${esc(k)}">${o.flag?'★ flagged by '+esc(o.flag.i)+' · unflag':'☆ flag this artist'}</button>`:'';
  const notes=API?`<div class="ns">${o.notes.map(n=>`<div class="nr" data-id="${esc(n.id)}"><b>${esc(n.i)}</b><span class="hn"> ${esc(ago(n.t))}${n.ed?' · edited by '+esc(n.ei||'')+' '+esc(ago(n.ed)):''}</span> <button class="nx" data-act="nedit" data-v="${esc(n.id)}" aria-label="edit note" title="edit note">✎</button><button class="nx" data-act="ndel" data-v="${esc(n.id)}" aria-label="delete note" title="delete note">✕</button><div class="nbody">${mention(n.x)}</div></div>`).join('')||'<div class="hn">no notes yet</div>'}
    <form class="nf" data-v="${esc(k)}"><input class="ni" name="i" maxlength="24" placeholder="your name" value="${esc(INI)}" aria-label="name"><input class="nx2" name="x" maxlength="500" placeholder="add a note - @name to mention someone" autocomplete="off" aria-label="note"><button type="submit">add</button></form></div>`:'';
  const shows=shList(rep),pls=[...plain(rep).map(p=>({...p,c:'pl'})),...sps(rep).map(p=>({...p,c:'sp'}))];
  const detail=(pls.length||(rep.press||[]).length||shows.length)?`<div class="ns pdet">${pls.length?`<div class="hn">found on</div><div class="chips">${chipsHtml(pls)}</div>`:''}${(rep.press||[]).length?`<div class="hn" style="margin-top:8px">press</div><div class="chips">${chipsHtml(rep.press,'pr')}</div>`:''}${shows.length?`<div class="hn" style="margin-top:8px">shows</div><div class="shwl">${shows.map(x=>`<span>${esc(x)}${capHtml(x)}</span>`).join('')}</div>`:''}</div>`:'';
  const hist=l.length>1?`<p class="hs">seen ${l.length} times · first ${esc(dlong(first))}${g?` · listeners ${g.f.toLocaleString()} → ${g.l.toLocaleString()} (${g.abs>=0?'+':''}${g.abs.toLocaleString()})`:''}</p>`:'';
  return `<div class="hc" role="dialog" aria-modal="true" aria-label="${esc(rep.artist)}"><button class="hx" data-act="histx" aria-label="close">✕</button>
    <h3>${esc(rep.artist)}</h3>${agLine}<div class="pcharts">${sparkBig(rep.hist,'monthly listeners')}${sparkBig(rep.igh,'instagram followers')}</div>${detail}${signForm}<div class="hf">${flagBtn}</div>${igSec}${notes}${hist}
    ${l.length>1?l.map((s,i)=>`<div class="hr"><div class="hd">${esc(dstr(s.date))}<span class="tg ${s.src==='MP'?'mp':'sp'}">${TAGN[s.src]||s.src}</span></div>
      <div class="hm">${s.track?`<a href="${esc(s.track)}" target="_blank" rel="noopener">${esc(s.song)} ↗</a>`:esc(s.song)}<span class="hn">${s.listeners!=null?fmt(s.listeners)+' listeners when added':''}${s.ig?' · '+fmt(s.ig)+' instagram':''}</span>
      ${i?`<div class="chips">${chipsHtml(s.press,'pr')}${chipsHtml([...plain(s).map(p=>({...p,c:'pl'})),...sps(s).map(p=>({...p,c:'sp'}))])}</div>`:''}</div></div>`).join(''):''}</div>`;
}
// activity feed: everything the team did, newest first, with a divider at the last visit
function evText(e){const n=esc(e.n||e.a),who=`<b>${esc(e.i)}</b>`;
  switch(e.y){case 'flag':return `${who} flagged ${n}`;case 'unflag':return `${who} unflagged ${n}`;
    case 'note':return `${who} noted on ${n}: ${mention(e.x)}`;case 'edit':return `${who} edited a note on ${n}`;case 'del':return `${who} removed a note on ${n}`;
    case 'ig':return `${who} set Instagram for ${n}`;case 'sign':{const v=String(e.x||'').split('|');return `${who} marked ${n} ${v[0]==='signed'?'signed'+(v[1]?' ('+esc(v[1])+')':''):v[0]==='unsigned'?'unsigned':v[0]==='wrong'?'a wrong rostr match':'back to rostr data'}`}
    case 'view':return `${who} saved the view “${n}”`;case 'watch':return `${who} is watching ${n}`;case 'unwatch':return `${who} stopped watching ${n}`;default:return ''}}
const mentionsMe=e=>INI&&e.y==='note'&&new RegExp('(^|\\s)@'+INI.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\w.-])','i').test(e.x||'');
const newEv=e=>SEENP&&String(e.t)>SEENP&&e.i!==INI&&evText(e);
function paintFeedBadge(){const n=LOG.filter(newEv).length,b=$('#fb');if(b)b.textContent=n?' ('+n+')':''}
function feedHtml(){
  let h='',day='',div=false;
  LOG.slice().sort((a,b)=>String(b.t).localeCompare(String(a.t))).slice(0,150).forEach(e=>{const t=evText(e);if(!t)return;
    const d=String(e.t).slice(0,10);if(d!==day){day=d;h+=`<div class="hn" style="margin:12px 0 4px">${esc(dlong(d))}</div>`}
    if(!div&&SEENP&&String(e.t)<=SEENP){div=true;h+='<div class="seenline">you were here</div>'}
    h+=`<div class="ev${newEv(e)?' new':''}${mentionsMe(e)?' mn':''}"><span class="hn">${esc(new Date(e.t).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}))}</span> ${t}${mentionsMe(e)?' <span class="rp">mentions you</span>':''}</div>`});
  return `<div class="hc" role="dialog" aria-modal="true" aria-label="activity"><button class="hx" data-act="histx" aria-label="close">✕</button><h3>team activity</h3><p class="hs">${LOG.length} events logged${SEENP?' · highlighted = since your last visit':''}</p>${h||'<div class="hn">nothing yet</div>'}</div>`}
function digestData(){
  const c=new Date();c.setDate(c.getDate()-7);const since=c.toISOString().slice(0,10),seen=new Set();
  const nw=ALL.filter(s=>s.date>=since&&s.src!=='WL');
  const uniq=a=>a.filter(s=>{const k=akey(s);if(seen.has(k))return false;seen.add(k);return true});
  const jumps=uniq(ALL.filter(s=>s.jp));seen.clear();
  const open=uniq(nw.filter(s=>!agOf(s)&&!isFlag(s)&&(cur(s)||0)<50000).sort((a,b)=>(cur(b)||0)-(cur(a)||0))).slice(0,10);seen.clear();
  const mov=uniq(ALL.filter(s=>isFlag(s)&&gr(s)&&gr(s).pct!=null).sort((a,b)=>gr(b).pct-gr(a).pct)).slice(0,6);
  const ev=LOG.filter(e=>String(e.t).slice(0,10)>=since);
  return {since,nw:nw.length,nwA:new Set(nw.map(akey)).size,jumps,open,mov,flags:ev.filter(e=>e.y==='flag').length,notes:ev.filter(e=>e.y==='note').length}}
function digestText(){const d=digestData(),L=['A&R INSTINCT - week since '+dstr(d.since),'',d.nw+' new songs from '+d.nwA+' artists'];
  if(d.jumps.length){L.push('','JUMPED');d.jumps.forEach(s=>L.push('- '+s.artist+': '+s.jp.f.toLocaleString()+' → '+s.jp.t.toLocaleString()+' monthly listeners'))}
  if(d.open.length){L.push('','NEW AND UNSIGNED, UNDER 50K');d.open.forEach(s=>L.push('- '+s.artist+' ('+fmt(cur(s))+')'+(s.track?' '+s.track:'')))}
  if(d.mov.length){L.push('','FLAGGED ARTISTS MOVING');d.mov.forEach(s=>{const g=gr(s);L.push('- '+s.artist+': '+(g.abs>=0?'+':'')+Math.round(g.pct*100)+'% ('+fmt(g.f)+' → '+fmt(g.l)+')')})}
  L.push('','team: '+d.flags+' flags, '+d.notes+' notes this week');return L.join('\n')}
function digestHtml(){const d=digestData(),li=(s,x)=>`<li><a href="#" data-act="hist" data-v="${esc(akey(s))}">${esc(s.artist)}</a> <span class="hn">${x}</span></li>`;
  return `<div class="hc" role="dialog" aria-modal="true" aria-label="digest"><button class="hx" data-act="histx" aria-label="close">✕</button><h3>this week</h3><p class="hs">since ${esc(dlong(d.since))}</p>
   <p><b>${d.nw}</b> new songs · <b>${d.nwA}</b> artists</p>
   ${d.jumps.length?`<div class="ns"><div class="hn">jumped</div><ul>${d.jumps.map(s=>li(s,s.jp.f.toLocaleString()+' → '+s.jp.t.toLocaleString())).join('')}</ul></div>`:''}
   ${d.open.length?`<div class="ns"><div class="hn">new, unsigned, under 50k</div><ul>${d.open.map(s=>li(s,fmt(cur(s)))).join('')}</ul></div>`:''}
   ${d.mov.length?`<div class="ns"><div class="hn">flagged artists moving</div><ul>${d.mov.map(s=>{const g=gr(s);return li(s,(g.abs>=0?'+':'')+Math.round(g.pct*100)+'%')}).join('')}</ul></div>`:''}
   <p class="hn" style="margin-top:12px">team: ${d.flags} flags · ${d.notes} notes</p>
   <div class="nf"><button data-act="copydigest">copy as text</button></div></div>`}
function watchHtml(){const w=Object.entries(TEAM).filter(([k,o])=>o.watch);
  return `<div class="hc" role="dialog" aria-modal="true" aria-label="watchlist"><button class="hx" data-act="histx" aria-label="close">✕</button><h3>watch an artist</h3><p class="hs">track an artist that is not on the sheet. Paste their Spotify artist link; they get a row and daily listener readings.</p>
   <form class="wf"><input name="u" placeholder="spotify artist link" autocomplete="off" aria-label="spotify artist link"><input name="n" placeholder="artist name" maxlength="60" autocomplete="off" aria-label="artist name"><button type="submit">watch</button></form>
   <div class="ns">${w.map(([k,o])=>`<div class="nr"><b>${esc(o.watch.name)}</b> <span class="hn">added by ${esc(o.watch.i)}</span> <button class="nx" data-act="unwatch" data-v="${esc(k)}" aria-label="stop watching">✕</button></div>`).join('')||'<div class="hn">nothing watched yet</div>'}</div></div>`}
function helpHtml(){const K=[['j / k','next / previous row'],['f','flag or unflag the selected artist'],['n','open notes for the selected artist'],['x','open the details window for the selected row'],['o or Enter','open the song on Spotify'],['/','search'],['shift-click a column','add a second sort'],['Esc','clear filters / close'],['?','this help']];
  return `<div class="hc" role="dialog" aria-modal="true" aria-label="keyboard shortcuts"><button class="hx" data-act="histx" aria-label="close">✕</button><h3>keyboard</h3><div class="ns">${K.map(([a,b])=>`<div class="nr"><kbd>${a}</kbd> ${b}</div>`).join('')}</div></div>`}
const paintHtml=()=>PM==='feed'?feedHtml():PM==='digest'?digestHtml():PM==='watch'?watchHtml():PM==='help'?helpHtml():panelHtml(PO);
function paintPanel(){const a=document.activeElement,c=a&&a.closest&&a.closest('#hist')&&a.classList.length?'.'+a.classList[0]:'';$('#hist').innerHTML=paintHtml();if(c){const n=document.querySelector('#hist '+c);n&&n.focus()}}
function redrawPanel(){const f=document.querySelector('#hist .nx2,#hist .wf input,#hist .sgf input,#hist .ef input');if(f&&f.value)return;if(document.querySelector('#hist .nr.editing'))return;paintPanel()}
function openPanel(mode,k){OPENER=document.activeElement;PM=mode;PO=k||null;$('#hist').innerHTML=paintHtml();$('#hist').hidden=false;HO=true;const x=document.querySelector('#hist .hx');x&&x.focus()}
const openHist=k=>openPanel('artist',k);
const closeHist=()=>{$('#hist').hidden=true;HO=false;PO=null;PM='artist';if(OPENER&&OPENER.focus&&document.contains(OPENER))OPENER.focus();OPENER=null};
async function teamAct(o){ // optimistic: apply to local state, post, then re-pull the truth
  const e=tm(o.a),now=new Date().toISOString();
  if(o.type==='flag')e.flag={i:o.i,t:now};else if(o.type==='unflag')e.flag=null;
  else if(o.type==='note')e.notes.unshift({id:'tmp'+Date.now(),t:now,i:o.i,x:o.x});
  else if(o.type==='del')e.notes=e.notes.filter(n=>n.id!==o.x);
  else if(o.type==='edit'){const p=o.x.split('|'),id=p.shift();e.notes.forEach(n=>{if(n.id===id){n.x=p.join('|');n.ed=now;n.ei=o.i}})}
  else if(o.type==='ig'){const [u,c]=o.x.split('|');e.ig={u,c:c?+c:null,i:o.i,t:now}}
  else if(o.type==='sign'){const p=o.x.split('|'),v=p.shift();e.sign=v==='reset'?null:{v,ag:p.join('|'),i:o.i,t:now}}
  else if(o.type==='watch'){e.watch={id:o.x.split('|')[0],name:o.n,i:o.i,t:now};syncWatch()}
  else if(o.type==='unwatch'){e.watch=null;syncWatch()}
  render();if(HO)paintPanel();
  await postTeam(o);await pullTeam();
}
// artists a teammate asked to watch: show a row right away; the daily build replaces it with a tracked one
function syncWatch(){ALL=ALL.filter(s=>!s._opt);const have=new Set(ALL.map(akey));
  Object.entries(TEAM).forEach(([k,o])=>{if(o.watch&&!have.has(k))ALL.push({src:'WL',date:UPD||new Date().toISOString().slice(0,10),artist:o.watch.name||k,song:'',track:'https://open.spotify.com/artist/'+o.watch.id,wid:o.watch.id,_opt:true})});
  DAYS=[...new Set(ALL.map(s=>s.date))].sort()}
const paintMe=()=>{const b=$('#me');if(b)b.textContent=INI?INI+' ▾':'set your name'};
function askIni(first){const w=$('#who');$('#whoi').value=INI;$('#whox').hidden=!!first&&!INI;w.hidden=false;setTimeout(()=>$('#whoi').focus(),30)}
$('#whof').addEventListener('submit',e=>{e.preventDefault();const v=$('#whoi').value.trim().slice(0,24);if(!v){$('#whoi').focus();return}INI=v;ls.set('instinct_ini',v);$('#who').hidden=true;paintMe();render()});
$('#whox').addEventListener('click',()=>{$('#who').hidden=true});
function needIni(k){if(INI)return false;if(!k){askIni(false);return true}openHist(k);const i=document.querySelector('#hist .ni');i&&i.focus();return true}
const toggle=(set,v)=>set.has(v)?set.delete(v):set.add(v);
const copy=async t=>{try{await navigator.clipboard.writeText(t);return true}catch(e){const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}a.remove();return ok}};

// ---- saved views (shared with the team through the log)
function viewsHtml(){return `<div class="vw" role="menu">${VIEWS.map(v=>`<div class="vr"><button data-act="applyview" data-v="${esc(v.id)}" role="menuitem">${esc(v.name)}</button><span class="hn">${esc(v.i)}</span>${v.i===INI?`<button class="nx" data-act="delview" data-v="${esc(v.id)}" aria-label="delete view">✕</button>`:''}</div>`).join('')||'<div class="hn" style="padding:4px 0">no saved views yet</div>'}
  <form class="vf"><input name="n" maxlength="40" placeholder="name this view" aria-label="view name" autocomplete="off"><button type="submit">save current</button></form></div>`}

const SETS=()=>({days:S.days,pls:S.pls,pr:S.pr,sp:S.sp,bk:S.bk,ag:S.ag});
const ACT={
  hist:(b,v)=>{openHist(v);return 1},
  histx:()=>{closeHist();return 1},
  me:()=>{askIni(false);return 1},
  igadd:(b,v)=>{if(needIni(v))return 1;openHist(v);setTimeout(()=>{const f=document.querySelector('#hist .igi');f&&f.focus()},40);return 1},
  pflag:(b,v)=>{if(needIni(v))return 1;const o=TEAM[v];teamAct({type:o&&o.flag?'unflag':'flag',a:v,n:nameOf(v),i:INI});return 1},
  ndel:(b,v)=>{if(PO&&confirm('Delete this note?'))teamAct({type:'del',a:PO,n:nameOf(PO),x:v});return 1},
  nedit:(b,v)=>{const r=b.closest('.nr'),n=((TEAM[PO]||{}).notes||[]).find(q=>q.id===v);if(!r||!n)return 1;r.classList.add('editing');r.querySelector('.nbody').innerHTML=`<form class="ef" data-id="${esc(v)}"><input name="x" maxlength="500" value="${esc(n.x)}" aria-label="edit note"><button type="submit">save</button><button type="button" data-act="ecancel">cancel</button></form>`;r.querySelector('input').focus();return 1},
  ecancel:()=>{paintPanel();return 1},
  sign:(b,v)=>{if(needIni(v))return 1;teamAct({type:'sign',a:v,n:nameOf(v),i:INI,x:b.dataset.s});return 1},
  unwatch:(b,v)=>{teamAct({type:'unwatch',a:v,n:nameOf(v),i:INI,x:''});return 1},
  feed:()=>{openPanel('feed');const now=new Date().toISOString();ls.set('instinct_seen',now);SEEN=now;paintFeedBadge();return 1},
  digest:()=>{openPanel('digest');return 1},
  watch:()=>{if(needIni(''))return 1;openPanel('watch');return 1},
  help:()=>{openPanel('help');return 1},
  copydigest:async b=>{b.textContent=(await copy(digestText()))?'copied':'copy failed';return 1},
  copylink:async()=>{save();const ok=await copy(location.href);toast(ok?'link copied - it keeps your filters':'could not copy the link');return 1},
  dens:()=>{document.body.classList.toggle('compact');ls.set('instinct_dens',document.body.classList.contains('compact')?'1':'');renderTop();return 1},
  views:()=>{const v=$('#vws');v.hidden=!v.hidden;if(!v.hidden)v.innerHTML=viewsHtml();return 1},
  applyview:(b,v)=>{const w=VIEWS.find(x=>x.id===v);if(w){try{applyState(JSON.parse(w.state));$('#vws').hidden=true}catch(e){toast('that view could not be read')}}},
  delview:(b,v)=>{teamAct({type:'delview',a:'_views',n:'',i:INI,x:v});$('#vws').hidden=true;return 1},
  shows:(b,v)=>{OPEN.has(v)?OPEN.delete(v):OPEN.add(v);renderRows();return 1},
  csv:()=>{csv();return 1},
  facets:()=>{document.querySelector('.layout').classList.toggle('fx');return 1},
  view:(b,v)=>{S.view=v;LIM=120},
  day:(b,v)=>{S.days=new Set(S.days.has(v)&&S.days.size===1?[]:[v]);lastDay=v;LIM=120},
  artist:(b,v)=>{S.q=v;$('#q').value=v;LIM=120},
  f:(b,v)=>{toggle(FSETS()[b.dataset.k],v);LIM=120},
  bk:(b,v)=>{toggle(S.bk,+v);LIM=120},
  'clr-bk':()=>{S.bk.clear()},
  rm:(b,v)=>{const k=b.dataset.k;if(k==='src')S.src='';else if(k==='flag')S.flag=false;else if(k==='mine')S.mine=false;else if(k==='hs')S.hs=false;else if(k==='q'){S.q='';$('#q').value=''}else SETS()[k].delete(k==='bk'?+v:v);LIM=120},
  clear:()=>{clearAll()},
  home:()=>{clearAll();S.sort='date';S.dir=-1;S.sort2='';S.sel=-1;window.scrollTo(0,0)},
  flag:(b,v)=>{if(b.classList.contains('lock'))return 1;
    if(API){if(needIni(v))return 1;const o=TEAM[v],was=!!(o&&o.flag);teamAct({type:was?'unflag':'flag',a:v,n:nameOf(v),i:INI});if(!was){openHist(v);setTimeout(()=>{const f=document.querySelector('#hist .nx2');f&&f.focus()},40)}return 1}
    LF.has(v)?LF.delete(v):LF.add(v);ls.set('instinct_flags',JSON.stringify([...LF]))},
  src:(b,v)=>{S.src=S.src===v?'':v;LIM=120},
  flagged:()=>{S.flag=!S.flag;LIM=120},
  mine:()=>{if(!INI){askIni(false);return 1}S.mine=!S.mine;LIM=120},
  grp:()=>{S.grp=!S.grp;LIM=120},
  hs:()=>{S.hs=!S.hs;LIM=120},
};
document.addEventListener('click',async e=>{
  if(HO&&e.target.id==='hist'){closeHist();return}
  if(!e.target.closest('#vws,[data-act=views]'))$('#vws').hidden=true;
  if(e.target.closest('a[href]:not([href="#"])'))return;
  const b=e.target.closest('[data-act],[data-sort],[data-tog]');
  if(!b)return;
  if(b.dataset.tog){const f=ACT[b.dataset.tog];if(f){const r=f(b);if(r!==1)render()}return}
  if(b.dataset.sort){e.preventDefault();const k=b.dataset.sort;
    if(e.shiftKey&&k!==S.sort){if(S.sort2===k)S.dir2*=-1;else{S.sort2=k;S.dir2=k==='artist'||k==='song'?1:-1}}
    else if(S.sort===k)S.dir*=-1;else{S.sort=k;S.dir=k==='artist'||k==='song'?1:-1;if(S.sort2===k)S.sort2=''}
    LIM=120;render();return}
  if(b.tagName==='A')e.preventDefault();
  const f=ACT[b.dataset.act];if(!f)return;
  const r=await f(b,b.dataset.v);if(r===1)return;
  render();
});
const parseCount=s=>{s=String(s||'').trim().toLowerCase().replace(/,/g,'');const m=s.match(/^([\d.]+)\s*([km])?$/);if(!m)return null;const n=parseFloat(m[1])*(m[2]==='k'?1e3:m[2]==='m'?1e6:1);return isFinite(n)&&n>0?Math.round(n):null};
const spotArtistId=u=>{const m=String(u||'').match(/artist\/([A-Za-z0-9]{22})/)||String(u||'').trim().match(/^([A-Za-z0-9]{22})$/);return m&&m[1]};
document.addEventListener('submit',e=>{const t=e.target;
  if(t.matches('.igf')){e.preventDefault();if(needIni(t.dataset.v))return;
    const h=igHandle(t.u.value.trim().replace(/^@/,'')),c=parseCount(t.c.value);
    if(!/^[A-Za-z0-9._]{1,30}$/.test(h)){t.u.focus();t.u.style.borderBottomColor='#d9342b';return}
    teamAct({type:'ig',a:t.dataset.v,n:nameOf(t.dataset.v),i:INI,x:'https://www.instagram.com/'+h+'/|'+(c||'')});return}
  if(t.matches('.sgf')){e.preventDefault();if(needIni(t.dataset.v))return;const ag=t.ag.value.trim();if(!ag){t.ag.focus();return}teamAct({type:'sign',a:t.dataset.v,n:nameOf(t.dataset.v),i:INI,x:'signed|'+ag});return}
  if(t.matches('.ef')){e.preventDefault();const x=t.x.value.trim();if(!x||!PO)return;teamAct({type:'edit',a:PO,n:nameOf(PO),i:INI,x:t.dataset.id+'|'+x});return}
  if(t.matches('.wf')){e.preventDefault();const id=spotArtistId(t.u.value),n=t.n.value.trim();
    if(!id){t.u.focus();t.u.style.borderBottomColor='#d9342b';return}if(!n){t.n.focus();return}
    teamAct({type:'watch',a:n.toLowerCase(),n,i:INI,x:id+'|'+n});t.reset();return}
  if(t.matches('.vf')){e.preventDefault();if(needIni(''))return;const n=t.n.value.trim();if(!n)return;teamAct({type:'view',a:'_views',n,i:INI,x:JSON.stringify(stateObj())}).then(()=>{$('#vws').innerHTML=viewsHtml()});return}
  if(!t.matches('.nf'))return;e.preventDefault();
  const i=t.i.value.trim().slice(0,24),x=t.x.value.trim();if(!i||!x){(i?t.x:t.i).focus();return}
  INI=i;ls.set('instinct_ini',i);t.x.value='';teamAct({type:'note',a:t.dataset.v,n:nameOf(t.dataset.v),i,x})});
$('#q').addEventListener('input',e=>{S.q=e.target.value;LIM=120;render()});
document.addEventListener('keydown',e=>{
  const t=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  if(e.key==='Escape'&&!$('#who').hidden&&INI){$('#who').hidden=true;return}
  if(e.key==='Escape'&&HO){closeHist();return}
  if(e.key==='Escape'){if(t)e.target.blur();clearAll();S.sel=-1;render();return}
  if(t||e.metaKey||e.ctrlKey||e.altKey)return;
  if(e.key==='/'){e.preventDefault();$('#q').focus();return}
  if(e.key==='?'){e.preventDefault();openPanel('help');return}
  if(e.key==='j'||e.key==='k'){S.sel=Math.max(0,Math.min(VIEW.length-1,S.sel+(e.key==='j'?1:-1)));if(S.sel>=RN&&$('#more'))moreRows(S.sel+60);renderRows();const el=document.querySelector('.row.sel');el&&el.scrollIntoView({block:'center'});return}
  const sel=VIEW[S.sel];if(!sel)return;
  if(e.key==='f'&&sel.src!=='WL'&&!sel.flag){const k=akey(sel);if(API){if(needIni(k))return;const o=TEAM[k];teamAct({type:o&&o.flag?'unflag':'flag',a:k,n:sel.artist,i:INI})}else{LF.has(k)?LF.delete(k):LF.add(k);ls.set('instinct_flags',JSON.stringify([...LF]));render()}return}
  if(e.key==='n'&&API){e.preventDefault();openHist(akey(sel));setTimeout(()=>{const f=document.querySelector('#hist .nx2');f&&f.focus()},40);return}
  if(e.key==='x'){openHist(akey(sel));return}
  if((e.key==='Enter'||e.key==='o')&&sel.track)window.open(sel.track,'_blank','noopener');
});
function csv(){
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const rows=[['date','artist','song','monthly listeners','instagram','instagram growth %','listener growth %','press','playlists','agency','agent','signed','flagged by','track url'],...VIEW.map(s=>{const a=agInfo(s),g=gr(s),gi=gr(s,'igh'),o=TEAM[akey(s)],lp=lastPt(s,'igh');return [s.date,s.artist,s.song,cur(s),lp?lp[1]:s.ig,gi&&gi.pct!=null?Math.round(gi.pct*100):'',g&&g.pct!=null?Math.round(g.pct*100):'',(s.press||[]).map(p=>p.t).join(' | '),(s.playlists||[]).map(p=>p.t).join(' | '),a.ag,a.agt||'',a.ag?'yes':'no',o&&o.flag?o.flag.i:s.flag?'sheet':'',s.track]})];
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(q).join(',')).join('\n')],{type:'text/csv'}));a.download='instinct.csv';a.click();
}
// ---- footer: what the data looks like right now
function paintFoot(d){
  const h=HEALTH,u=new Date(d.updated),hrs=(Date.now()-u)/36e5;
  $('#upd').textContent='updated '+u.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+u.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  const st=$('#stale');st.hidden=hrs<30;st.textContent=hrs>=30?`this data is ${Math.round(hrs)} hours old - the daily refresh may have failed`:'';
  if(!h){$('#foot').textContent='';return}
  const bits=[`${h.rows} songs · ${h.artists} artists`,`listener readings through ${h.lastread?dstr(h.lastread):'–'}${h.stale?` (${h.stale} artists over 10 days old)`:''}`,`instagram: ${h.igcount} counts, ${h.iggrow} with growth, ${h.noig} songs with no profile${h.lastig?', last read '+dstr(h.lastig):''}`,`rostr: ${h.rostr_nomatch} no match${h.rostr_never?`, ${h.rostr_never} never checked`:''}`,`${h.jumps} active jump${h.jumps===1?'':'s'}`];
  $('#foot').innerHTML=bits.map(esc).join(' · ')+' · <button class="act" data-act="help">keys (?)</button>';
}
function init(data){
  {const tk={};data.songs.forEach(s=>{if(s.track)tk[s.track]=akey(s)});let ch=false;
   [...LF].forEach(k=>{if(/^https?:/.test(k)){LF.delete(k);if(tk[k])LF.add(tk[k]);ch=true}else if(k.includes('|')){LF.delete(k);LF.add(k.split('|')[0].split(/,| & | feat\.? | x /i)[0].trim().toLowerCase());ch=true}});
   if(ch)ls.set('instinct_flags',JSON.stringify([...LF]))}
  {const c=new Date();c.setMonth(c.getMonth()-6);const cut=c.toISOString().slice(0,10);data.songs.forEach(s=>{if(s.press)s.press=s.press.filter(p=>!p.d||p.d>=cut)})}
  HS=data.hs||{};HEALTH=data.health||null;UPD=String(data.updated||'').slice(0,10);
  data.songs.forEach(s=>{const e=HS[akey(s)];if(e){if(e.h)s.hist=e.h;if(e.g)s.igh=e.g;if(e.x)s.igx=1}});
  REP={};data.songs.forEach(s=>{if(s.src==='WL')return;const k=akey(s);REP[k]=(REP[k]||0)+1});
  TW=null;ALL=data.songs.slice().sort((a,b)=>(a.src==='MP')-(b.src==='MP'));
  DAYS=[...new Set(ALL.map(s=>s.date))].sort();
  paintFoot(data);
  syncWatch();render();
}
function boot(d,enc){
  window.__b=enc&&enc.b||d.updated;SPL=d.spl||[];CAPS=d.caps||{};API=d.api||null;
  $('#gate').hidden=true;init(d);
  if(!SEEN){SEEN=new Date().toISOString();ls.set('instinct_seen',SEEN)}SEENP=SEENP||SEEN;
  pullTeam();paintMe();if(API&&!INI)askIni(true);
  document.querySelectorAll('.tm').forEach(b=>b.hidden=!API);
}

const b64=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));
async function decrypt(enc,pw){
  const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(enc.s),iterations:enc.i,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(enc.v)},key,b64(enc.c));
  return JSON.parse(new TextDecoder().decode(pt));
}
const getEnc=()=>fetch('data.enc.json?'+Date.now()).then(r=>r.json());
const sha=async t=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))].map(x=>x.toString(16).padStart(2,'0')).join('');
let PW=null;
// The decrypted payload is cached for this tab only (sessionStorage), keyed by the build stamp in the clear (enc.b)
// plus a hash of the password: a refresh paints at once, and the 600k-round key derivation only runs when the build changed.
async function open(pw,enc){
  const h=await sha(pw+'|'+enc.b);let d=null;
  const c=ss.get('instinct_cache');if(c&&enc.b){try{const o=JSON.parse(c);if(o.h===h)d=o.d}catch(e){}}
  if(!d){d=await decrypt(enc,pw);if(enc.b)ss.set('instinct_cache',JSON.stringify({h,d}))}
  return d}
async function unlock(pw,enc){
  enc=enc||await getEnc();
  const d=await open(pw,enc);
  PW=pw;boot(d,enc);ls.set('instinct_pw',pw);
}
// brute-force brake: after 3 wrong tries the field waits 2, 4, 8 ... up to 60 seconds
let FAILS=+(ss.get('instinct_fails')||0),LOCK=+(ss.get('instinct_lock')||0);
function lockTick(){const left=Math.ceil((LOCK-Date.now())/1000),i=$('#pw');if(left>0){i.disabled=true;$('#err').textContent='try again in '+left+'s';setTimeout(lockTick,500)}else if(i.disabled){i.disabled=false;$('#err').textContent='';i.focus()}}
$('#gate').addEventListener('submit',async e=>{
  e.preventDefault();if(Date.now()<LOCK)return;
  $('#gate').classList.add('busy');$('#err').textContent='decrypting…';
  try{await unlock($('#pw').value);FAILS=0;ss.set('instinct_fails','0')}
  catch(x){FAILS++;ss.set('instinct_fails',String(FAILS));$('#err').textContent='wrong password';$('#pw').select();
    if(FAILS>=3){LOCK=Date.now()+Math.min(60,Math.pow(2,FAILS-2))*1000;ss.set('instinct_lock',String(LOCK));lockTick()}}
  $('#gate').classList.remove('busy');
});
const SKEL='<div class="skel"></div>'.repeat(10);
(async()=>{
  if(ls.get('instinct_dens'))document.body.classList.add('compact');
  load();lockTick();
  const pw=ls.get('instinct_pw');
  if(pw){
    $('#gate').hidden=true;$('#rows').innerHTML=SKEL;$('#upd').textContent='decrypting…';
    let enc=null;try{enc=await getEnc()}catch(e){$('#upd').textContent='offline - could not load the data';return}
    try{await unlock(pw,enc)}catch(e){ls.del('instinct_pw');$('#gate').hidden=false;$('#rows').innerHTML='';$('#upd').textContent=''}
  }
  if(!PW)$('#pw').focus();
})();
setInterval(pullTeam,45e3);
// every 15 minutes: look for a newer build. Only the stamp is compared, so nothing is decrypted unless it changed.
setInterval(async()=>{if(!PW)return;try{const enc=await getEnc();if(enc.b&&enc.b===window.__b)return;boot(await open(PW,enc),enc)}catch(e){}},9e5);
