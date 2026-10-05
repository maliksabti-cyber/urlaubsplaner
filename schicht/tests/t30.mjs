// Schichtplan: Monate untereinander scrollbar (Nachladen, heute oben, ‹ ›, Zurück zu heute), Malen + Scrollen per Touch; Urlaub-Tab: Monate mit Urlaub
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7'], timezoneId:'Europe/Berlin'}); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m);
await p.clock.setFixedTime(new Date('2027-03-20T10:00:00+01:00'));
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
await p.evaluate(()=>{ setSel(false); S.rots=[{id:'r',name:'Mo-Fr',start:'2024-01-01',pattern:['F','F','F','F','F',null,null]}]; S.ov={}; S.vacs=[{id:'v',a:'2027-05-10',e:'2027-05-14'},{id:'w',a:'2027-08-02',e:'2027-08-06'}]; S.guide={hide:true,pickhide:true}; S.newsSeen=9; S.lastBackup=TODAY(); save(); show('heute'); document.querySelector('#toast').hidden=true; });
await p.locator('.tabs button[data-v="kal"]').tap(); await p.waitForTimeout(300);
const st=()=>p.evaluate(()=>{ const sc=document.querySelector('#mscroll'), top=kalTopBlock(sc); return {title:document.querySelector('#kaltitle').textContent, top:top.id, n:sc.querySelectorAll('.mblock').length, st:sc.scrollTop, a:KAL.a, e:KAL.e}; });
let s0=await st();
ok(/März 2027/.test(s0.title) && s0.top==='mb-2027-03', 'Beim Öffnen steht der aktuelle Monat oben: '+s0.title);
ok(await p.evaluate(()=>{ const t=document.querySelector('#mscroll .day.now'), sc=document.querySelector('#mscroll'); const r=t.getBoundingClientRect(), q=sc.getBoundingClientRect(); return t.dataset.s==='2027-03-20' && r.top>=q.top && r.bottom<=q.bottom+1; }), 'Heute (20.3.) ist im Bild');
ok(s0.n===7 && await p.locator('#mscroll .day:not(.out)[data-s="2027-03-20"]').count()===1, 'Anfangs 7 Monate, jeder Tag nur einmal');
// nach unten scrollen lädt nach
for(let i=0;i<8;i++){ await p.evaluate(()=>{ const sc=document.querySelector('#mscroll'); sc.scrollTop=sc.scrollHeight; }); await p.waitForTimeout(120); }
let s1=await st();
ok(s1.e>=ymOfJs(2028,0) && s1.n<=15, 'Nach unten scrollen lädt Monate nach (bis '+s1.top+'), höchstens 15 gleichzeitig ('+s1.n+')');
// nach oben scrollen lädt frühere Monate, ohne zu springen
await p.evaluate(()=>kalJump(ymOf(2027,2))); await p.waitForTimeout(150);
for(let i=0;i<4;i++){ await p.evaluate(()=>{ document.querySelector('#mscroll').scrollTop=0; }); await p.waitForTimeout(120); }
let s2=await st();
ok(s2.a<=ymOfJs(2026,10) && s2.st>0 && s2.n<=15, 'Nach oben scrollen lädt frühere Monate (ab '+(s2.a%12+1)+'/'+Math.floor(s2.a/12)+'), Ansicht springt nicht an den Anfang');
function ymOfJs(y,m){ return y*12+m; }
// ‹ › und Zurück zu heute
await p.evaluate(()=>kalJump(ymOf(2027,2))); await p.waitForTimeout(100);
await p.locator('#v-kal .mhead button').last().tap(); await p.waitForTimeout(150);
let s3=await st(); ok(/April 2027/.test(s3.title) && s3.top==='mb-2027-04', '› scrollt zum nächsten Monat: '+s3.title);
ok(await p.locator('#kaltoday').isVisible(), '„↩ Zurück zu heute“ erscheint');
await p.locator('#v-kal .mhead button').last().tap(); await p.locator('#v-kal .mhead button').last().tap(); await p.waitForTimeout(150);
await p.locator('#kaltoday').tap(); await p.waitForTimeout(150);
let s4=await st(); ok(/März 2027/.test(s4.title) && s4.top==='mb-2027-03' && await p.locator('#kaltoday').count()===0, '„Zurück zu heute“ scrollt zurück in den März');
await p.locator('#v-kal .mhead button').first().tap(); await p.waitForTimeout(150);
ok(/Februar 2027/.test((await st()).title), '‹ scrollt zum Vormonat');
// Malen per Touch (echte Touch-Ereignisse)
await p.evaluate(()=>{ kalJump(ymOf(2027,2)); setSel(true); brush='S'; drawBrushes(); }); await p.waitForTimeout(250);
const cdp=await c.newCDPSession(p);
const ctr=async s=>p.evaluate(s=>{ const r=document.querySelector('#mscroll .day:not(.out)[data-s="'+s+'"]').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; },s);
const touch=async(type,pt)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pt?[{x:pt.x,y:pt.y}]:[]});
const drag=async(pts,hold=0)=>{ await touch('touchStart',pts[0]); if(hold) await p.waitForTimeout(hold); for(const q of pts.slice(1)){ await touch('touchMove',q); await p.waitForTimeout(30); } await touch('touchEnd'); await p.waitForTimeout(250); };
const ov=()=>p.evaluate(()=>Object.keys(S.ov).sort().join(','));
// 1) Antippen
let a=await ctr('2027-03-22'); await drag([a]);
ok(await ov()==='2027-03-22', 'Antippen malt einen Tag: '+await ov());
// 2) seitlich wischen
a=await ctr('2027-03-23'); let e=await ctr('2027-03-25'); const steps=[]; for(let i=0;i<=8;i++) steps.push({x:a.x+(e.x-a.x)*i/8,y:a.y}); await drag(steps);
ok(await ov()==='2027-03-22,2027-03-23,2027-03-24,2027-03-25', 'Seitlich wischen malt mehrere Tage: '+await ov());
// 3) senkrecht wischen scrollt, malt nicht
const sc0=await p.evaluate(()=>document.querySelector('#mscroll').scrollTop); a=await ctr('2027-03-16'); const vs=[]; for(let i=0;i<=10;i++) vs.push({x:a.x,y:a.y-i*25}); await drag(vs);
const sc1=await p.evaluate(()=>document.querySelector('#mscroll').scrollTop);
ok(sc1>sc0+50 && await ov()==='2027-03-22,2027-03-23,2027-03-24,2027-03-25', 'Senkrecht wischen scrollt ('+sc0+'→'+sc1+') und malt nichts');
// 4) seitlich anfangen, dann schräg nach unten: malt über zwei Reihen
await p.evaluate(()=>{ kalJump(ymOf(2027,2)); }); await p.waitForTimeout(200);
a=await ctr('2027-03-01'); e=await ctr('2027-03-09'); const ds=[a,{x:a.x+20,y:a.y+2},{x:a.x+40,y:a.y+4}]; for(let i=1;i<=6;i++) ds.push({x:a.x+40+(e.x-a.x-40)*i/6,y:a.y+4+(e.y-a.y-4)*i/6}); await drag(ds);
const o4=await ov(); ok(/2027-03-01/.test(o4) && /2027-03-09/.test(o4), 'Seitlich anfangen und schräg nach unten malt über zwei Reihen: '+o4);
await p.evaluate(()=>setSel(false));
// Urlaub-Tab: Monate mit Urlaub untereinander
await p.evaluate(()=>{ uY=2027; show('urlaub'); }); await p.waitForTimeout(200);
ok(await p.locator('#vmonths .vmonth').count()===2 && /Mai 2027/i.test(await p.locator('#vmonths .vmonth').first().innerText()) && await p.locator('#vmonths .mc.vd').count()===10, 'Urlaub-Tab: Mai und August untereinander, 10 Urlaubstage markiert');
await p.locator('#vmonths .mc[data-s="2027-05-12"]').tap(); await p.waitForTimeout(150);
ok(/12\. Mai 2027/i.test(await p.locator('#pan h2').first().innerText()), 'Tag antippen öffnet den Tag');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
