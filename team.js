/* =====================================================================
   Schicht & Urlaub – Team (Stufe 3) · eigenes Modul
   Architektur (siehe aufgaben/TEAM-SPEZ.md):
   • Private Daten bleiben im Planer (S.vacs …). Standard: NICHTS wird geteilt.
     Erst wenn der Nutzer „Meinen Urlaub für den Admin freigeben“ einschaltet (consentGet("adminShare")),
     geht eine Kopie (von–bis, Tage) ins Team. Lesen dürfen diese Kopien nur Admins/Vertreter und der Nutzer selbst.
   • Firebase:  teams/{t}                    Team (Name, Grenze, Frist, Einladungscode)
                teams/{t}/members/{uid}      Mitglied (Name, Farbe, Form, Rolle, Vertreter-Ebene, Kinder, Name zeigen)
                teams/{t}/entries/{uid_id}   Team-Kopie eines Urlaubs (von–bis, Tage, Wert in Minuten, eingetragen am)
                teams/{t}/notes/{id}         zentrale Benachrichtigungen (Konflikt, Erinnerung, Freigabe …)
                teams/{t}/conflicts/{id}     Überschneidung mit Frage-Reihenfolge, Antworten, Entscheidung, Status
   • Team verlassen/entfernt = Mitglied + seine entries löschen. Der private Planer bleibt unberührt.
   • Ohne Server: Benachrichtigungen erscheinen in der App (Posteingang + Dringlichkeit).
   ===================================================================== */
const TEAM={s:null, data:null, loading:false, err:null, m:null, synced:false};
const SHAPES=["●","◆","♥","■"], SHAPE_N=["Kreis","Raute","Herz","Würfel"];
const TCOL=["#1C6DD0","#E8590C","#2E8B57","#C2185B","#7B2FA3","#0B8A83","#E0A100","#8E5A2B","#4A3FB5","#6B7A85","#D9480F","#1C7C9C"];
const MAXDEP=3;              /* höchstens 3 Vertreter-Ebenen */
const BIG_TEAM=8;            /* ab so vielen Mitgliedern zusätzlich Initialen */

