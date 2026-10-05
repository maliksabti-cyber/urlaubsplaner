// Runde 3: Live-Zeile auf Heute (läuft gerade / beginnt in / Feierabend, Nachtschicht von gestern), Statistik lesbar, „Zurück zu heute“ im Kalender
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7'], timezoneId:'Europe/Berlin'}); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m);
await p.clock.setFixedTime(new Date('2027-03-16T03:00:00+01:00')); // Di, 16.3.2027, 3 Uhr nachts
await p.goto('http://localhost:8765/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
// Mo Nacht, Di frei, Mi Tag, Do Spät (Wiederholung alle 4 Tage ab Mo 15.3.2027)
await p.evaluate(()=>{ setSel(false); S.rots=[{id:'r',name:'x',start:'2027-03-15',pattern:['N',null,'F','S']}]; S.vacs=[]; S.ov={}; S.guide={hide:true,pickhide:true}; S.newsSeen=9; save(); show('heute'); document.querySelector('#toast').hidden=true; });
await p.waitForTimeout(150);
const live=await p.locator('#live').innerText().catch(()=>'');
ok(/Läuft gerade: Nachtschicht seit gestern – Feierabend um 06:00 Uhr \(in 3 Std\.\)/.test(live), 'Freier Tag nach Nachtschicht um 3 Uhr: '+live);
const L=await p.evaluate(()=>{ const at=(d,h,m)=>new Date(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8),h,m); const f=(d,h,m)=>{ const r=liveLine(d,at(d,h,m)); return r?r[0]:null; };
  return { a:f('2027-03-15',20,0), b:f('2027-03-15',23,30), c:f('2027-03-17',15,0), d:f('2027-03-17',9,15), e:f('2027-03-16',7,0), wrong:liveLine('2027-03-17',at('2027-03-16',9,0)) }; });
ok(L.a==='Beginnt in 2 Std.', 'Mo 20:00 vor Nachtschicht: '+L.a);
ok(L.b==='Läuft gerade – Feierabend um 06:00 Uhr (in 6 Std. 30 Min.)', 'Mo 23:30 in Nachtschicht: '+L.b);
ok(L.c==='Geschafft – Feierabend seit 14:00 Uhr', 'Mi 15:00 nach Tagschicht: '+L.c);
ok(L.d==='Läuft gerade – Feierabend um 14:00 Uhr (in 4 Std. 45 Min.)', 'Mi 9:15 in Tagschicht: '+L.d);
ok(L.e===null && L.wrong===null, 'Freier Tag nach 6 Uhr und fremdes Datum: keine Live-Zeile');
// Statistik: Stunden brechen nicht um
await p.evaluate(()=>{ statY=2027; statM=2; show('stat'); }); await p.waitForTimeout(150);
const h=await p.evaluate(()=>{ const b=document.querySelector('#v-stat .stats3 .stat b'); return b.getBoundingClientRect().height/parseFloat(getComputedStyle(b).lineHeight||'30'); });
ok(h<1.5, 'Statistik: Arbeitszeit steht in einer Zeile');
// Kalender: „Zurück zu heute“
await p.evaluate(()=>{ kalMode='monat'; curY=2027; curM=2; show('kal'); }); await p.waitForTimeout(100);
ok(await p.locator('#kaltoday').count()===0, 'Aktueller Monat: kein „Zurück zu heute“');
await p.locator('#v-kal .mhead button').last().tap(); await p.locator('#v-kal .mhead button').last().tap(); await p.waitForTimeout(100);
await p.locator('#kaltoday').tap(); await p.waitForTimeout(100);
ok(/MÄRZ 2027/i.test(await p.locator('#v-kal .mhead h2').innerText()), 'Zwei Monate weiter → „Zurück zu heute“ springt in den März 2027');
await p.screenshot({path:'/tmp/claude-0/sc/t26.png'});
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
