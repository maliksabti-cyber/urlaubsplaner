// Teilen – einfach: Urlaub von/bis + Jahreskalender + Legende (Uhrzeit, Stunden dezimal + Minuten) als ein PDF
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7'],timezoneId:'Europe/Berlin',acceptDownloads:true}); await c.addInitScript(()=>{ const T=new Date('2026-10-05T09:00:00').getTime(); const D=Date; class F extends D{ constructor(...a){ super(...(a.length?a:[T])); } static now(){ return T; } } window.Date=F; window.open=(u)=>{ window.__opened=u; return null; }; try{ Object.defineProperty(navigator,'canShare',{value:undefined}); Object.defineProperty(navigator,'share',{value:undefined}); }catch(e){} });
const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(x,m)=>console.log((x?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
await p.evaluate(()=>{ S.name='Malik'; S.rots=[{id:'r',name:'x',start:'2026-01-05',pattern:['F','F','N','N',null,null,null]}]; S.guide={hide:true,pickhide:true}; S.newsSeen=9; S.vacs=[]; addVac('2026-11-09','2026-11-13'); save(); uY=2026; show('urlaub'); document.querySelector('#toast').hidden=true; });
await p.waitForTimeout(200);
await p.locator('#v-urlaub button',{hasText:'Urlaub & Schichtplan 2026 teilen'}).tap(); await p.waitForTimeout(250);
const t=await p.locator('#pan').innerText();
ok(/Urlaub & Schichtplan 2026/i.test(t) && await p.locator('#pan .shareico').isVisible(), 'Vorschau mit Teilen-Symbol oben rechts');
ok(/9\. November 2026 – 13\. November 2026|9\.11\.2026|November 2026 –/.test(t) || /09\.11\.|9\. Nov/.test(t), 'Urlaub von – bis in der Vorschau');
ok(await p.locator('#pan .years .mini').count()===12, 'Jahreskalender (12 Monate)');
const lg=await p.locator('#pan .slegend').innerText(); ok(/06:00 – 14:00/.test(lg) && /7,5 Std\. \(450 Min\.\)/.test(lg), 'Legende mit Uhrzeit und Stunden: '+lg.split('\n').slice(0,3).join(' '));
await p.screenshot({path:'/tmp/claude-0/t20-share.png',fullPage:true});
await p.locator('#pan .shareico').tap(); await p.waitForTimeout(150);
const opts=await p.locator('#ask .askb button').allInnerTexts(); ok(/PDF/.test(opts[0]) && !opts.some(o=>/Live-Link/.test(o)), 'Teilen-Auswahl: '+opts.join(' | '));
await p.locator('#ask .askb button',{hasText:'Abbrechen'}).tap();
const [dl]=await Promise.all([p.waitForEvent('download'), p.getByRole('button',{name:'📄 PDF teilen'}).tap()]);
ok(/Urlaub_und_Schichtplan_2026\.pdf$/.test(dl.suggestedFilename()), 'PDF: '+dl.suggestedFilename());
await dl.saveAs('/tmp/claude-0/t20.pdf');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
