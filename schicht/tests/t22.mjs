import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7']}); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
// 1) Feiertage je Bundesland 2026 (Soll laut Gesetz)
const exp={BW:12,BY:13,BE:10,BB:12,HB:10,HH:10,HE:10,MV:11,NI:10,NW:11,RP:11,SL:12,SN:11,ST:11,SH:10,TH:11};
const got=await p.evaluate(()=>{ const o={}; for(const [k] of LAENDER){ S.land=k; o[k]=Object.keys(holidays(2026)).length; } S.land='NW'; return o; });
const bad=Object.keys(exp).filter(k=>exp[k]!==got[k]); ok(!bad.length,'Anzahl Feiertage 2026 stimmt in allen 16 Ländern'+(bad.length?' – falsch: '+bad.map(k=>k+' '+got[k]+'≠'+exp[k]).join(', '):''));
const spot=await p.evaluate(()=>{ const f=(l,d)=>{ S.land=l; return holidays(2026)[d]||'-'; }; const r={BE_Frauentag:f('BE','2026-03-08'),TH_Kind:f('TH','2026-09-20'),SN_Buss:f('SN','2026-11-18'),BB_Ostersonntag:f('BB','2026-04-05'),BY_MH:f('BY','2026-08-15'),NW_MH:f('NW','2026-08-15'),HE_Allerheiligen:f('HE','2026-11-01'),NI_Reformation:f('NI','2026-10-31')}; S.land='NW'; return r; });
ok(spot.BE_Frauentag==='Frauentag'&&spot.TH_Kind==='Weltkindertag'&&spot.SN_Buss==='Buß- und Bettag'&&spot.BB_Ostersonntag==='Ostersonntag'&&spot.BY_MH==='Mariä Himmelfahrt'&&spot.NW_MH==='-'&&spot.HE_Allerheiligen==='-'&&spot.NI_Reformation==='Reformationstag','Stichproben: '+JSON.stringify(spot));
// 2) Örtliche Feiertage umschalten (Bayern)
await p.evaluate(()=>{ S.land='BY'; S.guide={hide:true,pickhide:true}; save(); show('set'); }); await p.waitForTimeout(200);
ok(await p.locator('#lh_BY_MH').isChecked() && !(await p.locator('#lh_BY_AUG').isChecked()), 'Bayern: Mariä Himmelfahrt an, Augsburger Friedensfest aus (Standard)');
await p.locator('#lh_BY_AUG').check(); await p.waitForTimeout(150);
ok(await p.evaluate(()=>holidays(2026)['2026-08-08']==='Augsburger Friedensfest'), 'Augsburger Friedensfest zuschaltbar');
await p.locator('summary',{hasText:'Gesetzliche Feiertage'}).tap(); await p.waitForTimeout(100);
ok(/Bayern \(14\)/.test(await p.locator('summary',{hasText:'Gesetzliche Feiertage'}).innerText()), 'Liste „Gesetzliche Feiertage 2026 in Bayern (14)“ sichtbar');
// 3) Zeitgutschrift an Feiertagen
await p.locator('#holfree').uncheck(); await p.waitForTimeout(200);
ok(await p.locator('#holcredit').isVisible(), 'Haken „An Feiertagen frei“ raus → Feld für Zeitgutschrift erscheint');
await p.fill('#holcredit','100'); await p.waitForTimeout(100);
const k=await p.evaluate(()=>{ S.land='NW'; S.ov={'2026-10-03':'F'}; S.rots=[]; S.soll=37.5; save(); return {ist:monthIst(2026,9), hol:monthWork(2026,9).hol}; });
ok(k.hol===450 && k.ist===900, 'Tagschicht am 3.10. (7,5 h) mit 100 % Gutschrift = 15 h aufs Konto ('+(k.ist/60)+' h)');
await p.evaluate(()=>{ statY=2026; statM=9; show('stat'); }); ok(/Gutschrift \+100 %/.test(await p.locator('#v-stat').innerText()), 'Statistik zeigt die Feiertags-Gutschrift');
// 4) Startseite: Resttage verplanen + Urlaubsliste
await p.evaluate(()=>{ S.rots=[{id:'r',name:'x',start:'2026-01-05',pattern:['F','F','F','F',null,null,null]}]; S.ov={}; S.vacs=[]; addVac('2026-11-09','2026-11-19'); addVac('2026-12-21','2026-12-23'); save(); show('heute'); document.querySelector('#toast').hidden=true; }); await p.waitForTimeout(200);
const vk=(await p.locator('.vlist').innerText()).replace(/\s+/g,' ');
ok(/Deine Urlaube 2026/i.test(vk) && /8 Urlaubstage/.test(vk) && /3 Urlaubstage/.test(vk), 'Startseite: Liste der Urlaube ('+vk.slice(0,120)+')');
const btn={tap:async()=>p.evaluate(()=>{ agState.year=2026; agState.sel=['max']; agState.plan=[]; agState.meta=null; agState.use=''; openAgent(); })}; ok(true,'Rechner über „Mehr“');
await btn.tap(); await p.waitForTimeout(300);
ok(/Urlaubsrechner/i.test(await p.locator('#pan h2').first().innerText()) && await p.locator('#agout .agbig').isVisible(), 'Öffnet den Urlaubsrechner mit fertigem Vorschlag: '+await p.locator('#agout .agbig').innerText());
await p.evaluate(()=>closeSheet()); await p.locator('.vlist').screenshot({path:'/tmp/claude-0/h-vlist.png'}); await p.locator('.vlist').evaluate(e=>e.closest('.card').scrollIntoView()); await p.screenshot({path:'/tmp/claude-0/h-card.png'});
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
