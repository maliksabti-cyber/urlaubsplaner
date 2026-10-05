import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7']}); await c.addInitScript(()=>{ navigator.canShare=undefined; }); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
await p.evaluate(()=>{ S.rots=[{id:'r',name:'x',start:'2026-01-05',pattern:['F','F','F','F',null,null,null]}]; S.pay={rate:20}; S.goal='money'; save(); closeSheet(); show('heute'); document.querySelector('#toast').hidden=true; });
await p.waitForTimeout(150);
// Übersicht öffnen
await p.locator('.guide summary').tap(); await p.waitForTimeout(100);
const boxes=p.locator('.guide .gstep .gck input'); ok(await boxes.count()===5, 'Übersicht: jeder Schritt hat ein Häkchenfeld (5)');
ok(await boxes.nth(1).isChecked(), 'Automatisch erledigt (Lohn) ist angehakt');
await boxes.nth(1).uncheck(); await p.waitForTimeout(150);
ok(await p.evaluate(()=>!stepDone('money','pay')), 'Automatischer Schritt lässt sich abwählen');
await p.locator('.guide summary').tap().catch(()=>{}); await p.waitForTimeout(100);
await p.evaluate(()=>{ const d=document.querySelector('.guide details'); if(d) d.open=true; }); await p.locator('.guide .gstep .gck input').nth(1).check(); await p.waitForTimeout(150);
ok(await p.evaluate(()=>stepDone('money','pay')), '… und wieder abhaken');
// Zurück-Pfeil: aus der Schrittliste (Fenster) in eine Funktion und zurück
await p.evaluate(()=>openGuide('money')); await p.waitForTimeout(150);
await p.locator('#pan .gstep',{hasText:'Lohn & Zuschläge eintragen'}).locator('button.btn').tap(); await p.waitForTimeout(200);
ok(/Lohn & Zuschläge/i.test(await p.locator('#pan h2').first().innerText()) && await p.isVisible('#hback'), 'Schritt geöffnet: Lohn-Fenster, Pfeil oben links sichtbar');
await p.locator('#hback').tap(); await p.waitForTimeout(200);
ok(/Verdienst/i.test(await p.locator('#pan h2').first().innerText()), 'Pfeil ← zurück zur Schrittliste');
await p.locator('#pan .gstep',{hasText:'Statistik'}).locator('button.btn').tap(); await p.waitForTimeout(200);
ok(await p.isVisible('#v-stat') && await p.locator('#sheet').isHidden(), 'Schritt „Statistik“ wechselt zur Statistik-Seite');
await p.locator('#hback').tap(); await p.waitForTimeout(250);
ok(!(await p.locator('#sheet').isHidden()) && /Verdienst/i.test(await p.locator('#pan h2').first().innerText()), 'Pfeil ← von der Statistik zurück zur Schrittliste');
await p.locator('#hback').tap(); await p.waitForTimeout(150); ok(await p.locator('#sheet').isHidden(), 'Pfeil ← schließt die Liste');
// Mehrere Fenster hintereinander: Urlaub eintragen → Urlaubsrechner → zurück
await p.evaluate(()=>openVac()); await p.waitForTimeout(100); await p.locator('#pan .btn.ai').tap(); await p.waitForTimeout(150);
ok(/Urlaubsrechner/i.test(await p.locator('#pan h2').first().innerText()), 'Aus „Urlaub eintragen“ in den Urlaubsrechner');
await p.locator('#pan [data-opt]').first().tap(); await p.waitForTimeout(100);
await p.locator('#hback').tap(); await p.waitForTimeout(150);
ok(/Urlaub eintragen/i.test(await p.locator('#pan h2').first().innerText()), 'Pfeil ← zurück zu „Urlaub eintragen“ (Auswahl im Rechner zählt nicht als eigener Schritt)');
await p.evaluate(()=>closeSheet());
// Übersicht aller Ziele mit Fortschritt
await p.evaluate(()=>openGoals()); await p.waitForTimeout(100);
ok(await p.locator('#pan .gprog').count()===8, 'Zielübersicht zeigt Fortschritt je Ziel'); await p.evaluate(()=>closeSheet());
// roter Rhythmus-Knopf
await p.evaluate(()=>{ show('kal'); setSel(false); }); await p.waitForTimeout(150);
const red=await p.evaluate(()=>{ const b=[...document.querySelectorAll('#v-kal button')].find(x=>/Mein Rhythmus bearbeiten/.test(x.textContent)); return b?getComputedStyle(b).backgroundColor:''; });
ok(red==='rgb(217, 72, 15)', '„Mein Rhythmus bearbeiten“ ist rot: '+red);
await p.screenshot({path:'/tmp/claude-0/r-kal.png'});
await p.evaluate(()=>{ show('heute'); const d=document.querySelector('.guide details'); if(d) d.open=true; }); await p.waitForTimeout(100); await p.locator('.guide').screenshot({path:'/tmp/claude-0/r-guide.png'});
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
