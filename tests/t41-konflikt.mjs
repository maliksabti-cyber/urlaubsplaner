// Stufe 3: Konflikt mit 3 Fake-Nutzern – Reihenfolge, Nein, Admin-Regel, Ausweichen, Freigabe, Team-PDF
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fakeFirebase } from './fake-firebase.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const FB=fakeFirebase(); const ok=(x,m)=>console.log((x?'✔ ':'✘ ')+m); const errs=[];
async function person(name){ const c=await b.newContext({...devices['Pixel 7'],timezoneId:'Europe/Berlin'}); await FB.attach(c); const p=await c.newPage(); p.on('pageerror',e=>errs.push(name+': '+e.message)); p.name=name; return p; }
async function onboard(p,hash){ await p.goto('http://localhost:8765/'+(hash||'')); await p.waitForTimeout(600); for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(150); }
  await p.evaluate(n=>{ S.name=n; S.rots=[{id:'r',name:'x',start:'2026-01-05',pattern:['F','F','F','F','F',null,null]}]; S.vacPerYear=30; save(); },p.name); }
async function register(p){ await p.evaluate(()=>show('team')); await p.waitForTimeout(150); await p.locator('#v-team .seg button',{hasText:'Konto erstellen'}).tap(); await p.fill('#t_mail',p.name.toLowerCase()+'@test.de'); await p.fill('#t_pw','geheim123'); await p.locator('#v-team form button[type=submit]').tap(); await p.waitForTimeout(400); }
const A=await person('Anna'), B=await person('Ben'), C=await person('Cem');
await onboard(A); await register(A);
await p0(); async function p0(){}
await A.fill('#tc_name','Station 3'); await A.selectOption('#tc_max','1'); await A.locator('#v-team button',{hasText:'Team erstellen'}).tap(); await A.waitForTimeout(800);
const link=await A.evaluate(()=>inviteLink()); ok(/#join=/.test(link),'Einladungslink: '+link.slice(-30)); await A.evaluate(()=>closeSheet());
const hash=link.slice(link.indexOf('#'));
for(const P of [B,C]){ await onboard(P,hash); await register(P); ok(await P.isVisible('#tj_name'),P.name+': Beitritts-Maske'); if(P===B) await P.check('#tj_kids'); await P.check('#tj_ok'); if(P===C) await P.check('#tj_show'); await P.locator('#v-team button',{hasText:'Beitreten'}).tap(); await P.waitForTimeout(900); }
await B.evaluate(()=>teamLoad()); await B.waitForTimeout(300); ok(await B.evaluate(()=>!!TEAM.data && TEAM.data.mem.length===3),'Ben ist im Team (3 Mitglieder)');
// Alle tragen dieselbe Woche Urlaub ein
for(const P of [A,B,C]){ await P.evaluate(()=>{ vacSave('2026-11-09','2026-11-13',vacCount('2026-11-09','2026-11-13').days); }); await P.waitForTimeout(2600); await P.evaluate(()=>{ const a=document.querySelector('#ask'); if(a) a.hidden=true; }); }
await A.evaluate(()=>teamLoad()); await A.waitForTimeout(500);
const cf=P=>P.evaluate(()=>{ const c=TEAM.data.conf.find(c=>c.status!=='solved'); return c&&{status:c.status,asked:c.asked&&uLab(c.asked),order:c.order.map(u=>TEAM.data.mem.find(m=>m.id===u).name),decided:c.decided.map(u=>TEAM.data.mem.find(m=>m.id===u).name)}; });
let c0=await cf(A); ok(c0 && c0.status==='open' && c0.order[0]==='Cem' && c0.order[2]==='Anna','Konflikt angelegt, Reihenfolge (zuletzt eingetragen zuerst): '+JSON.stringify(c0));
await C.evaluate(()=>teamLoad()); await C.waitForTimeout(400); await C.evaluate(()=>show('team')); await C.waitForTimeout(200);
ok(await C.locator('#v-team .tconf button',{hasText:'Ausweichtage'}).count()===1,'Cem sieht „Ausweichtage zeigen“');
await C.evaluate(()=>confNo(TEAM.data.conf.find(c=>c.status==='open'))); await C.waitForTimeout(400);
await A.evaluate(()=>teamLoad()); await A.waitForTimeout(400); c0=await cf(A); ok(c0.asked==='Mitglied Raute','Nach Nein wird Ben gefragt: '+JSON.stringify(c0));
await A.evaluate(()=>confRule(TEAM.data.conf.find(c=>c.status!=='solved'),true)); c0=await cf(A); ok(c0.status==='decided' && c0.decided.join()==='Cem,Ben','Admin-Regel: Cem und Ben weichen aus');
ok(await A.evaluate(()=>document.querySelector('#v-team')&&true) && !(await A.evaluate(()=>{ openTeamAdmin(); const b=[...document.querySelectorAll('#pan button')].find(b=>/freigeben/.test(b.textContent)); closeSheet(); return !b.disabled; })),'Freigabe gesperrt solange offen');
for(const P of [C,B]){ await P.evaluate(()=>teamLoad()); await P.waitForTimeout(400); const r=await P.evaluate(()=>{ const c=TEAM.data.conf.find(c=>c.status!=='solved'); const x=altDays(c); return x.alt.map(a=>a.a+'..'+a.e); }); ok(r.length>0,P.name+' Ausweichtage: '+r.join(' | '));
  await P.evaluate(()=>{ openAlt(TEAM.data.conf.find(c=>c.status!=='solved')); }); await P.waitForTimeout(150); await P.locator('#pan .vrow').first().tap(); await P.waitForTimeout(2600); }
await A.evaluate(()=>teamLoad()); await A.waitForTimeout(500);
ok(await A.evaluate(()=>TEAM.data.conf.every(c=>c.status==='solved') && teamConflicts('2026-10-01','2026-12-31').length===0),'Konflikt gelöst nach Ausweichen');
await A.evaluate(()=>teamRelease()); await A.waitForTimeout(300); await B.evaluate(()=>teamLoad()); await B.waitForTimeout(400);
ok(await B.evaluate(()=>myNotes().some(n=>n.type==='freigabe') && !!TEAM.data.team.released),'Ben bekommt Freigabe');
await B.evaluate(()=>{ TEAM.m={y:2026,m:10}; show('team'); }); await B.waitForTimeout(200); ok(await B.locator('#v-team button',{hasText:'als PDF'}).count()===1,'Team-PDF-Knopf nach Freigabe');
const pdf=await A.evaluate(async()=>{ let out=null; const o=pdfSave; pdfSave=async(b,f)=>{ out={n:b.length,f,pages:(new TextDecoder('latin1').decode(b).match(/\/Type \/Page\b/g)||[]).length}; }; await pdfTeam(2026); pdfSave=o; return out; });
ok(pdf && pdf.pages===13,'Team-PDF: '+JSON.stringify(pdf));
// Automatische Erinnerung kurz vor Fristende
ok(errs.length===0,'Keine Skriptfehler '+errs.join(' | ')); await b.close();
