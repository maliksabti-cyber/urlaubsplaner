// Schichttausch vermerken + Statistik für Abrechnungszeitraum / frei wählbaren Zeitraum
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7'], timezoneId:'Europe/Berlin'}); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m);
await p.clock.setFixedTime(new Date('2027-03-20T10:00:00+01:00'));
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
await p.evaluate(()=>{ setSel(false); S.rots=[{id:'r',name:'Mo-Fr',start:'2024-01-01',pattern:['F','F','F','F','F',null,null]}]; S.vacs=[]; S.ov={}; S.swaps=[]; S.holFree=true; S.pay={rate:20}; S.soll=40; S.guide={hide:true,pickhide:true}; S.newsSeen=9; save(); kalMode='monat'; curY=2027; curM=2; show('kal'); });
// 1) Tausch im Tagesfenster
await p.locator('#v-kal .day:not(.out)[data-s="2027-03-23"]').tap(); await p.waitForTimeout(150);
await p.locator('#swapadd').tap(); await p.fill('#swapwho','Jonas'); await p.fill('#swapother','2027-03-27'); await p.locator('#swapsave').tap(); await p.waitForTimeout(150);
ok(/Getauscht mit Jonas · Gegentag 27\.3\. · offen/.test(await p.locator('#swapbox').innerText()), 'Tagesfenster: „Getauscht mit Jonas · Gegentag 27.3. · offen“');
ok(await p.evaluate(()=>S.swaps.length===1 && S.swaps[0].d==='2027-03-23' && S.swaps[0].o==='2027-03-27'), 'Tausch gespeichert (Tag + Gegentag)');
await p.evaluate(()=>closeSheet()); await p.waitForTimeout(100);
ok(await p.locator('#v-kal .day:not(.out)[data-s="2027-03-23"] .swp').count()===1 && await p.locator('#v-kal .day:not(.out)[data-s="2027-03-27"] .swp').count()===1 && await p.locator('#v-kal .day:not(.out)[data-s="2027-03-24"] .swp').count()===0, 'Kalender markiert Tag und Gegentag mit ⇄');
ok(/1 offen/.test(await p.locator('#swaplist').innerText()), 'Schichtplan: Knopf „⇄ Tausch (1 offen)“');
await p.locator('#swaplist').tap(); await p.waitForTimeout(150);
ok(/Offen \(1\)/i.test(await p.locator('#pan').innerText()) && /Erledigt \(0\)/i.test(await p.locator('#pan').innerText()), 'Liste: Offen (1), Erledigt (0)');
await p.locator('#pan .vrow').first().tap(); await p.waitForTimeout(150);
await p.locator('#swapbox').getByRole('button',{name:'✓ Erledigt'}).tap(); await p.waitForTimeout(100);
ok(await p.evaluate(()=>S.swaps[0].done===true) && /erledigt/.test(await p.locator('#swapbox').innerText()), 'Als erledigt markiert');
await p.evaluate(()=>{ closeSheet(); openSwaps(); }); await p.waitForTimeout(100);
ok(/Offen \(0\)/i.test(await p.locator('#pan').innerText()) && /Erledigt \(1\)/i.test(await p.locator('#pan').innerText()), 'Liste: jetzt unter Erledigt');
await p.evaluate(()=>{ closeSheet(); openDay('2027-03-27'); }); await p.waitForTimeout(100);
ok(/Gegentag für 23\.3\./.test(await p.locator('#swapbox').innerText()), 'Gegentag zeigt „Gegentag für 23.3.“');
// 2) Statistik: Abrechnungszeitraum 16.–15.
await p.evaluate(()=>{ closeSheet(); show('stat'); }); await p.waitForTimeout(100);
await p.locator('#statmode').getByRole('button',{name:'Abrechnung'}).tap(); await p.waitForTimeout(100);
await p.fill('#payday','16'); await p.dispatchEvent('#payday','change'); await p.waitForTimeout(150);
ok(/16\.3\. – 15\.4\.2027/.test(await p.locator('#rangetitle').innerText()), 'Abrechnung 16.–15.: '+await p.locator('#rangetitle').innerText());
const exp=await p.evaluate(()=>{ const o=rangeWork('2027-03-16','2027-04-15'); return {h:hStr(o.min), sum:eur(rangePay('2027-03-16','2027-04-15').sum), sh:o.shifts}; });
ok(exp.sh===21 && (await p.locator('#rangestats').innerText()).includes(exp.h), 'Arbeitszeit im Zeitraum: '+exp.sh+' Schichten, '+exp.h+' (Karfreitag/Ostermontag frei)');
ok((await p.locator('#rangepay').innerText()).includes(exp.sum), 'Verdienst im Zeitraum: '+exp.sum);
await p.locator('#v-stat .mhead button').first().tap(); await p.waitForTimeout(100);
ok(/16\.2\. – 15\.3\.2027/.test(await p.locator('#rangetitle').innerText()), 'Zurückblättern: 16.2. – 15.3.');
// 3) Frei von–bis
await p.locator('#statmode').getByRole('button',{name:'Von – Bis'}).tap(); await p.waitForTimeout(100);
await p.fill('#st_from','2027-03-01'); await p.dispatchEvent('#st_from','change'); await p.fill('#st_to','2027-03-07'); await p.dispatchEvent('#st_to','change'); await p.waitForTimeout(150);
ok(/5 Schichten/.test(await p.locator('#rangestats').innerText()) && /40,0 Std\./.test(await p.locator('#v-stat').innerText()), 'Von–Bis 1.–7.3.: 5 Schichten, Soll 40 h');
await p.evaluate(()=>{ S.soll=38.5; statFrom='2027-01-01'; statTo='2027-12-31'; renderStat(); }); await p.waitForTimeout(100);
ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth), 'Große Zahlen (ganzes Jahr): nichts ragt seitlich heraus');
ok(await p.evaluate(()=>S.statMode)==='frei', 'Gewählte Ansicht wird gemerkt');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
