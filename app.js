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
const tm=k=>TEAM[k]||(TEAM[k]={flag:null,notes:[],sign:null,watch:null,pass:null,rmatch:null,rno:false,recs:[],prs:[]});
const PASS='[pass] ';
const isFlag=s=>!!s.flag||(API?!!(TEAM[akey(s)]&&TEAM[akey(s)].flag):LF.has(akey(s)));
const mine=s=>{const o=TEAM[akey(s)];return !!(o&&o.flag&&INI&&o.flag.i.toLowerCase()===INI.toLowerCase())};
function foldLog(log){const T={};const g=k=>T[k]||(T[k]={flag:null,notes:[],sign:null,watch:null,pass:null,rmatch:null,rno:false,recs:[],prs:[]});
  log.forEach(e=>{const o=g(e.a);
    switch(e.y){
      case 'flag':o.flag={i:e.i,t:e.t};break;
      case 'unflag':o.flag=null;break;
      case 'note':if(String(e.x||'').startsWith(PASS))o.pass={id:e.id,t:e.t,i:e.i,x:String(e.x).slice(PASS.length).replace(/^-$/,'')};else o.notes.push({id:e.id,t:e.t,i:e.i,x:e.x});break;
      case 'edit':{const p=String(e.x||'').split('|'),id=p.shift(),t=p.join('|');for(const q of Object.values(T))for(const n of q.notes)if(n.id===id){n.x=t;n.ed=e.t;n.ei=e.i}break}
      case 'ig':{const [u,c]=String(e.x||'').split('|');o.ig={u,c:c?+c:null,i:e.i,t:e.t};break}
      case 'sign':{const p=String(e.x||'').split('|'),v=p.shift();
        if(v==='match'){o.rmatch={slug:p[0],name:p.slice(1).join('|'),i:e.i,t:e.t};o.rno=false}
        else if(v==='nomatch'){o.rno=true;o.rmatch=null}
        else o.sign=v==='reset'?null:{v,ag:p.join('|'),i:e.i,t:e.t};break}
      case 'watch':o.watch={id:String(e.x||'').split('|')[0],name:e.n,i:e.i,t:e.t};break;
      case 'unwatch':o.watch=null;break;
      case 'rec':{const x=String(e.x||''),a=x.indexOf('|'),z=x.lastIndexOf('|');if(a>=0&&z>a)o.recs.push({id:e.id,url:x.slice(0,a),song:x.slice(a+1,z),date:x.slice(z+1),name:e.n,i:e.i,t:e.t});break}
      case 'unrec':for(const q of Object.values(T))q.recs=q.recs.filter(r=>r.id!==e.x);break;
      case 'press':{let p=null;try{p=JSON.parse(e.x)}catch(x){}if(p&&Array.isArray(p.u)&&p.u.length)o.prs.push({id:e.id,d:p.d,l:p.l==null?null:+p.l,s:p.s||'',t:p.t||'',u:p.u,name:e.n,i:e.i,at:e.t});break}
      case 'unpress':for(const q of Object.values(T))q.prs=q.prs.filter(r=>r.id!==e.x);break;
      case 'del':for(const q of Object.values(T)){q.notes=q.notes.filter(n=>n.id!==e.x);if(q.pass&&q.pass.id===e.x)q.pass=null}break;
    }});
  Object.values(T).forEach(o=>o.notes.sort((a,b)=>String(b.t).localeCompare(String(a.t))));return T}
function foldViews(log){const m=new Map();log.forEach(e=>{if(e.y==='view')m.set(e.id,{id:e.id,name:e.n,state:e.x,i:e.i,t:e.t});else if(e.y==='delview')m.delete(e.x)});return [...m.values()].reverse()}
function toast(msg,act){const t=$('#toast');t.textContent=msg;if(act){const b=document.createElement('button');b.className='tb';b.textContent=act[0];b.onclick=()=>{act[1]();t.hidden=true};t.append(' ',b)}t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,act?9000:4500)}
async function pullTeam(){if(!API)return;try{const r=await fetch(API.url+'?k='+encodeURIComponent(API.key));const j=await r.json();if(j.log){LOG=j.log;TEAM=foldLog(j.log);VIEWS=foldViews(j.log);syncWatch();render();if(HO)redrawPanel();paintFeedBadge()}}catch(e){}}
async function postTeam(o){if(!API)return false;try{const r=await fetch(API.url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({k:API.key,...o})});const j=await r.json();if(j.ok)return true;toast(j.error==='slow down'?'slow down - too many saves a minute':'could not save ('+(j.error||'error')+')');return false}catch(e){toast('could not save - offline?');return false}}
const nameOf=k=>(ALL.find(s=>akey(s)===k)||{}).artist||k;

// ---- series
const gr=(s,k='hist')=>{const c='_g'+k;if(s[c]!==undefined)return s[c];const h=s[k];if(!h||h.length<2)return s[c]=null;const f=h[0][1],l=h[h.length-1][1];return s[c]={f,l,abs:l-f,pct:f?(l-f)/f:null,d0:h[0][0],d1:h[h.length-1][0]}};
const lastPt=(s,k='hist')=>{const h=s[k];return h&&h.length?h[h.length-1]:null};
const TAGN={SP:'SCAN',MP:'REC',WL:'WATCH',PR:'PRESS'};
const tagCls=s=>({MP:'mp',WL:'wl',PR:'pr'})[s.src]||'sp';
let TW=null,UPD='',PD={},FOOTD=null;
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
  const dots=h.map(p=>`<circle cx="${X(tms(p[0])).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="2.2" fill="currentColor"/><circle cx="${X(tms(p[0])).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="8" fill="transparent"><title>${esc(dstr(p[0]))}: ${p[1].toLocaleString()}</title></circle>`).join('');
  return `<div class="xc"><div class="hn">${label}</div><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} trend"><polyline points="${poly}" fill="none" stroke="currentColor" stroke-width="1.4"/>${dots}</svg><div class="hn">${esc(dstr(h[0][0]))} ${h[0][1].toLocaleString()} → ${esc(dstr(h[h.length-1][0]))} ${h[h.length-1][1].toLocaleString()}</div></div>`;
}
function growHtml(s,k='hist'){
  const g=gr(s,k);if(!g)return '';
  const up=g.abs>0,dn=g.abs<0,p=g.pct==null?'':Math.abs(Math.round(g.pct*100))+'%';
  return `<div class="GR" title="${esc(dstr(g.d0))}: ${g.f.toLocaleString()} → ${esc(dstr(g.d1))}: ${g.l.toLocaleString()} (${g.abs>=0?'+':''}${g.abs.toLocaleString()})">${spark(s[k])}<span class="gp ${up?'up':dn?'dn':''}">${up?'▲':dn?'▼':'–'}${p}</span></div>`;
}
const ageTag=h=>{const p=h&&h.length?h[h.length-1]:null;if(!p)return '';const d=daysAgo(p[0]);return d>=2?`<span class="age${d>10?' old':''}" title="last reading ${esc(dstr(p[0]))} - ${d} days before this build">${d}d</span>`:''};

let REP={},CAPS={},OPEN=new Set(),SPL=[],ALL=[],DAYS=[],HS={},HEALTH=null,
  S={view:'all',q:'',days:new Set(),pls:new Set(),pr:new Set(),sp:new Set(),bk:new Set(),ag:new Set(),sort:'date',dir:-1,sort2:'',dir2:-1,sel:-1,src:'',flag:false,hs:false,mine:false,grp:false,passed:false,lb:new Set(),board:false,all:false},VIEW=[],lastDay=null;
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

function blob(s){if(!s._b)s._b=(s.artist+' '+s.song+' '+(s.press||[]).map(p=>p.t).join(' ')+' '+(s.playlists||[]).map(p=>p.t).join(' ')+' '+(s.ag||'')+' '+(s.agt||'')+' '+igHandle(s.igUrl)+' '+(realLb(s)?s.lb[0]:'')).toLowerCase();
  const o=TEAM[akey(s)];return o?s._b+' '+o.notes.map(n=>n.i+' '+n.x).join(' ').toLowerCase()+(o.flag?' flagged '+o.flag.i.toLowerCase():'')+(o.ig?' '+igHandle(o.ig.u).toLowerCase():''):s._b}
// growth over the last 14 days of readings (or fewer if that is all there is), scaled to a per-week rate
function win(h){if(!h||h.length<2)return null;const l=h[h.length-1],t1=tms(l[0]);let f=h[0];for(const p of h){if(t1-tms(p[0])<=14*DAY){f=p;break}}
  const days=Math.max(1,Math.round((t1-tms(f[0]))/DAY));if(!f[1]||days<1||f===l)return null;const pct=(l[1]-f[1])/f[1];return {days,pct,per7:Math.max(-1,Math.min(3,pct*7/Math.max(days,3))),f:f[1],l:l[1]}}
// momentum 0-100: listener growth (40) + Instagram growth (20) + playlists (20) + press (10) + a jump flag (10)
function momentum(s){if(s._m!==undefined)return s._m;const a=win(s.hist),b=win(s.igh),c=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
  return s._m=Math.round(c((a?c(a.per7,-.5,1)*40:0)+(b?c(b.per7/.5,-.5,1)*20:0)+Math.min(plain(s).length,8)/8*20+Math.min((s.press||[]).length,4)/4*10+(s.jp?10:0),0,100))}
function status(s){const a=win(s.hist);if(s.jp&&a&&a.per7>0)return 'heating up';if(!a)return daysAgo(s.date)<=7?'new':'too early';
  return a.per7>=.25?'heating up':a.per7>=.08?'moving':a.per7<=-.08?'cooling':'holding'}
function why(s){const a=win(s.hist),b=win(s.igh),p=n=>(n>=0?'+':'')+Math.round(n*100)+'%',o=[];
  if(a)o.push('listeners '+p(a.pct)+' in '+a.days+'d');if(b)o.push('instagram '+p(b.pct));const n=plain(s).length;if(n)o.push('on '+n+' playlist'+(n>1?'s':''));if((s.press||[]).length)o.push((s.press||[]).length+' press');if(s.jp)o.push('jumped');
  return o.join(' · ')||'one reading so far'}
