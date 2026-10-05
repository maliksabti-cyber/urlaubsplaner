// Eingaben bleiben stehen (Entwurf), Frage beim Schließen; PDF zeigt Schichten + Urlaub
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7'],timezoneId:'Europe/Berlin'}); await c.addInitScript(()=>{ const T=new Date('2026-10-05T09:00:00').getTime(); const D=Date; class F extends D{ constructor(...a){ super(...(a.length?a:[T])); } static now(){ return T; } } window.Date=F; });
const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(x,m)=>console.log((x?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
await p.evaluate(()=>{ S.land='NW'; S.rots=[{id:'r',name:'x',start:'2026-01-05',pattern:['F','F','N','N',null,null,null]}]; S.vacs=[]; S.ov={}; S.guide={hide:true,pickhide:true}; save(); show('heute'); });
await p.waitForTimeout(200);
// 1) Eintippen, andere Seite, zurück
await p.evaluate(()=>openVac()); await p.waitForTimeout(200);
await p.fill('#vfrom','2026-11-09'); await p.fill('#vto','2026-11-13'); await p.waitForTimeout(100);
await p.getByRole('button',{name:/Urlaub passend zum Rhythmus berechnen/}).tap(); await p.waitForTimeout(300);
ok(!(await p.locator('#vfrom').count()), 'Andere Seite (Urlaubsrechner) offen');
await p.locator('#hback').tap(); await p.waitForTimeout(300);
ok(await p.inputValue('#vfrom')==='2026-11-09' && await p.inputValue('#vto')==='2026-11-13', 'Zurück: Eingaben sind noch da ('+await p.inputValue('#vfrom')+' – '+await p.inputValue('#vto')+')');
// 2) Schließen → Frage → Nein
await p.locator('#pan .top button[aria-label="Schließen"]').tap(); await p.waitForTimeout(150);
ok(await p.isVisible('#ask') && /speichern/i.test(await p.locator('#ask h2').innerText()), 'Beim Schließen: Frage „Eingaben speichern?"');
await p.locator('#ask button',{hasText:'Weiter bearbeiten'}).tap(); await p.waitForTimeout(100);
ok(await p.isVisible('#pan') && await p.inputValue('#vfrom')==='2026-11-09', 'Weiter bearbeiten: bleibt offen');
await p.locator('#pan .top button[aria-label="Schließen"]').tap(); await p.waitForTimeout(150);
await p.locator('#ask button',{hasText:'Nein, verwerfen'}).tap(); await p.waitForTimeout(200);
ok(await p.isHidden('#sheet'), 'Verwerfen schließt');
await p.evaluate(()=>openVac()); await p.waitForTimeout(200);
ok(await p.inputValue('#vfrom')==='2026-10-05', 'Nach Verwerfen wieder leer/Standard');
// 3) Eintippen, App neu laden → Eingaben noch da
await p.fill('#vfrom','2026-12-14'); await p.fill('#vto','2026-12-18'); await p.waitForTimeout(100);
await p.evaluate(()=>{ window.onbeforeunload=null; }); p.on('dialog',d=>d.accept());
await p.reload(); await p.waitForTimeout(800);
await p.evaluate(()=>openVac()); await p.waitForTimeout(200);
ok(await p.inputValue('#vfrom')==='2026-12-14', 'Nach Neuladen: Eingabe noch da');
// 4) Schließen → Ja, speichern
await p.locator('#pan .top button[aria-label="Schließen"]').tap(); await p.waitForTimeout(150);
await p.locator('#ask button',{hasText:'Ja, speichern'}).tap(); await p.waitForTimeout(400);
await p.evaluate(()=>{ const a=document.querySelector('#ask'); if(a) a.hidden=true; });
ok(await p.evaluate(()=>vacList().some(v=>v.a==='2026-12-14'&&v.e==='2026-12-18')), 'Ja, speichern trägt Urlaub ein');
await p.evaluate(()=>{ if(!document.querySelector('#sheet').hidden) closeSheet(); });
await p.evaluate(()=>openVac()); await p.waitForTimeout(200);
ok(await p.inputValue('#vfrom')==='2026-10-05', 'Nach Speichern kein alter Entwurf');
// 5) Nichts eingetippt → keine Frage
await p.locator('#pan .top button[aria-label="Schließen"]').tap(); await p.waitForTimeout(150);
ok(await p.isHidden('#sheet') && await p.isHidden('#ask'), 'Ohne Eingaben: schließt ohne Frage');
// 6) Sofort speichernde Felder fragen nicht
await p.evaluate(()=>show('set')); await p.waitForTimeout(200);
// 7) PDF
const pdf=await p.evaluate(async()=>{ let out=null; const o=window.pdfSave; window.pdfSave=async(b,n)=>{ out=typeof b==='string'?b:new TextDecoder('latin1').decode(b); }; addVac('2026-11-09','2026-11-13'); await pdfMonth(2026,10); const m=out; await pdfYear(2026); const y=out; window.pdfSave=o; return {m,y}; });
const cnt=(t,re)=>(t.match(re)||[]).length;
ok(cnt(pdf.m,/\(Urlaub\)/g)>=4, 'Monats-PDF: Urlaubstage ('+cnt(pdf.m,/\(Urlaub\)/g)+')');
ok(/\(30\)/.test(pdf.m) && /\(1\)/.test(pdf.m), 'Monats-PDF: Nachbartage dabei');
ok(cnt(pdf.m,/\(T\)/g)>=6 && cnt(pdf.m,/\(N\)/g)>=6, 'Monats-PDF: Schichten T/N');
ok(cnt(pdf.y,/\(Urlaub\)/g)>=8, 'Jahres-PDF: Urlaub ('+cnt(pdf.y,/\(Urlaub\)/g)+')');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
