/* =====================================================================
   Schicht & Urlaub – Team (Stufe 3) · eigenes Modul
   Architektur (siehe aufgaben/TEAM-SPEZ.md):
   • Private Daten bleiben im Planer (S.vacs …). Ins Team geht nur eine Kopie,
     und nur wenn Einverständnis (consentGet("teamJoin")) + Sichtbarkeit (shareVacGet) es erlauben.
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
const isTAdmin=()=>{ const d=TEAM.data; return !!(d&&d.me&&(d.me.role==="admin"||d.me.role==="deputy")); };
const mCol=(m,i)=>m.color||TCOL[i%TCOL.length], mShape=(m,i)=>(m.shape!=null?m.shape:i)%4;
function mIdx(uid){ const d=TEAM.data; return d?d.mem.findIndex(m=>m.id===uid):-1; }
function mLabel(m,i,forceName){ const own=TEAM.s&&m.id===TEAM.s.uid; return (m.showName||own||forceName)?m.name:"Mitglied "+SHAPE_N[mShape(m,i)]; }
function mInit(m){ return String(m.name||"?").split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase(); }
function mMark(m,i,small){ const sp=el("span","tmk"+(small?" sm":"")); sp.style.color=mCol(m,i); sp.textContent=SHAPES[mShape(m,i)]; sp.title=mLabel(m,i);
  const d=TEAM.data; if(d && d.mem.length>BIG_TEAM && m.showName){ const b=el("b",null,mInit(m)); sp.append(b); } return sp; }

/* ---------- Laden ---------- */
async function teamLoad(){ const ref=tRef(); if(!ref||!TEAM.s){ TEAM.data=null; return; } TEAM.loading=true; if(view==="team") renderTeam();
  try{ const t=await tfs(TP()); if(!t){ tRefSet(null); TEAM.data=null; toast("Dieses Team gibt es nicht mehr."); return; }
    const team=tDoc(t), mem=(await tList(TP()+"/members")).sort((a,b)=>(a.joined||0)-(b.joined||0)), me=mem.find(m=>m.id===TEAM.s.uid);
    if(!me){ tRefSet(null); TEAM.data=null; toast("Du bist nicht mehr im Team. Dein privater Planer bleibt, wie er ist."); return; }
    const ent=await tList(TP()+"/entries"), notes=(await tList(TP()+"/notes")).sort((a,b)=>(b.created||0)-(a.created||0));
    const conf=await tList(TP()+"/conflicts").catch(()=>[]);
    TEAM.data={team,mem,me,ent,notes,conf}; TEAM.err=null;
    if(!TEAM.synced){ TEAM.synced=true; await teamSync(true); }
    await confTick();
  }catch(e){ TEAM.err=tErrMsg(e); } finally{ TEAM.loading=false; if(view==="team") renderTeam(); if(view==="heute") renderHeute(); } }

/* ---------- Eigenen Urlaub als Team-Kopie abgleichen (nur bei Änderungen, kein Dauer-Hintergrund) ---------- */
function myTeamEntries(){ const out=[], uidv=TEAM.s.uid, vt=vacType(), cm=vt&&+vt.credit>0?+vt.credit:creditMin({shifts:0,min:0});
  if(!consentGet("teamJoin")) return out;
  vacList().forEach(v=>{ if(!shareVacGet(v.id)) return; const days=vacDaysOf(v); if(!days.length) return; out.push({id:uidv+"_"+v.id, uid:uidv, a:v.a, e:v.e, days:days.length, value:days.length*cm, kids:consentGet("hasKids")}); });
  return out; }
