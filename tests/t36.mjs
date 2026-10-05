// Jahreskalender: Urlaub aus jedem Jahr bleibt gespeichert; Frage beim Schließen mit Auswahl
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7'],timezoneId:'Europe/Berlin'}); await c.addInitScript(()=>{ const T=new Date('2026-10-05T09:00:00').getTime(); const D=Date; class F extends D{ constructor(...a){ super(...(a.length?a:[T])); } static now(){ return T; } } window.Date=F; });
const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(x,m)=>console.log((x?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
await p.evaluate(()=>{ S.rots=[]; S.vacs=[]; S.ov={}; S.guide={hide:true,pickhide:true}; save(); show('urlaub'); }); await p.waitForTimeout(200);
const Y=p.locator('#yplan'); const nav=async(name,n)=>{ for(let i=0;i<n;i++){ await Y.getByRole('button',{name}).tap(); await p.waitForTimeout(80); } };
const cls=s=>p.evaluate(s=>document.querySelector('#yplan .ypc[data-s="'+s+'"]')?.className||'',s);
// 1) 2025 markieren, mit ✕ schließen → Frage → Ja
await p.locator('#v-urlaub .ypopen').tap(); await p.waitForTimeout(200); await nav('Zurück',3);
ok(/2025 · Januar/i.test(await Y.locator('h2').innerText()), '2025 Jan–Jun');
await Y.locator('.ypc[data-s="2025-03-10"]').tap(); await Y.locator('.ypc[data-s="2025-03-14"]').tap();
await Y.getByRole('button',{name:'Schließen'}).tap(); await p.waitForTimeout(150);
ok(await p.isVisible('#ask') && /Urlaub speichern/.test(await p.locator('#ask h2').textContent()), 'Schließen mit Markierung: Frage „Urlaub speichern?"');
await p.locator('#ask button',{hasText:'Ja, Urlaub speichern'}).tap(); await p.waitForTimeout(300);
ok(await p.isHidden('#yplan') && await p.evaluate(()=>vacUsed(2025))===5, 'Ja → gespeichert (2025: 5 Tage) und geschlossen');
// 2) Wieder öffnen → 2026 → 2025: noch da
await p.evaluate(()=>openYearPlanner(2026)); await p.waitForTimeout(200); await nav('Zurück',3);
ok(/\bva\b/.test(await cls('2025-03-12')), 'In 2025 weiterhin sichtbar');
// 3) Über den Jahreswechsel: 22.12.2025 – 9.1.2026
await nav('Weiter',1); await Y.locator('.ypc[data-s="2025-12-22"]').tap(); await nav('Weiter',1); await Y.locator('.ypc[data-s="2026-01-09"]').tap();
const bar=await p.locator('#ypbar').innerText(); ok(/2025: \d+ · 2026: \d+ übrig/.test(bar), 'Rest je Jahr: '+bar.split('\n')[1]);
await p.locator('#ypbar').getByRole('button',{name:'Eintragen',exact:true}).tap(); await p.waitForTimeout(300);
ok(/\bva\b/.test(await cls('2026-01-07')), 'Januar 2026 zeigt Urlaub');
await nav('Zurück',1); ok(/\bva\b/.test(await cls('2025-12-23')), 'Dezember 2025 zeigt Urlaub');
// 4) Nach Neuladen alles noch da
await p.reload(); await p.waitForTimeout(800);
const v=await p.evaluate(()=>[vacUsed(2025),vacUsed(2026),S.vacs.length]); ok(v[0]===11 && v[1]===6 && v[2]===2, 'Nach Neuladen: 2025='+v[0]+', 2026='+v[1]);
await p.evaluate(()=>{ uY=2026; show('urlaub'); renderUrlaub(); }); await p.waitForTimeout(150);
ok(/22\.12\./.test(await p.locator('#v-urlaub').innerText()), 'Urlaub-Tab 2026 zeigt den Urlaub ab 22.12.2025');
// 5) Markieren, Zurück-Taste → Nein verwerfen
await p.evaluate(()=>openYearPlanner(2026)); await p.waitForTimeout(200);
await Y.locator('.ypc[data-s="2026-11-02"]').tap(); await Y.locator('.ypc[data-s="2026-11-04"]').tap();
await p.evaluate(()=>goBack()); await p.waitForTimeout(150);
ok(await p.isVisible('#ask'), 'Zurück mit Markierung fragt auch');
await p.locator('#ask button',{hasText:'Nein, verwerfen'}).tap(); await p.waitForTimeout(200);
ok(await p.isHidden('#yplan') && await p.evaluate(()=>vacUsed(2026))===6, 'Verwerfen: nichts gespeichert');
// 6) Ohne Markierung: schließt ohne Frage
await p.evaluate(()=>openYearPlanner(2026)); await p.waitForTimeout(200);
await Y.getByRole('button',{name:'Schließen'}).tap(); await p.waitForTimeout(150);
ok(await p.isHidden('#yplan') && await p.isHidden('#ask'), 'Ohne Markierung: keine Frage');
// 7) Urlaub ohne Schichtplan verschwindet nicht, auch wenn später ein Rhythmus kommt
ok(await p.evaluate(()=>{ S.vacs.push({id:'x1',a:'2024-06-03',e:'2024-06-07'}); return vacUsed(2024); })===5, 'Urlaub ohne Plan und ohne feste Tage zählt Mo–Fr');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