// ROSTR has a profile for them but lists no agency and no label (or self-released): nobody visibly represents them
const isOpen=s=>!!s.rp&&!agOf(s)&&(!!s.ln||(s.lb&&s.lb[1]==='S'));
const isPassed=s=>{const o=TEAM[akey(s)];return !!(o&&o.pass)};
const LBC={M:'major label',I:'indie label',D:'distributor / services',S:'self-released'};
// only what ROSTR lists: a self-released entry or no label at all is simply not shown
const realLb=s=>s.lb&&s.lb[1]!=='S'?s.lb:null;
const lbCat=s=>realLb(s)?LBC[s.lb[1]]:'';
let VIS='';
const isNew=s=>!!VIS&&s.src!=='WL'&&s.date>VIS;
// search operators: listeners:<20k  ig:>5k  agency:none|signed|name  label:major|indie|self|name  flagged:yes  press:>0  pl:>3  added:<7  growth:>20  new:yes  signed:yes  passed:yes
let PQ={q:null,v:null};
function opFn(k,op,v){
  const num=x=>{const n=parseCount(x);return n==null?null:n},cmp=(x,n)=>x==null||n==null?false:op==='<'?x<n:op==='>'?x>n:op==='='?x===n:x>=n;
  const igv=s=>{const p=lastPt(s,'igh');return p?p[1]:(s.ig??null)};
  const yes=/^(y|yes|true|1)$/.test(v);
  switch(k){
    case 'listeners':case 'l':{const n=num(v);return n==null?null:s=>cmp(cur(s),n)}
    case 'ig':case 'instagram':{if(v==='none')return s=>igv(s)==null;const n=num(v);return n==null?null:s=>cmp(igv(s),n)}
    case 'agency':case 'ag':{if(/^(none|no|unsigned)$/.test(v))return s=>!agOf(s);if(/^(signed|any|yes)$/.test(v))return s=>!!agOf(s);return s=>agOf(s).toLowerCase().includes(v)}
    case 'label':case 'lb':{if(v==='major')return s=>s.lb&&s.lb[1]==='M';if(v==='indie')return s=>s.lb&&s.lb[1]==='I';if(v==='dist')return s=>s.lb&&s.lb[1]==='D';if(v==='none')return s=>!!s.ln;if(v==='unknown')return s=>!s.lb&&!s.ln;return s=>s.lb&&s.lb[0].toLowerCase().includes(v)}
    case 'flagged':return s=>isFlag(s)===yes;
    case 'press':{const n=num(v);return n==null?null:s=>cmp((s.press||[]).length,n)}
    case 'pl':{const n=num(v);return n==null?null:s=>cmp((s.playlists||[]).length,n)}
    case 'added':{const n=num(v);return n==null?null:s=>cmp(daysAgo(s.date),n)}
    case 'growth':{const n=num(v);return n==null?null:s=>{const g=gr(s);return g&&g.pct!=null?cmp(g.pct*100,n):false}}
    case 'new':return s=>isNew(s)===yes;
    case 'signed':return s=>!!s.sn===yes;
    case 'open':return s=>isOpen(s)===yes;
    case 'momentum':case 'score':{const n=num(v);return n==null?null:s=>cmp(momentum(s),n)}
    case 'status':return s=>status(s).replace(' ','')===v.replace(/[ _-]/g,'')||status(s)===v;
    case 'passed':return s=>isPassed(s)===yes;
  }return null}
function pq(raw){if(PQ.q===raw)return PQ.v;const o=[];let sp=false;
  const t=String(raw||'').toLowerCase().replace(/\b(listeners|l|ig|instagram|agency|ag|label|lb|flagged|press|pl|added|growth|new|signed|passed|open|momentum|score|status):([<>=]?)("[^"]*"|\S+)/g,(m,k,op,v)=>{const f=opFn.call(null,k,op,v.replace(/"/g,''));if(!f)return m;if(k==='passed')sp=true;o.push(f);return ' '}).replace(/\s+/g,' ').trim();
  PQ={q:raw,v:{t,o,sp}};return PQ.v}
function match(s,skip){
  if(S.src&&s.src!==S.src)return false;
  if(S.flag&&!isFlag(s))return false;
  if(S.mine&&!mine(s))return false;
  if(S.hs&&agOf(s))return false;
  const Q=pq(S.q);
  if(!S.passed&&!Q.sp&&isPassed(s))return false;
  if(Q.t&&!blob(s).includes(Q.t))return false;
  if(Q.o.length&&!Q.o.every(f=>f(s)))return false;
  if(skip!=='view'){
    if(S.view==='week'){const c=new Date();c.setDate(c.getDate()-7);if(s.date<c.toISOString().slice(0,10))return false}
    if(S.view==='press'&&!(s.press||[]).length)return false;
    if(S.view==='new'&&!isNew(s))return false;
    if(S.view==='grow'&&!(gr(s)&&gr(s).pct>=0.1))return false;
    if(S.view==='igrow'&&!(gr(s,'igh')&&gr(s,'igh').pct>=0.1))return false;
  }
  if(skip!=='days'&&S.days.size&&!S.days.has(s.date))return false;
  if(skip!=='pls'&&S.pls.size&&!plain(s).some(p=>S.pls.has(p.t)))return false;
  if(skip!=='pr'&&S.pr.size&&!(s.press||[]).some(p=>S.pr.has(p.t)))return false;
  if(skip!=='sp'&&S.sp.size&&!sps(s).some(p=>S.sp.has(p.t)))return false;
  if(skip!=='ag'&&S.ag.size&&!S.ag.has(agOf(s)||'(none)'))return false;
  if(skip!=='lb'&&S.lb.size&&!S.lb.has(lbCat(s)))return false;
  if(skip!=='bk'&&S.bk.size&&![...S.bk].some(i=>cur(s)>=BK[i][0]&&cur(s)<BK[i][1]))return false;
  return true;
}
const cur=s=>{const p=lastPt(s);return p?p[1]:s.listeners};
const KEY={mom:s=>momentum(s),iggr:s=>{const g=gr(s,'igh');return g&&g.pct!=null?g.pct:-9},gr:s=>{const g=gr(s);return g&&g.pct!=null?g.pct:-9},date:s=>s.date,artist:s=>s.artist.toLowerCase(),song:s=>s.song.toLowerCase(),listeners:s=>cur(s)??-1,ig:s=>{const p=lastPt(s,'igh');return p?p[1]:(s.ig??-1)},press:s=>(s.press||[]).length,ag:s=>(agOf(s)||'~').toLowerCase(),pls:s=>(s.playlists||[]).length};
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
const opChip=s=>isOpen(s)?'<span class="op" title="ROSTR has a profile but lists no agency and no label">open</span>':'';
const lbHtml=s=>{const x=lbHtml0(s);return x?x.replace(/<\/div>$/,opChip(s)+'</div>'):isOpen(s)?'<div class="lbl">'+opChip(s)+'</div>':''};
const lbHtml0=s=>{const l=realLb(s);if(!l)return '';const k=l[1];
  return `<div class="lbl k${k}" title="${esc(LBC[k])} (from ROSTR)">${esc(l[0])}</div>`};
const rsCell=s=>{const h=rostrHtml(s)+snTag(s);return `<div class="RS${/^<(?:a|span) class="[^"]*\bdash\b/.test(h)?' e':''}">${h}</div>`};
const snTag=s=>s.sn?`<span class="sg" title="agency listed ${esc(dstr(s.sn[1]))}${isFlag(s)?' - after this artist was flagged':''}">new</span>`:'';
function rostrHtml(s){const a=agInfo(s);
  if(a.ag){return `<a href="${s.rs&&!a.man?'https://www.rostr.cc/artist/'+esc(s.rs):'#'}" target="_blank" rel="noopener" title="${a.man?'set by '+esc(a.by):'open on ROSTR'}">${esc(a.ag)}</a>${a.man?'<span class="hn">set by '+esc(a.by)+'</span>':s.agt?`<span class="hn">${esc(s.agt)}</span>`:''}`}
  if(a.man)return `<span class="hn">${a.wrong?'wrong rostr match':'unsigned'} · ${esc(a.by)}</span>`;
  if(s.rp)return `<a class="soft dash" href="https://www.rostr.cc/artist/${esc(s.rp)}" target="_blank" rel="noopener" title="profile on ROSTR, no agency listed">–</a>`;
  if(s.rn){const k=akey(s),o=TEAM[k]||{};
    if(o.rmatch)return `<a class="soft" href="https://www.rostr.cc/artist/${esc(o.rmatch.slug)}" target="_blank" rel="noopener">${esc(o.rmatch.name||o.rmatch.slug)} ↗</a><span class="hn">confirmed by ${esc(o.rmatch.i)} · agency on the next update</span>`;
    if(s.rc&&API&&!o.rno){const c=s.rc[0];return `<span class="hn">maybe</span> <a class="soft" href="https://www.rostr.cc/artist/${esc(c[1])}" target="_blank" rel="noopener" title="closest name on ROSTR">${esc(c[0])} ↗</a><span class="mc"><button class="rmb" data-act="rmatch" data-v="${esc(k)}" data-s="${esc(c[1])}" data-nm="${esc(c[0])}" title="yes, that is them" aria-label="confirm ROSTR match ${esc(c[0])}">✓</button><button class="rmb" data-act="rno" data-v="${esc(k)}" title="not them" aria-label="reject ROSTR match">✕</button></span>`}
    return '<span class="hn dash" title="no exact name match on ROSTR - check by hand">–</span>'}
  return ''}
