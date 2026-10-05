// Startseite Monat, Nachbartage überall, Wischen, Schichten im Jahreskalender
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7'],timezoneId:'Europe/Berlin'}); await c.addInitScript(()=>{ const T=new Date('2026-10-05T09:00:00').getTime(); const D=Date; class F extends D{ constructor(...a){ super(...(a.length?a:[T])); } static now(){ return T; } } window.Date=F; });
const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(x,m)=>console.log((x?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
await p.evaluate(()=>{ S.land='NW'; S.rots=[{id:'r',name:'x',start:'2026-01-05',pattern:['F','F','N','N',null,null,null]}]; S.vacs=[]; S.ov={}; addVac('2026-10-19','2026-10-23'); S.guide={hide:true,pickhide:true}; save(); show('heute'); document.querySelector('#toast').hidden=true; });
await p.waitForTimeout(300);
const swipe=async(sel,dy)=>{ const bb=await p.locator(sel).boundingBox(); const x=bb.x+bb.width/2, y=bb.y+bb.height/2; await p.mouse.move(x,y); await p.mouse.down(); for(let i=1;i<=6;i++){ await p.mouse.move(x,y+dy*i/6); } await p.mouse.up(); await p.waitForTimeout(200); };
// Heute: Woche/Monat
await p.locator('#v-heute .hseg button',{hasText:'Monat'}).tap(); await p.waitForTimeout(200);
ok(await p.isVisible('#hmonth'), 'Startseite: Monatsansicht');
ok(/Oktober 2026/.test(await p.locator('#hmonth h4').innerText()), 'Zeigt Oktober 2026');
ok(await p.locator('#hmonth .mc.out').count()===3+1, 'Nachbartage sichtbar ('+await p.locator('#hmonth .mc.out').count()+': 28.–30.9. + 1.11.)');
ok(await p.locator('#hmonth .mc.vd').count()===4, 'Urlaub im Monat markiert ('+await p.locator('#hmonth .mc.vd').count()+')');
ok(await p.locator('#hmonth .mc.vd .chip').first().innerText()==='T', 'Urlaubstag zeigt Schicht');
ok(/Urlaub: 19\.10?\./.test(await p.locator('#hmonth').innerText()), 'Urlaubszeile im Monat');
await p.screenshot({path:'/tmp/claude-0/t34-heute.png'});
await swipe('#hmonth .mcal',-120);
ok(/November 2026/.test(await p.locator('#hmonth h4').innerText()), 'Hochwischen → November');
await swipe('#hmonth .mcal',120); await swipe('#hmonth .mcal',120);
ok(/September 2026/.test(await p.locator('#hmonth h4').innerText()), 'Runterwischen → September');
await p.evaluate(()=>renderHeute()); ok(await p.isVisible('#hmonth'), 'Monatsansicht bleibt gemerkt');
await p.locator('#hmonth .mc:not(.out)[data-s="2026-09-10"]').tap(); await p.waitForTimeout(200);
ok(/10\./.test(await p.locator('#pan h2').first().innerText()), 'Tag antippen öffnet Tag'); await p.evaluate(()=>closeSheet());
// Urlaub-Tab-Monate mit Nachbartagen
await p.evaluate(()=>show('urlaub')); await p.waitForTimeout(200);
ok(await p.locator('#vmonths .mc.out').count()>0, 'Urlaub-Tab: Nachbartage');
// vacPicker wischen
await p.evaluate(()=>{ openAgent(); }); await p.waitForTimeout(300);
const vp=p.locator('#vpick'); if(await vp.count()){ await vp.scrollIntoViewIfNeeded(); ok(await p.locator('#vpick .mc.out').count()>0,'Rechner-Kalender: Nachbartage'); const h0=await p.locator('#vpick h2').innerText(); await swipe('#vpick .mcal',-120); const h1=await p.locator('#vpick h2').innerText(); ok(h0!==h1, 'Urlaubsrechner-Kalender wischen: '+h0+' → '+h1);} else ok(false,'vpick fehlt');
await p.evaluate(()=>closeSheet());
// Rhythmus-Vorschau
await p.evaluate(()=>{ editRot={...JSON.parse(JSON.stringify(S.rots[0]))}; openRot(); }); await p.waitForTimeout(300);
const hasPv=await p.locator('#pan .mnav').count(); if(hasPv){ const h0=await p.locator('#pan .mnav h4').first().innerText(); ok(await p.locator('#pan .mcal .mc.out').count()>0,'Rhythmus-Vorschau: Nachbartage'); await swipe('#pan .mcal >> nth=0',-120); ok(h0!==await p.locator('#pan .mnav h4').first().innerText(),'Rhythmus-Vorschau wischen'); } else console.log('· Rhythmus-Vorschau hier ohne Kalender');
await p.evaluate(()=>closeSheet());
// Jahreskalender: Schicht eintragen
await p.evaluate(()=>{ kalMode='jahr'; show('kal'); }); await p.waitForTimeout(200);
await p.locator('#v-kal .ypopen').tap(); await p.waitForTimeout(300);
ok(await p.isVisible('#yplan .ypbrush'), 'Kalender → Jahreskalender im Schicht-Modus');
await p.locator('#yplan .ypb small',{hasText:'Nacht'}).first().tap(); await p.waitForTimeout(150);
await p.locator('#yplan .ypc[data-s="2026-11-02"]').tap(); await p.locator('#yplan .ypc[data-s="2026-11-04"]').tap(); await p.waitForTimeout(100);
ok(/→ Nacht/.test(await p.locator('#ypbar').innerText()), 'Leiste: '+(await p.locator('#ypbar').innerText()).replace(/\n/g,' | '));
await p.locator('#ypbar').getByRole('button',{name:'Eintragen',exact:true}).tap(); await p.waitForTimeout(200);
ok(await p.evaluate(()=>['2026-11-02','2026-11-03','2026-11-04'].map(d=>shiftOf(d)&&shiftOf(d).short).join())==='N,N,N', 'Nachtschicht 2.–4.11. eingetragen');
ok(await p.locator('#yplan .ypc[data-s="2026-11-02"] .yps').innerText()==='N', 'Im Jahreskalender sichtbar');
await p.screenshot({path:'/tmp/claude-0/t34-yp.png'});
await p.locator('#toastb').tap(); await p.waitForTimeout(150);
ok(await p.evaluate(()=>shiftOf('2026-11-02').short)==='T', 'Rückgängig');
// Frei über Urlaub: Urlaub bleibt
await p.locator('#yplan .ypb small',{hasText:'Frei'}).first().tap();
await p.locator('#yplan .ypc[data-s="2026-10-19"]').tap(); await p.locator('#yplan .ypc[data-s="2026-10-27"]').tap(); await p.waitForTimeout(100);
await p.locator('#ypbar').getByRole('button',{name:'Eintragen',exact:true}).tap(); await p.waitForTimeout(200);
ok(await p.evaluate(()=>vacUsed(2026))===4 && await p.evaluate(()=>dayKind('2026-10-26'))==='f', 'Frei eingetragen, Urlaub bleibt');
await p.locator('#yplan .ypseg button',{hasText:'Urlaub'}).tap(); await p.waitForTimeout(100);
ok(await p.locator('#yplan .ypbrush').count()===0, 'Zurück in Urlaub-Modus');
await p.evaluate(()=>goBack());
// Monatsansicht im Kalender: Nachbartage
await p.evaluate(()=>{ kalMode='monat'; renderKal(); }); await p.waitForTimeout(200);
ok(await p.locator('#v-kal .day.out').count()>0, 'Kalender: Nachbartage');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
