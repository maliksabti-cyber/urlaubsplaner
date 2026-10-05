import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fakeFirebase } from './fakefb.mjs';
const ADMIN="malik.sabti@googlemail.com", URL0='http://localhost:8765/schicht/';
const fb=fakeFirebase(ADMIN);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const errs=[]; let step=0; const ok=(c,msg)=>{ step++; console.log((c?"✔":"✘")+" "+step+". "+msg); if(!c) process.exitCode=1; };
async function person(hash=''){ const c=await b.newContext({...devices['Pixel 7']}); await c.route(/googleapis\.com/,r=>fb.handle(r)); await c.addInitScript(()=>{ navigator.canShare=undefined; window.__wa=[]; });
  const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.goto(URL0+hash); await p.waitForTimeout(600);
  for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(250); }
  await p.evaluate(()=>{ S.rots=[{id:'r1',name:'T',start:'2026-01-05',pattern:['F','F','F','F','F',null,null]}]; save(); render(); }); return p; }
const tab=(p,v)=>p.locator(`.tabs button[data-v="${v}"]`).tap();
const txt=async p=>(await p.locator('#v-team').innerText()).replace(/\s+/g,' ');
async function register(p,name,mail,pw){ await tab(p,'team'); await p.getByRole('button',{name:'Konto erstellen'}).first().tap(); await p.fill('#tname',name); await p.fill('#tmail',mail); await p.fill('#tpw',pw); await p.locator('#v-team button[type=submit]').tap(); await p.waitForTimeout(600); }
async function refresh(p){ await p.getByRole('button',{name:'↻ Aktualisieren'}).tap(); await p.waitForTimeout(500); }
async function addVac(p,a,e){ await p.evaluate(()=>openVac()); await p.waitForTimeout(200); const ins=p.locator('#pan input[type=date]'); await ins.nth(0).fill(a); await ins.nth(1).fill(e); await ins.nth(1).dispatchEvent('input'); await p.locator('#pan button.pri').last().tap(); await p.waitForTimeout(700); }