function rowHtml(s,i){
  const g0=gr(s),now=cur(s),k=akey(s),fl=isFlag(s),t=TEAM[k]||{notes:[]};
  const w=now?Math.max(2,Math.min(100,now/1e3)):0;
  const pls=[...plain(s).map(p=>({...p,c:'pl'})),...sps(s).map(p=>({...p,c:'sp'}))];
  const star=s.src==='WL'?'':`<button class="fl${fl?' on':''}${s.flag?' lock':''}" data-act="flag" data-v="${esc(k)}" aria-pressed="${fl}" aria-label="${fl?'unflag':'flag'} ${esc(s.artist)}" title="${s.flag?'artist flagged in the sheet':fl?(API&&t.flag?'flagged by '+esc(t.flag.i)+' - click to unflag':'unflag artist'):'flag artist'}">${fl?'★':'☆'}</button>`;
  return `<div class="row${i===S.sel?' sel':''}${fl?' fg':''}${isPassed(s)?' ps':''}${isNew(s)?' nw':''}" data-i="${i}">
    <button class="d" data-act="day" data-v="${s.date}" title="filter to ${esc(dlong(s.date))}">${dstr(s.date)}</button>
    <div class="A"><div class="al"><span class="alw">${star}${s.track?`<a class="a" href="${esc(s.track)}" target="_blank" rel="noopener" title="open ${esc(s.song||s.artist)} on spotify">${esc(s.artist)}</a>`:`<span class="a">${esc(s.artist)}</span>`}<button class="tg ${tagCls(s)}${S.src===s.src?' on':''}" data-act="src" data-v="${s.src}" title="${s.src==='WL'?'WATCHLIST':TAGN[s.src]||'SCAN'} - click to show only these">${TAGN[s.src]||s.src}</button>${s.dp?`<span class="dpb" title="may be the same artist as ${esc(s.dp.join(', '))}">≈</span>`:''}${t.pass?`<span class="fby ps" title="passed by ${esc(t.pass.i)}${t.pass.x?': '+esc(t.pass.x):''}">passed</span>`:''}${t.flag&&!s.flag?`<span class="fby" title="flagged by ${esc(t.flag.i)}">${esc(t.flag.i)}</span>`:''}${s._n>1?`<button class="rp" data-act="artist" data-v="${esc(s.artist)}" title="${s._n} songs - click to list them">×${s._n}</button>`:''}${REP[k]>1&&!S.grp?`<button class="rp" data-act="hist" data-v="${esc(k)}" title="seen before - show history">↻ ${REP[k]}</button>`:''}</span><button class="xb" data-act="hist" data-v="${esc(k)}" aria-label="open details for ${esc(s.artist)}" title="open details: graphs, playlists, press, shows, notes"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button></div>${lbHtml(s)}${showsHtml(s)}${noteLine(s)}</div>
    <div class="s">${s.track&&s.src!=='WL'?`<a href="${esc(s.track)}" target="_blank" rel="noopener" title="open on spotify">${esc(s.song)}</a>`:esc(s.song)}${s._n>1?` <span class="hn">+${s._n-1} more</span>`:''}</div>
    <div class="L">${now!=null?`<div class="NG"><a class="num n1" style="--w:${w}%" ${s.track?`href="${esc(s.track)}" target="_blank" rel="noopener"`:''} title="${now.toLocaleString()} monthly listeners${s.src==='PR'?' as of '+esc(dstr(s.date)):''}${g0?' (latest) · '+g0.f.toLocaleString()+' on '+esc(dstr(g0.d0)):''}"><span>${fmt(now)}</span></a>${ageTag(s.hist)}${s.jp?`<span class="jp" title="listeners ${s.jp.f.toLocaleString()} → ${s.jp.t.toLocaleString()} (${esc(dstr(s.jp.d0))} → ${esc(dstr(s.jp.d1))})">▲ JUMP</span>`:''}${growHtml(s)}</div>`:'<span class="none">–</span>'}</div>
    <div class="G">${igHtml(s)}</div>
    <div class="P chips">${chipsHtml(s.press,'pr')}</div>
    ${rsCell(s)}
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
  if(S.board){renderBoard();return}
  RLAST=null;RN=Math.min(VIEW.length,Math.max(LIM,0));
  $('#rows').innerHTML=rowsHtml(0,RN)+(RN<VIEW.length?'<div id="more" class="empty"> </div>':'');
  $('#empty').hidden=VIEW.length>0;
  fitArtist();watchMore();
}
function fitArtist(){let m=0;document.querySelectorAll('#rows .alw').forEach(e=>{m=Math.max(m,e.offsetWidth+46)});
  document.documentElement.style.setProperty('--aw',innerWidth>900&&m?Math.min(520,Math.ceil(m+20))+'px':'110px')}
let IO=null;
function watchMore(){const m=$('#more');if(!m)return;if(!IO)IO=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))moreRows()},{rootMargin:'800px'});IO.disconnect();IO.observe(m)}
function moreRows(n){const m=$('#more');if(!m)return;const a=RN;LIM=RN=Math.min(VIEW.length,n||RN+120);m.insertAdjacentHTML('beforebegin',rowsHtml(a,RN));fitArtist();if(RN>=VIEW.length)m.remove();else watchMore()}
const FSETS=()=>({'f-pl':S.pls,'f-pr':S.pr,'f-sp':S.sp,'f-ag':S.ag,'f-lb':S.lb});
function facet(el,items,set,cls){
  el.innerHTML=items.map(([t,c,u])=>`<div class="f ${set.has(t)?'on ':''}${cls}"><button class="l" data-act="f" data-k="${el.id}" data-v="${esc(t)}" aria-pressed="${set.has(t)}">${esc(t==='(none)'?'no agency':t)}</button><span class="c">${c}</span>${u?`<a class="o" href="${esc(u)}" target="_blank" rel="noopener" title="open on spotify">↗</a>`:'<span class="o"></span>'}</div>`).join('');
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
  facet($('#f-lb'),counts('lb',s=>lbCat(s)?[{t:lbCat(s)}]:[]).sort(by),S.lb,'');
  const bc=BK.map(b=>ALL.filter(s=>match(s,'bk')&&cur(s)>=b[0]&&cur(s)<b[1]).length),mx=Math.max(1,...bc);
  $('#bk').innerHTML=bc.map((c,i)=>`<button data-act="bk" data-v="${i}" class="${S.bk.has(i)?'on':''}" style="height:${Math.max(2,Math.round(c/mx*44))}px" aria-label="${BK[i][2]} listeners: ${c} songs" aria-pressed="${S.bk.has(i)}" title="${c} songs"></button>`).join('');
  $('#bkl').innerHTML=BK.map(b=>`<span>${b[2]}</span>`).join('');
}
const TABS=[['all','all'],['week','last 7 days'],['press','has press'],['grow','monthly listeners 10%+'],['igrow','instagram 10%+']];
function renderTop(){
  document.body.classList.toggle('nosong',!S.flag);
  document.querySelectorAll('.pill[data-act]').forEach(b=>{const on=b.dataset.act==='flagged'?S.flag:b.dataset.act==='hs'?S.hs:false;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
  document.body.classList.toggle('board',S.board);
  const cv=S.view;
  const tl=TABS.map(([k,l])=>{S.view=k;return [k,l,ALL.filter(s=>match(s)).length]});
  S.view=cv;
  $('#tabs').innerHTML=`<button data-act="board" class="${S.board?'on':''}" aria-pressed="${S.board}">my list<span class="n">${myKeys().size}</span></button>`+tl.filter(([k,l,n])=>!((k==='igrow'&&n<20||k==='new'&&!n)&&cv!==k)).map(([k,l,n])=>`<button data-act="view" data-v="${k}" class="${cv===k?'on':''}" aria-pressed="${cv===k}">${l}<span class="n">${n}</span></button>`).join('');
  const act=[];
  if(S.src)act.push(['src',S.src,TAGN[S.src]||S.src]);if(S.flag)act.push(['flag','','flagged']);if(S.mine)act.push(['mine','','my flags']);if(S.hs)act.push(['hs','','hide signed']);if(S.q)act.push(['q','','"'+S.q+'"']);
  S.days.forEach(v=>act.push(['days',v,dstr(v)]));S.pls.forEach(v=>act.push(['pls',v,v]));S.pr.forEach(v=>act.push(['pr',v,v]));S.sp.forEach(v=>act.push(['sp',v,v]));S.ag.forEach(v=>act.push(['ag',v,'agency: '+(v==='(none)'?'none':v)]));S.bk.forEach(v=>act.push(['bk',v,BK[v][2]+' listeners']));S.lb.forEach(v=>act.push(['lb',v,'release: '+v]));if(S.passed)act.push(['passed','','showing passed']);
  $('#active').innerHTML=act.map(([k,v,l])=>`<button data-act="rm" data-k="${k}" data-v="${esc(v)}" aria-label="remove filter ${esc(l)}">${esc(l)}</button>`).join('')+(act.length?'<button class="clr" data-act="clear">clear all</button>':'');
  if(S.board)$('#cnt').textContent=boardRows().length+' on the board';else $('#cnt').textContent=S.grp?VIEW.length+' artists':VIEW.length+' of '+ALL.length+' songs';
  document.querySelectorAll('#head button').forEach(b=>{const d=b.dataset.sort;b.classList.toggle('s',d===S.sort);b.classList.toggle('asc',d===S.sort&&S.dir===1);b.classList.toggle('s2',d===S.sort2);b.classList.toggle('asc2',d===S.sort2&&S.dir2===1);b.setAttribute('aria-label','sort by '+b.textContent+(d===S.sort?(S.dir===1?', ascending':', descending'):''))});
  document.body.classList.toggle('bydate',S.sort==='date');
}
function render(){compute();renderTop();renderSide();renderRows();paintAlerts();save()}
const stateObj=()=>({v:S.view,q:S.q,d:[...S.days],p:[...S.pls],r:[...S.pr],s:[...S.sp],b:[...S.bk],a:[...S.ag],o:S.sort,i:S.dir,o2:S.sort2,i2:S.dir2,x:S.src,f:S.flag,h:S.hs,m:S.mine,g:S.grp,l:[...S.lb],ps:S.passed,bd:S.board,ba:S.all});
function save(){try{history.replaceState(null,'','#'+encodeURIComponent(JSON.stringify(stateObj())))}catch(e){}}
function applyState(o){S.view=TABS.some(t=>t[0]===o.v)?o.v:'all';S.q=o.q||'';S.days=new Set(o.d);S.pls=new Set(o.p);S.pr=new Set(o.r);S.sp=new Set(o.s);S.bk=new Set(o.b);S.ag=new Set(o.a);S.sort=KEY[o.o]?o.o:'date';S.dir=o.i||-1;S.sort2=KEY[o.o2]?o.o2:'';S.dir2=o.i2||-1;S.src=o.x||'';S.flag=!!o.f;S.hs=!!o.h;S.mine=!!o.m;S.grp=!!o.g;S.lb=new Set(o.l||[]);S.passed=!!o.ps;S.board=!!o.bd;S.all=!!o.ba;$('#q').value=S.q;LIM=120}
function load(){try{applyState(JSON.parse(decodeURIComponent(location.hash.slice(1))))}catch(e){}}
const clearAll=()=>{S.src='';S.flag=false;S.hs=false;S.mine=false;S.days.clear();S.pls.clear();S.pr.clear();S.sp.clear();S.bk.clear();S.ag.clear();S.lb.clear();S.passed=false;S.q='';S.view='all';$('#q').value='';LIM=120};
let HO=false,PO=null,PM='artist',OPENER=null,SEEN=ls.get('instinct_seen')||'',SEENP='';
const ago=iso=>{const d=new Date(iso);return isNaN(d)?'':d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})};

// ---- panels (artist / activity / digest / watch / help share the #hist modal)
function passHtml(k,o){if(!API)return '';
  if(o.pass)return `<div class="hn pass">passed by <b>${esc(o.pass.i)}</b> ${esc(ago(o.pass.t))}${o.pass.x?' - '+esc(o.pass.x):''} <button class="nx" data-act="unpass" data-v="${esc(k)}">undo</button></div>`;
  return `<form class="pf" data-v="${esc(k)}"><input class="pfi" name="x" maxlength="120" placeholder="pass - reason (optional)" autocomplete="off" aria-label="reason for passing"><button type="submit">pass</button></form>`}
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
    <h3>${esc(rep.artist)}</h3><div class="hn mline"><span class="st ${STC[status(rep)]}">${esc(status(rep))}</span> momentum <b>${momentum(rep)}</b> · ${esc(why(rep))}</div>${agLine}${realLb(rep)?`<div class="hn">label: ${esc(rep.lb[0])} <span>(rostr)</span></div>`:rep.ln?'<div class="hn">label: none listed on rostr</div>':''}${rep.dp?`<div class="hn">may be the same artist as ${rep.dp.map(n=>`<a href="#" data-act="hist" data-v="${esc(n.split(/,| & | feat\.? | x /i)[0].trim().toLowerCase())}">${esc(n)}</a>`).join(', ')}</div>`:''}<div class="pcharts">${sparkBig(rep.hist,'monthly listeners')}${sparkBig(rep.igh,'instagram followers')}</div><div class="hf">${flagBtn}</div>${passHtml(k,o)}${notes}${detail}${igSec}${signForm?`<details class="fix"><summary>fix rostr data</summary>${signForm}</details>`:''}${hist}
    ${l.length>1?l.map((s,i)=>`<div class="hr"><div class="hd">${esc(dstr(s.date))}<span class="tg ${tagCls(s)}">${TAGN[s.src]||s.src}</span></div>
      <div class="hm">${s.track?`<a href="${esc(s.track)}" target="_blank" rel="noopener">${esc(s.song)} ↗</a>`:esc(s.song)}<span class="hn">${s.listeners!=null?fmt(s.listeners)+' listeners when added':''}${s.ig?' · '+fmt(s.ig)+' instagram':''}</span>
      ${i?`<div class="chips">${chipsHtml(s.press,'pr')}${chipsHtml([...plain(s).map(p=>({...p,c:'pl'})),...sps(s).map(p=>({...p,c:'sp'}))])}</div>`:''}</div></div>`).join(''):''}</div>`;
}
// activity feed: everything the team did, newest first, with a divider at the last visit
function evText(e){const n=esc(e.n||e.a),who=`<b>${esc(e.i)}</b>`;
  switch(e.y){case 'flag':return `${who} flagged ${n}`;case 'unflag':return `${who} unflagged ${n}`;
    case 'note':return String(e.x||'').startsWith(PASS)?`${who} passed on ${n}${String(e.x).slice(PASS.length).replace(/^-$/,'')?': '+esc(String(e.x).slice(PASS.length)):''}`:`${who} noted on ${n}: ${mention(e.x)}`;case 'edit':return `${who} edited a note on ${n}`;case 'del':return `${who} removed a note or pass on ${n}`;
    case 'ig':return `${who} set Instagram for ${n}`;case 'sign':{const v=String(e.x||'').split('|');if(v[0]==='match')return `${who} confirmed a ROSTR match for ${n}`;if(v[0]==='nomatch')return `${who} rejected the ROSTR match for ${n}`;return `${who} marked ${n} ${v[0]==='signed'?'signed'+(v[1]?' ('+esc(v[1])+')':''):v[0]==='unsigned'?'unsigned':v[0]==='wrong'?'a wrong rostr match':'back to rostr data'}`}
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
  const open=uniq(nw.filter(s=>!agOf(s)&&!isFlag(s)&&!isPassed(s)&&!(s.lb&&s.lb[1]==='M')&&(cur(s)||0)<50000).sort((a,b)=>(cur(b)||0)-(cur(a)||0))).slice(0,10);seen.clear();
  const mov=uniq(ALL.filter(s=>isFlag(s)&&gr(s)&&gr(s).pct!=null).sort((a,b)=>gr(b).pct-gr(a).pct)).slice(0,6);
  const ev=LOG.filter(e=>String(e.t).slice(0,10)>=since);seen.clear();
  const sg=uniq(ALL.filter(s=>s.sn&&isFlag(s)&&s.src!=='WL'));
  return {sg,since,nw:nw.length,nwA:new Set(nw.map(akey)).size,jumps,open,mov,flags:ev.filter(e=>e.y==='flag').length,notes:ev.filter(e=>e.y==='note').length}}
function digestText(){const d=digestData(),L=['A&R INSTINCT - week since '+dstr(d.since),'',d.nw+' new songs from '+d.nwA+' artists'];
  if(d.jumps.length){L.push('','JUMPED');d.jumps.forEach(s=>L.push('- '+s.artist+': '+s.jp.f.toLocaleString()+' → '+s.jp.t.toLocaleString()+' monthly listeners'))}
  if(d.open.length){L.push('','NEW AND UNSIGNED, UNDER 50K');d.open.forEach(s=>L.push('- '+s.artist+' ('+fmt(cur(s))+')'+(s.track?' '+s.track:'')))}
  if(d.sg.length){L.push('','FLAGGED ARTISTS THAT GOT AN AGENCY');d.sg.forEach(s=>L.push('- '+s.artist+' → '+s.sn[0]+' ('+dstr(s.sn[1])+')'))}
  if(d.mov.length){L.push('','FLAGGED ARTISTS MOVING');d.mov.forEach(s=>{const g=gr(s);L.push('- '+s.artist+': '+(g.abs>=0?'+':'')+Math.round(g.pct*100)+'% ('+fmt(g.f)+' → '+fmt(g.l)+')')})}
  L.push('','team: '+d.flags+' flags, '+d.notes+' notes this week');return L.join('\n')}
function digestHtml(){const d=digestData(),li=(s,x)=>`<li><a href="#" data-act="hist" data-v="${esc(akey(s))}">${esc(s.artist)}</a> <span class="hn">${x}</span></li>`;
  return `<div class="hc" role="dialog" aria-modal="true" aria-label="digest"><button class="hx" data-act="histx" aria-label="close">✕</button><h3>this week</h3><p class="hs">since ${esc(dlong(d.since))}</p>
   <p><b>${d.nw}</b> new songs · <b>${d.nwA}</b> artists</p>
   ${d.sg.length?`<div class="ns"><div class="hn">flagged, now with an agency</div><ul>${d.sg.map(s=>li(s,esc(s.sn[0])+' · '+esc(dstr(s.sn[1])))).join('')}</ul></div>`:''}
   ${d.jumps.length?`<div class="ns"><div class="hn">jumped</div><ul>${d.jumps.map(s=>li(s,s.jp.f.toLocaleString()+' → '+s.jp.t.toLocaleString())).join('')}</ul></div>`:''}
   ${d.open.length?`<div class="ns"><div class="hn">new, unsigned, under 50k</div><ul>${d.open.map(s=>li(s,fmt(cur(s))+(realLb(s)?' · '+esc(s.lb[0]):''))).join('')}</ul></div>`:''}
   ${d.mov.length?`<div class="ns"><div class="hn">flagged artists moving</div><ul>${d.mov.map(s=>{const g=gr(s);return li(s,(g.abs>=0?'+':'')+Math.round(g.pct*100)+'%')}).join('')}</ul></div>`:''}
   <p class="hn" style="margin-top:12px">team: ${d.flags} flags · ${d.notes} notes</p>
   <div class="nf"><button data-act="copydigest">copy as text</button></div></div>`}
function watchHtml(){const w=Object.entries(TEAM).filter(([k,o])=>o.watch);
  return `<div class="hc" role="dialog" aria-modal="true" aria-label="watchlist"><button class="hx" data-act="histx" aria-label="close">✕</button><h3>watch an artist</h3><p class="hs">track an artist that is not on the sheet. Paste their Spotify artist link and the name fills in; with no link, type the name. Instagram is optional - Spotify's public pages do not carry it, so it fills in on a daily update if the artist lists one there.</p>
   <form class="wf"><input name="u" placeholder="spotify artist link" autocomplete="off" aria-label="spotify artist link (optional)"><input name="n" placeholder="artist name" maxlength="60" autocomplete="off" aria-label="artist name (optional when you paste a link)"><input name="ig" placeholder="instagram @handle (optional)" maxlength="80" autocomplete="off" aria-label="instagram handle (optional)"><button type="submit">watch</button></form>
   <div class="ns">${w.map(([k,o])=>`<div class="nr"><b>${esc(o.watch.name)}</b> <span class="hn">added by ${esc(o.watch.i)}</span> <button class="nx" data-act="unwatch" data-v="${esc(k)}" aria-label="stop watching">✕</button></div>`).join('')||'<div class="hn">nothing watched yet</div>'}</div></div>`}
function helpHtml(){const K=[['j / k','next / previous row'],['f','flag or unflag the selected artist'],['n','open notes for the selected artist'],['p','pass on the selected artist: hides it for everyone, with an undo'],['shift-P','pass with a reason'],['x','open the details window for the selected row'],['o or Enter','open the song on Spotify'],['/','search'],['m','show or hide my list'],['shift-click a column','add a second sort'],['Esc','clear filters / close'],['?','this help']];
  return `<div class="hc" role="dialog" aria-modal="true" aria-label="keyboard shortcuts"><button class="hx" data-act="histx" aria-label="close">✕</button><h3>keyboard</h3><div class="ns">${K.map(([a,b])=>`<div class="nr"><kbd>${a}</kbd> ${b}</div>`).join('')}</div><h3 style="margin-top:18px">search tips</h3><div class="ns"><div class="nr">type any of these in the search box, mixed with plain words:</div><div class="nr"><kbd>listeners:&lt;20k</kbd> <kbd>ig:&gt;5k</kbd> <kbd>ig:none</kbd> <kbd>growth:&gt;20</kbd> <kbd>added:&lt;7</kbd></div><div class="nr"><kbd>agency:none</kbd> <kbd>agency:signed</kbd> <kbd>agency:caa</kbd> <kbd>signed:yes</kbd></div><div class="nr"><kbd>label:self</kbd> <kbd>label:indie</kbd> <kbd>label:major</kbd> <kbd>label:none</kbd> <kbd>label:sub pop</kbd></div><div class="nr"><kbd>momentum:&gt;70</kbd> <kbd>status:heating</kbd> <kbd>open:yes</kbd> <kbd>flagged:yes</kbd> <kbd>new:yes</kbd> <kbd>press:&gt;0</kbd> <kbd>pl:&gt;3</kbd> <kbd>passed:yes</kbd></div></div></div>`}
const paintHtml=()=>PM==='cmp'?cmpHtml():PM==='score'?scoreHtml():PM==='feed'?feedHtml():PM==='digest'?digestHtml():PM==='watch'?watchHtml():PM==='help'?helpHtml():panelHtml(PO);
function paintPanel(){const a=document.activeElement,c=a&&a.closest&&a.closest('#hist')&&a.classList.length?'.'+a.classList[0]:'';$('#hist').innerHTML=paintHtml();if(c){const n=document.querySelector('#hist '+c);n&&n.focus()}}
function redrawPanel(){const f=document.querySelector('#hist .nx2,#hist .wf input,#hist .sgf input,#hist .ef input');if(f&&f.value)return;if(document.querySelector('#hist .nr.editing'))return;paintPanel()}
function openPanel(mode,k){OPENER=document.activeElement;PM=mode;PO=k||null;$('#hist').innerHTML=paintHtml();$('#hist').hidden=false;HO=true;const x=document.querySelector('#hist .hx');x&&x.focus()}
const openHist=k=>openPanel('artist',k);
const closeHist=()=>{$('#hist').hidden=true;HO=false;PO=null;PM='artist';if(OPENER&&OPENER.focus&&document.contains(OPENER))OPENER.focus();OPENER=null};
async function teamAct(o){ // optimistic: apply to local state, post, then re-pull the truth
  const e=tm(o.a),now=new Date().toISOString();
  if(o.type==='flag')e.flag={i:o.i,t:now};else if(o.type==='unflag')e.flag=null;
  else if(o.type==='note'){if(String(o.x).startsWith(PASS))e.pass={id:'tmp'+Date.now(),t:now,i:o.i,x:String(o.x).slice(PASS.length).replace(/^-$/,'')};else e.notes.unshift({id:'tmp'+Date.now(),t:now,i:o.i,x:o.x})}
  else if(o.type==='del'){e.notes=e.notes.filter(n=>n.id!==o.x);if(e.pass&&e.pass.id===o.x)e.pass=null}
  else if(o.type==='edit'){const p=o.x.split('|'),id=p.shift();e.notes.forEach(n=>{if(n.id===id){n.x=p.join('|');n.ed=now;n.ei=o.i}})}
  else if(o.type==='ig'){const [u,c]=o.x.split('|');e.ig={u,c:c?+c:null,i:o.i,t:now}}
  else if(o.type==='sign'){const p=o.x.split('|'),v=p.shift();if(v==='match'){e.rmatch={slug:p[0],name:p.slice(1).join('|'),i:o.i,t:now};e.rno=false}else if(v==='nomatch'){e.rno=true;e.rmatch=null}else e.sign=v==='reset'?null:{v,ag:p.join('|'),i:o.i,t:now}}
  else if(o.type==='watch'){e.watch={id:o.x.split('|')[0],name:o.n,i:o.i,t:now};syncWatch()}
  else if(o.type==='unwatch'){e.watch=null;syncWatch()}
  else if(o.type==='rec'){const x=String(o.x),a=x.indexOf('|'),z=x.lastIndexOf('|');e.recs.push({id:'tmp'+Date.now(),url:x.slice(0,a),song:x.slice(a+1,z),date:x.slice(z+1),name:o.n,i:o.i,t:now});syncWatch()}
  else if(o.type==='press'){let p=null;try{p=JSON.parse(o.x)}catch(x){}if(p&&Array.isArray(p.u)){e.prs.push({id:'tmp'+Date.now(),d:p.d,l:p.l==null?null:+p.l,s:p.s||'',t:p.t||'',u:p.u,name:o.n,i:o.i,at:now});syncWatch()}}
  else if(o.type==='unpress'){Object.values(TEAM).forEach(q=>q.prs=(q.prs||[]).filter(r=>r.id!==o.x));syncWatch()}
  else if(o.type==='unrec'){Object.values(TEAM).forEach(q=>q.recs=(q.recs||[]).filter(r=>r.id!==o.x));syncWatch()}
  render();if(HO)paintPanel();
  await postTeam(o);await pullTeam();
}
// artists a teammate asked to watch: show a row right away; the daily build replaces it with a tracked one
// Recs added from the intake page become MP ("REC") rows with no counts until the daily build carries them. A rec the
// base data already has (same track, or same artist and song) is skipped, so promotion never doubles a row.
const trkId=u=>{const m=/track\/([A-Za-z0-9]{22})/.exec(u||'');return m?m[1]:''};
const songKey=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function syncWatch(){ALL=ALL.filter(s=>!s._opt);const have=new Set(ALL.map(akey));
  const bt=new Set(ALL.map(s=>trkId(s.track)).filter(Boolean)),bs=new Set(ALL.filter(s=>s.song).map(s=>akey(s)+'|'+songKey(s.song)));
  const recKeys=new Set();
  Object.entries(TEAM).forEach(([k,o])=>(o.recs||[]).forEach(r=>{const id=trkId(r.url),sk=k+'|'+songKey(r.song);
    if((id&&bt.has(id))||bs.has(sk))return;if(id)bt.add(id);bs.add(sk);recKeys.add(k);
    ALL.push({src:'MP',date:r.date,artist:r.name||k,song:r.song,track:r.url||'',_opt:true,_rec:r.id,_rby:r.i})}));
  // press finds from the intake page: their own PRESS rows, with the article links and the listener count as of the find
  const bpu={};ALL.forEach(x=>(x.press||[]).forEach(p=>{if(p.u)(bpu[akey(x)]||(bpu[akey(x)]=new Set())).add(p.u)}));
  const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch(e){return u}};
  Object.entries(TEAM).forEach(([k,o])=>(o.prs||[]).forEach(r=>{const b=bpu[k];if(b&&r.u.every(u=>b.has(u)))return;recKeys.add(k);
    ALL.push({src:'PR',date:r.d,artist:r.name||k,song:r.s,track:r.t,hist:r.l!=null?[[r.d,r.l]]:undefined,press:r.u.map(u=>({t:hostOf(u),u,d:PD[u]||''})),_opt:true,_pr:r.id,_rby:r.i})}));
  Object.entries(TEAM).forEach(([k,o])=>{if(o.watch&&!have.has(k)&&!recKeys.has(k))ALL.push({src:'WL',date:UPD||new Date().toISOString().slice(0,10),artist:o.watch.name||k,song:'',track:o.watch.id?'https://open.spotify.com/artist/'+o.watch.id:'',wid:o.watch.id||undefined,_opt:true})});
  DAYS=[...new Set(ALL.map(s=>s.date))].sort();if(FOOTD)paintFoot(FOOTD)}
