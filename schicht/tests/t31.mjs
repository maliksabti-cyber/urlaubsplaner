// Urlaubstage zeigen die eigentliche Schicht; Urlaub überall bearbeitbar
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7'],timezoneId:'Europe/Berlin'}); await c.addInitScript(()=>{ const T=new Date('2026-10-05T09:00:00').getTime(); const D=Date; class F extends D{ constructor(...a){ super(...(a.length?a:[T])); } static now(){ return T; } } window.Date=F; });
const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(x,m)=>console.log((x?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
await p.evaluate(()=>{ S.rots=[{id:'r',name:'x',start:'2026-01-05',pattern:['F','F','S','S',null,null,null]}]; S.vacs=[]; addVac('2026-11-09','2026-11-19'); S.guide={hide:true,pickhide:true}; save(); curY=2026; curM=10; kalMode='monat'; show('kal'); setSel(false); });
await p.waitForTimeout(300);
const cell=d=>p.evaluate(d=>{ const c=document.querySelector('.day:not(.out)[data-s="'+d+'"]'); return c?(c.classList.contains('vday')?'U:':'')+c.querySelector('.chip').textContent+(c.querySelector('.vtm')?'/Urlaub':''):'?'; },d);
ok(await cell('2026-11-09')==='U:T/Urlaub' && await cell('2026-11-11')==='U:S/Urlaub', 'Urlaubstag zeigt Schicht: Mo '+await cell('2026-11-09')+', Mi '+await cell('2026-11-11'));
ok(!/vday/.test(await p.evaluate(()=>document.querySelector('.day:not(.out)[data-s="2026-11-13"]').className)) && await cell('2026-11-13')==='F', 'Freier Tag im Urlaub bleibt F');
await p.screenshot({path:'/tmp/claude-0/t31-kal.png'});
// Bearbeiten aus dem Tagesfenster
await p.evaluate(()=>openDay('2026-11-10')); await p.waitForTimeout(150);
await p.getByRole('button',{name:/Urlaub .* bearbeiten/}).tap(); await p.waitForTimeout(150);
ok(/Urlaub bearbeiten/i.test(await p.locator('#pan h2').first().innerText()) && await p.inputValue('#ve_from')==='2026-11-09', 'Tagesfenster → „Urlaub bearbeiten" mit Von/Bis');
await p.fill('#ve_to','2026-11-12'); await p.locator('#ve_to').dispatchEvent('input'); await p.waitForTimeout(100);
ok(/4 Urlaubstage/.test(await p.locator('#pan .card').first().innerText()), 'Vorschau: 9.–12.11. = 4 Urlaubstage');
await p.getByRole('button',{name:'Änderung speichern'}).tap(); await p.waitForTimeout(300); await p.evaluate(()=>{ const a=document.querySelector('#ask'); if(a) a.hidden=true; });
ok(await p.evaluate(()=>vacUsed(2026))===4 && await p.evaluate(()=>S.vacs[0].e)==='2026-11-12', 'Gespeichert: 4 Tage, Ende 12.11.');
await p.locator('#toastb').tap(); await p.waitForTimeout(150);
ok(await p.evaluate(()=>S.vacs[0].e)==='2026-11-19', 'Rückgängig stellt 19.11. wieder her');
// Von Heute aus bearbeiten
await p.evaluate(()=>{ closeSheet(); show('heute'); }); await p.waitForTimeout(200);
const row=p.locator('#v-heute .vrow').first(); if(await row.count()){ await row.tap(); await p.waitForTimeout(150); ok(/Urlaub bearbeiten/i.test(await p.locator('#pan h2').first().innerText()), 'Heute: Urlaub antippen → bearbeiten'); }
else { const t=await p.locator('#v-heute').innerText(); ok(/Urlaub/.test(t), 'Heute zeigt Urlaub (keine Liste in diesem Layout)'); }
// Urlaub-Tab
await p.evaluate(()=>{ closeSheet(); show('urlaub'); }); await p.waitForTimeout(200);
const ur=p.locator('#v-urlaub .vrow').first(); await ur.tap(); await p.waitForTimeout(150);
ok(/Urlaub bearbeiten/i.test(await p.locator('#pan h2').first().innerText()), 'Urlaub-Tab: Urlaub antippen → bearbeiten');
await p.getByRole('button',{name:'Löschen'}).tap(); await p.waitForTimeout(150);
ok(await p.evaluate(()=>S.vacs.length)===0, 'Löschen funktioniert');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
