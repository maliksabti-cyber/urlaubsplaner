/* =====================================================================
   Schicht & Urlaub – Foto einlesen · eigenes Modul
   Ablauf: Foto aufnehmen/auswählen → verkleinern (max. 1600 px, JPEG) → Foto-Dienst
   (config.js: photoApi) → ggf. Jahr/Markierungen erfragen → Vorschau im Kalender →
   „Übernehmen“ (mit großem „Rückgängig“) oder „Abbrechen“.
   • Der API-Schlüssel liegt NUR im Foto-Dienst (foto-dienst/), nie in der App.
   • Bis „Übernehmen“ wird nichts an den Daten geändert.
   ===================================================================== */
const FOTO={ov:null,ac:null,img:null,res:null,p:null,map:null,months:[]};
const FOTO_NOCONN="Keine Verbindung. Bitte später erneut versuchen.";
const FOTO_LETTERS={T:"Tagschicht",F:"Frühschicht",S:"Spätschicht",N:"Nachtschicht"};
const FOTO_DEF={T:{name:"Tagschicht",short:"T",color:"#1C7ED6",start:"08:00",end:"16:30"},F:{name:"Frühschicht",short:"F",color:"#0FA3B1",start:"06:00",end:"14:00"},S:{name:"Spätschicht",short:"S",color:"#E8590C",start:"14:00",end:"22:00"},N:{name:"Nachtschicht",short:"N",color:"#111111",start:"22:00",end:"06:00"}};
const FOTO_CAM='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.6l1.6-2.2h6.6L16.9 7h2.6A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const FOTO_PIC='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 18l5.5-5 4 3.5 2.5-2 4 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const fclone=o=>JSON.parse(JSON.stringify(o));

function fotoUrl(){ const u=String(CFG.photoApi||"").trim().replace(/\/+$/,""); return u?(/\/lesen$/.test(u)?u:u+"/lesen"):""; }
function fotoDev(){ let d=lsGet("su_devid"); if(!d){ d=uid()+uid()+uid(); lsSet("su_devid",d); } return d; }
function fotoBtn(){ const b=el("button","btn plfoto"); b.type="button"; b.innerHTML=FOTO_CAM; b.append(el("span",null,"Foto einlesen")); b.onclick=fotoStart; return b; }

/* 1. Hinweis (einmalig) und Auswahl Kamera / Galerie */
function fotoStart(){ if(lsGet("su_fotook")==="1"){ fotoSource(); return; }
  ask("Foto einlesen","Das Foto wird zur Auswertung an einen Server gesendet und nicht gespeichert.",[{label:"Verstanden",pri:true,fn:()=>{ lsSet("su_fotook","1"); fotoSource(); }},{label:"Abbrechen"}]); }
function fotoSource(){ openSheet(p=>{ sheetTop(p,"Foto einlesen"); p.dataset.sheet="foto";
  p.append(el("p","fotohint","Fotografiere deinen Dienst- oder Urlaubsplan oder wähle ein Bild aus. Danach siehst du eine Vorschau und entscheidest selbst, was übernommen wird."));
  const mk=(icon,label,sub,cap)=>{ const lb=el("label","fotosrc"), i=el("span","fotoic"), t=el("span","fotot"), inp=document.createElement("input"); i.innerHTML=icon; t.append(el("b",null,label),el("small",null,sub));
    inp.type="file"; inp.accept="image/*"; inp.className="fotoinp"; if(cap) inp.setAttribute("capture","environment"); inp.dataset.src=cap?"kamera":"galerie";
    inp.onchange=()=>{ const f=inp.files&&inp.files[0]; if(!f) return; closeSheet(); fotoRun(f); }; lb.append(i,t,inp); return lb; };
  p.append(mk(FOTO_CAM,"Foto aufnehmen","Kamera öffnen",true), mk(FOTO_PIC,"Bild auswählen","Aus deinen Fotos",false));
  const x=el("button","btn fotocancel","Abbrechen"); x.type="button"; x.onclick=()=>closeSheet(); p.append(x); }); }

