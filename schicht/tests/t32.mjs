// Kaputte Sicherung darf keine Daten überschreiben (Mahmed #1)
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const c=await b.newContext({...devices['Pixel 7']}); const p=await c.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(x,m)=>console.log((x?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
await p.evaluate(()=>{ S.name='Malik'; S.vacs=[]; addVac('2026-11-09','2026-11-13'); S.guide={hide:true,pickhide:true}; save(); show('set'); });
await p.waitForTimeout(200);
for(const bad of ['{"v":1,"types":[],"rots":[]}','{"v":1}','kein json']){
  await p.evaluate(t=>{ const d=document.querySelector('#v-set details'); document.querySelectorAll('#v-set details').forEach(x=>x.open=true); document.querySelector('#backup').value=t; },bad);
  const btn=[...await p.locator('#v-set button').all()]; for(const x of btn){ if((await x.innerText()).trim()==='Sicherung einspielen' && await x.evaluate(e=>!!e.closest('details'))){ await x.click(); break; } }
  await p.waitForTimeout(200); await p.evaluate(()=>{ const a=document.querySelector('#ask'); if(a) a.hidden=true; });
}
await p.reload(); await p.waitForTimeout(800);
const st=await p.evaluate(()=>({onb:!document.querySelector('#onb').hidden, name:S&&S.name, vacs:S&&S.vacs.length}));
ok(!st.onb && st.name==='Malik' && st.vacs===1, 'Nach 3 kaputten Sicherungen sind Name und Urlaub noch da '+JSON.stringify(st));
await p.evaluate(()=>{ show('kal'); show('urlaub'); show('heute'); });
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