// the "hide playlists" pill: drops the playlists column (the grid is re-templated in styles.css)
function paintNopl(){const b=document.querySelector('[data-act=nopl]');if(!b)return;const on=document.body.classList.contains('nopl');b.textContent=on?'show playlists':'hide playlists';b.setAttribute('aria-pressed',on)}
const paintMe=()=>{const b=$('#me');if(b)b.textContent=INI?'you: '+INI+' ▾':'set your name'};
function askIni(first){const w=$('#who');$('#whoi').value=INI;$('#whox').hidden=!!first&&!INI;w.hidden=false;setTimeout(()=>$('#whoi').focus(),30)}
$('#whof').addEventListener('submit',e=>{e.preventDefault();const v=$('#whoi').value.trim().slice(0,24);if(!v){$('#whoi').focus();return}INI=v;ls.set('instinct_ini',v);$('#who').hidden=true;paintMe();render()});
$('#whox').addEventListener('click',()=>{$('#who').hidden=true});
function needIni(k){if(INI)return false;if(!k){askIni(false);return true}openHist(k);const i=document.querySelector('#hist .ni');i&&i.focus();return true}
const toggle=(set,v)=>set.has(v)?set.delete(v):set.add(v);
const copy=async t=>{try{await navigator.clipboard.writeText(t);return true}catch(e){const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}a.remove();return ok}};