/* 2. Verkleinern: längste Seite max. 1600 px, JPEG, unter ca. 4,5 MB */
function fotoShrink(file){ return new Promise((ok,bad)=>{ const url=URL.createObjectURL(file), im=new Image();
  im.onload=()=>{ try{ const w=im.naturalWidth, h=im.naturalHeight, f=Math.min(1,1600/Math.max(w,h)), cw=Math.max(1,Math.round(w*f)), ch=Math.max(1,Math.round(h*f));
      const c=document.createElement("canvas"); c.width=cw; c.height=ch; const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,cw,ch); x.drawImage(im,0,0,cw,ch); URL.revokeObjectURL(url);
      let q=.85, d=c.toDataURL("image/jpeg",q); while(d.length*.75>4.5*1024*1024 && q>.4){ q-=.15; d=c.toDataURL("image/jpeg",q); }
      ok({b64:d.slice(d.indexOf(",")+1),w:cw,h:ch,bytes:Math.round((d.length-d.indexOf(",")-1)*.75)}); }catch(e){ bad(e); } };
  im.onerror=()=>{ URL.revokeObjectURL(url); bad(new Error("bild")); }; im.src=url; }); }

/* Vollbild-Ebene für alle Schritte */
function fotoOv(){ let o=$("#foto"); if(!o){ o=el("div","foto"); o.id="foto"; o.setAttribute("role","dialog"); o.setAttribute("aria-modal","true"); document.body.append(o); }
  o.hidden=false; o.innerHTML=""; o.scrollTop=0; document.body.classList.add("fotoopen"); FOTO.ov=o; return o; }
function fotoOpen(){ const o=$("#foto"); return !!o && !o.hidden; }
function fotoClose(){ if(FOTO.ac){ FOTO.ac.user=true; FOTO.ac.abort(); } FOTO.ac=null; FOTO.img=null; FOTO.res=null; FOTO.p=null; FOTO.map=null; const o=$("#foto"); if(o){ o.hidden=true; o.innerHTML=""; } document.body.classList.remove("fotoopen"); }
function fotoBack(){ const d=$("#fotodlg"); if(d){ d.remove(); return true; } if(!fotoOpen()) return false; fotoClose(); return true; }
function fotoPage(title,cls){ const o=fotoOv(), w=el("div","fotow"+(cls?" "+cls:"")); if(title) w.append(el("h2","fotoh",title)); o.append(w); return w; }
function fotoBtns(w,list){ const r=el("div","fotobtns"); list.forEach(b=>{ const x=el("button","btn"+(b.pri?" pri":""),b.label); x.type="button"; x.onclick=b.fn; r.append(x); }); w.append(r); return r; }

function fotoLoading(){ const w=fotoPage(null,"fotoload"); w.append(el("div","fotospin"),el("h2","fotoh","Foto wird gelesen …"),el("p","fotosub","Das dauert meist unter einer Minute."));
  fotoBtns(w,[{label:"Abbrechen",fn:fotoClose}]); }
function fotoErr(msg,retry,more){ const w=fotoPage("Das hat nicht geklappt","fotoerr"); w.append(el("p","fotomsg",msg)); if(more) w.append(el("p","fotosub",more)); w.append(el("p","fotosub","Deine Einträge wurden nicht verändert."));
  const b=[]; if(retry) b.push({label:"Erneut versuchen",pri:true,fn:retry}); b.push({label:"Anderes Foto wählen",fn:()=>{ fotoClose(); fotoSource(); }}); b.push({label:"Schließen",fn:fotoClose}); fotoBtns(w,b); }

/* 3. Senden */
async function fotoRun(file){ fotoOv(); fotoLoading(); let img; const ac=new AbortController(); FOTO.ac=ac;
  try{ img=await fotoShrink(file); }catch(e){ if(!ac.user) fotoErr("Das Bild konnte nicht geöffnet werden. Bitte ein anderes Foto wählen."); return; }
  if(ac.user) return; FOTO.img=img; fotoSend(ac); }
