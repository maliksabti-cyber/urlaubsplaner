// Urlaubsantrag nach dem Eintragen + mehrere Urlaube in einem Antrag; Verfall von Resturlaub (Stichtag)
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7'], acceptDownloads:true, timezoneId:'Europe/Berlin'}); await c.addInitScript(()=>{ navigator.canShare=undefined; });
const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m);
await p.clock.setFixedTime(new Date('2027-02-01T10:00:00+01:00'));
await p.goto('http://localhost:8765/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
await p.evaluate(()=>{ setSel(false); S.rots=[{id:'r',name:'Mo-Fr',start:'2024-01-01',pattern:['F','F','F','F','F',null,null]}]; S.vacs=[]; S.ov={}; S.carry={}; S.vacPerYear=30; S.holFree=true; S.name='Anna Test'; S.guide={hide:true,pickhide:true}; S.newsSeen=9; save(); show('heute'); document.querySelector('#toast').hidden=true; });
// 1) Nach dem Eintragen: Meldung mit „Antrag“
await p.evaluate(()=>openVac()); await p.fill('#vfrom','2027-05-10'); await p.dispatchEvent('#vfrom','input'); await p.fill('#vto','2027-05-12'); await p.dispatchEvent('#vto','input'); await p.waitForTimeout(100);
await p.locator('#pan').getByRole('button',{name:'Eintragen'}).tap(); await p.waitForTimeout(250);
ok(await p.locator('#toastb').isVisible() && /Rückgängig/.test(await p.locator('#toastb').innerText()) && await p.locator('#toastb2').isVisible(), 'Meldung nach dem Eintragen: „Rückgängig“ und „📄 Antrag“');
let [dl]=await Promise.all([p.waitForEvent('download'), p.locator('#toastb2').tap()]);
ok(dl.suggestedFilename()==='Urlaubsantrag_2027-05-10_bis_2027-05-12.pdf', 'Antrag direkt aus der Meldung: '+dl.suggestedFilename());
// 2) Mehrere Urlaube in einem Antrag
await p.evaluate(()=>{ S.vacs.push({id:'x2',a:'2027-08-02',e:'2027-08-13'}); save(); uY=2027; show('urlaub'); }); await p.waitForTimeout(150);
await p.locator('#antragmulti').tap(); await p.waitForTimeout(150);
ok(await p.locator('#pan .agitem').count()===2 && /2 Urlaube, 13 Tage/.test(await p.locator('#antraggo').innerText()), 'Auswahl: 2 Urlaube, 13 Tage');
await p.locator('#pan .agitem input').first().uncheck(); await p.waitForTimeout(80);
ok(/1 Urlaub, 10 Tage/.test(await p.locator('#antraggo').innerText()), 'Abwählen: 1 Urlaub, 10 Tage');
await p.locator('#pan .agitem input').first().check(); await p.waitForTimeout(80);
[dl]=await Promise.all([p.waitForEvent('download'), p.locator('#antraggo').tap()]); await dl.saveAs('/tmp/claude-0/antrag2.pdf'); const pdf=fs.readFileSync('/tmp/claude-0/antrag2.pdf','latin1');
ok(dl.suggestedFilename()==='Urlaubsantrag_2027-05-10_bis_2027-08-13.pdf' && pdf.includes('(Zusammen: 13 Urlaubstage)') && pdf.includes('FOLGENDE ZEITR'), 'Ein PDF mit beiden Zeiträumen und Summe 13');
// 3) Verfall: 10 Tage Rest aus 2026, 5 Tage im Februar genommen → 5 verfallen am 31.3.
await p.evaluate(()=>{ closeSheet(); S.vacs=[{id:'f',a:'2027-02-08',e:'2027-02-12'}]; S.carry={2027:10}; delete S.expire; save(); show('heute'); }); await p.waitForTimeout(150);
const eh=await p.locator('#expheute').innerText().catch(()=>'');
ok(/5 Tage aus 2026 verfallen am 31\.3\./.test(eh), 'Heute: '+eh.split('\n')[0]);
ok(await p.evaluate(()=>vacTotal(2027))===40, 'Vor dem Stichtag zählt der Rest noch (40)');
await p.evaluate(()=>{ S.vacs.push({id:'g',a:'2027-06-07',e:'2027-06-11'}); save(); });
ok(await p.evaluate(()=>expInfo(2027).left)===5, 'Urlaub im Juni rettet den Rest nicht (zählt erst ab Stichtag)');
await p.evaluate(()=>{ uY=2027; show('urlaub'); }); await p.waitForTimeout(100);
ok(await p.locator('#expurlaub').isVisible(), 'Urlaub-Tab zeigt den Verfall-Hinweis');
ok(await p.evaluate(()=>!stepDone('plan','expire')) && /5 Tage aus 2026 verfallen/.test(await p.evaluate(()=>S_.expire.w)), 'Lotse: Schritt „Resturlaub vor dem Verfall nehmen“ ist offen');
await p.clock.setFixedTime(new Date('2027-04-02T10:00:00+02:00')); await p.evaluate(()=>renderUrlaub()); await p.waitForTimeout(100);
ok(await p.evaluate(()=>vacTotal(2027))===35 && /5 Tage Resturlaub aus 2026 verfallen/.test(await p.locator('#v-urlaub').innerText()) && await p.locator('#expurlaub').count()===0, 'Nach dem 31.3.: 5 Tage verfallen, Anspruch 35');
// abschalten
await p.evaluate(()=>openVacSettings(2027)); await p.waitForTimeout(100); await p.selectOption('#vs_expire','off'); await p.waitForTimeout(80);
ok(await p.evaluate(()=>vacTotal(2027))===40 && await p.locator('#pan .vsbox').innerText().then(t=>!/Verfallen/.test(t)), 'Verfall abschaltbar: wieder 40');
await p.selectOption('#vs_expire','06-30'); await p.waitForTimeout(80);
ok(await p.evaluate(()=>expInfo(2027).left)===0 && await p.evaluate(()=>vacTotal(2027))===40, 'Stichtag 30.6.: Juni-Urlaub verbraucht den Rest, nichts verfällt');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