async function teamSync(quiet){ const d=TEAM.data; if(!d||!TEAM.s) return; const mine=d.ent.filter(x=>x.uid===TEAM.s.uid), want=myTeamEntries(), changed=[];
  try{ for(const w of want){ const o=mine.find(m=>m.id===w.id); if(!o||o.a!==w.a||o.e!==w.e||o.days!==w.days||o.value!==w.value||o.kids!==w.kids){ const rec={...w,created:o&&o.created?o.created:Date.now(),updated:Date.now()}; delete rec.id; await tPut(TP()+"/entries/"+w.id,rec); changed.push({...rec,id:w.id}); } }
    for(const o of mine) if(!want.some(w=>w.id===o.id)) await tDel(TP()+"/entries/"+o.id);
    /* Prüfung nur beim Eintragen/Ändern – mit frischem Stand aller Team-Einträge */
    if(changed.length || mine.length!==want.length){ d.ent=await tList(TP()+"/entries"); d.notes=(await tList(TP()+"/notes")).sort((a,b)=>(b.created||0)-(a.created||0)); d.conf=await tList(TP()+"/conflicts").catch(()=>d.conf||[]); }
    if(changed.length) await teamCheck(changed,quiet);
    if(changed.length || mine.length!==want.length){ await confTick(); if(view==="team") renderTeam(); }
  }catch(e){ if(!quiet) toast(tErrMsg(e)); } }
let tSyncT=null; function teamSyncSoon(){ if(!tRef()||!TEAM.s||!TEAM.data) return; clearTimeout(tSyncT); tSyncT=setTimeout(()=>teamSync(false),1500); }

/* ---------- Überschneidungen ---------- */
function teamAwayMap(a,e){ const d=TEAM.data, m=new Map(); if(!d) return m; const mids=new Set(d.mem.map(x=>x.id));
  d.ent.forEach(x=>{ if(!mids.has(x.uid)) return; const s0=x.a>a?x.a:a, e0=x.e<e?x.e:e; for(let s=s0;s<=e0;s=addD(s,1)){ const w=parse(s).getDay(); if(w===0||w===6) continue; if(!m.has(s)) m.set(s,new Set()); m.get(s).add(x.uid); } }); return m; }
const tMax=()=>{ const d=TEAM.data; const n=d&&+d.team.maxAway; return n>0?n:999; };
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
async function teamCreate(name,maxAway,deadlineDays){ const id=Date.now().toString(36)+uid(), code=uid()+uid();
  await tPut("/teams/"+id,{name,maxAway,deadlineDays,invite:code,createdBy:TEAM.s.uid,created:Date.now(),deputyHint:false});
  tRefSet({id,code});
  await tPut("/teams/"+id+"/members/"+TEAM.s.uid,{name:S.name||TEAM.s.email.split("@")[0],color:TCOL[0],shape:0,role:"admin",depth:0,deputyOf:null,kids:consentGet("hasKids"),showName:consentGet("showName"),invite:code,joined:Date.now()});
  consentSet("teamJoin",true); TEAM.synced=false; await teamLoad(); }