// flagged artists that picked up an agency since the last build: a banner above the list, dismissable
function paintAlerts(){const el=$('#alerts');if(!el)return;let dis=[];try{dis=JSON.parse(ls.get('instinct_alerts')||'[]')}catch(e){}
  const seen=new Set(),l=[];
  ALL.forEach(s=>{if(!s.sn||s.src==='WL'||!isFlag(s))return;const k=akey(s);if(seen.has(k))return;seen.add(k);const id=k+'|'+s.sn[1];if(dis.includes(id)||daysAgo(s.sn[1])>14)return;l.push({k,id,s})});
  if(!l.length){el.hidden=true;el.textContent='';return}
  el.innerHTML='<b>signed since flagged</b> '+l.map(({k,s})=>`<a href="#" data-act="hist" data-v="${esc(k)}">${esc(s.artist)}</a> → ${esc(s.sn[0])} <span class="hn">${esc(dstr(s.sn[1]))}</span>`).join(' · ')+' <button class="act" data-act="alertx" data-v="'+esc(l.map(x=>x.id).join('\n'))+'">dismiss</button>';el.hidden=false}
// scorecard: every flagged artist, what they were when flagged against now
function scoreData(){
  const by=new Map();ALL.forEach(s=>{if(s.src==='WL'||!isFlag(s))return;const k=akey(s),e=by.get(k);if(!e)by.set(k,{k,rows:[s]});else e.rows.push(s)});
  const at=(h,d)=>{if(!h||!h.length)return null;let p=h[0];for(const q of h){if(q[0]<=d)p=q;else break}return p};
  const L=[];by.forEach(({k,rows})=>{
    const o=TEAM[k]||{},first=rows.map(r=>r.date).sort()[0],fd=o.flag?String(o.flag.t).slice(0,10):first,who=o.flag?o.flag.i:'sheet';
    const rp=rows.slice().sort((a,b)=>((b.hist||[]).length-(a.hist||[]).length))[0],ri=rows.slice().sort((a,b)=>((b.igh||[]).length-(a.igh||[]).length))[0];
    const h0=at(rp.hist,fd),h1=lastPt(rp),i0=at(ri.igh,fd),i1=lastPt(ri,'igh'),age=daysAgo(fd);
    const ok=rp.hist&&rp.hist.length>=2&&h0&&h1&&h0[1]>0;
    const pct=ok?(h1[1]-h0[1])/h0[1]:null,sn=rows.find(r=>r.sn&&r.sn[1]>=fd);
    L.push({k,name:rows[0].artist,who,fd,age,h0,h1,i0,i1,pct,ag:agOf(rows.find(r=>agOf(r))||rows[0]),signedAfter:!!sn})});
  const m=L.filter(x=>x.pct!=null&&x.age>=7);
  return {L:L.sort((a,b)=>(b.pct??-9)-(a.pct??-9)||b.age-a.age),n:m.length,all:L.length,up50:m.filter(x=>x.pct>=.5).length,up100:m.filter(x=>x.pct>=1).length,down:m.filter(x=>x.pct<0).length,signed:L.filter(x=>x.signedAfter).length,
    med:m.length?m.map(x=>x.pct).sort((a,b)=>a-b)[Math.floor(m.length/2)]:null}}
