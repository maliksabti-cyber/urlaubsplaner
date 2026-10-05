import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7']}); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
// Mo–Do Tagschicht, Fr–So frei; Urlaub Mo 9.11. – Do 19.11.2026 (keine Feiertage)
await p.evaluate(()=>{ S.rots=[{id:'r',name:'Mo-Do',start:'2026-01-05',pattern:['F','F','F','F',null,null,null]}]; S.holFree=true; S.guide={hide:true,pickhide:true}; S.vacs=[]; save(); });
await p.evaluate(()=>openVac()); await p.waitForTimeout(150);
await p.fill('#vfrom','2026-11-09'); await p.fill('#vto','2026-11-19'); await p.locator('#vto').dispatchEvent('input'); await p.waitForTimeout(100);
const info=(await p.locator('#pan .card').first().innerText()).replace(/\s+/g,' ');
ok(/8 Urlaubstage/.test(info) && /11 Kalendertage, davon 3 ohnehin frei/.test(info), 'Vorschau: '+info.slice(0,80));
await p.locator('#pan button.pri').last().tap(); await p.waitForTimeout(400);
await p.evaluate(()=>{ const a=document.querySelector('#ask'); if(a) a.hidden=true; });
const r=await p.evaluate(()=>{ const out={}; for(let s='2026-11-09';s<='2026-11-19';s=addD(s,1)){ out[s.slice(8)]=(shiftOf(s)||{short:'–'}).short+'/'+(dayKind(s)||'-'); } return {days:out, used:vacUsed(2026)}; });
ok(r.used===8, 'Gezählt: '+r.used+' Urlaubstage (Mo–Do ×2), nicht 11');
ok(r.days['13']==='F/f' && r.days['14']==='F/f' && r.days['15']==='F/f', 'Fr 13., Sa 14., So 15. bleiben frei (F): '+[r.days['13'],r.days['14'],r.days['15']].join(' '));
ok(r.days['12']==='U/v' && r.days['16']==='U/v', 'Do 12. und Mo 16. sind Urlaub (U)');
await p.evaluate(()=>{ curY=2026; curM=10; show('kal'); setSel(false); document.querySelector('#toast').hidden=true; }); await p.waitForTimeout(200);
const cell=await p.evaluate(()=>{ const c=document.querySelector('.day[data-s="2026-11-13"]'); return c.className+' | '+c.querySelector('.chip').textContent; });
ok(/fday/.test(cell) && !/vday/.test(cell) && /\| F$/.test(cell), 'Kalender Fr 13.11.: grün „frei“, nicht Urlaubsfarbe ('+cell+')');
await p.screenshot({path:'/tmp/claude-0/v-nov.png'});
// Ohne Schichtplan: Mo–Fr annehmen
await p.evaluate(()=>{ S.rots=[]; S.vacs=[]; save(); openVac(); }); await p.waitForTimeout(150);
await p.fill('#vfrom','2027-03-01'); await p.fill('#vto','2027-03-12'); await p.locator('#vto').dispatchEvent('input'); await p.waitForTimeout(100);
const i2=(await p.locator('#pan .card').first().innerText()).replace(/\s+/g,' ');
ok(/10 Urlaubstage/.test(i2) && /noch kein Schichtplan/.test(i2) && !(await p.locator('#pan button.pri').last().isDisabled()), 'Ohne Plan: 10 Tage (Mo–Fr), Hinweis, Eintragen möglich');
await p.locator('#pan button.pri').last().tap(); await p.waitForTimeout(300);
ok(await p.evaluate(()=>vacUsed(2027))===10, 'Ohne Plan eingetragen und gezählt: 10');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