function inviteLink(){ const r=tRef(); return APP_URL+"#join="+r.id+"."+r.code; }
function parseJoin(t){ const m=String(t||"").match(/#?join=([a-z0-9]+)\.([a-z0-9]+)/i)||String(t||"").match(/^([a-z0-9]+)\.([a-z0-9]+)$/i); return m?{id:m[1],code:m[2]}:null; }
async function teamJoin(j,name,kids,showName){ const t=await tfs("/teams/"+j.id); if(!t) throw Object.assign(new Error("Dieses Team gibt es nicht."),{code:"NOTEAM"});
  const team=tDoc(t); if(team.invite!==j.code) throw Object.assign(new Error("Der Einladungslink ist nicht mehr gültig."),{code:"BADCODE"});
  const mem=await tList("/teams/"+j.id+"/members").catch(()=>[]); const n=mem.length;
  consentSet("teamJoin",true); consentSet("hasKids",kids); consentSet("showName",showName);
  await tPut("/teams/"+j.id+"/members/"+TEAM.s.uid,{name,color:TCOL[n%TCOL.length],shape:n%4,role:"member",depth:null,deputyOf:null,kids,showName,invite:j.code,joined:Date.now()});
  tRefSet(j); TEAM.synced=false; await teamLoad(); }
async function teamLeave(){ const d=TEAM.data; try{ for(const x of d.ent.filter(x=>x.uid===TEAM.s.uid)) await tDel(TP()+"/entries/"+x.id); await tDel(TP()+"/members/"+TEAM.s.uid); }catch(e){ toast(tErrMsg(e)); return; }
  tRefSet(null); TEAM.data=null; toast("Du hast das Team verlassen. Dein privater Planer bleibt unverändert."); render(); }
async function teamRemove(m){ const d=TEAM.data; try{ for(const x of d.ent.filter(x=>x.uid===m.id)) await tDel(TP()+"/entries/"+x.id); await tDel(TP()+"/members/"+m.id); toast(m.name+" wurde entfernt – seine Daten sind aus dem Team gelöscht."); await teamLoad(); }catch(e){ toast(tErrMsg(e)); } }
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
  const d=TEAM.data, adm=isTAdmin();
  const h=el("div","card sec"); const hr=el("div","row"); hr.append(el("h2","grow",d.team.name)); const rl=el("button","btn",TEAM.loading?"…":"↻"); rl.type="button"; rl.setAttribute("aria-label","Aktualisieren"); rl.onclick=teamLoad; hr.append(rl); h.append(hr);
  h.append(el("p","muted",d.mem.length+(d.mem.length===1?" Mitglied":" Mitglieder")+" · höchstens "+(tMax()>=999?"unbegrenzt":tMax())+" gleichzeitig · Frist "+(+d.team.deadlineDays||7)+" Tage · du bist "+({admin:"Admin",deputy:"Vertreter (Ebene "+d.me.depth+")",member:"Mitglied"}[d.me.role]||"Mitglied")));
  if(TEAM.err) h.append(el("div","banner bad",TEAM.err));
  if(!consentGet("teamJoin")) h.append(el("div","banner","Du hast die Datenfreigabe abgeschaltet – dein Urlaub wird nicht ins Team übertragen. (Einstellungen → Datenschutz & Freigaben)"));
  const r2=el("div","row"); if(adm){ const iv=el("button","btn pri grow","➕ Einladen"); iv.type="button"; iv.onclick=openTeamInvite; r2.append(iv); const am=el("button","btn grow","⚙ Admin-Maske"); am.type="button"; am.onclick=openTeamAdmin; r2.append(am); }
  const fr=el("button","btn grow","🔒 Meine Freigaben"); fr.type="button"; fr.onclick=()=>goSettings("consent"); r2.append(fr); h.append(r2); box.append(h);
  /* einmalige Empfehlung: Vertreter bestimmen */
  if(d.me.role==="admin" && d.mem.length>=3 && !d.mem.some(m=>m.role==="deputy") && !d.team.deputyHint){ const b=el("div","banner tip"); b.append(el("span","grow","Tipp: Bestimme einen Vertreter, der dich bei Abwesenheit vertritt (freiwillig).")); const ok=el("button","btn","Vertreter wählen"); ok.type="button"; ok.onclick=()=>{ tPut(TP(),{deputyHint:true}).catch(()=>{}); d.team.deputyHint=true; openTeamAdmin(); }; const no=el("button","btn ghost","Später"); no.type="button"; no.onclick=()=>{ tPut(TP(),{deputyHint:true}).catch(()=>{}); d.team.deputyHint=true; renderTeam(); }; b.append(ok,no); box.append(b); }
  if(d.team.released && !confOpen()) box.append(el("div","banner tip","✅ Team-Kalender freigegeben am "+fmt(iso(new Date(d.team.released.at)))+"."));
  teamConfCard(box); teamInbox(box); teamCalendar(box);
  const lv=el("button","linkbtn","Team verlassen"); lv.type="button"; lv.onclick=()=>ask("Team verlassen?","Deine Daten verschwinden aus der Team-Ansicht. Dein privater Planer bleibt unverändert.",[{label:"Ja, verlassen",pri:true,fn:teamLeave},{label:"Abbrechen"}]);
  const lo=el("button","linkbtn","Abmelden"); lo.type="button"; lo.onclick=tLogout; const rr=el("div","row"); rr.append(lv,lo); box.append(rr); }

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
    d.mem.forEach((mm,i)=>{ if(!st.has(mm.id)) return; const r=el("div","trow"); r.append(mMark(mm,i), el("b","grow",mLabel(mm,i))); const e=d.ent.find(x=>x.uid===mm.id&&x.a<=s&&x.e>=s); if(e) r.append(el("small","muted",fmtS(e.a)+" – "+fmtS(e.e))); p.append(r); });
    if(st.size>mx) p.append(el("div","banner bad",st.size+" gleichzeitig – erlaubt sind "+mx+".")); }); }