/* ---------- Anmeldung (eigene Team-Sitzung, unabhängig vom privaten Planer) ---------- */
function tsLoad(){ try{ TEAM.s=JSON.parse(lsGet("su_tsess")||"null"); }catch(e){ TEAM.s=null; } }
function tsSave(j,email){ const o=TEAM.s||{}; TEAM.s={uid:j.localId||j.user_id||o.uid, email:(email||j.email||o.email||"").toLowerCase(), idToken:j.idToken||j.id_token, refresh:j.refreshToken||j.refresh_token||o.refresh, exp:Date.now()+((+(j.expiresIn||j.expires_in)||3600)-120)*1000}; lsSet("su_tsess",JSON.stringify(TEAM.s)); }
async function tTok(){ const s=TEAM.s; if(!s) throw Object.assign(new Error("NO_SESSION"),{code:"NO_SESSION"}); if(Date.now()<s.exp && s.idToken) return s.idToken;
  let r; try{ r=await fetch("https://securetoken.googleapis.com/v1/token?key="+CFG.apiKey,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=refresh_token&refresh_token="+encodeURIComponent(s.refresh)}); }catch(e){ throw Object.assign(new Error("NETWORK"),{code:"NETWORK"}); }
  const j=await r.json().catch(()=>({})); if(!r.ok) throw Object.assign(new Error((j.error&&j.error.message)||"AUTH"),{code:"AUTH"}); tsSave(j,s.email); return TEAM.s.idToken; }
function tLogout(){ TEAM.s=null; TEAM.data=null; lsSet("su_tsess",null); render(); }

/* ---------- Firestore (REST) ---------- */
const FSB=()=>"https://firestore.googleapis.com/v1/projects/"+CFG.projectId+"/databases/(default)/documents";
function fv(v){ if(!v) return null; if("stringValue" in v) return v.stringValue; if("integerValue" in v) return +v.integerValue; if("doubleValue" in v) return v.doubleValue; if("booleanValue" in v) return v.booleanValue; if("nullValue" in v) return null;
  if("arrayValue" in v) return (v.arrayValue.values||[]).map(fv); if("mapValue" in v){ const o={}; const f=v.mapValue.fields||{}; for(const k in f) o[k]=fv(f[k]); return o; } return null; }
function tv(v){ if(v==null) return {nullValue:null}; if(typeof v==="boolean") return {booleanValue:v}; if(typeof v==="number") return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(Array.isArray(v)) return {arrayValue:{values:v.map(tv)}}; if(typeof v==="object"){ const f={}; for(const k in v) f[k]=tv(v[k]); return {mapValue:{fields:f}}; } return {stringValue:String(v)}; }
const tFields=o=>{ const f={}; for(const k in o) f[k]=tv(o[k]); return {fields:f}; };
function tDoc(d){ const o={id:d.name.split("/").pop()}; const f=d.fields||{}; for(const k in f) o[k]=fv(f[k]); return o; }
async function tfs(path,method,body,q){ let r; try{ r=await fetch(FSB()+path+(q?"?"+q:""),{method:method||"GET",headers:Object.assign({Authorization:"Bearer "+await tTok()},body?{"Content-Type":"application/json"}:{}),body:body?JSON.stringify(body):undefined}); }catch(e){ if(e.code) throw e; throw Object.assign(new Error("NETWORK"),{code:"NETWORK"}); }
  if(r.status===404 && (!method||method==="GET")) return null; const j=await r.json().catch(()=>({}));
  if(!r.ok){ const c=(j.error&&(j.error.status||j.error.message))||"HTTP_"+r.status; throw Object.assign(new Error(c),{code:c}); } return j; }
async function tList(path){ const out=[]; let pt=""; do{ const j=await tfs(path,"GET",null,"pageSize=300"+(pt?"&pageToken="+encodeURIComponent(pt):"")); if(!j) break; (j.documents||[]).forEach(d=>out.push(tDoc(d))); pt=j.nextPageToken||""; }while(pt); return out; }
const tPut=(path,o,mask)=>tfs(path,"PATCH",tFields(o),(mask||Object.keys(o)).map(k=>"updateMask.fieldPaths="+k).join("&"));
const tDel=path=>tfs(path,"DELETE");
function tErrMsg(e){ const c=String(e&&(e.code||e.message)||""); if(/PERMISSION/.test(c)) return "Keine Berechtigung – sind die neuen Firebase-Regeln veröffentlicht?";
  if(/NETWORK|Failed to fetch/.test(c)) return "Keine Verbindung. Bitte später nochmal."; return authMsg(e); }

/* ---------- Verknüpfung zum Team (getrennt vom privaten Datensatz) ---------- */
function tRef(){ try{ return JSON.parse(lsGet("su_tref")||"null"); }catch(e){ return null; } }
function tRefSet(r){ lsSet("su_tref",r?JSON.stringify(r):null); }
const TP=()=>"/teams/"+tRef().id;
const isTAdmin=()=>{ const d=TEAM.data; return !!(d&&d.me&&!d.pending&&d.me.status!=="pending"&&(d.me.role==="admin"||d.me.role==="deputy")); };
const isAdmM=m=>(m.role==="admin"||m.role==="deputy")&&m.status!=="pending";
const mCol=(m,i)=>{ const d=TEAM.data, j=d&&m.color?d.mem.findIndex(x=>x.color===m.color):-1; return m.color&&(j<0||j===i)?m.color:TCOL[i%TCOL.length]; }, mShape=(m,i)=>(m.shape!=null?m.shape:i)%4;
function mIdx(uid){ const d=TEAM.data; return d?d.mem.findIndex(m=>m.id===uid):-1; }
function mLabel(m,i,forceName){ const own=TEAM.s&&m.id===TEAM.s.uid; return (m.showName||own||forceName)?m.name:"Mitglied "+SHAPE_N[mShape(m,i)]; }
function mInit(m){ return String(m.name||"?").split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase(); }
function mMark(m,i,small){ const sp=el("span","tmk"+(small?" sm":"")); sp.style.color=mCol(m,i); sp.textContent=SHAPES[mShape(m,i)]; sp.title=mLabel(m,i);
  const d=TEAM.data; if(d && d.mem.length>BIG_TEAM && m.showName){ const b=el("b",null,mInit(m)); sp.append(b); } return sp; }

/* ---------- Laden ---------- */
/* Abfrage mit Filter (Mitglieder dürfen nur eigene Vorschläge lesen) */
async function tQuery(coll,field,val){ const j=await tfs(TP()+":runQuery","POST",{structuredQuery:{from:[{collectionId:coll}],where:{fieldFilter:{field:{fieldPath:field},op:"EQUAL",value:tv(val)}}}}); return (Array.isArray(j)?j:[]).filter(x=>x&&x.document).map(x=>tDoc(x.document)); }
async function teamLoad(){ const ref=tRef(); if(!ref||!TEAM.s){ TEAM.data=null; return; } TEAM.loading=true; TEAM.last=Date.now(); if(view==="team") renderTeam();
  try{ let md=null; try{ md=await tfs(TP()+"/members/"+TEAM.s.uid); }catch(e){ if(!/PERMISSION/.test(String(e.code))) throw e; }
    /* eigenes Mitglieds-Profil weg = entfernt → sofort kein Zugriff mehr, privater Planer bleibt */
    if(!md){ tSentSet([]); tRefSet(null); TEAM.data=null; toast("Du bist nicht mehr in diesem Team. Dein privater Planer bleibt, wie er ist."); return; }
    const me0=tDoc(md);
    if(me0.status==="pending"){ TEAM.data={pending:true,team:{name:ref.name||"Team"},me:me0,mem:[me0],ent:[],props:[],bans:[],notes:[],conf:[]}; TEAM.err=null; return; }
    const t=await tfs(TP()); if(!t){ tRefSet(null); TEAM.data=null; toast("Dieses Team gibt es nicht mehr."); return; }
    const team=tDoc(t), adm=isAdmM(me0); if(ref.name!==team.name) tRefSet(Object.assign({},ref,{name:team.name}));
    /* Profile, Urlaube, Sperren: nur der Admin. Mitglieder: nur eigenes Profil und eigene Vorschläge */
    const mem=adm?(await tList(TP()+"/members")).sort((a,b)=>(a.joined||0)-(b.joined||0)):[me0], me=mem.find(m=>m.id===TEAM.s.uid)||me0;
    const ent=adm?await tList(TP()+"/entries"):[];
    const props=(adm?await tList(TP()+"/proposals").catch(()=>[]):await tQuery("proposals","uid",TEAM.s.uid).catch(()=>[])).sort((a,b)=>(b.created||0)-(a.created||0));
    const bans=adm?await tList(TP()+"/bans").catch(()=>[]):[];
    TEAM.data={team,mem,me,ent,props,bans,notes:[],conf:[]}; TEAM.err=null;
    if(!TEAM.synced){ TEAM.synced=true; await teamSync(true); }
    teamAlerts();
  }catch(e){ TEAM.err=tErrMsg(e); } finally{ TEAM.loading=false; if(view==="team") renderTeam(); if(view==="heute") renderHeute(); } }

/* ---------- Eigenen Urlaub als Team-Kopie abgleichen (nur bei Änderungen, kein Dauer-Hintergrund) ---------- */
function myTeamEntries(){ const out=[], uidv=TEAM.s.uid, vt=vacType(), cm=vt&&+vt.credit>0?+vt.credit:creditMin({shifts:0,min:0});
  if(!consentGet("adminShare")) return out;
  vacList().forEach(v=>{ if(!shareVacGet(v.id)) return; const days=vacDaysOf(v); if(!days.length) return; out.push({id:uidv+"_"+v.id, uid:uidv, a:v.a, e:v.e, days:days.length, value:days.length*cm, kids:consentGet("hasKids")}); });
  return out; }
/* Merkliste, welche eigenen Kopien im Team liegen (Mitglieder dürfen die Team-Einträge nicht lesen) */
const tSentKey=()=>"su_tsent_"+(tRef()?tRef().id:"");
function tSentGet(){ try{ return JSON.parse(lsGet(tSentKey())||"[]"); }catch(e){ return []; } }
function tSentSet(L){ lsSet(tSentKey(),L.length?JSON.stringify(L):null); }
function myEntries(){ const d=TEAM.data; return isTAdmin()&&d?d.ent.filter(x=>x.uid===TEAM.s.uid):tSentGet(); }
async function teamSync(quiet){ const d=TEAM.data; if(!d||!TEAM.s||d.pending) return; const mine=myEntries(), want=myTeamEntries(); let sent=tSentGet().filter(x=>mine.some(m=>m.id===x.id)||isTAdmin()), changed=0;
  try{ for(const w of want){ const o=mine.find(m=>m.id===w.id); if(!o||o.a!==w.a||o.e!==w.e||o.days!==w.days||o.value!==w.value||o.kids!==w.kids){ const rec={...w,created:o&&o.created?o.created:Date.now(),updated:Date.now()}; delete rec.id; await tPut(TP()+"/entries/"+w.id,rec); changed++; }
      sent=sent.filter(x=>x.id!==w.id); sent.push({...w,created:(o&&o.created)||Date.now()}); }
    for(const o of mine) if(!want.some(w=>w.id===o.id)){ await tDel(TP()+"/entries/"+o.id); sent=sent.filter(x=>x.id!==o.id); changed++; }
    tSentSet(sent);
    if(changed && isTAdmin()) d.ent=await tList(TP()+"/entries");
    if(changed && view==="team") renderTeam();
  }catch(e){ if(!quiet) toast(tErrMsg(e)); } }
let tSyncT=null; function teamSyncSoon(){ if(!tRef()||!TEAM.s||!TEAM.data) return; clearTimeout(tSyncT); tSyncT=setTimeout(()=>teamSync(false),1500); }

/* ---------- Überschneidungen ---------- */
function teamAwayMap(a,e){ const d=TEAM.data, m=new Map(); if(!d) return m; const mids=new Set(d.mem.map(x=>x.id));
  d.ent.forEach(x=>{ if(!mids.has(x.uid)) return; const s0=x.a>a?x.a:a, e0=x.e<e?x.e:e; for(let s=s0;s<=e0;s=addD(s,1)){ const w=parse(s).getDay(); if(w===0||w===6) continue; if(!m.has(s)) m.set(s,new Set()); m.get(s).add(x.uid); } }); return m; }
const tMax=()=>{ const d=TEAM.data; const n=d&&+d.team.maxAway; return n>0?n:999; };
const tLimit=()=>{ const n=TEAM.data&&+TEAM.data.team.maxAway; return n>0?n:0; };
function teamConflicts(a,e){ const out=[], m=teamAwayMap(a,e), mx=tMax(); [...m.keys()].sort().forEach(s=>{ const st=m.get(s); if(st.size>mx){ const L=out[out.length-1], who=[...st].sort().join("|");
  if(L && L.who===who && L.e===addD(s,-1)) L.e=s; else if(L && L.who===who && diffD(L.e,s)<=3 && [...Array(diffD(L.e,s)-1)].every((_,i)=>{ const w=parse(addD(L.e,i+1)).getDay(); return w===0||w===6; })) L.e=s; else out.push({a:s,e:s,who,uids:[...st],n:st.size}); } }); return out; }
/* ---------- Stufe 3: Konfliktlösung ----------
   teams/{t}/conflicts/{id} = {a,e,uids,order,need,step,asked,answers,status,decided,due,created,lastRemind,ferien}
   Ablauf: open (einer nach dem anderen wird gefragt) → admin (alle haben abgelehnt) → decided (Admin oder Regel) → solved.
   Reihenfolge: zuerst gefragt wird, wer zuletzt eingetragen hat – wer zuerst kam, behält.
   In den Schulferien werden Kollegen ohne Kinder zuerst gefragt. Läuft die Frist ab, gilt automatisch diese Regel. */
const hsh=t=>{ let h=0; for(const c of t) h=(h*31+c.charCodeAt(0))|0; return (h>>>0).toString(36); };
const cId=k=>"k"+k.a.replace(/-/g,"")+"_"+k.e.replace(/-/g,"")+"_"+hsh(k.uids.slice().sort().join("|"));
const rTxt=(a,e)=>a===e?fmt(a):fmtS(a)+" – "+fmt(e);
const uLab=u=>{ const i=mIdx(u); return i>=0?mLabel(TEAM.data.mem[i],i):"ehemaliges Mitglied"; };
const memKids=u=>{ const m=TEAM.data.mem.find(x=>x.id===u); return m&&m.kids?1:0; };
function rangeFerien(a,e){ for(let s=a;s<=e;s=addD(s,1)) if(ferien(s)) return true; return false; }
function entCreated(u,a,e){ let c=0; TEAM.data.ent.forEach(x=>{ if(x.uid===u&&x.a<=e&&x.e>=a) c=Math.max(c,x.created||0); }); return c; }
function conflictOrder(k,fe){ return k.uids.slice().sort((x,y)=>(fe?memKids(x)-memKids(y):0)||(entCreated(y,k.a,k.e)-entCreated(x,k.a,k.e))); }
function whyTxt(c,u){ return c.ferien&&!memKids(u)&&c.uids.some(memKids)?"In den Schulferien haben Kollegen mit Kindern Vorrang.":"Du hast als Letzter eingetragen – wer zuerst eingetragen hat, behält seinen Urlaub."; }
const admins=()=>TEAM.data.mem.filter(m=>m.role==="admin"||m.role==="deputy").map(m=>m.id);
const tFrist=()=>(+TEAM.data.team.deadlineDays||7)*86400000;
async function cPut(c,up){ Object.assign(c,up); await tPut(TP()+"/conflicts/"+c.id,up); }
async function askAt(c,u){ await notify({type:"konflikt",to:[u],title:"Kannst du ausweichen?",text:rTxt(c.a,c.e)+": zu viele gleichzeitig. "+whyTxt(c,u)+" Bitte im Team-Bereich antworten.",due:c.due,range:[c.a,c.e]}); }
async function teamCheck(changed,quiet){ const d=TEAM.data, mx=tMax(); if(mx>=999) return; const hits=[];
  changed.forEach(c=>teamConflicts(c.a,c.e).forEach(k=>{ if(k.uids.includes(TEAM.s.uid) && !hits.some(h=>cId(h)===cId(k))) hits.push(k); }));
  if(!hits.length) return; if(!d.conf) d.conf=[]; const due=Date.now()+tFrist();
  for(const k of hits){ const id=cId(k); if(d.conf.some(c=>c.id===id&&c.status!=="solved")) continue;
    /* schon offene Überschneidung im selben Zeitraum → erweitern statt doppelt anlegen; Neuer wird zuerst gefragt */
    const ex=d.conf.find(c=>c.status!=="solved"&&c.a<=k.e&&c.e>=k.a);
    if(ex){ const uids=[...new Set(ex.uids.concat(k.uids))], a=ex.a<k.a?ex.a:k.a, e=ex.e>k.e?ex.e:k.e, fe=rangeFerien(a,e); const order=conflictOrder({a,e,uids},fe);
      await cPut(ex,{a,e,uids,order,ferien:fe,need:k.n-mx,status:"open",step:-1,decided:[],due}); await notify({type:"konflikt",to:uids,title:"Zu viele gleichzeitig im Urlaub",text:rTxt(a,e)+": jetzt "+k.n+" statt höchstens "+mx+".",due,range:[a,e]});
      await confNext(ex,new Set(uids)); continue; }
    const fe=rangeFerien(k.a,k.e), order=conflictOrder(k,fe), c={id,a:k.a,e:k.e,uids:k.uids,order,need:k.n-mx,step:0,asked:order[0],answers:{},status:"open",decided:[],due,created:Date.now(),lastRemind:Date.now(),ferien:fe};
    const rec={...c}; delete rec.id; await tPut(TP()+"/conflicts/"+id,rec); d.conf=d.conf.filter(x=>x.id!==id).concat([c]);
    await notify({type:"konflikt",to:k.uids,title:"Zu viele gleichzeitig im Urlaub",text:rTxt(k.a,k.e)+": "+k.n+" statt höchstens "+mx+". Zuerst gefragt wird: "+uLab(order[0])+".",due,range:[k.a,k.e]});
    await askAt(c,order[0]); }
  if(!quiet){ const meAsk=d.conf.some(c=>c.status==="open"&&c.asked===TEAM.s.uid);
    ask("Überschneidung im Team",hits.map(k=>rTxt(k.a,k.e)+": "+k.n+" statt höchstens "+mx).join("\n")+"\n"+(meAsk?"Du wirst zuerst gefragt, ob du ausweichen kannst.":"Die anderen werden der Reihe nach gefragt.")+" Frist: "+(+d.team.deadlineDays||7)+" Tage.",[{label:"Zum Team",pri:true,fn:()=>{ TEAM.m={y:+hits[0].a.slice(0,4),m:+hits[0].a.slice(5,7)-1}; show("team"); }},{label:"OK"}]); } }
/* noch betroffen? (wer inzwischen ausgewichen ist, fällt raus) */
function confNow(c){ const cur=teamConflicts(c.a,c.e).filter(k=>k.uids.some(u=>c.uids.includes(u))); const still=new Set(); let n=0; cur.forEach(k=>{ k.uids.forEach(u=>still.add(u)); n=Math.max(n,k.n); }); return {still,n,open:cur.length>0}; }
async function confNext(c,still){ const st=c.order.findIndex((u,i)=>i>c.step&&still.has(u)&&(c.answers||{})[u]!=="nein");
  if(st>=0){ await cPut(c,{step:st,asked:c.order[st]}); await askAt(c,c.asked); }
  else{ await cPut(c,{status:"admin",asked:null}); await notify({type:"konflikt",to:admins(),title:"Bitte entscheiden",text:rTxt(c.a,c.e)+": Niemand kann ausweichen. Der Admin entscheidet (Admin-Maske).",due:c.due,range:[c.a,c.e]}); } }
async function confRule(c,byAdmin){ const {still,n}=confNow(c), need=Math.max(1,n-tMax()), dec=c.order.filter(u=>still.has(u)).slice(0,need), due=Date.now()+tFrist();
  await cPut(c,{status:"decided",decided:dec,asked:null,due,lastRemind:Date.now()});
  await notify({type:"konflikt",to:dec,title:"Bitte weiche aus",text:rTxt(c.a,c.e)+": "+(byAdmin?"Der Admin hat entschieden":"Die Frist ist abgelaufen – es gilt: Wer zuerst eingetragen hat, behält")+". Bitte verschiebe deinen Urlaub.",due,range:[c.a,c.e]});
  if(!byAdmin) await notify({type:"info",to:admins(),title:"Frist abgelaufen",text:rTxt(c.a,c.e)+": automatisch entschieden – "+dec.map(uLab).join(", ")+" soll ausweichen.",range:[c.a,c.e]}); }
async function confDecide(c,u){ const due=Date.now()+tFrist(); await cPut(c,{status:"decided",decided:[u],asked:null,due,lastRemind:Date.now()});
  await notify({type:"konflikt",to:[u],title:"Bitte weiche aus",text:rTxt(c.a,c.e)+": Der Admin hat entschieden. Bitte verschiebe deinen Urlaub.",due,range:[c.a,c.e]}); }
async function confNo(c){ const a=Object.assign({},c.answers,{[TEAM.s.uid]:"nein"}); await cPut(c,{answers:a}); await confNext(c,confNow(c).still); renderTeam(); }
/* läuft bei jedem Laden: gelöst? weiterfragen? Frist abgelaufen? automatische Erinnerung 48 Std. vor Fristende */
async function confTick(){ const d=TEAM.data; if(!d||!d.conf) return; const now=Date.now();
  try{ for(const c of d.conf){ if(c.status==="solved") continue; const {still,open}=confNow(c);
    if(tMax()>=999||!open){ await cPut(c,{status:"solved",asked:null}); await notify({type:"info",to:c.uids,title:"Überschneidung gelöst",text:rTxt(c.a,c.e)+": jetzt passt es. Danke!",range:[c.a,c.e]}); continue; }
    if(c.status==="open" && !still.has(c.asked)){ await confNext(c,still); continue; }
    if((c.status==="open"||c.status==="admin") && c.due<=now){ await confRule(c,false); continue; }
    if(c.status==="decided" && c.decided.length && !c.decided.some(u=>still.has(u))){ await confNext(Object.assign(c,{status:"open",step:-1,decided:[]}),still); continue; }
    if((c.status==="open"||c.status==="decided") && c.due-now<48*3600000 && now-(c.lastRemind||0)>24*3600000){ const to=c.status==="open"?[c.asked]:c.decided;
      await cPut(c,{lastRemind:now}); await notify({type:"erinnerung",to,title:"Frist läuft bald ab",text:rTxt(c.a,c.e)+": Bitte kläre deine Überschneidung.",due:c.due,range:[c.a,c.e]}); } } }catch(e){} }
/* Ausweichtage: eigenen Urlaub verschieben, so dass höchstens die erlaubte Zahl gleichzeitig weg ist */
function altDays(c){ const me=TEAM.s.uid, mx=tMax(), today=TODAY(); const v=vacList().filter(x=>shareVacGet(x.id)&&x.a<=c.e&&x.e>=c.a)[0]; if(!v) return {v:null,alt:[]}; const alt=[];
  for(let k=1;k<=60&&alt.length<3;k++) for(const dl of [k,-k]){ if(alt.length>=3) break; const na=addD(v.a,dl), ne=addD(v.e,dl); if(na<=today) continue;
    if(vacList().some(o=>o.id!==v.id&&o.a<=addD(ne,1)&&o.e>=addD(na,-1))) continue;
    const mp=teamAwayMap(na,ne); let okk=true; mp.forEach(st=>{ const n=st.size-(st.has(me)?1:0); if(n+1>mx) okk=false; }); if(!okk) continue;
    const days=vacDaysOf({a:na,e:ne}); if(!days.length||vacOver(days,v.id).length) continue; alt.push({a:na,e:ne,dl,n:days.length}); }
  return {v,alt}; }
function openAlt(c){ const {v,alt}=altDays(c);
  openSheet(p=>{ sheetTop(p,"Ausweichtage"); if(!v){ p.append(el("p",null,"Du hast in diesem Zeitraum keinen freigegebenen Urlaub.")); return; }
    p.append(el("p","hint","Dein Urlaub "+rTxt(v.a,v.e)+". Diese Zeiträume sind frei – ein Tipp verschiebt deinen Urlaub dorthin:"));
    if(!alt.length) p.append(el("p",null,"Keine passenden Tage in den nächsten 2 Monaten gefunden. Bitte im Jahreskalender selbst ändern."));
    alt.forEach(x=>{ const b=el("button","vrow"); b.type="button"; const t=el("div","grow"); t.append(el("b",null,rTxt(x.a,x.e)), el("small",null,x.n+" Urlaubstage · "+(x.dl>0?x.dl+" Tage später":(-x.dl)+" Tage früher"))); b.append(t,el("span","chev","›"));
      b.onclick=()=>{ v.a=x.a; v.e=x.e; if(v.fixed) v.fixed=v.fixed.map(s=>addD(s,x.dl)); normVacs(); save(); closeSheet(); toast("Urlaub verschoben auf "+rTxt(x.a,x.e)+". Das Team wird informiert."); }; p.append(b); }); }); }
function teamConfCard(box){ const d=TEAM.data, me=TEAM.s.uid, adm=isTAdmin(); const L=(d.conf||[]).filter(c=>c.status!=="solved"&&(adm||c.uids.includes(me))).sort((x,y)=>x.a<y.a?-1:1); if(!L.length) return;
  const card=el("div","card sec"); card.append(el("h3",null,"⚠️ Offene Überschneidungen ("+L.length+")"));
  L.forEach(c=>{ const r=el("div","tconf"); const t=el("div"); const mk=el("span"); c.uids.forEach(u=>{ const i=mIdx(u); if(i>=0) mk.append(mMark(d.mem[i],i,true)); }); t.append(el("b",null,rTxt(c.a,c.e)+" "),mk);
    const stx=c.status==="open"?"Gefragt: "+(c.asked===me?"du":uLab(c.asked)):c.status==="admin"?"Niemand kann ausweichen – der Admin entscheidet.":"Entscheidung: "+c.decided.map(u=>u===me?"du":uLab(u)).join(", ")+" soll ausweichen.";
    t.append(el("small",null,stx)); const nein=Object.keys(c.answers||{}).filter(u=>c.answers[u]==="nein"); if(nein.length) t.append(el("small",null,"Behalten: "+nein.map(u=>u===me?"du":uLab(u)).join(", ")));
    const left=c.due-Date.now(); t.append(el("span","turg"+(left<86400000?" hi":left<3*86400000?" mid":""),"⏳ "+dueTxt(c.due))); r.append(t);
    const act=el("div","row"); const mine=(c.status==="open"&&c.asked===me)||(c.status==="decided"&&c.decided.includes(me));
    if(mine){ if(c.status==="open") act.append(el("p","hint",whyTxt(c,me))); const y=el("button","btn pri grow","↔ Ausweichtage zeigen"); y.type="button"; y.onclick=()=>openAlt(c); act.append(y);
      if(c.status==="open"){ const n=el("button","btn grow","Nein, ich behalte"); n.type="button"; n.onclick=()=>ask("Urlaub behalten?","Dann wird der Nächste gefragt. Wenn niemand ausweichen kann, entscheidet der Admin.",[{label:"Ja, behalten",pri:true,fn:()=>confNo(c).catch(e=>toast(tErrMsg(e)))},{label:"Abbrechen"}]); act.append(n); } }
    if(adm){ const dz=el("button","btn grow","⚖ Entscheiden"); dz.type="button"; dz.onclick=()=>openConfDecide(c); act.append(dz); }
    const sh=el("button","btn ghost","Ansehen"); sh.type="button"; sh.onclick=()=>{ TEAM.m={y:+c.a.slice(0,4),m:+c.a.slice(5,7)-1}; renderTeam(); }; act.append(sh);
    r.append(act); card.append(r); }); box.append(card); }
function openConfDecide(c){ const d=TEAM.data, {still}=confNow(c);
  openSheet(p=>{ sheetTop(p,"Entscheiden: "+rTxt(c.a,c.e)); p.append(el("p","hint","Wer soll ausweichen? Die Person bekommt eine Nachricht mit neuer Frist."));
    c.order.filter(u=>still.has(u)).forEach(u=>{ const i=mIdx(u); const r=el("div","trow"); if(i>=0) r.append(mMark(d.mem[i],i)); const nm=i>=0?d.mem[i].name:"?"; r.append(el("b","grow",nm+(memKids(u)?" · Kinder":"")+((c.answers||{})[u]==="nein"?" · möchte behalten":"")));
      const b=el("button","btn","muss ausweichen"); b.type="button"; b.onclick=()=>confDecide(c,u).then(()=>{ closeSheet(); toast(nm+" wird benachrichtigt."); renderTeam(); }).catch(e=>toast(tErrMsg(e))); r.append(b); p.append(r); });
    const rl=el("button","btn pri","Regel anwenden (wer zuerst eingetragen hat, behält)"); rl.type="button"; rl.onclick=()=>confRule(c,true).then(()=>{ closeSheet(); toast("Entschieden – die Betroffenen werden benachrichtigt."); renderTeam(); }).catch(e=>toast(tErrMsg(e))); p.append(rl);
    if(c.ferien) p.append(el("p","hint","Schulferien: Kollegen mit Kindern stehen in der Reihenfolge hinten.")); }); }
const confOpen=()=>(TEAM.data.conf||[]).filter(c=>c.status!=="solved").length;
async function teamRelease(){ const d=TEAM.data; const at=Date.now(); await tPut(TP(),{released:{at,by:TEAM.s.uid}}); d.team.released={at,by:TEAM.s.uid};
  await notify({type:"freigabe",to:[],title:"Team-Kalender freigegeben",text:"Alle Überschneidungen sind geklärt. Den Team-Kalender gibt es jetzt als PDF."}); toast("Freigegeben – alle werden benachrichtigt."); renderTeam(); }

/* ---------- Team-PDF (gleiches PDF-Modul wie privat: Inhaltsverzeichnis + Monatsseiten zum Antippen) ---------- */
async function pdfTeam(y){ const d=TEAM.data, P=makePDF(true), M=28, mx=tMax(), RED=[0.78,0.12,0.1];
  const MONF=["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
  const ab=(m,i)=>m.showName||m.id===TEAM.s.uid?mInit(m):["K","R","H","W"][mShape(m,i)];
  const mark=(m,i,x,yy,sz)=>{ const c=hexRGB(mCol(m,i)); P.rect(x,yy,sz,sz-2,c); P.text(x+sz/2,yy+sz-5,ab(m,i),sz*0.5,true,isDark(mCol(m,i))?INK:[1,1,1],"center"); };
  const yearMap=teamAwayMap(y+"-01-01",y+"-12-31");
  P.page(); P.rect(0,0,P.W,5,ACC); P.text(M,38,"Team-Kalender "+y+" · "+d.team.name,20,true,INK);
  P.text(M,56,"Höchstens "+(mx>=999?"unbegrenzt":mx)+" gleichzeitig im Urlaub · "+(d.team.released?"freigegeben am "+fmt(iso(new Date(d.team.released.at))):"noch nicht freigegeben")+" · Stand "+fmt(TODAY()),9,false,GREY);
  let yy=90; P.text(M,yy,"LEGENDE",11,true,INK); yy+=8;
  d.mem.forEach((m,i)=>{ yy+=20; if(yy>P.H-40) return; mark(m,i,M,yy-13,16); let n=0; yearMap.forEach(st=>{ if(st.has(m.id)) n++; }); P.text(M+24,yy,mLabel(m,i)+(m.showName||m.id===TEAM.s.uid?"":" ("+SHAPE_N[mShape(m,i)]+")"),10,true,INK); P.text(M+300,yy,n+" Urlaubstage "+y,10,false,GREY); });
  yy+=22; if(mx<999) P.text(M,yy,"Rot umrandet = mehr als "+mx+" gleichzeitig.",9,false,RED);
  { const x0=P.W/2+20; let ty=90; P.text(x0,ty,"INHALT (antippen)",11,true,INK); MONF.forEach((mn,k)=>{ const cx=x0+(k>5?170:0), cy=ty+24+(k%6)*22; P.text(cx,cy,"› "+mn+" "+y,11,true,ACC); P.link(cx,cy-12,150,17,k+1); }); }
  P.text(M,P.H-16,"Schicht & Urlaub · Team · Namen nur mit Einverständnis",7.5,false,GREY);
  for(let m=0;m<12;m++){ P.page(); P.rect(0,0,P.W,5,ACC); P.text(M,34,MONF[m]+" "+y,18,true,INK); P.text(M+tw(MONF[m]+" "+y,18,true)+12,34,d.team.name,11,false,GREY);
    P.text(P.W-M,34,"‹ Inhalt",11,true,ACC,"right"); P.link(P.W-M-70,20,70,18,0);
    const f=y+"-"+pad(m+1)+"-01", off=(parse(f).getDay()+6)%7, dim=new Date(y,m+1,0).getDate(), rows=Math.ceil((off+dim)/7), top=50, cw=(P.W-2*M)/7, hh=16, ch=(P.H-top-hh-40)/rows;
    WDS.forEach((w,k)=>{ P.rect(M+k*cw,top,cw,hh,INK); P.text(M+k*cw+cw/2,top+11.5,w,9,true,[1,1,1],"center"); });
    const mp=teamAwayMap(f,lastOfMonth(f));
    for(let dd=1;dd<=dim;dd++){ const s=y+"-"+pad(m+1)+"-"+pad(dd), k=off+dd-1, x=M+(k%7)*cw, y0=top+hh+Math.floor(k/7)*ch, w=parse(s).getDay(), st=mp.get(s), over=st&&st.size>mx;
      P.rect(x,y0,cw,ch,holName(s)?[1,0.93,0.72]:(w===0||w===6)?[0.935,0.945,0.955]:null,RULE,0.5);
      P.text(x+5,y0+12,String(dd),10,true,INK); if(holName(s)) P.text(x+20,y0+12,holName(s).slice(0,18),6.5,false,[0.6,0.33,0]);
      if(st){ let n=0; const per=Math.max(1,Math.floor((cw-8)/17)); d.mem.forEach((mm,i)=>{ if(!st.has(mm.id)) return; const r=Math.floor(n/per), cpos=n%per; if(y0+18+r*16+14<y0+ch) mark(mm,i,x+4+cpos*17,y0+18+r*16,15); n++; }); }
      if(over) P.rect(x+1,y0+1,cw-2,ch-2,null,RED,2); }
    P.text(M,P.H-16,"Legende auf Seite 1 · Rot umrandet = zu viele gleichzeitig",7.5,false,GREY); }
  await pdfSave(P.build(),"Team_"+String(d.team.name).replace(/[^\wäöüÄÖÜß-]+/g,"_")+"_"+y+".pdf"); }

/* ---------- Zentrales Benachrichtigungssystem ----------
   Ein Kanal für alles: Konfliktanfragen, automatische und manuelle Erinnerungen, finale Freigabe.
   Ohne Server erscheinen sie im Posteingang der App (mit Dringlichkeit bis zur Frist). */
async function notify(n){ const ref=tRef(); if(!ref||!TEAM.s) return; const id=Date.now().toString(36)+uid();
  const rec={type:n.type||"info", to:n.to||[], title:n.title||"", text:n.text||"", due:n.due||null, range:n.range||null, from:TEAM.s.uid, created:Date.now()};
  try{ await tPut(TP()+"/notes/"+id,rec); if(TEAM.data) TEAM.data.notes.unshift({...rec,id}); }catch(e){} }
function tReadSet(){ try{ return new Set(JSON.parse(lsGet("su_tread")||"[]")); }catch(e){ return new Set(); } }
function myNotes(){ const d=TEAM.data; if(!d) return []; return d.notes.filter(n=>!n.to||!n.to.length||n.to.includes(TEAM.s.uid)); }
function teamUnread(){ const r=tReadSet(); return myNotes().filter(n=>!r.has(n.id)).length; }
function markRead(ids){ const r=tReadSet(); ids.forEach(i=>r.add(i)); lsSet("su_tread",JSON.stringify([...r].slice(-500))); }
function dueTxt(t){ if(!t) return ""; const ms=t-Date.now(); if(ms<=0) return "Frist abgelaufen"; const d=Math.floor(ms/86400000), h=Math.floor(ms%86400000/3600000); return "noch "+(d?d+(d===1?" Tag ":" Tage "):"")+h+" Std."; }
const NTYPE={konflikt:["⚠️","Konflikt"],erinnerung:["🔔","Erinnerung"],freigabe:["✅","Freigabe"],info:["ℹ️","Info"]};

/* ---------- Team erstellen / beitreten ---------- */
async function teamCreate(name,maxAway){ const id=Date.now().toString(36)+uid(), code=uid()+uid();
  await tPut("/teams/"+id,{name,maxAway:+maxAway||0,invite:code,requireApproval:false,createdBy:TEAM.s.uid,created:Date.now()});
  tRefSet({id,code,name});
  await tPut("/teams/"+id+"/members/"+TEAM.s.uid,{name:S.name||TEAM.s.email.split("@")[0],color:TCOL[0],shape:0,role:"admin",status:"active",kids:consentGet("hasKids"),showName:consentGet("showName"),invite:code,joined:Date.now()});
  await tPut("/teams/"+id+"/invites/"+code,{name,approval:false,created:Date.now()});
  consentSet("teamJoin",true); TEAM.synced=false; await teamLoad(); }
function inviteLink(){ const r=tRef(), c=(TEAM.data&&TEAM.data.team&&TEAM.data.team.invite)||r.code; return APP_URL+"#join="+r.id+"."+c; }
function parseJoin(t){ const m=String(t||"").match(/#?join=([a-z0-9]+)\.([a-z0-9]+)/i)||String(t||"").match(/^([a-z0-9]+)\.([a-z0-9]+)$/i); return m?{id:m[1],code:m[2]}:null; }
/* Beitritt: Einladungscode muss gültig sein (gesperrter Link = ungültig), gesperrte Personen werden von den Regeln abgewiesen */
async function teamJoin(j,name,kids,showName){ let inv=null; try{ inv=await tfs("/teams/"+j.id+"/invites/"+j.code); }catch(e){ if(!/PERMISSION/.test(String(e.code))) throw e; }
  if(!inv) throw Object.assign(new Error("Dieser Einladungslink ist nicht mehr gültig. Bitte frag den Admin nach dem neuen Link."),{code:"BADCODE"});
  const I=tDoc(inv), h=[...TEAM.s.uid].reduce((a,c)=>a+c.charCodeAt(0),0);
  consentSet("teamJoin",true); consentSet("hasKids",kids); consentSet("showName",showName);
  try{ await tPut("/teams/"+j.id+"/members/"+TEAM.s.uid,{name,color:TCOL[h%TCOL.length],shape:h%4,role:"member",status:I.approval?"pending":"active",kids,showName,invite:j.code,joined:Date.now()}); }
  catch(e){ if(/PERMISSION/.test(String(e.code))) throw Object.assign(new Error("Beitritt nicht möglich – du bist für dieses Team gesperrt oder der Link wurde gesperrt."),{code:"BANNED"}); throw e; }
  tRefSet({id:j.id,code:j.code,name:I.name}); TEAM.synced=false; await teamLoad(); return !!I.approval; }
async function teamLeaveNow(){ try{ for(const x of myEntries()) await tDel(TP()+"/entries/"+x.id).catch(()=>{}); await tDel(TP()+"/members/"+TEAM.s.uid); }catch(e){ toast(tErrMsg(e)); return; }
  tSentSet([]); tRefSet(null); TEAM.data=null; toast("Du hast das Team verlassen. Dein privater Planer bleibt unverändert."); render(); }
/* Verlassen: der einzige Admin muss vorher einen anderen Admin ernennen oder das Team löschen */
function teamLeaveAsk(){ const d=TEAM.data; if(d&&!d.pending&&isTAdmin()){ const others=d.mem.filter(m=>m.id!==TEAM.s.uid&&m.status!=="pending"), adms=d.mem.filter(isAdmM);
    if(adms.length<=1&&others.length){ ask("Du bist der einzige Admin","Ernenne zuerst ein anderes Mitglied zum Admin – oder lösche das Team.",[{label:"Admin ernennen",pri:true,fn:openTeamAdmin},{label:"Team löschen",fn:teamDeleteAsk},{label:"Abbrechen"}]); return; }
    if(adms.length<=1){ teamDeleteAsk(); return; } }
  ask(d&&d.pending?"Anfrage zurückziehen?":"Team verlassen?","Deine freigegebenen Daten werden aus dem Team gelöscht. Dein privater Planer bleibt unverändert.",[{label:d&&d.pending?"Ja, zurückziehen":"Ja, verlassen",pri:true,fn:teamLeaveNow},{label:"Abbrechen"}]); }
const teamLeave=teamLeaveNow;
function teamDeleteAsk(){ ask("Team löschen?","Das Team, alle Mitgliedschaften, Freigaben und Vorschläge werden gelöscht. Die privaten Planer aller Mitglieder bleiben unverändert.",[{label:"Ja, Team löschen",pri:true,fn:teamDelete},{label:"Abbrechen"}]); }
async function teamDelete(){ const d=TEAM.data; try{ for(const x of d.ent) await tDel(TP()+"/entries/"+x.id); for(const x of d.props) await tDel(TP()+"/proposals/"+x.id); for(const x of d.bans) await tDel(TP()+"/bans/"+x.id);
    if(d.team.invite) await tDel(TP()+"/invites/"+d.team.invite).catch(()=>{}); for(const m of d.mem) if(m.id!==TEAM.s.uid) await tDel(TP()+"/members/"+m.id); await tDel(TP()); await tDel(TP()+"/members/"+TEAM.s.uid); }
  catch(e){ toast(tErrMsg(e)); return; } closeSheet(); tSentSet([]); tRefSet(null); TEAM.data=null; toast("Team gelöscht. Dein privater Planer bleibt unverändert."); render(); }
/* Entfernen (optional mit Sperre): Mitgliedschaft und freigegebene Urlaube weg, offene Vorschläge zurückgezogen */
async function teamRemove(m,ban){ const d=TEAM.data; try{ for(const x of d.ent.filter(x=>x.uid===m.id)) await tDel(TP()+"/entries/"+x.id);
    for(const x of d.props.filter(x=>x.uid===m.id&&x.status==="open")) await tPut(TP()+"/proposals/"+x.id,{status:"withdrawn",updated:Date.now()});
    if(ban) await tPut(TP()+"/bans/"+m.id,{name:m.name||"",at:Date.now(),by:TEAM.s.uid});
    await tDel(TP()+"/members/"+m.id); toast((m.name||"Mitglied")+(ban?" wurde entfernt und gesperrt.":" wurde aus dem Team entfernt.")); await teamLoad(); }catch(e){ toast(tErrMsg(e)); } }
async function teamUnban(b){ try{ await tDel(TP()+"/bans/"+b.id); toast("Sperre für "+(b.name||"Mitglied")+" aufgehoben."); await teamLoad(); }catch(e){ toast(tErrMsg(e)); } }
/* Einladungslink sperren und neu erzeugen: alter Code wird gelöscht und ist damit ungültig */
async function teamNewInvite(){ const d=TEAM.data, old=d.team.invite, code=uid()+uid();
  await tPut(TP()+"/invites/"+code,{name:d.team.name,approval:!!d.team.requireApproval,created:Date.now()}); await tPut(TP(),{invite:code}); if(old) await tDel(TP()+"/invites/"+old).catch(()=>{});
  d.team.invite=code; tRefSet(Object.assign({},tRef(),{code})); }
async function teamSetApproval(on){ const d=TEAM.data; await tPut(TP(),{requireApproval:!!on}); if(d.team.invite) await tPut(TP()+"/invites/"+d.team.invite,{approval:!!on}); d.team.requireApproval=!!on; }
async function teamSetRole(m,role){ const d=TEAM.data; if(role==="member"&&isAdmM(m)&&d.mem.filter(isAdmM).length<=1){ toast("Es muss mindestens ein Admin im Team bleiben."); return; }
  try{ await tPut(TP()+"/members/"+m.id,{role,depth:role==="member"?null:0,deputyOf:null}); toast(role==="member"?(m.name||"Mitglied")+" ist kein Admin mehr.":(m.name||"Mitglied")+" ist jetzt Admin."); await teamLoad(); }catch(e){ toast(tErrMsg(e)); } }
async function teamApprove(m,ok){ try{ if(ok) await tPut(TP()+"/members/"+m.id,{status:"active"}); else await tDel(TP()+"/members/"+m.id); toast(ok?(m.name||"Mitglied")+" ist jetzt im Team.":"Beitritt abgelehnt."); await teamLoad(); }catch(e){ toast(tErrMsg(e)); } }
/* ---------- Änderungsvorschläge ----------
   teams/{t}/proposals/{id} = {uid, vacId, entryId, name, curA, curE, propA, propE, reason, status: open|accepted|declined|withdrawn, by, created, updated}
   Der Admin ändert nie direkt. Erst wenn der Nutzer zustimmt, ändert sein eigenes Gerät den Urlaub. */
async function propCreate(u,E,propA,propE,reason){ const id=Date.now().toString(36)+uid(), i=mIdx(u), m=TEAM.data.mem[i]||{};
  const rec={uid:u,vacId:E.id.slice(E.id.indexOf("_")+1),entryId:E.id,name:m.name||"",curA:E.a,curE:E.e,propA,propE,reason,status:"open",by:TEAM.s.uid,created:Date.now(),updated:Date.now()};
  await tPut(TP()+"/proposals/"+id,rec); TEAM.data.props.unshift(Object.assign({id},rec)); }
async function propSet(pr,status){ await tPut(TP()+"/proposals/"+pr.id,{status,updated:Date.now()}); pr.status=status; pr.updated=Date.now(); }
function propCalc(pr,v){ const keep=S.vacs; S.vacs=vacList().filter(x=>x.id!==v.id); const r=vacCount(pr.propA,pr.propE); S.vacs=keep; r.over=vacOver(r.days,v.id); return r; }
async function propAccept(pr){ const v=vacList().find(x=>x.id===pr.vacId); if(!v){ toast("Diesen Urlaub gibt es in deinem Planer nicht mehr. Du kannst den Vorschlag ablehnen."); return; }
  const r=propCalc(pr,v); if(!r.n){ toast("Im vorgeschlagenen Zeitraum hast du sowieso frei – das passt nicht. Bitte ablehnen."); return; } if(r.over.length){ toast(quotaMsg(r.over)); return; }
  const old=JSON.parse(JSON.stringify(vacList())); v.a=pr.propA; v.e=pr.propE; if(v.fixed||r.as) v.fixed=r.days.slice(); normVacs(); save();
  try{ await propSet(pr,"accepted"); }catch(e){ S.vacs=old; save(); render(); toast(tErrMsg(e)); return; }
  await teamSync(true); render(); const y=+pr.propA.slice(0,4); toast("Urlaub geändert auf "+plRange(pr.propA,pr.propE)+" · noch "+vacRest(y)+" Tage übrig"); }
async function propDecline(pr){ try{ await propSet(pr,"declined"); toast("Abgelehnt – dein Urlaub bleibt, wie er ist."); renderTeam(); }catch(e){ toast(tErrMsg(e)); } }
function openPropose(u,k){ const d=TEAM.data, E=d.ent.filter(x=>x.uid===u&&x.a<=k.e&&x.e>=k.a)[0]; if(!E){ toast("Für dieses Mitglied ist dort kein freigegebener Urlaub."); return; } const i=mIdx(u), nm=i>=0?mLabel(d.mem[i],i,true):"Mitglied", lim=tLimit();
  openSheet(p=>{ sheetTop(p,"Änderung vorschlagen"); p.dataset.sheet="propose";
    p.append(el("p","hint","Du änderst den Urlaub nicht selbst. "+nm+" bekommt deinen Vorschlag und entscheidet."), el("p","tpcur","Aktueller Urlaub von "+nm+": "+plRange(E.a,E.e)+" ("+E.days+(E.days===1?" Urlaubstag":" Urlaubstage")+")"));
    const len=diffD(E.a,E.e), a0=addD(k.e,1), two=el("div","two"), la=el("label","f","Neuer Beginn"), lb=el("label","f","Neues Ende"), ia=el("input"), ib=el("input"); ia.type=ib.type="date"; ia.id="tp_from"; ib.id="tp_to"; ia.value=a0; ib.value=addD(a0,len); la.append(ia); lb.append(ib); two.append(la,lb);
    const lr=el("label","f","Grund"), ir=el("textarea"); ir.id="tp_reason"; ir.rows=2; ir.value="Zu viele Überschneidungen am "+plRange(k.a,k.e)+(lim?" (erlaubt: "+lim+" gleichzeitig)":""); lr.append(ir);
    const info=el("p","hint"); const upd=()=>{ info.textContent=ia.value&&ib.value&&ib.value>=ia.value?"Vorschlag: "+plRange(ia.value,ib.value)+" · "+(diffD(ia.value,ib.value)+1)+" Kalendertage. Die Urlaubstage berechnet die App von "+nm+" selbst (freie Tage und Feiertage zählen nicht).":"Bitte Beginn und Ende wählen."; };
    ia.oninput=()=>{ if(ib.value<ia.value) ib.value=ia.value; upd(); }; ib.oninput=upd; upd();
    const go=el("button","btn pri uwide","Vorschlag senden"); go.type="button"; go.onclick=async()=>{ const a=ia.value, e=ib.value; if(!a||!e||e<a){ toast("Bitte Beginn und Ende wählen."); return; } if(a===E.a&&e===E.e){ toast("Das ist derselbe Zeitraum wie jetzt."); return; }
      go.disabled=true; try{ await propCreate(u,E,a,e,ir.value.trim().slice(0,200)||"Zu viele Überschneidungen"); closeSheet(); toast("Vorschlag an "+nm+" gesendet."); renderTeam(); }catch(err){ toast(tErrMsg(err)); go.disabled=false; } };
    p.append(two,info,lr,go); }); }
const PSTAT={open:["offen","pst-open"],accepted:["angenommen","pst-ok"],declined:["abgelehnt","pst-no"],withdrawn:["zurückgezogen","pst-wd"]};
function pBadge(st){ const [t,c]=PSTAT[st]||PSTAT.open; return el("span","pst "+c,t); }
/* Admin: alle Vorschläge mit Status */
function teamPropCard(box){ const d=TEAM.data; if(!d.props.length) return; const seen=tSeen(), c=el("div","card sec"); c.append(el("h3",null,"Änderungsvorschläge"));
  d.props.slice(0,30).forEach(pr=>{ const r=el("div","tprow"); const tx=el("div","grow"); const isNew=(pr.status==="accepted"||pr.status==="declined")&&(pr.updated||0)>(seen.ans||0);
    tx.append(el("b",null,(pr.name||"Mitglied")+(isNew?" · neu":"")), el("small",null,plRange(pr.curA,pr.curE)+" → "+plRange(pr.propA,pr.propE)), el("small","muted",pr.reason||"")); r.append(tx,pBadge(pr.status));
    if(pr.status==="open"){ const w=el("button","btn ghost","Zurückziehen"); w.type="button"; w.onclick=async()=>{ try{ await propSet(pr,"withdrawn"); toast("Vorschlag zurückgezogen."); renderTeam(); }catch(e){ toast(tErrMsg(e)); } }; r.append(w); } c.append(r); });
  box.append(c); const mx=Math.max(0,...d.props.map(x=>x.status==="accepted"||x.status==="declined"?x.updated||0:0)); if(mx>(seen.ans||0)){ seen.ans=mx; lsSet("su_tseen",JSON.stringify(seen)); } }
/* Nutzer: Vorschläge für den eigenen Urlaub */
function teamMyProps(box){ const d=TEAM.data, me=TEAM.s.uid, L=d.props.filter(p=>p.uid===me); if(!L.length) return;
  L.filter(p=>p.status==="open").forEach(pr=>{ const c=el("div","card sec tpopen"); c.append(el("h3",null,"🔔 Änderungsvorschlag vom Admin"), el("p","tpreason",pr.reason||""));
    const v=vacList().find(x=>x.id===pr.vacId); const cur=v?vacDaysOf(v).length:null;
    c.append(el("p",null,"Dein Urlaub jetzt: "+plRange(v?v.a:pr.curA,v?v.e:pr.curE)+(cur!=null?" ("+cur+(cur===1?" Urlaubstag)":" Urlaubstage)"):"")));
    let ok=!!v; if(v){ const r=propCalc(pr,v), y=+pr.propA.slice(0,4), keep=S.vacs; S.vacs=vacList().filter(x=>x.id!==v.id); const left=vacRest(y)-r.days.filter(x=>+x.slice(0,4)===y).length; S.vacs=keep;
      c.append(el("p","tpnew","Vorschlag: "+plRange(pr.propA,pr.propE)+" ("+r.n+(r.n===1?" Urlaubstag":" Urlaubstage")+" · danach "+left+" übrig)")); if(r.over.length){ c.append(el("p","ypwarn",quotaMsg(r.over))); ok=false; } if(!r.n){ c.append(el("p","ypwarn","Im vorgeschlagenen Zeitraum hast du sowieso frei.")); ok=false; } }
    else c.append(el("p","ypwarn","Diesen Urlaub gibt es in deinem Planer nicht mehr."));
    const row=el("div","row"), y=el("button","btn pri grow","Zustimmen"), n=el("button","btn grow","Ablehnen"); y.type=n.type="button"; y.disabled=!ok; y.onclick=async()=>{ y.disabled=n.disabled=true; await propAccept(pr); renderTeam(); }; n.onclick=()=>propDecline(pr); row.append(y,n); c.append(row); box.append(c); });
  const done=L.filter(p=>p.status!=="open").slice(0,5); if(done.length){ const c=el("div","card sec"); c.append(el("h3",null,"Frühere Vorschläge")); done.forEach(pr=>{ const r=el("div","tprow"); r.append(el("span","grow",plRange(pr.curA,pr.curE)+" → "+plRange(pr.propA,pr.propE)),pBadge(pr.status)); c.append(r); }); box.append(c); } }
/* ---------- Hinweise: in der App + Systembenachrichtigung (wenn erlaubt) ---------- */
function tSeen(){ try{ return JSON.parse(lsGet("su_tseen")||"{}"); }catch(e){ return {}; } }
function teamAttention(){ const d=TEAM.data; if(!d||!TEAM.s||d.pending) return null; const me=TEAM.s.uid, seen=tSeen(), adm=isTAdmin();
  const open=d.props.filter(p=>p.uid===me&&p.status==="open"), ans=adm?d.props.filter(p=>(p.status==="accepted"||p.status==="declined")&&(p.updated||0)>(seen.ans||0)):[], pend=adm?d.mem.filter(m=>m.status==="pending"):[];
  return {open,ans,pend,n:open.length+ans.length+pend.length}; }
function sysNotify(title,body){ try{ if(!("Notification" in window)||Notification.permission!=="granted") return; if(typeof swReg!=="undefined"&&swReg&&swReg.showNotification) swReg.showNotification(title,{body,tag:"team-"+hsh(title+body),icon:"icon-192.png"}); else new Notification(title,{body}); }catch(e){} }
function teamAlerts(){ const a=teamAttention(); if(!a) return; const seen=tSeen(), ids=new Set(seen.ids||[]), msgs=[];
  a.open.forEach(p=>{ if(!ids.has(p.id)){ ids.add(p.id); msgs.push(["Änderungsvorschlag vom Admin",(p.reason||"")+" – Vorschlag: "+plRange(p.propA,p.propE)]); } });
  a.ans.forEach(p=>{ const k=p.id+":"+p.status; if(!ids.has(k)){ ids.add(k); msgs.push([p.status==="accepted"?"Vorschlag angenommen":"Vorschlag abgelehnt",(p.name||"Mitglied")+": "+plRange(p.propA,p.propE)]); } });
  a.pend.forEach(m=>{ const k="p:"+m.id; if(!ids.has(k)){ ids.add(k); msgs.push(["Beitritt bestätigen",(m.name||"Jemand")+" möchte ins Team."]); } });
  seen.ids=[...ids].slice(-300); lsSet("su_tseen",JSON.stringify(seen)); msgs.forEach(([t,b])=>sysNotify(t,b)); }
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible"&&typeof tRef==="function"&&tRef()&&TEAM.s&&Date.now()-(TEAM.last||0)>60000) teamLoad(); });
/* Einverständnis geändert → Mitglied-Eintrag und Team-Kopie anpassen */
{ const _cs=consentSet; consentSet=function(k,v){ _cs(k,v); const d=TEAM.data; if(!d||!TEAM.s) return;
  if(k==="showName"||k==="hasKids"){ const f=k==="showName"?"showName":"kids"; tPut(TP()+"/members/"+TEAM.s.uid,{[f]:!!v}).then(()=>{ d.me[f]=!!v; }).catch(()=>{}); }
  teamSyncSoon(); }; }
/* Jede Speicherung → Team-Kopie bei Bedarf abgleichen (mit Verzögerung) */
{ const _sv=save; save=function(){ const r=_sv.apply(this,arguments); try{ teamSyncSoon(); }catch(e){} return r; }; }

/* ---------- Ansicht ---------- */
function renderTeam(){ const box=$("#v-team"); if(!box) return; box.innerHTML="";
  if(!TEAM.s){ return teamLoginCard(box); }
  const pend=sessionStorage.getItem("su_join"); if(pend && !TEAM.data){ return teamJoinCard(box,parseJoin(pend)); }
  if(!tRef()){ return teamStartCards(box); }
  if(!TEAM.data){ const c=el("div","card"); c.append(el("p",null,TEAM.err||"Lade dein Team …")); if(TEAM.err){ const b=el("button","btn","Nochmal versuchen"); b.type="button"; b.onclick=teamLoad; c.append(b); } box.append(c); if(!TEAM.loading&&!TEAM.err) teamLoad(); return; }
  const d=TEAM.data, adm=isTAdmin(), rr=el("div","row"), lv=el("button","linkbtn",d.pending?"Anfrage zurückziehen":"Team verlassen"), lo=el("button","linkbtn","Abmelden"); lv.type=lo.type="button"; lv.onclick=teamLeaveAsk; lo.onclick=tLogout; rr.append(lv,lo);
  const h=el("div","card sec"); const hr=el("div","row"); hr.append(el("h2","grow",d.team.name)); const rl=el("button","btn",TEAM.loading?"…":"↻"); rl.type="button"; rl.setAttribute("aria-label","Aktualisieren"); rl.onclick=teamLoad; hr.append(rl); h.append(hr);
  if(d.pending){ h.append(el("div","banner","⏳ Deine Anfrage wartet auf Bestätigung durch den Admin. Bis dahin siehst du nur deinen privaten Bereich.")); box.append(h); teamShareCard(box); box.append(rr); return; }
  h.append(el("p","muted",(adm?d.mem.filter(m=>m.status!=="pending").length+" Mitglieder · "+(tLimit()?"höchstens "+tLimit()+" gleichzeitig":"keine Grenze")+" · ":"")+"du bist "+(adm?"Admin":"Mitglied")));
  if(TEAM.err) h.append(el("div","banner bad",TEAM.err));
  if(adm){ const r2=el("div","row"); const iv=el("button","btn pri grow","➕ Einladen"); iv.type="button"; iv.onclick=openTeamInvite; const am=el("button","btn grow","⚙ Verwalten"); am.type="button"; am.onclick=openTeamAdmin; r2.append(iv,am); h.append(r2);
    const np=d.mem.filter(m=>m.status==="pending").length; if(np){ const b=el("button","banner tip tpend"); b.type="button"; b.textContent="👤 "+np+(np===1?" Person wartet":" Personen warten")+" auf Bestätigung – antippen"; b.onclick=openTeamAdmin; h.append(b); } }
  box.append(h);
  teamMyProps(box); teamShareCard(box);
  if(adm){ teamAdminOverview(box); teamPropCard(box); } else box.append(el("p","hint tpriv","🔒 Die Urlaube der anderen siehst du nicht – das kann nur der Admin, und nur bei denen, die freigegeben haben."));
  if("Notification" in window && Notification.permission==="default"){ const nb=el("button","btn ghost uwide","🔔 Benachrichtigungen erlauben"); nb.type="button"; nb.onclick=()=>Notification.requestPermission().then(()=>renderTeam()); box.append(nb); }
  box.append(rr); }
/* Eigene Freigabe: Standard aus */
function teamShareCard(box){ const on=consentGet("adminShare"), c=el("div","card sec tshare"+(on?" on":"")); c.append(el("h3",null,"Meine Freigabe"));
  const l=el("label","sw tsw"), cb=el("input"); cb.type="checkbox"; cb.id="t_share"; cb.checked=on; l.append(cb, el("span",null,"Meinen Urlaub für den Admin freigeben")); c.append(l);
  const mine=myTeamEntriesPreview(); c.append(el("p","hint",on?(mine.n?"Der Admin sieht "+mine.n+(mine.n===1?" Urlaub":" Urlaube")+" ("+mine.days+" Tage): nur von–bis und Anzahl Tage. Andere Mitglieder sehen nichts.":"Freigegeben – sobald du Urlaub einträgst, sieht ihn der Admin."):"Aus: Nur du siehst deinen Urlaub. Es wird nichts übertragen."));
  cb.onchange=()=>{ consentSet("adminShare",cb.checked); toast(cb.checked?"Dein Urlaub ist jetzt für den Admin freigegeben.":"Freigabe beendet – dein Urlaub wurde aus dem Team gelöscht."); teamSync(false).then(()=>renderTeam()); renderTeam(); };
  box.append(c); }
function myTeamEntriesPreview(){ let n=0, days=0; vacList().forEach(v=>{ if(!shareVacGet(v.id)) return; const k=vacDaysOf(v).length; if(k){ n++; days+=k; } }); return {n,days}; }
/* Überschneidungen: Tage, an denen mindestens 2 Mitglieder Urlaub haben (Wochenenden zählen nicht) */
function teamOverlaps(a,e){ const out=[], m=teamAwayMap(a,e); [...m.keys()].sort().forEach(s=>{ const st=m.get(s); if(st.size<2) return; const who=[...st].sort().join("|"), L=out[out.length-1];
  const gapWe=L&&diffD(L.e,s)<=3&&[...Array(Math.max(0,diffD(L.e,s)-1))].every((_,i)=>{ const w=parse(addD(L.e,i+1)).getDay(); return w===0||w===6; });
  if(L&&L.who===who&&(L.e===addD(s,-1)||gapWe)){ L.e=s; L.days++; } else out.push({a:s,e:s,who,uids:[...st],n:st.size,days:1}); }); return out; }
function teamAdminOverview(box){ const d=TEAM.data, t=TODAY(), lim=tLimit(); if(!TEAM.m){ TEAM.m={y:+t.slice(0,4),m:+t.slice(5,7)-1}; } const {y,m}=TEAM.m;
  const nm=u=>{ const i=mIdx(u); return i>=0?mLabel(d.mem[i],i,true):"ehemaliges Mitglied"; }, isConf=n=>lim?n>lim:false;
  /* 1) Wer hat freigegeben? */
  const c0=el("div","card sec"); c0.append(el("h3",null,"Freigaben im Team"));
  d.mem.filter(mm=>mm.status!=="pending").forEach(mm=>{ const i=mIdx(mm.id), E=d.ent.filter(x=>x.uid===mm.id), r=el("div","trow"); r.append(mMark(mm,i), el("b","grow",mLabel(mm,i,true)));
    r.append(el("small",E.length?"tok":"muted",E.length?E.length+(E.length===1?" Urlaub":" Urlaube")+" · "+E.reduce((s2,x)=>s2+(+x.days||0),0)+" Tage":"keine Freigabe")); c0.append(r); });
  c0.append(el("p","hint","Du siehst nur Urlaube von Mitgliedern, die ihn freigegeben haben.")); box.append(c0);
  /* 2) Monatskalender: Konflikt = mehr als erlaubt gleichzeitig */
  const c=el("div","card sec tcal tov"); const go=k=>{ TEAM.m.m+=k; if(TEAM.m.m<0){ TEAM.m.m=11; TEAM.m.y--; } if(TEAM.m.m>11){ TEAM.m.m=0; TEAM.m.y++; } renderTeam(); };
  const nav=el("div","tovnav"), pv=el("button","ypa5","‹"), nx=el("button","ypa5","›"); pv.type=nx.type="button"; pv.setAttribute("aria-label","Voriger Monat"); nx.setAttribute("aria-label","Nächster Monat"); pv.onclick=()=>go(-1); nx.onclick=()=>go(1);
  nav.append(pv, el("h3","grow",MONF_[m]+" "+y), nx); c.append(nav);
  const f=y+"-"+pad(m+1)+"-01", l=lastOfMonth(f), mp=teamAwayMap(f,l), g=el("div","tovgrid"); ["Mo","Di","Mi","Do","Fr","Sa","So"].forEach(w=>g.append(el("span","tovwd",w)));
  for(let i=0;i<(parse(f).getDay()+6)%7;i++) g.append(el("span","tove"));
  for(let s2=f;s2<=l;s2=addD(s2,1)){ const st=mp.get(s2), n=st?st.size:0, cf=isConf(n), b=el("button","tovd"+(cf?" o3":n>=2?" o2":n===1?" o1":"")+(s2===t?" now":"")+(holName(s2)?" ho":"")); b.type="button"; b.append(el("b",null,String(parse(s2).getDate())));
    const mk=el("span","tovmk"); if(st) d.mem.forEach((mm,i)=>{ if(st.has(mm.id)){ const dot=el("i"); dot.style.background=mCol(mm,i); mk.append(dot); } }); b.append(mk); if(cf) b.append(el("small","tovn","Konflikt")); else if(n>=2) b.append(el("small","tovn",n+"×"));
    b.setAttribute("aria-label",fmt(s2)+": "+(n?n+" im Urlaub":"niemand im Urlaub")+(cf?", Konflikt":"")); b.onclick=()=>teamDayPopup(s2); g.append(b); }
  swipeMonths(g,go); c.append(g);
  const lg=el("div","tovleg"); (lim?[["o1","1 Person"],["o2","gleichzeitig, erlaubt"],["o3","Konflikt: mehr als "+lim]]:[["o1","1 Person"],["o2","Überschneidung"]]).forEach(([k,tx])=>{ const sp=el("span"); sp.append(el("i","tovsw "+k),document.createTextNode(tx)); lg.append(sp); }); c.append(lg);
  if(!lim) c.append(el("p","hint","Tipp: Unter „Verwalten“ festlegen, wie viele gleichzeitig Urlaub haben dürfen – dann werden Konflikte rot markiert."));
  const ml=el("div","tlegend"); d.mem.forEach((mm,i)=>{ if(!d.ent.some(x=>x.uid===mm.id)) return; const sp=el("span"); const dot=el("i","tovdot"); dot.style.background=mCol(mm,i); sp.append(dot, document.createTextNode(" "+mLabel(mm,i,true))); ml.append(sp); }); c.append(ml);
  box.append(c);
  /* 3) Konflikte mit betroffenen Mitgliedern + Vorschlag; danach erlaubte Überschneidungen */
  const ov=teamOverlaps(t,addD(t,365)), cf=ov.filter(k=>isConf(k.n)), ok=ov.filter(k=>!isConf(k.n));
  if(lim){ const c1=el("div","card sec tconf"); c1.append(el("h3",null,"Konflikte (mehr als "+lim+" gleichzeitig)"));
    if(!cf.length) c1.append(el("p","muted","Keine Konflikte in den nächsten 12 Monaten."));
    cf.slice(0,40).forEach(k=>{ const r=el("div","tovrow o3"); const tx=el("div","grow"); tx.append(el("b",null,plRange(k.a,k.e)+" · "+k.n+" gleichzeitig"), el("small",null,"erlaubt: "+lim+" · "+k.days+(k.days===1?" Arbeitstag":" Arbeitstage"))); r.append(tx);
      const who=el("div","tconfwho"); k.uids.forEach(u=>{ const w=el("div","tconfm"), pr=d.props.find(p=>p.uid===u&&p.curA<=k.e&&p.curE>=k.a&&p.status!=="withdrawn"); w.append(el("span","grow",nm(u)));
        if(pr) w.append(pBadge(pr.status)); if(!pr||pr.status!=="open"){ if(u!==TEAM.s.uid){ const b=el("button","btn tpbtn","Änderung vorschlagen"); b.type="button"; b.onclick=()=>openPropose(u,k); w.append(b); } } who.append(w); }); r.append(who); c1.append(r); });
    box.append(c1); }
  if(ok.length){ const c2=el("div","card sec"); c2.append(el("h3",null,lim?"Überschneidungen (erlaubt)":"Überschneidungen (nächste 12 Monate)"));
    ok.slice(0,40).forEach(k=>{ const r=el("button","tovrow"); r.type="button"; const tx=el("span","grow"); tx.append(el("b",null,plRange(k.a,k.e)), el("small",null,k.uids.map(nm).join(", ")+" · "+k.days+(k.days===1?" Arbeitstag":" Arbeitstage"))); r.append(tx, el("span","tovcnt",k.n+"×"));
      r.onclick=()=>{ TEAM.m={y:+k.a.slice(0,4),m:+k.a.slice(5,7)-1}; renderTeam(); }; c2.append(r); }); box.append(c2); } }

function teamInbox(box){ const L=myNotes(); if(!L.length) return; const rd=tReadSet(), c=el("div","card sec"); const un=L.filter(n=>!rd.has(n.id)).length;
  c.append(el("h3",null,"📬 Nachrichten"+(un?" ("+un+" neu)":"")));
  L.slice(0,8).forEach(n=>{ const r=el("div","tnote"+(rd.has(n.id)?"":" new")); const [ic,lab]=NTYPE[n.type]||NTYPE.info; const t=el("div","grow"); t.append(el("b",null,ic+" "+n.title), el("small",null,n.text));
    if(n.due){ const left=n.due-Date.now(), u=el("span","turg"+(left<86400000?" hi":left<3*86400000?" mid":""),"⏳ "+dueTxt(n.due)); t.append(u); }
    r.append(t); if(n.range){ const g=el("button","btn","Ansehen"); g.type="button"; g.onclick=()=>{ TEAM.m={y:+n.range[0].slice(0,4),m:+n.range[0].slice(5,7)-1}; renderTeam(); }; r.append(g); } c.append(r); });
  if(un){ const ok=el("button","btn ghost","Alle als gelesen markieren"); ok.type="button"; ok.onclick=()=>{ markRead(L.map(n=>n.id)); renderTeam(); render(); }; c.append(ok); } box.append(c); }

function teamCalendar(box){ const d=TEAM.data; if(!TEAM.m){ const t=TODAY(); TEAM.m={y:+t.slice(0,4),m:+t.slice(5,7)-1}; } const {y,m}=TEAM.m;
  const c=el("div","card sec tcal"); const go=k=>{ TEAM.m.m+=k; if(TEAM.m.m<0){ TEAM.m.m=11; TEAM.m.y--; } if(TEAM.m.m>11){ TEAM.m.m=0; TEAM.m.y++; } renderTeam(); };
  pvHead(c,"Team · "+MON[m]+" "+y,go); const f=y+"-"+pad(m+1)+"-01", l=lastOfMonth(f), mp=teamAwayMap(padBefore(f)[0]||f, padAfter(l).pop()||l), mx=tMax();
  const g=el("div","mcal tgrid"); WDS.forEach(w=>g.append(el("span","dw",w)));
  const cell=(s,out)=>{ const b=el("button","mc tday"+(out?" out":"")); b.type="button"; b.append(el("i",null,String(parse(s).getDate()))); const st=mp.get(s), mk=el("div","tmks");
    if(st){ d.mem.forEach((mm,i)=>{ if(st.has(mm.id)) mk.append(mMark(mm,i,true)); }); if(st.size>mx) b.classList.add("over"); }
    if(holName(s)) b.classList.add("hol"); b.append(mk); b.onclick=()=>teamDayPopup(s); g.append(b); };
  padBefore(f).forEach(s=>cell(s,true)); for(let s=f; s<=l; s=addD(s,1)) cell(s,false); padAfter(l).forEach(s=>cell(s,true));
  swipeMonths(g,go); c.append(g);
  const lg=el("div","tlegend"); d.mem.forEach((mm,i)=>{ const sp=el("span"); sp.append(mMark(mm,i), document.createTextNode(" "+mLabel(mm,i))); lg.append(sp); }); c.append(lg);
  if(mx<999) c.append(el("p","hint","Rot umrandet = mehr als "+mx+" gleichzeitig im Urlaub."));
  if(isTAdmin()||d.team.released){ const pb=el("button","btn grow","📄 Team-Kalender "+y+" als PDF"); pb.type="button"; pb.onclick=()=>pdfTeam(y).catch(()=>toast("PDF hat nicht geklappt.")); c.append(pb); }
  else c.append(el("p","hint","Das Team-PDF gibt es, sobald der Admin den Kalender freigegeben hat."));
  box.append(c); }

function teamDayPopup(s){ const d=TEAM.data, st=teamAwayMap(s,s).get(s)||new Set(), mx=tMax();
  openSheet(p=>{ sheetTop(p,fmt(s)); if(holName(s)) p.append(el("p","muted",holName(s)));
    if(!st.size) p.append(el("p",null,"Niemand aus dem Team hat Urlaub."));
    d.mem.forEach((mm,i)=>{ if(!st.has(mm.id)) return; const r=el("div","trow"); r.append(mMark(mm,i), el("b","grow",mLabel(mm,i,isTAdmin()))); const e=d.ent.find(x=>x.uid===mm.id&&x.a<=s&&x.e>=s); if(e) r.append(el("small","muted",fmtS(e.a)+" – "+fmtS(e.e))); p.append(r); });
    const lim=tLimit(); if(lim&&st.size>lim) p.append(el("div","banner bad","Konflikt: "+st.size+" gleichzeitig – erlaubt sind "+lim+".")); else if(st.size>=2) p.append(el("div","banner",st.size+" gleichzeitig im Urlaub.")); }); }

function teamLoginCard(box){ const c=el("div","card sec"); c.append(el("h2",null,"👥 Team"), el("p","hint","Dein Urlaub bleibt privat. Du kannst ihn freiwillig für den Admin freigeben – der sieht dann, wo sich Urlaube im Team überschneiden."));
  let mode="login"; const f=el("form"); f.style.display="grid"; f.style.gap="10px"; f.setAttribute("data-nodraft","1"); const seg=el("div","seg full"); const em=el("input"), pw=el("input"); em.type="email"; em.placeholder="E-Mail"; em.autocomplete="email"; em.id="t_mail"; em.setAttribute("aria-label","E-Mail");
  pw.type="password"; pw.placeholder="Passwort"; pw.id="t_pw"; pw.autocomplete="current-password"; pw.setAttribute("aria-label","Passwort");
  const msg=el("p","amsg"); msg.setAttribute("role","status"); const go=el("button","btn pri","Anmelden"); go.type="submit"; const fg=el("button","linkbtn tforgot","Passwort vergessen?"); fg.type="button";
  [["login","Anmelden"],["signup","Konto erstellen"]].forEach(([k,l])=>{ const b=el("button",null,l); b.type="button"; b.setAttribute("aria-pressed",String(mode===k)); b.onclick=()=>{ mode=k; seg.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); go.textContent=l; pw.autocomplete=k==="signup"?"new-password":"current-password"; pw.placeholder=k==="signup"?"Passwort (mind. 8 Zeichen)":"Passwort"; fg.hidden=k==="signup"; msg.textContent=""; }; seg.append(b); });
  const okMail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  f.onsubmit=async e=>{ e.preventDefault(); const mail=em.value.trim(), p=pw.value; msg.className="amsg err";
    if(!okMail(mail)){ msg.textContent="Bitte eine gültige E-Mail-Adresse eingeben."; em.focus(); return; }
    if(p.length<(mode==="signup"?8:6)){ msg.textContent=mode==="signup"?"Das Passwort braucht mindestens 8 Zeichen.":"Bitte dein Passwort eingeben."; pw.focus(); return; }
    go.disabled=true; msg.className="amsg"; msg.textContent="Einen Moment …";
    try{ const j=await authCall(mode==="signup"?"signUp":"signInWithPassword",{email:mail,password:p,returnSecureToken:true}); pw.value=""; tsSave(j,mail); renderTeam(); if(tRef()) teamLoad(); }
    catch(err){ pw.value=""; pwHide(pw); msg.className="amsg err"; msg.textContent=tErrMsg(err); go.disabled=false; } };
  /* Passwort vergessen: Firebase schickt einen Link per E-Mail. Neutrale Meldung, damit niemand herausfinden kann, ob es ein Konto gibt. */
  fg.onclick=async()=>{ const mail=em.value.trim(); if(!okMail(mail)){ msg.className="amsg err"; msg.textContent="Trag oben deine E-Mail ein, dann nochmal tippen."; em.focus(); return; }
    fg.disabled=true; try{ await authCall("sendOobCode",{requestType:"PASSWORD_RESET",email:mail}); }catch(err){ if(/NETWORK/.test(String(err&&err.code))){ msg.className="amsg err"; msg.textContent=tErrMsg(err); fg.disabled=false; return; } }
    msg.className="amsg ok"; msg.textContent="Wenn es ein Konto mit dieser E-Mail gibt, kommt gleich eine E-Mail mit einem Link zum Zurücksetzen. Schau auch im Spam-Ordner."; fg.disabled=false; };
  f.append(em,pw,go,fg,msg); c.append(seg,f); box.append(c); pwEye(pw); }

function teamStartCards(box){ const c1=el("div","card sec"); c1.append(el("h2",null,"Team erstellen"), el("p","hint","Du wirst Admin und kannst Kollegen per Link einladen."));
  const n=el("input"); n.type="text"; n.id="tc_name"; n.placeholder="Name des Teams, z. B. Station 3"; const two=el("div","two");
  const lm=el("label","f","Höchstens gleichzeitig im Urlaub"), sm=el("select"); sm.id="tc_max"; [[0,"unbegrenzt"],...[1,2,3,4,5,6,7,8,10,15,20].map(x=>[x,x+(x===1?" Person":" Personen")])].forEach(([v,l])=>{ const o=el("option",null,l); o.value=v; sm.append(o); }); sm.value=2; lm.append(sm);
  two.append(lm);
  const go=el("button","btn pri","Team erstellen"); go.type="button"; go.onclick=async()=>{ const nm=n.value.trim(); if(!nm){ toast("Bitte einen Namen eingeben."); return; } go.disabled=true; try{ await teamCreate(nm,+sm.value||0); openTeamInvite(); }catch(e){ toast(tErrMsg(e)); go.disabled=false; } };
  c1.append(n,two,go); box.append(c1);
  const c2=el("div","card sec"); c2.append(el("h2",null,"Team beitreten"), el("p","hint","Öffne den Einladungslink – oder füge ihn hier ein.")); const li=el("input"); li.type="text"; li.id="tj_link"; li.placeholder="Einladungslink"; const jb=el("button","btn","Weiter"); jb.type="button";
  jb.onclick=()=>{ const j=parseJoin(li.value); if(!j){ toast("Das ist kein gültiger Einladungslink."); return; } sessionStorage.setItem("su_join",j.id+"."+j.code); renderTeam(); }; c2.append(li,jb); box.append(c2);
  const lo=el("button","linkbtn","Abmelden ("+TEAM.s.email+")"); lo.type="button"; lo.onclick=tLogout; box.append(lo); }

function teamJoinCard(box,j){ const c=el("div","card sec"); c.append(el("h2",null,"Team beitreten"));
  if(!j){ sessionStorage.removeItem("su_join"); c.append(el("p",null,"Der Link ist ungültig.")); box.append(c); return; }
  c.append(el("p","hint","Dein Urlaub bleibt privat. Nur wenn du ihn freigibst, sieht ihn der Admin – andere Mitglieder sehen ihn nie."));
  const ln=el("label","f","Dein Name im Team"), ni=el("input"); ni.type="text"; ni.id="tj_name"; ni.value=S.name||""; ln.append(ni);
  const sw=(id,t,on)=>{ const l=el("label","sw"), cb=el("input"); cb.type="checkbox"; cb.id=id; cb.checked=on; l.append(cb,el("span",null,t)); return [l,cb]; };
  const [lk,ck]=sw("tj_kids","Ich habe Kinder (Vorrang in den Schulferien)",consentGet("hasKids")), [ls,cs]=sw("tj_show","Meinen Namen im Team-Kalender zeigen (sonst nur Farbe und Form)",consentGet("showName")), [la,ca]=sw("tj_ok","Meinen Urlaub gleich für den Admin freigeben (kannst du jederzeit ändern)",false);
  const go=el("button","btn pri","Beitreten"); go.type="button"; go.onclick=async()=>{ if(!ni.value.trim()){ toast("Bitte deinen Namen eingeben."); return; } go.disabled=true;
    try{ consentSet("adminShare",ca.checked); const wait=await teamJoin(j,ni.value.trim().slice(0,40),ck.checked,cs.checked); sessionStorage.removeItem("su_join"); toast(wait?"Anfrage gesendet – der Admin muss dich noch bestätigen.":"Willkommen im Team!"); }catch(e){ sessionStorage.removeItem("su_join"); toast(["BADCODE","NOTEAM","BANNED"].includes(e.code)?e.message:tErrMsg(e)); go.disabled=false; renderTeam(); } };
  const no=el("button","btn ghost","Abbrechen"); no.type="button"; no.onclick=()=>{ sessionStorage.removeItem("su_join"); renderTeam(); };
  c.append(ln,lk,ls,la,go,no); box.append(c); }

function openTeamInvite(){ const url=inviteLink(); openSheet(p=>{ sheetTop(p,"Kollegen einladen"); p.append(el("p","hint","Schick diesen Link. Wer beitritt, wird Mitglied und sieht den Team-Kalender."), el("div","applink",url));
  const txt="Komm in unser Team „"+((TEAM.data&&TEAM.data.team.name)||"")+"“ in Schicht & Urlaub: "+url; const r=el("div","row");
  const sh=el("button","btn pri grow","⇪ Link teilen"); sh.type="button"; sh.onclick=async()=>{ if(navigator.share){ try{ await navigator.share({title:"Schicht & Urlaub – Team",text:txt,url}); return; }catch(e){ if(e&&e.name==="AbortError") return; } } try{ await navigator.clipboard.writeText(url); toast("Link kopiert"); }catch(e){} };
  const cp=el("button","btn","📋 Kopieren"); cp.type="button"; cp.onclick=async()=>{ try{ await navigator.clipboard.writeText(url); toast("Link kopiert"); }catch(e){ toast("Kopieren hat nicht geklappt."); } }; r.append(sh,cp); p.append(r); }); }

function openTeamAdmin(){ const d=TEAM.data; if(!d||!isTAdmin()) return; const me=TEAM.s.uid, adms=d.mem.filter(isAdmM);
  const re=()=>{ if(TEAM.data&&isTAdmin()) openTeamAdmin(); else closeSheet(); };
  openSheet(p=>{ sheetTop(p,"Team verwalten"); p.dataset.sheet="tadmin";
    /* Regeln */
    p.append(el("h3",null,"Regeln")); const lm=el("label","f","Höchstens gleichzeitig im Urlaub"), sm=el("select"); sm.id="ta_max"; [[0,"unbegrenzt"],...Array.from({length:30},(_,i)=>[i+1,(i+1)+((i+1)===1?" Person":" Personen")])].forEach(([v,l])=>{ const o=el("option",null,l); o.value=v; sm.append(o); }); sm.value=+d.team.maxAway||0; lm.append(sm);
    sm.onchange=async()=>{ try{ await tPut(TP(),{maxAway:+sm.value||0}); d.team.maxAway=+sm.value||0; toast("Gespeichert: "+(+sm.value?"höchstens "+sm.value+" gleichzeitig":"unbegrenzt")); renderTeam(); }catch(e){ toast(tErrMsg(e)); } }; p.append(lm);
    const la=el("label","sw tsw"), ca=el("input"); ca.type="checkbox"; ca.id="ta_appr"; ca.checked=!!d.team.requireApproval; la.append(ca,el("span",null,"Neue Mitglieder erst bestätigen (Beitritt bestätigen)")); ca.onchange=async()=>{ try{ await teamSetApproval(ca.checked); toast(ca.checked?"Neue Mitglieder musst du jetzt bestätigen.":"Neue Mitglieder sind sofort im Team."); }catch(e){ toast(tErrMsg(e)); ca.checked=!ca.checked; } }; p.append(la);
    /* Einladungslink */
    p.append(el("h3",null,"Einladungslink"), el("div","applink",inviteLink())); const ir=el("div","row"), sh=el("button","btn grow","Link teilen"), nw=el("button","btn bad grow","Link sperren & neu erzeugen"); sh.type=nw.type="button"; sh.onclick=openTeamInvite;
    nw.onclick=()=>ask("Einladungslink sperren?","Der alte Link funktioniert sofort nicht mehr. Wer schon im Team ist, bleibt drin.",[{label:"Sperren & neuen Link erzeugen",pri:true,fn:async()=>{ try{ await teamNewInvite(); toast("Neuer Link erzeugt – der alte ist gesperrt."); re(); }catch(e){ toast(tErrMsg(e)); } }},{label:"Abbrechen"}]); ir.append(sh,nw); p.append(ir);
    /* Wartende */
    const pend=d.mem.filter(m=>m.status==="pending"); if(pend.length){ p.append(el("h3",null,"Warten auf Bestätigung")); pend.forEach(m=>{ const r=el("div","tmrow"), top=el("div","row"); top.append(el("b","grow",m.name||"Neues Mitglied")); const ok=el("button","btn pri","Beitritt bestätigen"), no=el("button","btn","Ablehnen"); ok.type=no.type="button"; ok.onclick=()=>teamApprove(m,true).then(re); no.onclick=()=>teamApprove(m,false).then(re); top.append(ok,no); r.append(top); p.append(r); }); }
    /* Mitglieder */
    p.append(el("h3",null,"Mitglieder"));
    d.mem.filter(m=>m.status!=="pending").forEach(mm=>{ const i=mIdx(mm.id), r=el("div","tmrow"), top=el("div","row"), self=mm.id===me, adm=isAdmM(mm); top.append(mMark(mm,i), el("b","grow",mLabel(mm,i,true)+(self?" (du)":"")), el("small","muted",adm?"Admin":"Mitglied")); r.append(top);
      const act=el("div","row tmact");
      if(!adm){ const a=el("button","btn","Zum Admin ernennen"); a.type="button"; a.onclick=()=>teamSetRole(mm,"admin").then(re); act.append(a); }
      else if(adms.length>1){ const a=el("button","btn ghost",self?"Meine Admin-Rechte abgeben":"Admin-Rechte entziehen"); a.type="button"; a.onclick=()=>ask(self?"Admin-Rechte abgeben?":"Admin-Rechte entziehen?",(self?"Du":mm.name)+" bleibt Mitglied im Team.",[{label:"Ja",pri:true,fn:()=>teamSetRole(mm,"member").then(re)},{label:"Abbrechen"}]); act.append(a); }
      if(!self){ const rm=el("button","btn","Aus Team entfernen"); rm.type="button"; rm.onclick=()=>ask((mm.name||"Mitglied")+" entfernen?","Die Person verliert sofort den Zugriff auf das Team. Ihre freigegebenen Urlaube verschwinden aus der Team-Ansicht. Ihr privater Planer bleibt unberührt. Mit dem Einladungslink kann sie wieder beitreten.",[{label:"Ja, entfernen",pri:true,fn:()=>teamRemove(mm,false).then(re)},{label:"Abbrechen"}]);
        const bn=el("button","btn bad","Entfernen und sperren"); bn.type="button"; bn.onclick=()=>ask((mm.name||"Mitglied")+" entfernen und sperren?","Wie „Entfernen“ – zusätzlich kann die Person diesem Team nicht mehr beitreten, bis du die Sperre aufhebst.",[{label:"Entfernen und sperren",pri:true,fn:()=>teamRemove(mm,true).then(re)},{label:"Abbrechen"}]); act.append(rm,bn); }
      r.append(act); p.append(r); });
    if(adms.length<=1) p.append(el("p","hint","Du bist der einzige Admin. Um das Team zu verlassen, ernenne vorher einen anderen Admin – oder lösche das Team."));
    /* Gesperrt */
    if(d.bans.length){ p.append(el("h3",null,"Gesperrt")); d.bans.forEach(bn=>{ const r=el("div","tmrow"), top=el("div","row"); top.append(el("b","grow",bn.name||"Gesperrte Person")); const u=el("button","btn","Sperre aufheben"); u.type="button"; u.onclick=()=>teamUnban(bn).then(re); top.append(u); r.append(top); p.append(r); }); }
    const del=el("button","btn bad uwide tdel","Team löschen"); del.type="button"; del.onclick=teamDeleteAsk; p.append(del); }); }

/* ---------- Einbindung ---------- */
function teamOnEnter(){ tsLoad(); const h=location.hash; if(h.startsWith("#join=")){ sessionStorage.setItem("su_join",h.slice(6)); try{ history.replaceState(null,"",location.pathname); }catch(e){} }
  if(sessionStorage.getItem("su_join")) show("team"); else if(tRef()&&TEAM.s) teamLoad(); }
window.addEventListener("hashchange",()=>{ if(location.hash.startsWith("#join=") && S && S.onboarded){ sessionStorage.setItem("su_join",location.hash.slice(6)); try{ history.replaceState(null,"",location.pathname); }catch(e){} show("team"); } });
