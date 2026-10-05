// Nachgebautes Firebase (Anmeldung + Firestore-REST) für Tests mit mehreren Fake-Nutzern.
// Achtung: prüft KEINE Sicherheitsregeln – nur Datenfluss und Ablauf.
export function fakeFirebase(){
  const users=new Map(), docs=new Map(); let n=0;
  const resp=(route,status,obj)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'},body:JSON.stringify(obj)});
  const tok=u=>({localId:u.uid,idToken:'tok:'+u.uid,refreshToken:'r:'+u.uid,expiresIn:'3600',email:u.email,user_id:u.uid,id_token:'tok:'+u.uid,refresh_token:'r:'+u.uid,expires_in:'3600'});
  async function handle(route){ const req=route.request(), url=new URL(req.url()), m=req.method();
    if(m==='OPTIONS') return resp(route,200,{});
    if(url.host==='identitytoolkit.googleapis.com'){ const b=JSON.parse(req.postData()||'{}'), email=(b.email||'').toLowerCase();
      if(url.pathname.endsWith(':signUp')){ if(users.has(email)) return resp(route,400,{error:{message:'EMAIL_EXISTS'}}); const u={uid:'u'+(++n),email,pw:b.password}; users.set(email,u); return resp(route,200,tok(u)); }
      if(url.pathname.endsWith(':signInWithPassword')){ const u=users.get(email); if(!u||u.pw!==b.password) return resp(route,400,{error:{message:'INVALID_LOGIN_CREDENTIALS'}}); return resp(route,200,tok(u)); }
      return resp(route,400,{error:{message:'UNSUPPORTED'}}); }
    if(url.host==='securetoken.googleapis.com'){ const rt=new URLSearchParams(req.postData()||'').get('refresh_token')||''; const uid=rt.slice(2); const u=[...users.values()].find(x=>x.uid===uid); return u?resp(route,200,tok(u)):resp(route,400,{error:{message:'TOKEN_EXPIRED'}}); }
    if(url.host==='firestore.googleapis.com'){ const p=decodeURIComponent(url.pathname.split('/documents')[1]||''), segs=p.split('/').filter(Boolean), base='projects/x/databases/(default)/documents';
      if(m==='GET' && segs.length%2===1){ const out=[...docs.entries()].filter(([k])=>k.startsWith(p+'/')&&k.slice(p.length+1).split('/').length===1).map(([k,v])=>({name:base+k,fields:v})); return resp(route,200,{documents:out}); }
      if(m==='GET'){ return docs.has(p)?resp(route,200,{name:base+p,fields:docs.get(p)}):resp(route,404,{error:{status:'NOT_FOUND'}}); }
      if(m==='PATCH'){ const body=JSON.parse(req.postData()||'{}'), mask=url.searchParams.getAll('updateMask.fieldPaths'); const cur=docs.get(p)||{}; const f=body.fields||{};
        const next=mask.length?{...cur}:{}; (mask.length?mask:Object.keys(f)).forEach(k=>{ if(k in f) next[k]=f[k]; else delete next[k]; }); docs.set(p,next); return resp(route,200,{name:base+p,fields:next}); }
      if(m==='DELETE'){ docs.delete(p); return resp(route,200,{}); } }
    return route.continue(); }
  return { async attach(ctx){ for(const h of ['identitytoolkit.googleapis.com','securetoken.googleapis.com','firestore.googleapis.com']) await ctx.route(u=>u.host===h,handle); }, docs, users }; }