function teamLoginCard(box){ const c=el("div","card sec"); c.append(el("h2",null,"👥 Team"), el("p","hint","Seht gemeinsam, wer wann Urlaub hat. Dein privater Planer bleibt privat – ins Team geht nur, was du freigibst."));
  let mode="login"; const f=el("form"); f.style.display="grid"; f.style.gap="10px"; const seg=el("div","seg full"); const em=el("input"), pw=el("input"); em.type="email"; em.placeholder="E-Mail"; em.autocomplete="email"; em.id="t_mail"; pw.type="password"; pw.placeholder="Passwort (mind. 6 Zeichen)"; pw.id="t_pw"; pw.autocomplete="current-password";
  const msg=el("p","amsg"); const go=el("button","btn pri","Anmelden"); go.type="submit";
  [["login","Anmelden"],["signup","Konto erstellen"]].forEach(([k,l])=>{ const b=el("button",null,l); b.type="button"; b.setAttribute("aria-pressed",String(mode===k)); b.onclick=()=>{ mode=k; seg.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); go.textContent=l; }; seg.append(b); });
  f.onsubmit=async e=>{ e.preventDefault(); go.disabled=true; msg.textContent="Einen Moment …"; try{ const j=await authCall(mode==="signup"?"signUp":"signInWithPassword",{email:em.value.trim(),password:pw.value,returnSecureToken:true}); tsSave(j,em.value.trim()); renderTeam(); if(tRef()) teamLoad(); }catch(err){ msg.textContent=tErrMsg(err); go.disabled=false; } };
  f.append(em,pw,go,msg); c.append(seg,f); box.append(c); }

function teamStartCards(box){ const c1=el("div","card sec"); c1.append(el("h2",null,"Team erstellen"), el("p","hint","Du wirst Admin und kannst Kollegen per Link einladen."));
  const n=el("input"); n.type="text"; n.id="tc_name"; n.placeholder="Name des Teams, z. B. Station 3"; const two=el("div","two");
  const lm=el("label","f","Höchstens gleichzeitig im Urlaub"), sm=el("select"); sm.id="tc_max"; [[0,"unbegrenzt"],...[1,2,3,4,5,6,7,8,10,15,20].map(x=>[x,x+(x===1?" Person":" Personen")])].forEach(([v,l])=>{ const o=el("option",null,l); o.value=v; sm.append(o); }); sm.value=2; lm.append(sm);
  const lf=el("label","f","Frist für Konflikte (Tage)"), fi=el("input"); fi.type="number"; fi.id="tc_frist"; fi.min=1; fi.max=90; fi.value=7; lf.append(fi); two.append(lm,lf);
  const go=el("button","btn pri","Team erstellen"); go.type="button"; go.onclick=async()=>{ const nm=n.value.trim(); if(!nm){ toast("Bitte einen Namen eingeben."); return; } go.disabled=true; try{ await teamCreate(nm,+sm.value||0,Math.max(1,Math.min(90,+fi.value||7))); openTeamInvite(); }catch(e){ toast(tErrMsg(e)); go.disabled=false; } };
  c1.append(n,two,go); box.append(c1);
  const c2=el("div","card sec"); c2.append(el("h2",null,"Team beitreten"), el("p","hint","Öffne den Einladungslink – oder füge ihn hier ein.")); const li=el("input"); li.type="text"; li.id="tj_link"; li.placeholder="Einladungslink"; const jb=el("button","btn","Weiter"); jb.type="button";
  jb.onclick=()=>{ const j=parseJoin(li.value); if(!j){ toast("Das ist kein gültiger Einladungslink."); return; } sessionStorage.setItem("su_join",j.id+"."+j.code); renderTeam(); }; c2.append(li,jb); box.append(c2);
  const lo=el("button","linkbtn","Abmelden ("+TEAM.s.email+")"); lo.type="button"; lo.onclick=tLogout; box.append(lo); }

