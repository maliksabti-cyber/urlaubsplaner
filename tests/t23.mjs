import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7']}); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
await p.evaluate(()=>{ S.rots=[{id:'r',name:'x',start:'2026-01-05',pattern:['F','F','F','F',null,null,null]}]; S.guide={hide:true,pickhide:true}; S.newsSeen=9; S.vacs=[]; save(); show('heute'); document.querySelector('#toast').hidden=true; });
await p.waitForTimeout(150);
await p.evaluate(()=>{ show('mehr'); }); await p.locator('#v-mehr .mrow',{hasText:'Urlaubsrechner'}).tap(); await p.waitForTimeout(250);
ok(await p.locator('#vpick').count()===1 && await p.getByRole('button',{name:/Selbst im Kalender eintragen/}).isVisible(), 'Urlaubsrechner hat „Selbst eintragen“ mit Kalender + Sprungknopf oben');
await p.getByRole('button',{name:/Selbst im Kalender eintragen/}).tap(); await p.waitForTimeout(400);
// zum November blättern, 9. und 19. antippen
const mon=async()=>await p.locator('#vpick .mhead h2').innerText();
const back=/2027|2028/.test(await mon()); for(let i=0;i<24 && !/NOVEMBER 2026/i.test(await mon());i++){ await p.locator('#vpick .mhead button')[back?'first':'last']().tap(); await p.waitForTimeout(60); }
await p.locator('#vpick .mc[data-s="2026-11-09"]').tap(); await p.waitForTimeout(80); await p.locator('#vpick .mc[data-s="2026-11-19"]').tap(); await p.waitForTimeout(120);
const sum=(await p.locator('#vpick .vpsum').innerText()).replace(/\s+/g,' ');
ok(/8 Urlaubstage/.test(sum) && /11 Kalendertage, davon 3 ohnehin frei/.test(sum), 'Antippen 9.→19.11.: '+sum);
ok(await p.locator('#vpick .mc.inrange').count()===11 && await p.inputValue('#vp_from')==='2026-11-09' && await p.inputValue('#vp_to')==='2026-11-19', 'Zeitraum markiert, Von/Bis-Felder gefüllt');
await p.screenshot({path:'/tmp/claude-0/vp.png'});
await p.locator('#vpick').getByRole('button',{name:'Urlaub eintragen'}).tap(); await p.waitForTimeout(400);
await p.evaluate(()=>{ const a=document.querySelector('#ask'); if(a) a.hidden=true; });
ok(await p.evaluate(()=>vacUsed(2026))===8 && await p.evaluate(()=>vacTotal(2026)-vacUsed(2026))===22, 'Eingetragen: 8 Tage, 22 übrig (2026)');
// per Datumsfeld
await p.locator('#vp_from').fill('2026-12-21'); await p.locator('#vp_from').dispatchEvent('change'); await p.waitForTimeout(80);
await p.locator('#vp_to').fill('2026-12-23'); await p.locator('#vp_to').dispatchEvent('change'); await p.waitForTimeout(80);
ok(/3 Urlaubstage/.test(await p.locator('#vpick .vpsum').innerText()) && /DEZEMBER 2026/i.test(await mon()), 'Datum eintippen: 21.–23.12. = 3 Tage, Kalender springt in den Dezember');
// Jahresansicht mit Zahlen
await p.evaluate(()=>{ closeSheet(); kalMode='jahr'; curY=2026; show('kal'); setSel(false); }); await p.waitForTimeout(200);
const nums=await p.evaluate(()=>[...document.querySelectorAll('.years .mini')][10].querySelectorAll('i:not(.e)').length+' / '+[...document.querySelectorAll('.years .mini')][10].querySelector('i:not(.e)').textContent);
ok(/^30 \/ 1$/.test(nums), 'Jahresansicht November: 30 Tage mit Zahlen (erste: 1)');
await p.screenshot({path:'/tmp/claude-0/yr.png'});
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
