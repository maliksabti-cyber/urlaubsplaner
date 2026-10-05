// Minimaler Nachbau von Firebase Auth + Firestore REST mit den Regeln aus firestore.rules
export function fakeFirebase(ADMIN){
  const users=new Map(), tokens=new Map(), db={mitarbeiter:new Map(), urlaube:new Map()}; let n=0;
  const val=v=>v==null?{nullValue:null}:typeof v==="boolean"?{booleanValue:v}:typeof v==="number"?{integerValue:String(v)}:{stringValue:v};
  const unval=f=>{ const o={}; for(const k in f){ const v=f[k]; o[k]="stringValue" in v?v.stringValue:"integerValue" in v?+v.integerValue:"booleanValue" in v?v.booleanValue:null; } return o; };
  const out=(col,id,d)=>({name:`projects/p/databases/(default)/documents/${col}/${id}`,fields:Object.fromEntries(Object.entries(d).map(([k,v])=>[k,val(v)]))});
  const json=(route,status,body)=>route.fulfill({status,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(body)});
  const deny=r=>json(r,403,{error:{status:"PERMISSION_DENIED"}});
  const auth=u=>{ const t="tok"+(++n); tokens.set(t,u); return {localId:u.uid,email:u.email,idToken:t,refreshToken:"r"+t,expiresIn:"3600"}; };
  const approved=u=>u && (u.email===ADMIN || (db.mitarbeiter.get(u.uid)||{}).approved===true);
  const myName=u=>(db.mitarbeiter.get(u.uid)||{}).name;
  return { db, users, async handle(route){ const req=route.request(), url=new URL(req.url()), m=req.method();
    if(m==="OPTIONS") return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"*"}});
    const body=req.postData()?JSON.parse(req.postData()):null;
    if(url.host==="identitytoolkit.googleapis.com"){ const ep=url.pathname.split(":").pop();
      if(ep==="signUp"){ if([...users.values()].some(u=>u.email===body.email)) return json(route,400,{error:{message:"EMAIL_EXISTS"}}); const u={uid:"u"+(++n),email:body.email,pw:body.password}; users.set(u.uid,u); return json(route,200,auth(u)); }
      if(ep==="signInWithPassword"){ const u=[...users.values()].find(u=>u.email===body.email); if(!u||u.pw!==body.password) return json(route,400,{error:{message:"INVALID_LOGIN_CREDENTIALS"}}); return json(route,200,auth(u)); }
      if(ep==="delete"){ const u=tokens.get(body.idToken); if(u) users.delete(u.uid); return json(route,200,{}); }
      return json(route,400,{error:{message:"UNKNOWN"}}); }
    if(url.host==="securetoken.googleapis.com") return json(route,400,{error:{message:"TOKEN_EXPIRED"}});
    if(url.host!=="firestore.googleapis.com") return route.continue();
    const u=tokens.get((req.headers()["authorization"]||"").replace("Bearer ","")); if(!u) return deny(route);
    const parts=url.pathname.split("/documents/")[1].split("/"), col=parts[0], id=parts[1], C=db[col]; if(!C) return deny(route);
    if(col==="mitarbeiter"){
      if(m==="GET" && !id) return json(route,200,{documents:[...C].map(([i,d])=>out(col,i,d))});
      if(m==="PATCH"){ const mask=url.searchParams.getAll("updateMask.fieldPaths"), data=unval(body.fields), cur=C.get(id);
        if(!cur){ const ok=u.email===ADMIN || (id===u.uid && Object.keys(data).every(k=>["name","tage","emailHash","emailMask","uid","created","approved"].includes(k)) && typeof data.name==="string" && data.name.length>=2 && data.uid===u.uid && data.approved===false && data.tage==null); if(!ok) return deny(route); C.set(id,data); return json(route,200,out(col,id,data)); }
        const next=mask.length?{...cur,...Object.fromEntries(mask.map(k=>[k,data[k]]))}:data; const changed=Object.keys({...cur,...next}).filter(k=>JSON.stringify(cur[k])!==JSON.stringify(next[k]));
        const ok=u.email===ADMIN || (id===u.uid && cur.approved===true && changed.every(k=>k==="tage")); if(!ok) return deny(route); C.set(id,next); return json(route,200,out(col,id,next)); }
      return deny(route); }
    if(col==="urlaube"){
      if(m==="GET" && !id){ if(!approved(u)) return deny(route); return json(route,200,{documents:[...C].map(([i,d])=>out(col,i,d))}); }
      if(m==="POST"){ const d=unval(body.fields); const ok=(u.email===ADMIN || (approved(u) && d.name===myName(u))) && Object.keys(d).every(k=>["name","start","end","created"].includes(k)); if(!ok) return deny(route); const i="v"+(++n); C.set(i,d); return json(route,200,out(col,i,d)); }
      if(m==="DELETE"){ const cur=C.get(id); if(!cur) return json(route,200,{}); if(!(u.email===ADMIN || (approved(u) && cur.name===myName(u)))) return deny(route); C.delete(id); return json(route,200,{}); }
      return deny(route); }
    return deny(route); } };
}