// 1) Admin richtet Team ein
const A=await person(); await register(A,'Malik Sabti',ADMIN,'geheim123');
ok(/Verwalten/i.test(await txt(A)) && fb.db.mitarbeiter.size===1 && [...fb.db.mitarbeiter.values()][0].approved===true, 'Admin erstellt Konto, ist sofort freigegeben und sieht „Verwalten“');
await A.selectOption('#tlimit','2'); await A.waitForTimeout(400);
ok([...fb.db.mitarbeiter.values()][0].maxWeg===2, 'Admin stellt „höchstens 2 gleichzeitig“ ein');
// 2) Einladen
await A.getByRole('button',{name:'Kollegen einladen'}).tap(); await A.waitForTimeout(200);
const wa=await A.locator('#pan a.sharebtn').first().getAttribute('href'), ml=await A.locator('#pan a.sharebtn').nth(1).getAttribute('href');
ok(wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes('/schicht/#team') && ml.startsWith('mailto:?subject='), 'Einladung per WhatsApp und E-Mail enthält den Team-Link');
await A.evaluate(()=>closeSheet());
// 3) Kollegin öffnet Einladungslink
const B=await person('#team');
ok(await B.isVisible('#v-team'), 'Einladungslink öffnet nach der Einrichtung direkt den Team-Bereich');
await register(B,'Anna Beispiel','anna@example.com','anna1234');
ok(/wartet auf die Freigabe/i.test(await txt(B)), 'Kollegin erstellt Konto und sieht „wartet auf Freigabe“');
// 4) Admin gibt frei
await refresh(A); ok(/Anna Beispiel/i.test(await txt(A)), 'Admin sieht Anna unter „Wartet auf Freigabe“');
await A.getByRole('button',{name:'Freigeben'}).tap(); await A.waitForTimeout(500);
await refresh(B); ok(/Dein Urlaub im Team/i.test(await txt(B)) && /höchstens 2 gleichzeitig/i.test(await txt(B)), 'Nach Freigabe sieht Anna das Team und die Grenze 2');
// 5) Namensdoppel
const X=await person(); await register(X,'anna beispiel','anna2@example.com','xxxxxx');
ok(/gibt es schon/i.test(await txt(X)) && ![...fb.users.values()].some(u=>u.email==='anna2@example.com'), 'Doppelter Name wird abgelehnt, Konto wieder gelöscht');
// 6) Urlaub eintragen und ans Team senden
await addVac(B,'2027-07-05','2027-07-16');
ok(await B.isVisible('#ask') && /Ans Team senden/i.test(await B.locator('#ask').innerText()), 'Nach dem Eintragen fragt die App: „Ans Team senden?“');
await B.getByRole('button',{name:'Ja, ans Team senden'}).tap(); await B.waitForTimeout(600);
ok([...fb.db.urlaube.values()].some(v=>v.name==='Anna Beispiel'&&v.start==='2027-07-05'&&v.end==='2027-07-16'), 'Annas Urlaub ist im Team gespeichert (auch für den Team-Urlaubsplaner sichtbar)');
// 7) Dritter Kollege ohne E-Mail, Login per Name
const C=await person('#team'); await register(C,'Ben Test','','ben12345'); await refresh(A); await A.getByRole('button',{name:'Freigeben'}).tap(); await A.waitForTimeout(400);
await C.getByRole('button',{name:'Vom Team abmelden'}).tap(); await C.waitForTimeout(200);
await C.fill('#tmail','Ben Test'); await C.fill('#tpw','ben12345'); await C.locator('#v-team button[type=submit]').tap(); await C.waitForTimeout(700);
console.log('C:',(await txt(C)).slice(0,300)); ok(/Ben Test/i.test(await txt(C)) && /Dein Urlaub im Team/i.test(await txt(C)), 'Kollege ohne E-Mail meldet sich mit seinem Namen an');
await addVac(C,'2027-07-12','2027-07-23'); await C.getByRole('button',{name:'Ja, ans Team senden'}).tap(); await C.waitForTimeout(500);
// 8) Admin bucht in die volle Zeit -> Warnung + Überschneidung
await refresh(A); await addVac(A,'2027-07-14','2027-07-15');
ok(/bis zu 3 gleichzeitig weg \(erlaubt: 2\)/i.test(await A.locator('#ask').innerText()), 'Warnung: „Dann wären bis zu 3 gleichzeitig weg (erlaubt: 2)“');
await A.getByRole('button',{name:'Ja, ans Team senden'}).tap(); await A.waitForTimeout(600); await tab(A,'team'); await A.waitForTimeout(300);
const at=await txt(A); ok(/14\.7\. – 15\.7\.: 3 gleichzeitig weg/i.test(at) && /Anna Beispiel/i.test(at), 'Überschneidungen zeigen 14.–15.7.: 3 gleichzeitig weg, mit Namen');
// 9) Assistent vermeidet volle Tage
await tab(B,'team'); await refresh(B);
const plan=await B.evaluate(()=>{ agState.year=2027; openAgent(); document.querySelector('#agtext').value='1 Woche im Juli'; [...document.querySelectorAll('#pan button')].find(b=>b.textContent==='Vorschlag berechnen').click(); return {plan:agState.plan.map(x=>[x.start,x.end]), note:(document.querySelector('#agout .banner')||{}).innerText||''}; });
const clash=plan.plan.some(([s,e])=>!(e<'2027-07-14'||s>'2027-07-15'));
ok(plan.plan.length && !clash && /aus dem Team/i.test(plan.note), 'Assistent plant Anna eine Juli-Woche ohne die vollen Tage 14.–15.7. ('+plan.plan.map(x=>x.join('–')).join(', ')+')');
// 10) Abgleich: im Team gelöscht/ergänzt
fb.db.urlaube.set('vX',{name:'Anna Beispiel',start:'2027-09-01',end:'2027-09-03',created:1}); await B.evaluate(()=>closeSheet()); await refresh(B);
ok(/Nur im Team: 1\.9\.–3\.9\./i.test(await txt(B)), 'Urlaub, der nur im Team steht, wird angezeigt');
await B.getByRole('button',{name:'Übernehmen'}).tap(); await B.waitForTimeout(300);
ok(await B.evaluate(()=>!!vacAt('2027-09-02')), '… und lässt sich in den eigenen Plan übernehmen');
// 11) Nicht freigegebene sehen keinen Urlaub
const D=await person(); await register(D,'Neu Ling','neu@example.com','neu12345');
ok(!/Demnächst im Urlaub/i.test(await txt(D)) && /wartet/i.test(await txt(D)), 'Nicht freigegebene Personen sehen keinen Urlaub der anderen');
// 12) Abmelden behält persönliche Daten
const before=await B.evaluate(()=>vacList().length); await tab(B,'team'); await B.getByRole('button',{name:'Vom Team abmelden'}).tap(); await B.waitForTimeout(200);
ok(await B.evaluate(()=>vacList().length)===before && await B.isVisible('#tmail'), 'Abmelden vom Team lässt den eigenen Plan unverändert');
ok(errs.length===0, 'Keine Skriptfehler'+(errs.length?': '+errs.join(' | '):''));
await A.screenshot({path:'/tmp/claude-0/team-admin.png',fullPage:true});
await b.close();