function scoreHtml(){const d=scoreData(),p=x=>x==null?'':(x>=0?'+':'')+Math.round(x*100)+'%';
  return `<div class="hc" role="dialog" aria-modal="true" aria-label="scorecard"><button class="hx" data-act="histx" aria-label="close">✕</button><h3>scorecard</h3>
   <p class="hs">${d.all} flagged artists · ${d.n} flagged at least a week ago with readings</p>
   ${d.n?`<p><b>${d.up50}</b> grew 50%+ · <b>${d.up100}</b> doubled · <b>${d.down}</b> fell · median ${p(d.med)} · <b>${d.signed}</b> got an agency after being flagged</p>`:'<p class="hn">no flagged artist is a week old yet - this fills in as readings accumulate</p>'}
   <div class="sc">${d.L.slice(0,80).map(x=>`<div class="scr"><a href="#" data-act="hist" data-v="${esc(x.k)}">${esc(x.name)}</a><span class="hn">${esc(x.who)} · ${esc(dstr(x.fd))} · ${x.age}d</span><span>${x.h0&&x.h1?fmt(x.h0[1])+' → '+fmt(x.h1[1]):''} <b class="${x.pct>0?'up':x.pct<0?'dn':''}">${p(x.pct)}</b></span><span class="hn">${x.i0&&x.i1?'IG '+fmt(x.i0[1])+' → '+fmt(x.i1[1]):''}</span><span class="hn">${esc(x.ag||'')}${x.signedAfter?' (after flag)':''}</span></div>`).join('')}</div>
   <p class="hn" style="margin-top:12px">readings start when an artist enters the sheet, and sheet flags count from the first day the artist appears. Artists flagged under a week ago are listed but not counted in the summary.</p></div>`}

// ---- my list: a board of the artists you follow (your flags and the artists you added), with status, momentum and 7-14 day changes
const CMP=new Set(),CCOL=['#000','#8a63d2','#2f6fd0','#c0392b','#1f9d55','#e08a3c','#777'];
function myKeys(){const ks=new Set(),me=(INI||'').toLowerCase();
  if(!API){LF.forEach(k=>ks.add(k));return ks}
  Object.entries(TEAM).forEach(([k,o])=>{const f=o.flag&&me&&String(o.flag.i).toLowerCase()===me,w=o.watch&&me&&String(o.watch.i).toLowerCase()===me;if(S.all?(o.flag||o.watch):(f||w))ks.add(k)});
  if(S.all)ALL.forEach(s=>{if(s.flag)ks.add(akey(s))});return ks}
const repOf=k=>ALL.filter(s=>akey(s)===k).sort((a,b)=>((b.hist||[]).length-(a.hist||[]).length)||b.date.localeCompare(a.date))[0];
const STC={'heating up':'hot','moving':'mov','holding':'hold','cooling':'cool','new':'new','too early':'new'};
function boardRows(){return [...myKeys()].map(repOf).filter(Boolean).filter(s=>!isPassed(s)).sort((a,b)=>momentum(b)-momentum(a)||a.artist.localeCompare(b.artist))}
function cardHtml(s){const k=akey(s),o=TEAM[k]||{notes:[]},st=status(s),a=win(s.hist),b=win(s.igh),p=n=>(n>=0?'+':'')+Math.round(n*100)+'%';
  const n=o.notes&&o.notes[0],lp=lastPt(s,'igh'),ig=lp?lp[1]:s.ig,a2=agInfo(s);
  const rm=API&&((o.flag&&!s.flag)||(o.watch))?`<button class="bx" data-act="bdrm" data-v="${esc(k)}" title="remove from my list" aria-label="remove ${esc(s.artist)} from my list">✕</button>`:'';
  return `<div class="bc ${STC[st]}" data-k="${esc(k)}">
   <div class="bh"><input type="checkbox" class="cmpb" data-act="cmpsel" data-v="${esc(k)}" ${CMP.has(k)?'checked':''} aria-label="compare ${esc(s.artist)}" title="select to compare">${s.track&&s.src!=='WL'?`<a class="a" href="${esc(s.track)}" target="_blank" rel="noopener">${esc(s.artist)}</a>`:`<span class="a">${esc(s.artist)}</span>`}<span class="sc" title="momentum 0-100: listener growth, Instagram growth, playlists, press, jumps">${momentum(s)}</span>${rm}</div>
   <div class="bt"><span class="st ${STC[st]}">${esc(st)}</span><span class="hn">${esc(why(s))}</span></div>
   <div class="bm"><div><span class="hn">monthly listeners</span><b>${cur(s)!=null?fmt(cur(s)):'–'}</b>${a?`<i class="${a.pct>=0?'up':'dn'}">${p(a.pct)}</i>`:''}</div>${s.hist&&s.hist.length>1?spark(s.hist,96):''}</div>
   <div class="bm"><div><span class="hn">instagram</span><b>${ig?fmt(ig):'–'}</b>${b?`<i class="${b.pct>=0?'up':'dn'}">${p(b.pct)}</i>`:''}</div>${s.igh&&s.igh.length>1?spark(s.igh,96):''}</div>
   <div class="bi">${a2.ag?`<span>${esc(a2.ag)}</span>`:'<span class="hn">no agency</span>'}${realLb(s)?`<span>${esc(s.lb[0])}</span>`:''}${opChip(s)}${s.sn?snTag(s):''}</div>
   ${n?`<div class="nt"><b>${esc(n.i)}</b> ${mention(n.x)}</div>`:''}
   <div class="bb"><button data-act="hist" data-v="${esc(k)}">details</button>${s.track&&s.src!=='WL'?`<a href="${esc(s.track)}" target="_blank" rel="noopener">play ↗</a>`:''}</div></div>`}
function boardHtml(){
  const L=boardRows(),by={};L.forEach(s=>{(by[status(s)]=by[status(s)]||[]).push(s)});
  const al=['heating up','cooling'].filter(x=>by[x]).map(x=>`<b>${by[x].length} ${x}</b>: ${by[x].slice(0,4).map(s=>{const a=win(s.hist);return `<a href="#" data-act="hist" data-v="${esc(akey(s))}">${esc(s.artist)}</a>${a?' '+(a.pct>=0?'+':'')+Math.round(a.pct*100)+'%':''}`}).join(', ')}`).join(' · ');
  const add=API?`<form class="bf"><input name="u" placeholder="paste a Spotify artist link to follow" autocomplete="off" aria-label="spotify artist link"><button type="submit">follow</button></form>`:'';
  return `<div class="bd"><div class="bdh"><div><h2>${S.all?'everyone’s follows':'my list'} <span class="hn">${L.length} artist${L.length===1?'':'s'}</span></h2>${al?`<div class="bal">${al}</div>`:''}</div>
   <div class="bdc">${add}<button class="act" data-act="bdall">${S.all?'show only mine':'show everyone’s'}</button><button class="act" data-act="cmp" ${CMP.size<2?'disabled':''} id="cmpb">compare${CMP.size?' ('+CMP.size+')':''}</button><button class="act" data-act="report">copy weekly report</button></div></div>
   ${L.length?`<div class="bgrid">${L.map(cardHtml).join('')}</div>`:`<div class="empty">${INI?'nothing here yet - paste a Spotify artist link above, or star an artist in the main list':'enter your name first'}.</div>`}</div>`}
function renderBoard(){$('#rows').innerHTML=boardHtml();$('#empty').hidden=true}
function reportText(){const L=boardRows(),o=['MY LIST - '+dstr(UPD||new Date().toISOString().slice(0,10)),L.length+' artists',''];
  ['heating up','moving','holding','cooling','new','too early'].forEach(x=>{const g=L.filter(s=>status(s)===x);if(!g.length)return;o.push(x.toUpperCase());g.forEach(s=>o.push('- '+s.artist+' ('+momentum(s)+'): '+why(s)+(agOf(s)?' · '+agOf(s):'')+(s.track&&s.src!=='WL'?' '+s.track:'')));o.push('')});return o.join('\n')}
