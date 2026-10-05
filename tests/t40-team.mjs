// Team mit 3 Fake-Nutzern: erstellen, per Link beitreten, Urlaub, Überschneidung, Vertreter, Entfernen
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
const st=await A.evaluate(()=>({ent:TEAM.data.ent.length, notes:TEAM.data.notes.filter(n=>n.type==='konflikt').length, conf:teamConflicts('2026-11-01','2026-11-30').map(k=>k.n), unread:teamUnread()}));
ok(st.ent===3,'3 Team-Kopien vorhanden ('+st.ent+')'); ok(st.notes>=1 && st.conf[0]===3,'Konflikt erkannt: '+JSON.stringify(st));
// Privatsphäre: Ben ohne Namensfreigabe → nur Form; Cem mit Namen
const lab=await A.evaluate(()=>TEAM.data.mem.map((m,i)=>mLabel(m,i))); ok(lab.includes('Mitglied Raute') && lab.includes('Cem'),'Namen nur mit Einverständnis: '+lab.join(', '));
// Team-Kalender November + Popup
await A.evaluate(()=>{ TEAM.m={y:2026,m:10}; show('team'); }); await A.waitForTimeout(300);
ok(await A.locator('#v-team .tday.over').count()>=5,'Kalender: Überschreitung rot markiert');
await A.locator('#v-team .tday:not(.out)').nth(8).tap(); await A.waitForTimeout(200); ok(/Mitglied Raute/.test(await A.locator('#pan').innerText()),'Tages-Popup mit X'); await A.evaluate(()=>closeSheet());
await A.screenshot({path:'/tmp/claude-0/t40-team.png',fullPage:true});
// Vertreter + Entfernen
await A.evaluate(()=>openTeamAdmin()); await A.waitForTimeout(200);
await A.locator('#pan .tmrow').nth(1).getByRole('button',{name:'Als meinen Vertreter'}).tap(); await A.waitForTimeout(500);
ok(await A.evaluate(()=>TEAM.data.mem.find(m=>m.name==='Ben').role==='deputy' && TEAM.data.mem.find(m=>m.name==='Ben').depth===1),'Ben ist Vertreter (Ebene 1)');
await A.evaluate(()=>openTeamAdmin()); await A.waitForTimeout(200);
await A.locator('#pan .tmrow').nth(2).getByRole('button',{name:'Entfernen'}).tap(); await A.locator('#ask button',{hasText:'Ja, entfernen'}).tap(); await A.waitForTimeout(700);
ok(await A.evaluate(()=>TEAM.data.mem.length===2 && !TEAM.data.ent.some(e=>e.uid===TEAM.data.mem.find(m=>m.name==='Cem')?.id) && TEAM.data.ent.length===2),'Cem entfernt – seine Team-Daten weg');
await C.evaluate(()=>teamLoad()); await C.waitForTimeout(400); ok(await C.evaluate(()=>!tRef() && vacList().length===1),'Cem: privater Urlaub bleibt, Team-Verknüpfung weg');
// Erinnerung an Ben
await A.evaluate(()=>openTeamAdmin()); await A.waitForTimeout(200); await A.locator('#pan .tmrow').nth(1).getByRole('button',{name:'🔔 Erinnern'}).tap(); await A.waitForTimeout(400);
await B.evaluate(()=>teamLoad()); await B.waitForTimeout(400); ok(await B.evaluate(()=>myNotes().some(n=>n.type==='erinnerung')),'Ben bekommt Erinnerung im Posteingang');
// Ben verlässt
await B.evaluate(()=>teamLeave()); await B.waitForTimeout(500); await A.evaluate(()=>teamLoad()); await A.waitForTimeout(400); ok(await A.evaluate(()=>TEAM.data.mem.length===1 && TEAM.data.ent.length===1),'Ben verlassen – nur Anna übrig');
ok(errs.length===0,'Keine Skriptfehler '+errs.join(' | ')); await b.close();
