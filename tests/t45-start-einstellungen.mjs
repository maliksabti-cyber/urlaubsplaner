// Start im Plan-Bildschirm, „Heute“ über die Navigation, Einstellungen kompakt in Gruppen mit runden Ecken.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SHOT=process.env.SHOT||'/tmp/claude-0/set'; const fs=await import('fs'); fs.mkdirSync(SHOT,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--disable-background-networking','--disable-sync','--no-first-run']});
const ok=(x,m)=>{ console.log((x?'✔ ':'✘ ')+m); if(!x) process.exitCode=1; }; const errs=[];
for(const [w,h] of [[360,640],[390,844],[412,915]]) for(const fsz of ['n','xl']) for(const th of ['light','dark']){
  const tag=w+'x'+h+'-'+fsz+'-'+th, c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:th,timezoneId:'Europe/Berlin',serviceWorkers:'block'}), p=await c.newPage();
  p.on('pageerror',e=>errs.push(tag+': '+e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource/.test(m.text())) errs.push(tag+': '+m.text()); });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(120); }
  await p.evaluate(([f,th])=>{ lsSet('su_fs',f); S.theme=th; save(); },[fsz,th]);
  await p.reload(); await p.waitForTimeout(600);
  ok(await p.evaluate(()=>view==='urlaub' && !$('#v-urlaub').hidden && $('#v-heute').hidden),tag+': startet im Plan-Bildschirm');
  await p.locator('nav.tabs button[data-v="heute"]').tap(); await p.waitForTimeout(200); ok(await p.evaluate(()=>view==='heute' && !$('#v-heute').hidden && !!document.querySelector('.hweek')),tag+': „Heute“ über die Navigation');
  await p.locator('nav.tabs button[data-v="mehr"]').tap(); await p.waitForTimeout(250); await p.evaluate(()=>{ $('#toast').hidden=true; });
  const r=await p.evaluate(()=>{ const v=$('#v-mehr'), cards=[...v.querySelectorAll('.setcard')], btns=[...v.querySelectorAll('button,select')].filter(x=>x.offsetParent);
    const rad=x=>parseFloat(getComputedStyle(x).borderTopLeftRadius); const W=document.documentElement.clientWidth;
    return {grp:[...v.querySelectorAll('.setgrp')].map(x=>x.textContent).join(','),cards:cards.length,crad:Math.min(...cards.map(rad)),brad:Math.min(...btns.filter(x=>!x.closest('.thseg')).map(rad)),minH:Math.min(...btns.map(x=>x.getBoundingClientRect().height)),
      over:document.documentElement.scrollWidth>W||[...v.querySelectorAll('*')].some(x=>{ const q=x.getBoundingClientRect(); return q.width>0&&(q.right>W+1||q.left<-1); }),h:v.scrollHeight}; });
  ok(r.grp==='Arbeit & Urlaub,Darstellung,Team,App' && r.cards===4,tag+': Gruppen '+r.grp);
  ok(r.crad>=16 && r.brad>=12,tag+': runde Ecken (Karten '+r.crad+' px, Knöpfe ≥'+r.brad+' px)');
  ok(!r.over && r.minH>=40,tag+': nichts abgeschnitten, Knöpfe ≥ '+Math.round(r.minH)+' px');
  await p.screenshot({path:SHOT+'/einst-'+tag+'.png',fullPage:true});
  { await p.evaluate(()=>window.scrollTo(0,1e6)); await p.waitForTimeout(150); const e=await p.evaluate(()=>{ const v=document.querySelector('#v-mehr .mver').getBoundingClientRect(), n=document.querySelector('nav.tabs').getBoundingClientRect(); return v.bottom<=n.top+1; }); ok(e,tag+': Ende der Einstellungen über der unteren Leiste sichtbar'); await p.screenshot({path:SHOT+'/einst-ende-'+tag+'.png'}); await p.evaluate(()=>window.scrollTo(0,0)); }
  // alle Knöpfe funktionieren noch
  for(const [sel,exp] of [['#v-mehr .setrow:has-text("Schichtrhythmus") .setbtn','Rhythmus'],['#v-mehr .setrow:has-text("Urlaubsanspruch") .setbtn','Urlaub'],['#resetall','Alles zurücksetzen']]){
    await p.locator(sel).first().tap(); await p.waitForTimeout(250); ok(await p.evaluate(e=>!$('#sheet').hidden&&$('#pan').innerText.includes(e),exp),tag+': '+exp+' öffnet sich'); await p.evaluate(()=>closeSheet()); await p.waitForTimeout(100); }
  await p.locator('#v-mehr .thseg button',{hasText:th==='dark'?'Hell':'Dunkel'}).tap(); await p.waitForTimeout(150); ok(await p.evaluate(t=>S.theme===t,th==='dark'?'light':'dark'),tag+': Farben umschalten');
  await p.evaluate(()=>[...document.querySelectorAll('#v-mehr .setrow')].find(r=>r.textContent.includes('Team')).scrollIntoView({block:'center'})); await p.waitForTimeout(100); await p.locator('#v-mehr .setrow:has-text("Team") .setbtn').tap(); await p.waitForTimeout(200); ok(await p.evaluate(()=>view==='team'),tag+': Team öffnen');
  await c.close(); }
ok(!errs.length,'Keine Konsolenfehler'+(errs.length?': '+errs.join(' | '):''));
await b.close();
