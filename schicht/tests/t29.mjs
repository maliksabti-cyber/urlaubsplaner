// Neuheiten-Karte v2 für bestehende Nutzer, neue Hilfe-Themen und Lotse-Schritte (Tausch, Abrechnung)
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7']}); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
// bestehender Nutzer, der die alte Karte (v1) schon weggeklickt hat
await p.evaluate(()=>{ setSel(false); S.rots=[{id:'r',name:'x',start:'2026-01-05',pattern:['F','F','F','F','F',null,null]}]; S.guide={hide:true,pickhide:true}; S.newsSeen=1; S.swaps=[]; delete S.payDay; save(); show('heute'); document.querySelector('#toast').hidden=true; });
await p.waitForTimeout(150);
const nt=await p.locator('.news').innerText().catch(()=>'');
ok(/Urlaubsantrag/.test(nt) && /Resturlaub/.test(nt) && /Läuft gerade/.test(nt) && /Schichttausch/.test(nt) && /Abrechnungszeitraum/.test(nt), 'Bestehende Nutzer sehen die Karte „Neu in der App“ mit allen 5 Neuheiten');
await p.screenshot({path:'/tmp/claude-0/sc/news2.png'});
await p.locator('.newsrow',{hasText:'Schichttausch'}).tap(); await p.waitForTimeout(250);
ok(await p.isVisible('#v-kal'), '„Schichttausch merken“ führt zum Schichtplan (noch kein Tausch)');
// Lotse-Schritte
ok(await p.evaluate(()=>goalById('shift').steps.includes('swap') && goalById('money').steps.includes('payperiod')), 'Lotse: Tausch im Ziel „Schichtplan ändern“, Abrechnung im Ziel „Verdienst“');
ok(await p.evaluate(()=>!stepDone('shift','swap') && !stepDone('money','payperiod')), 'Schritte anfangs offen');
await p.evaluate(()=>{ S.swaps=[{id:'a',d:'2026-11-03',w:'Jonas',o:null,done:false}]; S.payDay=16; save(); });
ok(await p.evaluate(()=>stepDone('shift','swap') && stepDone('money','payperiod')), 'Nach Tausch bzw. Beginn-Tag 16: automatisch erledigt');
// Hilfe
await p.evaluate(()=>openHelp()); await p.waitForTimeout(150);
for(const t of ['Urlaubsantrag','Resturlaub & Verfall','Schichttausch','Abrechnungszeitraum']) ok(await p.locator('#pan summary',{hasText:t}).count()===1, 'Hilfe-Thema „'+t+'“');
await p.locator('#pan summary',{hasText:'Schichttausch'}).tap(); await p.locator('#pan details[open] button').tap(); await p.waitForTimeout(200);
ok(/Schichttausch/i.test(await p.locator('#pan h2').first().innerText()), 'Hilfe „Ausprobieren“ öffnet die Tausch-Liste');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
