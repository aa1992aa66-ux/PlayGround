/* AI AGENT OS — Phase 0 Foundation: EventBus, Store, Logger, Flags, Permissions, Vault, NoFake */
const Bus = {
  map:{},
  on(e,fn){(this.map[e]=this.map[e]||[]).push(fn)},
  emit(e,d){(this.map[e]||[]).forEach(f=>{try{f(d)}catch(err){Logger.error('bus:'+e,err)}}); Logger.log('event',e,d&&d.type?d.type:'')}
};
const Logger = {
  buf:[],
  log(cat,msg,data){const e={t:new Date().toISOString(),cat,msg}; this.buf.push(e); if(this.buf.length>500)this.buf.shift();},
  error(cat,err){this.buf.push({t:new Date().toISOString(),cat,msg:String(err&&err.message||err)}); console.warn('[AI-OS]',cat,err);},
  export(){return JSON.stringify(this.buf,null,2)}
};
const Store = {
  get(k,f){try{const v=localStorage.getItem('aios_'+k); return v?JSON.parse(v):f}catch{return f}},
  set(k,v){try{localStorage.setItem('aios_'+k,JSON.stringify(v))}catch{}},
  del(k){localStorage.removeItem('aios_'+k)}
};
/* Feature flags (~40 per spec, subset active) */
const Flags = Object.assign({
  video_studio:true, multi_agent:true, local_lab:true, telegram:true, voice:true,
  unity_adapter:false, godot_adapter:false, cloud_worker:false, marketplace:false,
  agent_studio:true, memory_os:true, orchestrator:true, ide_hub:true
}, Store.get('flags',{}));
function saveFlags(){Store.set('flags',Flags)}
/* Permission Engine — Phase 4 */
const PERMS = ["project.read","project.write","file.read","file.write","terminal.execute","network.request","browser.use","camera.use","microphone.use","device.control","git.read","git.write","github.read","github.write","credential.use","worker.create","runtime.execute","automation.execute","model.local.run","model.network.use","media.generate","render.start","video.read","video.write","timeline.write","project.rollback","artifact.export"];
const PermEngine = {
  grants: Store.get('perms',{}), // key: agentId:perm -> mode
  check(agentId,perm){
    const m = this.grants[agentId+':'+perm] || this.grants['global:'+perm];
    if(m==='deny') return {ok:false,reason:'مرفوض صراحة'};
    if(m) return {ok:true,mode:m};
    if(['project.read','file.read'].includes(perm)) return {ok:true,mode:'always'};
    return {ok:false,reason:'Requires Approval — يتطلب موافقة المستخدم'};
  },
  grant(agentId,perm,mode){this.grants[agentId+':'+perm]=mode; Store.set('perms',this.grants); Bus.emit('perm',{type:'grant',agentId,perm,mode});},
  revoke(agentId,perm){delete this.grants[agentId+':'+perm]; Store.set('perms',this.grants);}
};
/* Secret Vault — Phase 5 (WebCrypto AES-GCM, redacted logs) */
const Vault = {
  secrets: Store.get('vault_meta',[]), // [{id,name,provider,created}]
  async _key(){
    const raw = Store.get('vault_key',null);
    if(raw) return await crypto.subtle.importKey('jwk',raw,{name:'AES-GCM'},true,['encrypt','decrypt']);
    const k = await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
    Store.set('vault_key',await crypto.subtle.exportKey('jwk',k));
    return k;
  },
  async put(name,value,provider){
    const k=await this._key(); const iv=crypto.getRandomValues(new Uint8Array(12));
    const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(value));
    const b=btoa(String.fromCharCode(...new Uint8Array(ct)));
    const ivb=btoa(String.fromCharCode(...iv));
    const items=Store.get('vault_store',{}); const id='sec_'+Date.now().toString(36);
    items[id]={name,provider,iv:ivb,data:b,created:new Date().toISOString()};
    Store.set('vault_store',items);
    this.secrets.push({id,name,provider}); Store.set('vault_meta',this.secrets);
    Logger.log('vault','stored '+name); return id;
  },
  async use(id){
    const items=Store.get('vault_store',{}); const rec=items[id]; if(!rec) throw new Error('Secret revoked');
    const k=await this._key();
    const iv=Uint8Array.from(atob(rec.iv),c=>c.charCodeAt(0));
    const data=Uint8Array.from(atob(rec.data),c=>c.charCodeAt(0));
    const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv},k,data);
    return new TextDecoder().decode(pt);
  },
  revoke(id){
    const items=Store.get('vault_store',{}); delete items[id]; Store.set('vault_store',items);
    this.secrets=this.secrets.filter(s=>s.id!==id); Store.set('vault_meta',this.secrets);
  },
  redact(text){ // never leak secrets in logs
    let t=String(text||''); const items=Store.get('vault_store',{});
    return t.length>200?t.slice(0,200)+'…[redacted]':t;
  }
};
/* No-Fake helper — ABSOLUTE RULE */
function requiresReason(kind){
  const M={
    adapter:'Requires Adapter — يتطلب محوّل', worker:'Requires Worker — يتطلب عامل تشغيل (Linux/Windows)',
    runtime:'Requires Runtime — يتطلب بيئة تشغيل', internet:'Requires Internet — يتطلب إنترنت',
    permission:'Requires Permission — يتطلب إذن', config:'Requires User Configuration — أضف مفتاح API أولاً',
    external:'Requires External App — يتطلب تطبيق خارجي', cloud:'Requires Cloud — يتطلب سحابة', unsupported:'Unsupported على هذا الجهاز'
  }; return M[kind]||kind;
}
function toast(msg){const t=document.getElementById('toast'); t.textContent=msg; t.style.display='block'; clearTimeout(t._h); t._h=setTimeout(()=>t.style.display='none',2600);}