function cmpHtml(){const ks=[...CMP].slice(0,7),rows=ks.map(repOf).filter(Boolean);
  const T1=tw()[1],T0=T1-28*DAY,W=560,H=200,P=28,X=t=>P+(t-T0)/(T1-T0)*(W-P-8);
  const ser=rows.map(s=>{const h=(s.hist||[]).filter(p=>tms(p[0])>=T0);const base=h.length?h[0][1]:null;return {s,h,base}});
  let lo=100,hi=100;ser.forEach(x=>x.h.forEach(p=>{if(x.base){const v=p[1]/x.base*100;lo=Math.min(lo,v);hi=Math.max(hi,v)}}));lo=Math.floor(lo-3);hi=Math.ceil(hi+3);const Y=v=>H-P+4-(v-lo)/(hi-lo||1)*(H-P-8);
  const lines=ser.map((x,i)=>x.h.length>1&&x.base?`<polyline fill="none" stroke="${CCOL[i]}" stroke-width="2" points="${x.h.map(p=>X(tms(p[0])).toFixed(1)+','+Y(p[1]/x.base*100).toFixed(1)).join(' ')}"/>`:'').join('');
  return `<div class="hc" role="dialog" aria-modal="true" aria-label="compare"><button class="hx" data-act="histx" aria-label="close">✕</button><h3>compare monthly listeners</h3><p class="hs">each line starts at 100 on its first reading in the last 28 days</p>
   <svg width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="listener growth comparison"><line x1="${P}" x2="${W-8}" y1="${Y(100).toFixed(1)}" y2="${Y(100).toFixed(1)}" stroke="rgba(0,0,0,.25)" stroke-dasharray="3 3"/><text x="2" y="${(Y(100)+3).toFixed(1)}" font-size="9">100</text><text x="2" y="${(Y(hi)+9).toFixed(1)}" font-size="9">${hi}</text><text x="2" y="${(Y(lo)).toFixed(1)}" font-size="9">${lo}</text>${lines}</svg>
   <div class="cl">${ser.map((x,i)=>{const l=x.h.length?x.h[x.h.length-1][1]:null;return `<div><i style="background:${CCOL[i]}"></i><b>${esc(x.s.artist)}</b> <span class="hn">${l!=null?fmt(l)+' listeners':''}${x.base&&l!=null?' · '+(l>=x.base?'+':'')+Math.round((l/x.base-1)*100)+'%':''} · momentum ${momentum(x.s)}</span></div>`}).join('')}</div></div>`}
// Spotify's own oEmbed gives the artist name for a link (CORS-open); cached per id
const OEN=new Map();
async function spotName(id){if(OEN.has(id))return OEN.get(id);let n='';try{const r=await fetch('https://open.spotify.com/oembed?url='+encodeURIComponent('https://open.spotify.com/artist/'+id));n=(await r.json()).title||''}catch(e){}if(n)OEN.set(id,n);return n}
const nameKey=n=>n.split(/,| & | feat\.? | x /i)[0].trim().toLowerCase();
// the watch form: the name fills in as soon as a Spotify link is pasted (unless the name was typed by hand)
let WFT=0;
document.addEventListener('input',e=>{const t=e.target;if(!t.matches)return;
  if(t.matches('.wf [name=n]')){t.dataset.auto='';return}
  if(!t.matches('.wf [name=u]'))return;const f=t.form,id=spotArtistId(t.value);clearTimeout(WFT);if(!id)return;
  WFT=setTimeout(async()=>{const n=f.n;if(n.value&&n.dataset.auto!=='1')return;const ph=n.placeholder;n.placeholder='reading spotify…';
    const name=await spotName(id);n.placeholder=ph;
    if(name&&f.isConnected&&spotArtistId(f.u.value)===id&&(!n.value||n.dataset.auto==='1')){n.value=name;n.dataset.auto='1'}},120)});
async function watchSubmit(t){
  if(needIni(''))return;const raw=t.u.value.trim(),id=spotArtistId(raw)||'';
  if(raw&&!id){t.u.focus();t.u.style.borderBottomColor='#d9342b';return}
  let n=t.n.value.trim();if(!n&&id)n=await spotName(id);
  if(!n){t.n.focus();t.n.style.borderBottomColor='#d9342b';toast('type a name, or paste a Spotify link');return}
  const igRaw=t.ig.value.trim().replace(/^@/,''),h=igRaw?igHandle(igRaw):'';
  if(igRaw&&!/^[A-Za-z0-9._]{1,30}$/.test(h)){t.ig.focus();t.ig.style.borderBottomColor='#d9342b';return}
  const k=nameKey(n);t.reset();
  await teamAct({type:'watch',a:k,n,i:INI,x:id+'|'+n});
  if(h)await teamAct({type:'ig',a:k,n,i:INI,x:'https://www.instagram.com/'+h+'/|'});
  toast(n+' is on the watchlist'+(id?'':' - no Spotify link, so no listener readings'))}
async function followLink(raw){const id=spotArtistId(raw);if(!id){toast('that is not a Spotify artist link');return}
  if(needIni(''))return;let name=await spotName(id);
  if(!name)name=(prompt('artist name?')||'').trim();if(!name)return;
  const k=name.split(/,| & | feat\.? | x /i)[0].trim().toLowerCase(),have=ALL.some(s=>akey(s)===k&&s.src!=='WL');
  if(!have&&!(TEAM[k]&&TEAM[k].watch))await teamAct({type:'watch',a:k,n:name,i:INI,x:id+'|'+name});
  if(!(TEAM[k]&&TEAM[k].flag)&&!ALL.some(s=>akey(s)===k&&s.flag))await teamAct({type:'flag',a:k,n:name,i:INI});
  toast(name+' is on your list'+(have?'':' - readings start with the next daily update'))}

// ---- saved views (shared with the team through the log)
const SORTS=[['mom',-1,'momentum (growth, playlists, press)'],['date',-1,'newest first'],['date',1,'oldest first'],['artist',1,'artist A–Z'],['listeners',-1,'monthly listeners'],['gr',-1,'listener growth'],['ig',-1,'instagram followers'],['iggr',-1,'instagram growth'],['pls',-1,'most playlists'],['press',-1,'most press'],['ag',1,'agency A–Z']];
let MENU='';
function closeMenu(){$('#pop').hidden=true;MENU=''}
function menuHtml(v){
  if(v==='views')return viewsHtml();
  const it=(on,act,val,txt)=>`<button class="mi${on?' on':''}" data-act="${act}" data-v="${val}" role="menuitem">${on?'✓ ':''}${txt}</button>`;
  if(v==='recap')return `<div class="vw" role="menu">${it(false,'go','digest','this week')}${it(false,'go','score','scorecard')}${API?it(false,'go','feed','team activity'+(($('#fb')||{}).textContent||'')):''}</div>`;
  if(v==='view')return `<div class="vw">${it(S.grp,'tog','grp','group by artist')}${API?it(S.mine,'tog','mine','my flags only'):''}${API?it(S.passed,'tog','passed','show passed artists ('+Object.values(TEAM).filter(o=>o.pass).length+')'):''}${it(document.body.classList.contains('compact'),'dens','','compact rows')}</div>`;
  if(v==='sort')return `<div class="vw">${SORTS.map(([k,d,t])=>it(S.sort===k&&S.dir===d,'setsort',k+'|'+d,t)).join('')}</div>`;
  return `<div class="vw">${it(0,'copylink','','copy link to this view')}${it(0,'csv','','download csv')}</div>`}
function viewsHtml(){return `<div class="vw" role="menu">${VIEWS.map(v=>`<div class="vr"><button data-act="applyview" data-v="${esc(v.id)}" role="menuitem">${esc(v.name)}</button><span class="hn">${esc(v.i)}</span>${v.i===INI?`<button class="nx" data-act="delview" data-v="${esc(v.id)}" aria-label="delete view">✕</button>`:''}</div>`).join('')||'<div class="hn" style="padding:4px 0">no saved views yet</div>'}
  <form class="vf"><input name="n" maxlength="40" placeholder="name this view" aria-label="view name" autocomplete="off"><button type="submit">save current</button></form></div>`}

