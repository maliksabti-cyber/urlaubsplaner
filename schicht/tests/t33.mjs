// Jahreskalender: Urlaub mit dem Finger einzeichnen, Feiertage + Ferien sichtbar
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7'],timezoneId:'Europe/Berlin'}); await c.addInitScript(()=>{ const T=new Date('2026-10-05T09:00:00').getTime(); const D=Date; class F extends D{ constructor(...a){ super(...(a.length?a:[T])); } static now(){ return T; } } window.Date=F; });
const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(x,m)=>console.log((x?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
await p.evaluate(()=>{ S.land='NW'; S.rots=[{id:'r',name:'x',start:'2026-01-05',pattern:['F','F','N','N',null,null,null]}]; S.vacs=[]; S.guide={hide:true,pickhide:true}; save(); show('urlaub'); });
await p.waitForTimeout(300);
await p.locator('.ypopen').tap(); await p.waitForTimeout(300);
ok(await p.isVisible('#yplan'), 'Jahreskalender öffnet aus dem Urlaub-Tab');
ok(/2026 · Juli – Dezember/i.test(await p.locator('#yplan h2').innerText()), 'Startet im Oktober 2026 mit Juli–Dezember');
await p.getByRole('button',{name:'Weiter'}).tap(); await p.waitForTimeout(200);
const h2=await p.locator('#yplan h2').innerText(); ok(/2027 · Januar – Juni/i.test(h2), 'Startet mit 2027 Jan–Jun ('+h2+')');
const cls=s=>p.evaluate(s=>document.querySelector('#yplan .ypc[data-s="'+s+'"]')?.className||'',s);
ok(/\bho\b/.test(await cls('2027-05-27')), 'Fronleichnam 27.5.2027 als Feiertag markiert');
ok(/\bho\b/.test(await cls('2027-01-01')), 'Neujahr markiert');
ok(/\bfe\b/.test(await cls('2027-04-01')), 'Osterferien (1.4.2027) markiert');
ok(await p.evaluate(()=>document.querySelector('#yplan .ypc[data-s="2027-01-01"] .yps.free')?.textContent)==='F', 'Freie Tage im Jahreskalender als F sichtbar');
ok(/\bso\b/.test(await cls('2027-01-03')) && /\bsa\b/.test(await cls('2027-01-02')), 'Wochenende markiert');
await p.screenshot({path:'/tmp/claude-0/t33-a.png'});
// Halbjahr wechseln
await p.getByRole('button',{name:'Weiter'}).tap(); await p.waitForTimeout(200);
ok(/Juli – Dezember/i.test(await p.locator('#yplan h2').innerText()), 'Wechsel auf Juli–Dezember');
ok(/\bfe\b/.test(await cls('2027-07-20')), 'Sommerferien markiert');
// Linie ziehen 12.7. → 23.7.
const box=async s=>p.locator('#yplan .ypc[data-s="'+s+'"]').boundingBox();
const A=await box('2027-07-12'), E=await box('2027-07-23');
await p.mouse.move(A.x+A.width/2,A.y+A.height/2); await p.mouse.down();
for(let i=1;i<=8;i++){ await p.mouse.move(A.x+A.width/2,A.y+A.height/2+(E.y-A.y)*i/8); await p.waitForTimeout(20); }
await p.mouse.up(); await p.waitForTimeout(150);
const bar=await p.locator('#ypbar').innerText();
ok(await p.locator('#yplan .ypgrid .ypc.sel').count()===12, '12 Tage markiert ('+await p.locator('#yplan .ypgrid .ypc.sel').count()+')');
ok(/12\.07?.*23\.07?|12\.7.*23\.7/.test(bar) && /Urlaubstag/.test(bar), 'Leiste zeigt Zeitraum: '+bar.replace(/\n/g,' | '));
await p.screenshot({path:'/tmp/claude-0/t33-b.png'});
const exp=await p.evaluate(()=>vacCount('2027-07-12','2027-07-23').n);
await p.getByRole('button',{name:'Eintragen',exact:true}).tap(); await p.waitForTimeout(300); await p.evaluate(()=>{ const a=document.querySelector('#ask'); if(a) a.hidden=true; });
ok(await p.evaluate(()=>vacUsed(2027))===exp && exp>0, 'Eingetragen: '+exp+' Urlaubstage');
ok(/\bva\b/.test(await cls('2027-07-12')), 'Urlaub im Jahreskalender sichtbar');
ok(await p.evaluate(()=>document.querySelector('#yplan .ypc[data-s="2027-07-12"] .yps')?.textContent)==='T', 'Urlaubstag zeigt Schicht T');
// Tippen: Anfang und Ende
await p.locator('#yplan .ypc[data-s="2027-10-04"]').tap(); await p.waitForTimeout(100);
await p.locator('#yplan .ypc[data-s="2027-10-08"]').tap(); await p.waitForTimeout(100);
ok(await p.locator('#yplan .ypgrid .ypc.sel').count()===5, 'Tippen Anfang/Ende markiert 5 Tage');
await p.getByRole('button',{name:'Auswahl löschen'}).tap(); await p.waitForTimeout(100);
ok(await p.locator('#yplan .ypgrid .ypc.sel').count()===0, 'Auswahl löschen');
// vorhandenen Urlaub antippen → Bearbeiten
await p.locator('#yplan .ypc[data-s="2027-07-14"]').tap(); await p.waitForTimeout(100);
await p.locator('#ypbar').getByRole('button',{name:'Bearbeiten'}).tap(); await p.waitForTimeout(200);
ok(await p.isHidden('#yplan') && /Urlaub bearbeiten/i.test(await p.locator('#pan h2').first().innerText()), 'Urlaub antippen → Bearbeiten');
await p.evaluate(()=>closeSheet());
// Zurück-Taste schließt
await p.evaluate(()=>openYearPlanner(2027)); await p.waitForTimeout(200);
await p.evaluate(()=>goBack()); await p.waitForTimeout(100);
ok(await p.isHidden('#yplan'), 'Zurück schließt den Jahreskalender');
// aus dem Eintragen-Fenster
await p.evaluate(()=>openVac()); await p.waitForTimeout(200);
await p.getByRole('button',{name:/Im Jahreskalender auswählen/}).tap(); await p.waitForTimeout(200);
ok(await p.isVisible('#yplan'), 'Aus „Urlaub eintragen“ erreichbar');
await p.getByRole('button',{name:'Schließen'}).tap(); await p.waitForTimeout(100);
ok(await p.isHidden('#yplan'), '✕ schließt');
// Dunkelmodus Bild
await p.emulateMedia({colorScheme:'dark'}); await p.evaluate(()=>openYearPlanner(2027)); await p.waitForTimeout(200); await p.screenshot({path:'/tmp/claude-0/t33-dark.png'});
const sw=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1 && document.querySelector('#yplan').scrollWidth<=innerWidth+1); ok(sw,'Kein Querscrollen');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
