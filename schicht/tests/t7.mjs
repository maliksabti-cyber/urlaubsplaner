import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7'], acceptDownloads:true}); await c.addInitScript(()=>{ navigator.canShare=undefined; }); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(1000);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(400); }
await p.locator('.tabs button[data-v="heute"]').tap(); await p.waitForTimeout(300);
await p.evaluate(()=>{ S.guide={hide:true}; histMute=true; save(); histMute=false; render(); }); const ban=p.locator('#v-heute .banner'); console.log('banner:', await ban.count(), await p.evaluate(()=>({dlNs, due:backupDue(), lm:CFG.localMode, ob:S.onboarded, txt:[...document.querySelectorAll('#v-heute .banner')].map(x=>x.innerText)})));
p.on('download',d=>console.log('download:',d.suggestedFilename())); await ban.locator('button').tap(); await p.waitForTimeout(800);
await p.waitForTimeout(300); console.log('banner after:', await p.locator('#v-heute .banner').count(), 'lastBackup:', await p.evaluate(()=>S.lastBackup), 'undo disabled:', await p.evaluate(()=>document.querySelector('#hundo').disabled));
await p.evaluate(()=>{ S.rots=[{id:'r1',name:'T',start:TODAY(),pattern:['F','F','S','S','N','N',null,null]}]; save(); render(); }); await p.locator('#gear').tap(); await p.waitForTimeout(300);
const dp=p.waitForEvent('download'); await p.getByText('In den Handy-Kalender').tap(); const d2=await dp;
const fs=await import('fs'); const path=await d2.path(); const ics=fs.readFileSync(path,'utf8'); console.log('ics:', d2.suggestedFilename(), 'events:', (ics.match(/BEGIN:VEVENT/g)||[]).length, ics.split('\r\n').slice(4,9).join(' | '));
console.log('errors', errs); await b.close();