const SETS=()=>({days:S.days,pls:S.pls,pr:S.pr,sp:S.sp,bk:S.bk,ag:S.ag,lb:S.lb});
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
  go:(b,v)=>{closeMenu();return ACT[v](b,'')},
  feed:()=>{openPanel('feed');const now=new Date().toISOString();ls.set('instinct_seen',now);SEEN=now;paintFeedBadge();return 1},
  digest:()=>{openPanel('digest');return 1},
  score:()=>{openPanel('score');return 1},
  board:()=>{S.board=!S.board;window.scrollTo(0,0)},
  bdall:()=>{S.all=!S.all},
  bdrm:(b,v)=>{const o=TEAM[v]||{};if(o.flag&&!ALL.some(s=>akey(s)===v&&s.flag))teamAct({type:'unflag',a:v,n:nameOf(v),i:INI});if(o.watch&&o.watch.i===INI)teamAct({type:'unwatch',a:v,n:nameOf(v),i:INI,x:''});return 1},
  cmpsel:(b,v)=>{b.checked?CMP.add(v):CMP.delete(v);const c=$('#cmpb');if(c){c.disabled=CMP.size<2;c.textContent='compare'+(CMP.size?' ('+CMP.size+')':'')}return 1},
  cmp:()=>{if(CMP.size>=2)openPanel('cmp');return 1},
  report:async b=>{b.textContent=(await copy(reportText()))?'copied':'copy failed';setTimeout(()=>{b.textContent='copy weekly report'},2000);return 1},
  alertx:(b,v)=>{let d=[];try{d=JSON.parse(ls.get('instinct_alerts')||'[]')}catch(e){}ls.set('instinct_alerts',JSON.stringify([...d,...String(v).split('\n')].slice(-200)));paintAlerts();return 1},
  rmatch:(b,v)=>{if(needIni(v))return 1;teamAct({type:'sign',a:v,n:nameOf(v),i:INI,x:'match|'+b.dataset.s+'|'+b.dataset.nm});return 1},
  rno:(b,v)=>{if(needIni(v))return 1;teamAct({type:'sign',a:v,n:nameOf(v),i:INI,x:'nomatch'});return 1},
  unpass:(b,v)=>{const o=TEAM[v];if(o&&o.pass)teamAct({type:'del',a:v,n:nameOf(v),x:o.pass.id});return 1},
  watch:()=>{if(needIni(''))return 1;openPanel('watch');return 1},
  help:()=>{openPanel('help');return 1},
  copydigest:async b=>{b.textContent=(await copy(digestText()))?'copied':'copy failed';return 1},
  copylink:async()=>{closeMenu();save();const ok=await copy(location.href);toast(ok?'link copied - it keeps your filters':'could not copy the link');return 1},
  nopl:()=>{const on=document.body.classList.toggle('nopl');ls.set('instinct_nopl',on?'1':'');paintNopl();return 1},
  dens:()=>{document.body.classList.toggle('compact');ls.set('instinct_dens',document.body.classList.contains('compact')?'1':'');closeMenu();renderTop();return 1},
  menu:(b,v)=>{const p=$('#pop');if(!p.hidden&&MENU===v){closeMenu();return 1}MENU=v;p.innerHTML=menuHtml(v);const r=b.getBoundingClientRect();p.style.left=Math.max(8,Math.min(r.left,innerWidth-250))+'px';p.style.top=(r.bottom+window.scrollY+4)+'px';p.hidden=false;return 1},
  tog:(b,v)=>{closeMenu();if(v==='passed')S.passed=!S.passed;else if(v==='mine'){if(!INI){askIni(false);return 1}S.mine=!S.mine}else S.grp=!S.grp;LIM=120},
  setsort:(b,v)=>{const [k,d]=v.split('|');S.sort=k;S.dir=+d;if(S.sort2===k)S.sort2='';LIM=120;closeMenu()},
  applyview:(b,v)=>{const w=VIEWS.find(x=>x.id===v);if(w){try{applyState(JSON.parse(w.state));closeMenu()}catch(e){toast('that view could not be read')}}},
  delview:(b,v)=>{teamAct({type:'delview',a:'_views',n:'',i:INI,x:v});closeMenu();return 1},
  shows:(b,v)=>{OPEN.has(v)?OPEN.delete(v):OPEN.add(v);renderRows();return 1},
  csv:()=>{closeMenu();csv();return 1},
  facets:()=>{document.querySelector('.layout').classList.toggle('fx');return 1},
  view:(b,v)=>{S.view=v;LIM=120},
  day:(b,v)=>{S.days=new Set(S.days.has(v)&&S.days.size===1?[]:[v]);lastDay=v;LIM=120},
  artist:(b,v)=>{S.q=v;$('#q').value=v;LIM=120},
  f:(b,v)=>{toggle(FSETS()[b.dataset.k],v);LIM=120},
  bk:(b,v)=>{toggle(S.bk,+v);LIM=120},
  'clr-bk':()=>{S.bk.clear()},
  rm:(b,v)=>{const k=b.dataset.k;if(k==='src')S.src='';else if(k==='flag')S.flag=false;else if(k==='mine')S.mine=false;else if(k==='hs')S.hs=false;else if(k==='passed')S.passed=false;else if(k==='q'){S.q='';$('#q').value=''}else SETS()[k].delete(k==='bk'?+v:v);LIM=120},
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
  if(!e.target.closest('#pop,[data-act=menu]'))closeMenu();
  if(e.target.closest('a[href]:not([href="#"])'))return;
  const b=e.target.closest('[data-act],[data-sort]');
  if(!b)return;
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
  if(t.matches('.bf')){e.preventDefault();const v=t.u.value;t.u.value='';followLink(v);return}
  if(t.matches('.pf')){e.preventDefault();if(needIni(t.dataset.v))return;teamAct({type:'note',a:t.dataset.v,n:nameOf(t.dataset.v),i:INI,x:PASS+(t.x.value.trim()||'-')});return}
  if(t.matches('.ef')){e.preventDefault();const x=t.x.value.trim();if(!x||!PO)return;teamAct({type:'edit',a:PO,n:nameOf(PO),i:INI,x:t.dataset.id+'|'+x});return}
  if(t.matches('.wf')){e.preventDefault();watchSubmit(t);return}
  if(t.matches('.vf')){e.preventDefault();if(needIni(''))return;const n=t.n.value.trim();if(!n)return;teamAct({type:'view',a:'_views',n,i:INI,x:JSON.stringify(stateObj())}).then(()=>{$('#pop').innerHTML=viewsHtml()});return}
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
  if(e.key==='m'){S.board=!S.board;render();return}
  if(e.key==='j'||e.key==='k'){S.sel=Math.max(0,Math.min(VIEW.length-1,S.sel+(e.key==='j'?1:-1)));if(S.sel>=RN&&$('#more'))moreRows(S.sel+60);renderRows();const el=document.querySelector('.row.sel');el&&el.scrollIntoView({block:'center'});return}
  const sel=VIEW[S.sel];if(!sel)return;
  if(e.key==='f'&&sel.src!=='WL'&&!sel.flag){const k=akey(sel);if(API){if(needIni(k))return;const o=TEAM[k];teamAct({type:o&&o.flag?'unflag':'flag',a:k,n:sel.artist,i:INI})}else{LF.has(k)?LF.delete(k):LF.add(k);ls.set('instinct_flags',JSON.stringify([...LF]));render()}return}
  if(e.key==='n'&&API){e.preventDefault();openHist(akey(sel));setTimeout(()=>{const f=document.querySelector('#hist .nx2');f&&f.focus()},40);return}
  if((e.key==='p'||e.key==='P')&&API&&sel.src!=='WL'){e.preventDefault();const k=akey(sel);
    if(e.key==='P'){openHist(k);setTimeout(()=>{const f=document.querySelector('#hist .pfi');f&&f.focus()},40);return}
    if(needIni(k))return;S.sel=Math.min(S.sel,Math.max(0,VIEW.length-2));
    teamAct({type:'note',a:k,n:sel.artist,i:INI,x:PASS+'-'}).then(()=>{const o=TEAM[k];if(o&&o.pass)toast('passed on '+sel.artist,['undo',()=>teamAct({type:'del',a:k,n:sel.artist,x:o.pass.id})])});return}
  if(e.key==='x'){openHist(akey(sel));return}
  if((e.key==='Enter'||e.key==='o')&&sel.track)window.open(sel.track,'_blank','noopener');
});
function csv(){
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const rows=[['date','artist','song','monthly listeners','instagram','instagram growth %','listener growth %','press','playlists','agency','agent','signed','flagged by','label','release','track url'],...VIEW.map(s=>{const a=agInfo(s),g=gr(s),gi=gr(s,'igh'),o=TEAM[akey(s)],lp=lastPt(s,'igh');return [s.date,s.artist,s.song,cur(s),lp?lp[1]:s.ig,gi&&gi.pct!=null?Math.round(gi.pct*100):'',g&&g.pct!=null?Math.round(g.pct*100):'',(s.press||[]).map(p=>p.t).join(' | '),(s.playlists||[]).map(p=>p.t).join(' | '),a.ag,a.agt||'',a.ag?'yes':'no',o&&o.flag?o.flag.i:s.flag?'sheet':'',realLb(s)?s.lb[0]:'',lbCat(s),s.track]})];
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(q).join(',')).join('\n')],{type:'text/csv'}));a.download='instinct.csv';a.click();
}
// ---- footer: what the data looks like right now
function paintFoot(d){FOOTD=d;
  const h=HEALTH,u=new Date(d.updated),hrs=(Date.now()-u)/36e5;
  $('#upd').textContent='updated '+u.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+u.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  const st=$('#stale');st.hidden=hrs<30;st.textContent=hrs>=30?`this data is ${Math.round(hrs)} hours old - the daily refresh may have failed`:'';
  if(!h){$('#foot').textContent='';return}
  const live=ALL.filter(s=>s.src!=='WL'),bits=[`${live.length} songs · ${new Set(live.map(akey)).size} artists`,`listener readings through ${h.lastread?dstr(h.lastread):'–'}${h.stale?` (${h.stale} artists over 10 days old)`:''}`,`instagram: ${h.igcount} counts, ${h.iggrow} with growth, ${h.noig} songs with no profile${h.lastig?', last read '+dstr(h.lastig):''}`,`rostr: ${h.rostr_nomatch} no match${h.rostr_never?`, ${h.rostr_never} never checked`:''}`,`${h.jumps} active jump${h.jumps===1?'':'s'}`];
  $('#foot').innerHTML=bits.map(esc).join(' · ')+' · <button class="act" data-act="help">keys (?)</button>';
}
function init(data){
  {const tk={};data.songs.forEach(s=>{if(s.track)tk[s.track]=akey(s)});let ch=false;
   [...LF].forEach(k=>{if(/^https?:/.test(k)){LF.delete(k);if(tk[k])LF.add(tk[k]);ch=true}else if(k.includes('|')){LF.delete(k);LF.add(k.split('|')[0].split(/,| & | feat\.? | x /i)[0].trim().toLowerCase());ch=true}});
   if(ch)ls.set('instinct_flags',JSON.stringify([...LF]))}
  {const c=new Date();c.setMonth(c.getMonth()-6);const cut=c.toISOString().slice(0,10);data.songs.forEach(s=>{if(s.press)s.press=s.press.filter(p=>!p.d||p.d>=cut)})}
  {const mx=data.songs.filter(s=>s.src!=='WL').reduce((a,s)=>s.date>a?s.date:a,'');
   if(!ss.get('vs')){ls.set('instinct_prevmax',ls.get('instinct_lastmax')||'');ls.set('instinct_lastmax',mx);ss.set('vs','1')}
   VIS=ls.get('instinct_prevmax')||''}
  HS=data.hs||{};PD=data.pd||{};HEALTH=data.health||null;UPD=String(data.updated||'').slice(0,10);
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
  if(ls.get('instinct_nopl'))document.body.classList.add('nopl');paintNopl();
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
