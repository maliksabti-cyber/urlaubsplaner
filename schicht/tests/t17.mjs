import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m); const errs=[];
async function ctx(dark){ const c=await b.newContext({...devices['Pixel 7'],colorScheme:dark?'dark':'light'}); const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); return p; }
// 1) Neuer Nutzer
const p=await ctx(false); await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
const t=await p.evaluate(()=>S.types.map(x=>x.id+':'+x.name+':'+x.short+':'+x.color).join(' | '));
ok(/F:Tagschicht:T:#1C6DD0/.test(t) && /N:Nachtschicht:N:#111111/.test(t) && /X:Frei:F:/.test(t), 'Neue Nutzer: '+t);
await p.evaluate(()=>{ S.rots=[{id:'r',name:'x',start:'2026-09-28',pattern:['F','F','S','S','N','N',null,null,null,null]}]; S.guide={hide:true,pickhide:true}; save(); show('kal'); document.querySelector('#toast').hidden=true; });
await p.waitForTimeout(200);
const cells=await p.evaluate(()=>[...document.querySelectorAll('.day:not(.out) .chip')].slice(0,10).map(c=>c.textContent).join(''));
ok(cells==='SNFFFFFTTS', 'Kalender Okt: '+cells+' (T=Tag, N=Nacht, F=frei)');
const nStyle=await p.evaluate(()=>{ const c=[...document.querySelectorAll('.day .chip')].find(x=>x.textContent==='N'); const s=getComputedStyle(c); return s.backgroundColor+' / '+s.color; });
ok(/rgb\(17, 17, 17\) \/ rgb\(255, 255, 255\)/.test(nStyle), 'Nachtschicht schwarz mit weißem N: '+nStyle);
const tStyle=await p.evaluate(()=>{ const c=[...document.querySelectorAll('.day .chip')].find(x=>x.textContent==='T'); const s=getComputedStyle(c); return s.backgroundColor+' / '+s.color; });
ok(/rgb\(28, 109, 208\) \/ rgb\(255, 255, 255\)/.test(tStyle), 'Tagschicht blau: '+tStyle);
await p.screenshot({path:'/tmp/claude-0/c-light.png'});
// 2) Vorhandener Nutzer mit alten Werten
const q=await ctx(true); await q.goto('http://localhost:8765/schicht/'); await q.waitForTimeout(500);
await q.evaluate(()=>{ const old={v:1,onboarded:true,land:'NW',vacPerYear:30,carry:{},ov:{'2026-10-02':'F'},notes:{},vacs:[],tpls:[],guide:{hide:true,pickhide:true},newsSeen:1,
  types:[{id:'F',name:'Frühschicht',short:'F',color:'#E0A100',start:'06:00',end:'14:00',pause:30,kind:'work'},{id:'S',name:'Spätschicht',short:'S',color:'#E8590C',start:'14:00',end:'22:00',pause:30,kind:'work'},{id:'N',name:'Nachtschicht',short:'N',color:'#4A3FB5',start:'22:00',end:'06:00',pause:30,kind:'work'},{id:'U',name:'Urlaub',short:'U',color:'#2E8B57',kind:'vac'},{id:'K',name:'Krank',short:'K',color:'#C2185B',kind:'sick'},{id:'X',name:'Frei',short:'X',color:'#6B7A85',kind:'free'}],
  rots:[{id:'r',name:'x',start:'2026-09-28',pattern:['F','F','S','S','N','N',null,null,null,null]}]}; localStorage.setItem('su_data_local',JSON.stringify(old)); });
await q.reload(); await q.waitForTimeout(700); await q.evaluate(()=>{ show('kal'); });
const t2=await q.evaluate(()=>S.types.map(x=>x.id+':'+x.name+':'+x.short+':'+x.color).join(' | ')+' | Tag 2.10.: '+shiftOf('2026-10-02').short);
ok(/F:Tagschicht:T:#1C6DD0/.test(t2) && /N:Nachtschicht:N:#111111/.test(t2) && /X:Frei:F:/.test(t2) && /Tag 2\.10\.: T/.test(t2), 'Vorhandene Daten umgestellt, Einträge bleiben: '+t2);
await q.evaluate(()=>{ const f=S.types.find(x=>x.id==='F'); f.color='#00AA00'; f.name='Meine Frühe'; save(); S.tagMig=0; render(); });
ok(await q.evaluate(()=>{ const f=S.types.find(x=>x.id==='F'); return f.name==='Meine Frühe' && f.color==='#00AA00'; }), 'Eigene Anpassungen werden nicht überschrieben');
await q.evaluate(()=>{ document.querySelector('#toast').hidden=true; const f=S.types.find(x=>x.id==='F'); f.name='Tagschicht'; f.color='#1C6DD0'; save(); render(); }); await q.screenshot({path:'/tmp/claude-0/c-dark.png'});
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