function teamJoinCard(box,j){ const c=el("div","card sec"); c.append(el("h2",null,"Team beitreten"));
  if(!j){ sessionStorage.removeItem("su_join"); c.append(el("p",null,"Der Link ist ungültig.")); box.append(c); return; }
  c.append(el("p","hint","Du bleibst in deinem privaten Bereich und kannst zusätzlich die Team-Ansicht öffnen."));
  const ln=el("label","f","Dein Name im Team"), ni=el("input"); ni.type="text"; ni.id="tj_name"; ni.value=S.name||""; ln.append(ni);
  const sw=(id,t,on)=>{ const l=el("label","sw"), cb=el("input"); cb.type="checkbox"; cb.id=id; cb.checked=on; l.append(cb,el("span",null,t)); return [l,cb]; };
  const [lk,ck]=sw("tj_kids","Ich habe Kinder (Vorrang in den Schulferien)",consentGet("hasKids")), [ls,cs]=sw("tj_show","Meinen Namen im Team-Kalender zeigen (sonst nur Farbe und Form)",consentGet("showName")), [la,ca]=sw("tj_ok","Ich bin einverstanden, dass mein freigegebener Urlaub (von–bis, Anzahl Tage, Wert) im Team sichtbar ist.",false);
  const go=el("button","btn pri","Beitreten"); go.type="button"; go.onclick=async()=>{ if(!ni.value.trim()){ toast("Bitte deinen Namen eingeben."); return; } if(!ca.checked){ toast("Ohne Einverständnis geht der Beitritt nicht."); return; } go.disabled=true;
    try{ await teamJoin(j,ni.value.trim().slice(0,40),ck.checked,cs.checked); sessionStorage.removeItem("su_join"); toast("Willkommen im Team!"); }catch(e){ toast(e.code==="BADCODE"||e.code==="NOTEAM"?e.message:tErrMsg(e)); go.disabled=false; } };
  const no=el("button","btn ghost","Abbrechen"); no.type="button"; no.onclick=()=>{ sessionStorage.removeItem("su_join"); renderTeam(); };
  c.append(ln,lk,ls,la,go,no); box.append(c); }

function openTeamInvite(){ const url=inviteLink(); openSheet(p=>{ sheetTop(p,"Kollegen einladen"); p.append(el("p","hint","Schick diesen Link. Wer beitritt, wird Mitglied und sieht den Team-Kalender."), el("div","applink",url));
  const txt="Komm in unser Team „"+((TEAM.data&&TEAM.data.team.name)||"")+"“ in Schicht & Urlaub: "+url; const r=el("div","row");
  const sh=el("button","btn pri grow","⇪ Link teilen"); sh.type="button"; sh.onclick=async()=>{ if(navigator.share){ try{ await navigator.share({title:"Schicht & Urlaub – Team",text:txt,url}); return; }catch(e){ if(e&&e.name==="AbortError") return; } } try{ await navigator.clipboard.writeText(url); toast("Link kopiert"); }catch(e){} };
  const cp=el("button","btn","📋 Kopieren"); cp.type="button"; cp.onclick=async()=>{ try{ await navigator.clipboard.writeText(url); toast("Link kopiert"); }catch(e){ toast("Kopieren hat nicht geklappt."); } }; r.append(sh,cp); p.append(r); }); }