async function fotoSend(ac){ if(!ac){ fotoOv(); fotoLoading(); ac=new AbortController(); FOTO.ac=ac; } const img=FOTO.img, again=()=>fotoSend();
  const url=fotoUrl(); if(!url){ fotoErr("Der Foto-Dienst ist noch nicht eingerichtet.",null,"In config.js fehlt noch die Adresse des Foto-Dienstes (photoApi)."); return; }
  if(navigator.onLine===false){ fotoErr(FOTO_NOCONN,again); return; }
  const to=setTimeout(()=>ac.abort(),120000); let res, j=null;
  try{ res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","X-Device":fotoDev()},body:JSON.stringify({image:img.b64,type:"image/jpeg"}),signal:ac.signal,cache:"no-store",credentials:"omit"}); try{ j=await res.json(); }catch(e){} }
  catch(e){ clearTimeout(to); if(ac.user||FOTO.ac!==ac) return; fotoErr(FOTO_NOCONN,again); return; }
  clearTimeout(to); if(ac.user||FOTO.ac!==ac) return; FOTO.ac=null;
  if(!res.ok||!j||j.error){ const m=j&&typeof j.message==="string"?j.message:res.status===413?"Das Foto ist zu groß.":"Das Foto konnte gerade nicht gelesen werden. Bitte später erneut versuchen.";
    fotoErr(m,res.status===429||res.status===413||res.status===403||res.status===422?null:again); return; }
  FOTO.img=null; fotoGot(j); }

/* 4. Ergebnis prüfen – nur gültige Tage, nichts erfinden */
function fotoGot(j){ const marks=Array.isArray(j.marks)?j.marks.filter(m=>m&&typeof m.id==="string"):[], ids=new Set(marks.map(m=>m.id)), seen=new Set(), list=[];
  (Array.isArray(j.entries)?j.entries:[]).forEach(e=>{ if(!e||!/^\d{4}-\d\d-\d\d$/.test(e.date||"")||seen.has(e.date)) return; const d=new Date(e.date+"T12:00:00"); if(isNaN(d)||fotoIso(d)!==e.date) return;
    const conf=Math.max(0,Math.min(1,+e.confidence||0)); if(e.kind==="shift"&&/^[TSNFKXU]$/.test(e.shift||"")) list.push({d:e.date,sh:e.shift,conf}); else if(e.kind==="marked"&&ids.has(e.mark)) list.push({d:e.date,mk:e.mark,conf}); else return; seen.add(e.date); });
  if(!list.length){ fotoErr("Auf dem Foto wurde kein Plan erkannt.",null,(typeof j.note==="string"&&j.note?j.note+" ":"")+"Tipp: Den Plan gerade und hell fotografieren, möglichst ohne Schatten."); return; }
  FOTO.res={marks:marks.filter(m=>list.some(x=>x.mk===m.id)),list,legend:!!j.legend_found,year:+j.year||0,sure:!!j.year_sure};
  if(!FOTO.res.sure) fotoAskYear(); else fotoAskMarks(); }
function fotoIso(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }

/* 4a. Jahr nicht lesbar → fragen */
function fotoAskYear(){ const w=fotoPage("Welches Jahr zeigt das Foto?"), y=new Date().getFullYear(), L=FOTO.res.list, mo=[...new Set(L.map(x=>+x.d.slice(5,7)))].sort((a,b)=>a-b);
  w.append(el("p","fotomsg","Das Jahr ist auf dem Foto nicht zu erkennen."),el("p","fotosub","Erkannt: "+mo.map(m=>MONF_[m-1]).join(", ")));
  const g=el("div","fotoyears"); [y-1,y,y+1].forEach(yy=>{ const b=el("button","btn"+(yy===y?" pri":""),String(yy)); b.type="button"; b.onclick=()=>fotoSetYear(yy); g.append(b); }); w.append(g);
  fotoBtns(w,[{label:"Abbrechen",fn:fotoClose}]); }
function fotoSetYear(yy){ const out=[], seen=new Set(); FOTO.res.list.forEach(x=>{ const s=yy+x.d.slice(4), d=new Date(s+"T12:00:00"); if(isNaN(d)||fotoIso(d)!==s||seen.has(s)) return; seen.add(s); out.push(Object.assign({},x,{d:s})); });
  FOTO.res.list=out; FOTO.res.sure=true; FOTO.res.year=yy; fotoAskMarks(); }

/* 4b. Markierungen: mit Legende Vorschlag bestätigen, sonst je Art einmal fragen */
function fotoOpts(){ const o=[{c:"U",label:"Urlaub"}]; ["T","S","N","F"].forEach(l=>{ const id=fotoType(l), t=fotoLook(id); o.push({c:id,label:t.name,short:t.short,color:t.color}); });
  const k=S.types.find(t=>t.kind==="sick"); if(k) o.push({c:k.id,label:"Krank",short:k.short,color:k.color}); o.push({c:"free",label:"Frei"}); return o; }
function fotoType(l){ if(l==="U") return "U"; if(l==="X") return "free"; if(l==="K"){ const k=S.types.find(t=>t.kind==="sick"); return k?k.id:"free"; }
  const t=S.types.find(x=>x.kind==="work"&&String(x.short).toUpperCase()===l)||S.types.find(x=>x.kind==="work"&&x.id===l); return t?t.id:"~"+l; }
function fotoLook(c){ if(c==="U"){ const v=vacType()||{}; return {name:"Urlaub",short:v.short||"U",color:v.color||"#2E8B57",vac:true}; } if(c==="free") return {name:"Frei",short:"–",color:null};
  if(c&&c[0]==="~"){ const d=FOTO_DEF[c[1]]; return {name:d.name,short:d.short,color:d.color}; } const t=typeOf(c); return t?{name:t.kind==="free"?"Frei":t.name,short:t.kind==="free"?"–":t.short,color:t.kind==="free"?null:t.color}:{name:"?",short:"?",color:null}; }
function fotoSwatch(m){ const s=el("span","fotosw "+(m.shape||"other")); s.style.setProperty("--c",/^#[0-9a-fA-F]{6}$/.test(m.color||"")?m.color:"#888"); return s; }
function fotoSugg(m){ const s=m.suggestion; if(!s) return null; if(s==="ignore") return "ignore"; return /^[TSNFKXU]$/.test(s)?fotoType(s):null; }
function fotoAskMarks(){ const R=FOTO.res; FOTO.map={}; if(!R.marks.length){ fotoBuild(); return; }
  if(R.legend && R.marks.some(m=>fotoSugg(m))){ R.marks.forEach(m=>{ const s=fotoSugg(m); if(s) FOTO.map[m.id]=s; }); fotoLegend(); return; }
  fotoNextMark(); }
function fotoNextMark(){ const m=FOTO.res.marks.find(x=>!(x.id in FOTO.map)); if(!m){ fotoBuild(); return; } fotoMarkQ(m,c=>{ FOTO.map[m.id]=c; fotoNextMark(); }); }
function fotoMarkQ(m,done,back){ const R=FOTO.res, n=R.list.filter(x=>x.mk===m.id).length, w=fotoPage("Was bedeutet das?"), hd=el("div","fotomark");
  hd.append(fotoSwatch(m)); const t=el("div"); t.append(el("b",null,m.description||"Markierung"),el("small",null,"auf dem Foto an "+n+(n===1?" Tag":" Tagen")+(m.legend_text?" · Legende: „"+m.legend_text+"“":""))); hd.append(t); w.append(hd);
  w.append(el("p","fotosub","Deine Antwort gilt für alle Tage mit dieser Markierung."));
  const g=el("div","fotoopts"), cur=FOTO.map[m.id]; fotoOpts().concat([{c:"ignore",label:"Ignorieren"}]).forEach(o=>{ const b=el("button","fopt"+(cur===o.c?" on":"")+(o.c==="ignore"?" ign":"")); b.type="button";
    const k=el("b","dqk"+(o.color?"":" free"),o.c==="U"?fotoLook("U").short:o.c==="ignore"?"×":o.short||"–"); if(o.c==="U"||o.color){ const col=o.c==="U"?fotoLook("U").color:o.color; k.style.background=col; k.style.color=isDark(col)?"#16222B":"#fff"; }
    b.append(k,el("span",null,o.label)); b.onclick=()=>done(o.c); g.append(b); }); w.append(g);
  fotoBtns(w,back?[{label:"Zurück",fn:back}]:[{label:"Abbrechen",fn:fotoClose}]); }
function fotoLegend(){ const R=FOTO.res, w=fotoPage("Legende erkannt"); w.append(el("p","fotosub","So verstehe ich die Markierungen auf dem Foto. Tippe auf eine Zeile, um sie zu ändern."));
  const box=el("div","fotolegend"); R.marks.forEach(m=>{ const b=el("button","fleg"); b.type="button"; const c=FOTO.map[m.id], t=el("span","flegt"); t.append(el("b",null,m.description||"Markierung")); if(m.legend_text) t.append(el("small",null,"Legende: „"+m.legend_text+"“"));
    b.append(fotoSwatch(m),t,el("span","flegv"+(c?"":" miss"),c==="ignore"?"Ignorieren":c?fotoLook(c).name:"Bitte wählen")); b.onclick=()=>fotoMarkQ(m,v=>{ FOTO.map[m.id]=v; fotoLegend(); },fotoLegend); box.append(b); }); w.append(box);
  const all=R.marks.every(m=>m.id in FOTO.map), r=fotoBtns(w,[{label:"Passt so",pri:true,fn:()=>{ if(all) fotoBuild(); }},{label:"Abbrechen",fn:fotoClose}]); r.firstChild.disabled=!all; }

/* 5. Vorschau */
function fotoCur(s){ if(dayKind(s)==="v") return "U"; const x=shiftOf(s); if(!x) return null; if(x.kind==="free") return "free"; return x.id; }
function fotoBuild(){ const R=FOTO.res, p={}; R.list.forEach(x=>{ const c=x.mk?FOTO.map[x.mk]:fotoType(x.sh); if(!c||c==="ignore") return; p[x.d]={c,conf:x.conf}; });
  FOTO.p=p; Object.keys(p).forEach(s=>fotoConf(s,true)); const ks=Object.keys(p).sort();
  if(!ks.length){ fotoErr("Es bleibt nichts zum Übernehmen übrig.",null,"Alle Markierungen wurden ignoriert."); return; }
  const mo=new Set(ks.map(s=>s.slice(0,7))); FOTO.months=[...mo].sort(); fotoPreview(); }
/* Konflikt: an dem Tag ist schon Urlaub oder ein eigener Eintrag, der anders ist. Standard: Behalten. */
function fotoConf(s,init){ const e=FOTO.p[s]; if(!e) return; const hasOv=Object.prototype.hasOwnProperty.call(S.ov,s), cur=fotoCur(s), own=dayKind(s)==="v"||hasOv;
  const cf=own && cur!==e.c && !(e.c==="free"&&cur==null); e.cf=cf?cur:undefined; if(!cf) delete e.keep; else if(init||e.keep==null) e.keep=true; }
function fotoUnsure(e){ return e.conf<.8 && !e.ok; }
function fotoList(){ return Object.keys(FOTO.p).sort().map(s=>({s,e:FOTO.p[s]})).filter(x=>!(x.e.cf!==undefined&&x.e.keep)); }
function fotoEnsure(c){ if(!c||c[0]!=="~") return c; const l=c[1], d=FOTO_DEF[l], id=S.types.some(t=>t.id===l)?uid():l; S.types.push({id,name:d.name,short:d.short,color:d.color,start:d.start,end:d.end,pause:30,kind:"work"}); return id; }
/* Wendet den Import auf S an (ohne zu speichern). Logik wie beim Eintragen von Hand. */
function fotoApply(){ const L=fotoList(), skip=[], ids={}; const tid=c=>{ if(!(c in ids)) ids[c]=fotoEnsure(c); return ids[c]; };
  L.filter(x=>x.e.c!=="U").forEach(({s,e})=>{ if(dayKind(s)==="v") removeVacDay(s); const base=baseShift(s), baseId=base?base.id:"", tg=e.c==="free"?"":tid(e.c); if(baseId===tg) delete S.ov[s]; else S.ov[s]=tg; });
  S.vacs=vacList().filter(v=>vacDaysOf(v).length); normVacs();
  L.filter(x=>x.e.c==="U").forEach(({s})=>{ if(dayKind(s)==="v") return; if(Object.prototype.hasOwnProperty.call(S.ov,s)) delete S.ov[s];
    if(vsDays(s,s).length) addVac(s,s); else if(!planKnown(s)){ vacList().push({id:uid(),a:s,e:s,fixed:[s]}); normVacs(); } else skip.push(s); });
  return {skip,n:L.length}; }
/* Probelauf auf einer Kopie: Resturlaub danach, ohne etwas zu speichern */
function fotoSim(){ const keep={ov:fclone(S.ov),vacs:fclone(vacList()),types:fclone(S.types)}, out={years:{},skip:[]};
  try{ const r=fotoApply(); out.skip=r.skip; fotoList().filter(x=>x.e.c==="U").forEach(({s})=>{ const y=+s.slice(0,4), t=shiftOf(s); if(!out.years[y]) out.years[y]={n:0}; if(t&&t.kind==="vac") out.years[y].n++; });
    Object.keys(out.years).forEach(y=>{ out.years[y].rest=vacRest(+y); }); }
  finally{ S.ov=keep.ov; S.vacs=keep.vacs; S.types=keep.types; } return out; }
function fotoSummary(){ const P=FOTO.p, ks=Object.keys(P), uns=ks.filter(s=>fotoUnsure(P[s])).length, sim=fotoSim(), ys=Object.keys(sim.years).map(Number).sort((a,b)=>sim.years[b].n-sim.years[a].n||a-b);
  let t=ks.length+(ks.length===1?" Tag erkannt":" Tage erkannt")+" · "+uns+" unsicher";
  if(!ys.length) t+=" · keine Urlaubstage"; else ys.forEach((y,i)=>{ const o=sim.years[y]; t+=" · "+(i?y+": ":"")+o.n+(o.n===1?" Urlaubstag":" Urlaubstage")+", danach "+(o.rest<0?"es fehlen "+(-o.rest):o.rest+" übrig"); });
  const over=ys.filter(y=>sim.years[y].rest<0&&sim.years[y].n>0).map(y=>({y,rest:sim.years[y].rest})); return {t,over,skip:sim.skip}; }
function fotoPreview(){ const o=fotoOv(), w=el("div","fotow fotoprev"), P=FOTO.p, sm=fotoSummary(); o.append(w);
  w.append(el("h2","fotoh","Vorschau"),el("p","fotosub","Noch ist nichts gespeichert. Tippe auf einen Tag, um ihn zu ändern oder zu entfernen."));
  const sl=el("p","fotosum",sm.t); sl.id="fotosum"; w.append(sl);
  if(sm.over.length) w.append(el("p","fotowarn","Achtung: Dafür reichen deine Urlaubstage nicht ("+sm.over.map(x=>x.y+": es fehlen "+(-x.rest)+(x.rest===-1?" Tag":" Tage")).join(", ")+")."));
  if(sm.skip.length) w.append(el("p","fotosub",sm.skip.length+(sm.skip.length===1?" Urlaubstag ist":" Urlaubstage sind")+" bei dir sowieso frei und "+(sm.skip.length===1?"wird":"werden")+" nicht eingetragen."));
  const cf=Object.keys(P).filter(s=>P[s].cf!==undefined);
  if(cf.length){ const c=el("div","fotoconf"), k=cf.filter(s=>P[s].keep).length; c.append(el("b",null,cf.length+(cf.length===1?" Tag ist schon belegt.":" Tage sind schon belegt.")),el("small",null,"Für alle: bisherige Einträge behalten oder durch das Foto ersetzen? Einzelne Tage kannst du antippen."));
    const sg=el("div","fotoseg"); [["Behalten",true],["Überschreiben",false]].forEach(([l,v])=>{ const b=el("button",null,l); b.type="button"; b.setAttribute("aria-pressed",String(v?k===cf.length:k===0)); b.onclick=()=>{ cf.forEach(s=>P[s].keep=v); fotoPreview(); }; sg.append(b); }); c.append(sg); w.append(c); }
  const lg=el("div","fotolg"); lg.append(el("span","fq","?"),document.createTextNode("unsicher, bitte prüfen")); if(cf.length){ lg.append(el("span","fx","!"),document.createTextNode("schon belegt")); } w.append(lg);
  FOTO.months.forEach(ym=>w.append(fotoMonth(ym)));
  const bar=el("div","fotobar"), ok=el("button","btn pri fotook","Übernehmen"), x=el("button","btn fotox","Abbrechen"); ok.type=x.type="button"; ok.onclick=fotoCommit; x.onclick=fotoClose; bar.append(ok,x); o.append(bar); }
function fotoMonth(ym){ const y=+ym.slice(0,4), m=+ym.slice(5,7)-1, box=el("div","fotomon"), g=el("div","fotogrid"), P=FOTO.p; box.append(el("h3","fotomh",MONF_[m]+" "+y));
  ["Mo","Di","Mi","Do","Fr","Sa","So"].forEach((w,i)=>g.append(el("div","fwd"+(i>4?" we":""),w)));
  const first=ym+"-01", last=lastOfMonth(first); for(let i=0;i<(parse(first).getDay()+6)%7;i++) g.append(el("i","fce"));
  for(let s=first;s<=last;s=addD(s,1)){ const e=P[s], w=parse(s).getDay(), b=el("button","fc"); b.type="button"; b.dataset.s=s; if(w===0||w===6) b.classList.add("we"); if(holName(s)) b.classList.add("ho");
    b.append(el("span","fcn",String(+s.slice(8,10)))); let lab=fmt(s);
    if(e){ const keep=e.cf!==undefined&&e.keep, c=keep?e.cf:e.c, t=c?fotoLook(c):null; b.classList.add("has"); if(keep) b.classList.add("keep");
      const k=el("b","fck"+(t&&t.color?"":" free"),t?t.short:"·"); if(t&&t.color){ k.style.background=t.color; k.style.color=isDark(t.color)?"#16222B":"#fff"; } b.append(k);
      if(fotoUnsure(e)){ b.classList.add("uns"); b.append(el("i","fq","?")); } if(e.cf!==undefined) b.append(el("i","fx","!"));
      lab+=", "+(t?t.name:"")+(fotoUnsure(e)?", unsicher":"")+(e.cf!==undefined?(keep?", bisheriger Eintrag bleibt":", ersetzt bisherigen Eintrag"):""); }
    b.setAttribute("aria-label",lab); b.onclick=()=>fotoDay(s); g.append(b); }
  box.append(g); return box; }
/* Tag korrigieren / entfernen / Konflikt entscheiden */
function fotoDay(s){ const P=FOTO.p, e=P[s], d=el("div","fotodlg"), c=el("div","fdc"); d.id="fotodlg"; d.onclick=ev=>{ if(ev.target===d) d.remove(); };
  c.append(el("h2","fotoh",fmt(s))); if(e) c.append(el("p","fotosub","Erkannt: "+fotoLook(e.c).name+(fotoUnsure(e)?" (unsicher)":""))); else c.append(el("p","fotosub","Auf dem Foto nicht erkannt."));
  const done=()=>{ d.remove(); fotoPreview(); };
  if(e&&e.cf!==undefined){ c.append(el("p","fotowarn","Bisher eingetragen: "+(e.cf?fotoLook(e.cf).name:"nichts"))); const sg=el("div","fotoseg"); [["Behalten",true],["Überschreiben",false]].forEach(([l,v])=>{ const b=el("button",null,l); b.type="button"; b.setAttribute("aria-pressed",String(!!e.keep===v)); b.onclick=()=>{ e.keep=v; e.ok=true; done(); }; sg.append(b); }); c.append(sg); }
  const g=el("div","fotoopts"); fotoOpts().forEach(o=>{ const b=el("button","fopt"+(e&&e.c===o.c?" on":"")); b.type="button"; const col=o.c==="U"?fotoLook("U").color:o.color, k=el("b","dqk"+(col?"":" free"),o.c==="U"?fotoLook("U").short:o.short||"–"); if(col){ k.style.background=col; k.style.color=isDark(col)?"#16222B":"#fff"; }
    b.append(k,el("span",null,o.label)); b.onclick=()=>{ const n=Object.assign({conf:1},e||{},{c:o.c,ok:true}); delete n.keep; P[s]=n; fotoConf(s); if(n.cf!==undefined) n.keep=false; fotoMonthsUpd(); done(); }; g.append(b); }); c.append(g);
  const r=el("div","fotobtns"); if(e){ const rm=el("button","btn fotorm","Aus der Vorschau entfernen"); rm.type="button"; rm.onclick=()=>{ delete P[s]; if(!Object.keys(P).length){ d.remove(); fotoClose(); toast("Nichts übernommen."); return; } fotoMonthsUpd(); done(); }; r.append(rm); }
  if(e&&fotoUnsure(e)){ const ok=el("button","btn","Stimmt so"); ok.type="button"; ok.onclick=()=>{ e.ok=true; done(); }; r.append(ok); }
  const x=el("button","btn","Schließen"); x.type="button"; x.onclick=()=>d.remove(); r.append(x); c.append(r); d.append(c); FOTO.ov.append(d); }
function fotoMonthsUpd(){ const ks=Object.keys(FOTO.p); const mo=new Set(FOTO.months); ks.forEach(s=>mo.add(s.slice(0,7))); FOTO.months=[...mo].sort(); }

/* 6. Übernehmen + großes Rückgängig */
function fotoCommit(){ const sm=fotoSummary(), go=()=>{ const before={ov:fclone(S.ov),vacs:fclone(vacList()),types:fclone(S.types)}, first=Object.keys(FOTO.p).sort()[0];
    const r=fotoApply(); save(); lsSet("su_fotoundo",JSON.stringify(Object.assign(before,{at:S.updated,n:r.n}))); fotoClose();
    if(first&&typeof ypU!=="undefined"){ ypU.paint=false; ypU.pv="m"; lsSet("su_pview","m"); ypU.one=+first.slice(0,4)*12+(+first.slice(5,7)-1); }
    if(view!=="urlaub") show("urlaub"); else render(); window.scrollTo(0,0); };
  if(!fotoList().length){ ask("Nichts zu übernehmen","Alle erkannten Tage behalten ihre bisherigen Einträge.",[{label:"OK"}]); return; }
  if(sm.over.length) ask("Urlaubstage reichen nicht","Sie überschreiten Ihr Urlaubskontingent: "+sm.over.map(x=>x.y+" fehlen "+(-x.rest)+(x.rest===-1?" Urlaubstag":" Urlaubstage")).join(", ")+".\nTrotzdem übernehmen?",[{label:"Trotzdem übernehmen",pri:true,fn:go},{label:"Zurück"}]);
  else go(); }
function fotoUndoGet(){ try{ const u=JSON.parse(lsGet("su_fotoundo")||"null"); return u&&S&&u.at===S.updated?u:null; }catch(e){ return null; } }
function fotoUndoBar(st){ if(!st||st.paint||!st.root) return; const u=fotoUndoGet(); if(!u){ if(lsGet("su_fotoundo")) lsSet("su_fotoundo",null); return; }
  const c=el("div","fundo"), t=el("div","fundot"), b=el("button","btn fundob","Rückgängig"), x=el("button","fundox","Fertig"); b.type=x.type="button";
  t.append(el("b",null,u.n+(u.n===1?" Eintrag":" Einträge")+" aus dem Foto übernommen."),el("small",null,"Gefällt dir das Ergebnis nicht? Alles mit einem Tipp zurücknehmen."));
  b.onclick=()=>{ S.ov=u.ov; S.vacs=u.vacs; S.types=u.types; lsSet("su_fotoundo",null); save(); render(); toast("Foto-Import rückgängig gemacht."); };
  x.onclick=()=>{ lsSet("su_fotoundo",null); render(); }; c.append(t,b,x); st.root.prepend(c); }
document.addEventListener("keydown",e=>{ if(e.key==="Escape" && fotoOpen()){ const a=$("#ask"); if(a&&!a.hidden) return; fotoBack(); } });
