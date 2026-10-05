import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const errs=[]; const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m);
async function person(){ const c=await b.newContext({...devices['Pixel 7'],acceptDownloads:true}); await c.addInitScript(()=>{ navigator.canShare=undefined; }); const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
  for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); } return p; }
const A=await person();
// 1) Zuschläge: Nacht Sa 22–So 6 (Pause 30), Feiertag 25.12. Früh
const r=await A.evaluate(()=>{ S.rots=[]; S.ov={}; S.ov['2026-10-10']='N'; S.ov['2026-12-25']='F'; S.pay={rate:20}; save();
  const n=shiftSplit('2026-10-10',typeOf('N')), f=shiftSplit('2026-12-25',typeOf('F')), o=monthPay(2026,9); return {n,f,sum:o.sum,base:o.base,night:o.night,sun:o.sun}; });
ok(r.n.min===450 && r.n.night===450 && r.n.sun===338 && r.n.hol===0, 'Nachtschicht Sa→So: 7,5 h, davon 7,5 h Nacht, 5,6 h Sonntag ('+JSON.stringify(r.n)+')');
ok(r.f.hol===450 && r.f.sun===0, 'Feiertag 25.12.: 7,5 h Feiertagszuschlag');
const exp=7.5*20 + 7.5*20*0.25 + 338/60*20*0.5; ok(Math.abs(r.sum-exp)<0.01, 'Oktober: '+r.sum.toFixed(2)+' € = 150 + 37,50 Nacht + 56,33 Sonntag');
// 2) Arbeitszeitkonto
const k=await A.evaluate(()=>{ S.soll=37.5; save(); return {soll:monthSoll(2026,9), ist:monthIst(2026,9)}; });
ok(k.soll===Math.round(37.5*60/7*31) && k.ist===450, 'Soll Oktober '+(k.soll/60).toFixed(1)+' h, Ist 7,5 h');
// 3) Statistik zeigt Verdienst und Konto
await A.evaluate(()=>{ statY=2026; statM=9; show('stat'); }); const st=(await A.locator('#v-stat').innerText()).replace(/\s+/g,' ');
ok(/Nachtzuschlag/.test(st) && /Summe/i.test(st) && /243,83/.test(st) && /Minusstunden/i.test(st), 'Statistik zeigt Verdienst (243,83 €) und Minusstunden');
// 4) Erinnerung im Kalender
const ics=await A.evaluate(()=>{ S.remind=60; S.ov[addD(TODAY(),2)]='F'; return makeICS(); });
ok(/BEGIN:VALARM[\s\S]*TRIGGER:-PT60M[\s\S]*END:VALARM/.test(ics), 'Kalender-Datei enthält Erinnerung 60 min vorher');
// 5) Vorlage 2-2-2 eintragen mit Start an Tag 3 (S)
await A.evaluate(()=>{ S.ov={}; S.rots=[]; S.tpls=[]; S.holFree=false; save(); show('heute'); });
await A.getByRole('button',{name:'Mein Rhythmus'}).first().tap(); await A.waitForTimeout(200);
await A.locator('summary',{hasText:'Fertige Vorlage'}).tap(); await A.locator('#pan .onbopt',{hasText:'2-2-2 + 4 frei'}).tap(); await A.waitForTimeout(200);
await A.locator('#pan .pick button').nth(2).tap(); await A.getByRole('button',{name:'In den Kalender eintragen'}).tap(); await A.waitForTimeout(300);
const pr=await A.evaluate(()=>[0,1,2,3,4,5,6].map(i=>{ const x=shiftOf(addD(TODAY(),i)); return x?x.short:'-'; }).join(''));
ok(pr==='SSNN---', 'Vorlage 2-2-2 ab heute mit Spätschicht: '+pr);
// 6) Gemeinsam frei: A schickt Link, B importiert
await A.evaluate(()=>{ S.name='Malik'; save(); });
const link=await A.evaluate(()=>planLink()); ok(link.length<4000, 'Plan-Link ist '+link.length+' Zeichen lang');
const B=await person(); await B.evaluate(()=>{ S.rots=[{id:'r1',name:'Mo-Fr',start:'2026-01-05',pattern:['F','F','F','F','F',null,null]}]; S.ov={}; save(); });
await B.goto(link.replace('https://maliksabti-cyber.github.io/urlaubsplaner/schicht/','http://localhost:8765/schicht/').replace(/^http:\/\/localhost:8765\/schicht\/(?=#)/,'http://localhost:8765/schicht/')); await B.waitForTimeout(900);
ok(/Plan von Malik hinzufügen/i.test(await B.locator('#ask').innerText()), 'Link öffnen fragt: „Plan von Malik hinzufügen?“');
await B.getByRole('button',{name:'Ja, hinzufügen'}).tap(); await B.waitForTimeout(300);
const bf=await B.evaluate(()=>{ const out=[]; for(let i=0;i<10;i++){ const s=addD(TODAY(),i); out.push(bothFree(s)?'♥':'·'); } return out.join(''); });
const expBF=await B.evaluate(()=>{ const out=[]; for(let i=0;i<10;i++){ const s=addD(TODAY(),i); const w=parse(s).getDay(); const mine=(w===0||w===6); const p=['S','S','N','N',null,null,null,null,null,null][i]; out.push(mine&&!p?'♥':'·'); } return out.join(''); });
const chk=await B.evaluate(()=>({o10:bothFree('2026-10-10'),o17:bothFree('2026-10-17'),o18:bothFree('2026-10-18'),o15:bothFree('2026-10-15')})); ok(!chk.o10&&chk.o17&&chk.o18&&!chk.o15, 'Gemeinsam frei: 10.10. nein (Malik Früh), 17./18.10. ja (beide frei), 15.10. nein (Anna arbeitet) '+JSON.stringify(chk));
await B.locator('.tabs button[data-v="kal"]').tap(); await B.waitForTimeout(200);
ok(await B.locator('.day .both').count()>0, 'Schichtplan markiert gemeinsame freie Tage mit ♥');
await B.locator('.tabs button[data-v="heute"]').tap(); ok(/Gemeinsam frei/.test(await B.locator('#v-heute').innerText()) && /Nächste Schicht/.test(await B.locator('#v-heute').innerText()), 'Startseite: „Nächste Schicht“ und „Gemeinsam frei“');
// 7) Beschädigter Link
await B.goto('http://localhost:8765/schicht/#plan=kaputt!!'); await B.waitForTimeout(800); ok(/beschädigt/.test(await B.locator('#toastt').innerText()), 'Kaputter Link: verständliche Meldung');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
