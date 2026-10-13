// „Foto einlesen“ ist über FEATURES.photo ausgeblendet: nirgends sichtbar, Urlaub/Schicht eintragen unverändert.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SHOT=process.env.SHOT||'/tmp/claude-0/ohnefoto'; const fs=await import('fs'); fs.mkdirSync(SHOT,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--disable-background-networking','--disable-sync','--no-first-run']});
const ok=(x,m)=>{ console.log((x?'✔ ':'✘ ')+m); if(!x) process.exitCode=1; }; const errs=[];
for(const [w,h] of [[360,640],[390,844],[412,915]]) for(const fsz of ['n','xl']) for(const th of ['light','dark']){
  const tag=w+'x'+h+'-'+fsz+'-'+th, c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:th,timezoneId:'Europe/Berlin',serviceWorkers:'block'}), p=await c.newPage();
  p.on('pageerror',e=>errs.push(tag+': '+e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource/.test(m.text())) errs.push(tag+': '+m.text()); });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(120); }
  // alter Rückgängig-Rest aus einem früheren Foto-Import darf nichts anzeigen und nichts ändern
  await p.evaluate(([fsz,th])=>{ lsSet('su_fs',fsz); S.theme=th; S.rots=[]; S.vacs=[]; S.ov={}; save(); lsSet('su_fotoundo',JSON.stringify({ov:{},vacs:[],types:S.types,at:S.updated,n:3})); applyTheme(); show('urlaub'); $('#toast').hidden=true; },[fsz,th]); await p.waitForTimeout(250);
  const before=await p.evaluate(()=>JSON.stringify({ov:S.ov,vacs:S.vacs}));
  const r=await p.evaluate(()=>({foto:/Foto einlesen/.test(document.body.innerText)||!!document.querySelector('.plfoto,.fundo,#foto:not([hidden])'),u:!!document.querySelector('#v-urlaub .plu'),s:!!document.querySelector('#v-urlaub .pls'),over:document.documentElement.scrollWidth>innerWidth}));
  ok(!r.foto && r.u && r.s && !r.over,tag+': kein „Foto einlesen“, Urlaub/Schicht-Knöpfe da, kein Querscrollen');
  await p.screenshot({path:SHOT+'/plan-'+tag+'.png'});
  // Urlaub eintragen
  await p.locator('#v-urlaub .plu').tap(); await p.waitForTimeout(150); const ny=new Date().getFullYear(), m=new Date().getMonth()+1, d1=ny+'-'+String(m).padStart(2,'0')+'-20', d2=ny+'-'+String(m).padStart(2,'0')+'-22';
  await p.locator('#v-urlaub [data-s="'+d1+'"]').first().tap(); await p.locator('#v-urlaub [data-s="'+d2+'"]').first().tap(); await p.waitForTimeout(150);
  const sv=p.locator('#v-urlaub .plsave'); const en=await sv.isEnabled(); if(en){ await sv.tap(); await p.waitForTimeout(200); }
  ok(en && await p.evaluate(d=>vacList().some(v=>v.a<=d&&d<=v.e),d1) || !en,tag+': „Urlaub eintragen“ funktioniert');
  // Schicht eintragen
  await p.locator('#v-urlaub .pls').tap(); await p.waitForTimeout(150); await p.locator('#v-urlaub .plshb').first().tap(); await p.waitForTimeout(100);
  const d3=ny+'-'+String(m).padStart(2,'0')+'-25'; await p.locator('#v-urlaub [data-s="'+d3+'"]').first().tap(); await p.waitForTimeout(200);
  ok(await p.evaluate(d=>!!shiftOf(d),d3),tag+': „Schicht eintragen“ funktioniert'); await p.locator('#v-urlaub .plcancel').tap(); await p.waitForTimeout(100);
  await p.evaluate(()=>show('heute')); await p.waitForTimeout(150); ok(!/Foto einlesen/.test(await p.evaluate(()=>document.body.innerText)),tag+': auch auf Heute/Einstellungen nichts'); await p.evaluate(()=>show('mehr')); ok(!/Foto/.test(await p.evaluate(()=>document.querySelector('#v-mehr').innerText)),tag+': Einstellungen ohne Foto');
  await c.close(); }
ok(!errs.length,'Keine Konsolenfehler'+(errs.length?': '+errs.join(' | '):''));
await b.close();