function openTeamAdmin(){ const d=TEAM.data; if(!d||!isTAdmin()) return;
  openSheet(p=>{ sheetTop(p,"Admin-Maske"); p.dataset.sheet="tadmin";
    const two=el("div","two"); const lm=el("label","f","Höchstens gleichzeitig"), sm=el("select"); sm.id="ta_max"; [[0,"unbegrenzt"],...Array.from({length:30},(_,i)=>[i+1,(i+1)+((i+1)===1?" Person":" Personen")])].forEach(([v,l])=>{ const o=el("option",null,l); o.value=v; sm.append(o); }); sm.value=+d.team.maxAway||0; lm.append(sm);
    const lf=el("label","f","Frist für Konflikte (Tage)"), fi=el("input"); fi.type="number"; fi.id="ta_frist"; fi.min=1; fi.max=90; fi.value=+d.team.deadlineDays||7; lf.append(fi); two.append(lm,lf); p.append(two);
    const sv=el("button","btn pri","Einstellungen speichern"); sv.type="button"; sv.onclick=async()=>{ try{ await tPut(TP(),{maxAway:+sm.value||0,deadlineDays:Math.max(1,Math.min(90,+fi.value||7))}); d.team.maxAway=+sm.value||0; d.team.deadlineDays=+fi.value||7; toast("Gespeichert"); renderTeam(); }catch(e){ toast(tErrMsg(e)); } }; p.append(sv);
    p.append(el("h3",null,"Mitglieder"));
    d.mem.forEach((mm,i)=>{ const box=el("div","tmrow"); const top=el("div","row"); top.append(mMark(mm,i)); const ni=el("input"); ni.type="text"; ni.value=mm.name; ni.className="grow"; ni.setAttribute("aria-label","Name");
      ni.onchange=()=>tPut(TP()+"/members/"+mm.id,{name:ni.value.trim().slice(0,40)}).then(()=>{ mm.name=ni.value.trim(); renderTeam(); }).catch(e=>toast(tErrMsg(e)));
      top.append(ni, el("small","muted",{admin:"Admin",deputy:"Vertreter "+mm.depth,member:"Mitglied"}[mm.role]||"")); box.append(top);
      const pal=el("div","tpal"); TCOL.forEach(cc=>{ const b=el("button"); b.type="button"; b.style.background=cc; b.setAttribute("aria-label","Farbe"); if(mCol(mm,i)===cc) b.classList.add("on"); b.onclick=()=>tPut(TP()+"/members/"+mm.id,{color:cc}).then(()=>{ mm.color=cc; openTeamAdmin(); renderTeam(); }).catch(e=>toast(tErrMsg(e))); pal.append(b); });
      SHAPES.forEach((sh,k)=>{ const b=el("button","tsh",sh); b.type="button"; b.setAttribute("aria-label",SHAPE_N[k]); if(mShape(mm,i)===k) b.classList.add("on"); b.onclick=()=>tPut(TP()+"/members/"+mm.id,{shape:k}).then(()=>{ mm.shape=k; openTeamAdmin(); renderTeam(); }).catch(e=>toast(tErrMsg(e))); pal.append(b); }); box.append(pal);
      const act=el("div","row"); const me=mm.id===TEAM.s.uid;
      if(!me && mm.role==="member"){ const a=el("button","btn","Zum Admin machen"); a.type="button"; a.onclick=()=>tPut(TP()+"/members/"+mm.id,{role:"admin",depth:0,deputyOf:null}).then(teamLoad).then(openTeamAdmin).catch(e=>toast(tErrMsg(e))); act.append(a);
        const myDepth=d.me.role==="admin"?0:(+d.me.depth||0), hasDep=d.mem.some(x=>x.role==="deputy"&&x.deputyOf===TEAM.s.uid);
        if(myDepth<MAXDEP && !hasDep){ const v=el("button","btn","Als meinen Vertreter"); v.type="button"; v.onclick=()=>tPut(TP()+"/members/"+mm.id,{role:"deputy",depth:myDepth+1,deputyOf:TEAM.s.uid}).then(teamLoad).then(openTeamAdmin).catch(e=>toast(tErrMsg(e))); act.append(v); } }
      if(!me){ const rm=el("button","btn","🔔 Erinnern"); rm.type="button"; rm.onclick=()=>notify({type:"erinnerung",to:[mm.id],title:"Erinnerung vom Admin",text:"Bitte trag deinen Urlaub ein bzw. kläre deine Überschneidungen."}).then(()=>toast("Erinnerung geschickt")); act.append(rm);
        const del=el("button","btn bad","Entfernen"); del.type="button"; del.onclick=()=>ask(mm.name+" entfernen?","Alle Daten von "+mm.name+" verschwinden aus der Team-Ansicht. Der private Planer bleibt unberührt.",[{label:"Ja, entfernen",pri:true,fn:()=>teamRemove(mm).then(openTeamAdmin)},{label:"Abbrechen"}]); act.append(del); }
      if(mm.role!=="member" && !me && d.me.role==="admin"){ const dn=el("button","btn ghost","Rolle entziehen"); dn.type="button"; dn.onclick=()=>tPut(TP()+"/members/"+mm.id,{role:"member",depth:null,deputyOf:null}).then(teamLoad).then(openTeamAdmin).catch(e=>toast(tErrMsg(e))); act.append(dn); }
      box.append(act); p.append(box); });
    p.append(el("p","hint","Vertreter haben Admin-Rechte. Jeder kann einen Vertreter ernennen – höchstens "+MAXDEP+" Ebenen."));
    /* Überschneidungen nach Tagen und Farben */
    p.append(el("h3",null,"Überschneidungen"));
    const t=TODAY(), cl=teamConflicts(t,addD(t,730)); if(!cl.length) p.append(el("p","muted",tMax()>=999?"Keine Grenze eingestellt.":"Keine – nie mehr als "+tMax()+" gleichzeitig."));
    cl.slice(0,40).forEach(k=>{ const r=el("div","trow"); r.append(el("b","grow",(k.a===k.e?fmt(k.a):fmtS(k.a)+" – "+fmt(k.e))+": "+k.n)); const mk=el("span"); k.uids.forEach(u=>{ const i=mIdx(u); if(i>=0) mk.append(mMark(d.mem[i],i,true)); }); r.append(mk); p.append(r); });
    /* Finale Freigabe: erst wenn alles geklärt ist */
    p.append(el("h3",null,"Freigabe"));
    const offen=confOpen()+cl.filter(k=>!(d.conf||[]).some(c=>c.status!=="solved"&&c.a<=k.e&&c.e>=k.a)).length;
    if(d.team.released) p.append(el("p","muted","Zuletzt freigegeben am "+fmt(iso(new Date(d.team.released.at)))+"."));
    const rb=el("button","btn pri","✅ Alle Überschneidungen gelöst – Kalender freigeben"); rb.type="button"; rb.disabled=offen>0; rb.onclick=()=>teamRelease().then(closeSheet).catch(e=>toast(tErrMsg(e))); p.append(rb);
    if(offen) p.append(el("p","hint","Erst alle "+offen+" Überschneidungen klären, dann kannst du freigeben.")); }); }

/* ---------- Einbindung ---------- */
function teamOnEnter(){ tsLoad(); const h=location.hash; if(h.startsWith("#join=")){ sessionStorage.setItem("su_join",h.slice(6)); try{ history.replaceState(null,"",location.pathname); }catch(e){} }
  if(sessionStorage.getItem("su_join")) show("team"); else if(tRef()&&TEAM.s) teamLoad(); }
window.addEventListener("hashchange",()=>{ if(location.hash.startsWith("#join=") && S && S.onboarded){ sessionStorage.setItem("su_join",location.hash.slice(6)); try{ history.replaceState(null,"",location.pathname); }catch(e){} show("team"); } });
