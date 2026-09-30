import * as THREE from 'three';

/* ============================================================
MAZINGER Z VS GREAT MAZINGER — playable 3D mecha prototype
Single-file engine: bases -> vehicle -> flight -> dock -> robot
battle -> exit -> vehicle combat -> re-dock -> win/lose.
All geometry procedural, all audio synthesized (no copied assets).
============================================================ */
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);

/* ---------- SAVE / SETTINGS ---------- */
const SAVE_KEY='mazinger_save_v1';
const save={unlocked:['Z','G'],upgrades:{hp:0,atk:0,def:0,spd:0},story:0,difficulty:1,quality:'Medium',fps:'60 FPS',music:60,sfx:80,shake:true,dmgNum:true,wins:{Z:0,G:0}};
try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));if(s)Object.assign(save,s);}catch{}
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch{}}

/* ---------- AUDIO (100% synthesized) ---------- */
const AudioSys={ctx:null,musicGain:null,sfxGain:null,musicTimer:null,
init(){if(this.ctx)return;try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.musicGain=this.ctx.createGain();this.sfxGain=this.ctx.createGain();this.musicGain.connect(this.ctx.destination);this.sfxGain.connect(this.ctx.destination);this.applyVol();this.startMusic();}catch{}},
applyVol(){if(!this.ctx)return;this.musicGain.gain.value=save.music/100*0.25;this.sfxGain.gain.value=save.sfx/100*0.6;},
tone(f,d,type='sawtooth',vol=0.3,slide=0){if(!this.ctx)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f+slide),t+d);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+d);o.connect(g);g.connect(this.sfxGain);o.start(t);o.stop(t+d);},
noise(d=0.3,vol=0.4,lp=1200){if(!this.ctx)return;const t=this.ctx.currentTime,len=this.ctx.sampleRate*d,buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate),ch=buf.getChannelData(0);for(let i=0;i<len;i++)ch[i]=(Math.random()*2-1)*(1-i/len);const s=this.ctx.createBufferSource();s.buffer=buf;const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=lp;const g=this.ctx.createGain();g.gain.value=vol;s.connect(f);f.connect(g);g.connect(this.sfxGain);s.start(t);},
punch(){this.noise(0.15,0.5,900);this.tone(90,0.15,'square',0.4,-50);},
explosion(){this.noise(0.8,0.8,500);this.tone(50,0.7,'sine',0.5,-30);},
laser(){this.tone(1400,0.25,'sawtooth',0.25,-1100);},
missile(){this.noise(0.5,0.3,2500);this.tone(300,0.4,'sawtooth',0.2,400);},
step(){this.noise(0.12,0.35,300);this.tone(60,0.1,'sine',0.3,-20);},
transform(){for(let i=0;i<6;i++)setTimeout(()=>this.tone(150+i*120,0.12,'square',0.25),i*90);this.noise(0.7,0.3,3000);},
dock(){this.tone(200,0.5,'sawtooth',0.35,600);setTimeout(()=>this.tone(800,0.3,'sine',0.3,-400),400);},
engine(d=0.2){this.tone(80+Math.random()*40,d,'sawtooth',0.12,30);},
block(){this.tone(500,0.1,'square',0.3,-200);},
ult(){for(let i=0;i<10;i++)setTimeout(()=>{this.noise(0.2,0.4,800+i*300);this.tone(100+i*80,0.25,'sawtooth',0.3);},i*120);},
alarm(){for(let i=0;i<3;i++)setTimeout(()=>this.tone(660,0.25,'square',0.25),i*350);},
startMusic(){if(this.musicTimer||!this.ctx)return;const bass=[55,55,65.4,49,55,55,73.4,65.4];let i=0;this.musicTimer=setInterval(()=>{if(!this.ctx)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sawtooth';o.frequency.value=bass[i%bass.length];g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.5);const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=300;o.connect(f);f.connect(g);g.connect(this.musicGain);o.start(t);o.stop(t+0.55);if(i%2===0){const o2=this.ctx.createOscillator(),g2=this.ctx.createGain();o2.type='square';o2.frequency.value=bass[i%bass.length]*4;g2.gain.setValueAtTime(0.03,t);g2.gain.exponentialRampToValueAtTime(0.001,t+0.3);o2.connect(g2);g2.connect(this.musicGain);o2.start(t);o2.stop(t+0.32);}i++;},420);}
};

/* ---------- INPUT ---------- */
const Input={keys:{},edge:{},joy:{x:0,y:0},camDrag:{x:0,y:0},btn:{},padPrev:{},
init(canvas){
 addEventListener('keydown',e=>{this.keys[e.code]=true;if(!e.repeat)this.edge[e.code]=true;if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();});
 addEventListener('keyup',e=>{this.keys[e.code]=false;});
 // touch joystick
 const jl=$('joyL'),st=$('stickL');let tid=null;
 const setStick=(t)=>{const r=jl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=(t.clientX-cx)/(r.width/2),dy=(t.clientY-cy)/(r.height/2);const m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m;}this.joy.x=dx;this.joy.y=dy;st.style.left=(40+dx*38)+'px';st.style.top=(40+dy*38)+'px';};
 jl.addEventListener('touchstart',e=>{tid=e.changedTouches[0].identifier;setStick(e.changedTouches[0]);e.preventDefault();},{passive:false});
 addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===tid)setStick(t);},{passive:true});
 addEventListener('touchend',e=>{for(const t of e.changedTouches)if(t.identifier===tid){tid=null;this.joy.x=0;this.joy.y=0;st.style.left='40px';st.style.top='40px';}});
 // camera drag on canvas (touch + mouse)
 let drag=null;
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;if(e.target!==canvas)return;drag={x:e.clientX,y:e.clientY};});
 addEventListener('pointermove',e=>{if(!drag)return;this.camDrag.x+=(e.clientX-drag.x)*0.005;this.camDrag.y+=(e.clientY-drag.y)*0.005;drag={x:e.clientX,y:e.clientY};});
 addEventListener('pointerup',()=>drag=null);
 // touch buttons
 document.querySelectorAll('#btnsR button').forEach(b=>{
  const a=b.dataset.a;
  b.addEventListener('touchstart',e=>{this.btn[a]=true;e.preventDefault();},{passive:false});
  b.addEventListener('touchend',()=>this.btn[a]=false);
  b.addEventListener('mousedown',()=>this.btn[a]=true);b.addEventListener('mouseup',()=>this.btn[a]=false);
 });
},
axis(){let x=0,y=0;if(this.keys['KeyW']||this.keys['ArrowUp'])y-=1;if(this.keys['KeyS']||this.keys['ArrowDown'])y+=1;if(this.keys['KeyA']||this.keys['ArrowLeft'])x-=1;if(this.keys['KeyD']||this.keys['ArrowRight'])x+=1;x+=this.joy.x;y+=this.joy.y;const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}return{x,y};},
edgeHit(code){const v=this.edge[code];this.edge[code]=false;return !!v;},
pressed(code){return !!this.keys[code];},
tap(name){const v=this.btn[name];if(v){this.btn[name]='held';return true;}return false;},
held(name){return !!this.btn[name];},
consumeCam(){const c={...this.camDrag};this.camDrag.x*=0.85;this.camDrag.y*=0.85;return c;},
gamepad(){try{const gps=navigator.getGamepads?navigator.getGamepads():[];for(const g of gps){if(!g||!g.connected)continue;const ax=(i)=>Math.abs(g.axes[i]||0)>0.15?g.axes[i]:0;let x=ax(0),y=ax(1);const b=(i)=>g.buttons[i]&&g.buttons[i].pressed;
 return{move:{x,y},atk:b(0),heavy:b(1)||b(5),jump:b(3),block:b(4)||b(6),boost:b(7),exit:b(8),skill:b(2),ult:b(9),cam:b(11)};}}catch{}return null;}
};

/* ---------- THREE SETUP ---------- */
const canvas=$('game');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x87b5e8);
scene.fog=new THREE.Fog(0x87b5e8,300,2200);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.5,6000);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
renderer.setSize(innerWidth,innerHeight);
scene.add(new THREE.HemisphereLight(0xbfd9ff,0x3a4a3a,0.9));
const sun=new THREE.DirectionalLight(0xfff2d9,1.6);sun.position.set(400,600,200);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-400;sun.shadow.camera.right=400;sun.shadow.camera.top=400;sun.shadow.camera.bottom=-400;sun.shadow.camera.far=2000;
scene.add(sun);
function applyQuality(q){save.quality=q;if(q==='Low'){renderer.shadowMap.enabled=false;renderer.setPixelRatio(1);}else if(q==='Medium'){renderer.shadowMap.enabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));}else{renderer.shadowMap.enabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio,2));}}

/* ---------- MATERIALS ---------- */
const M=(c,r=0.6,m=0.7)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const MAT={dark:M(0x1a2233,0.5,0.8),steel:M(0x8a97a8,0.35,0.9),black:M(0x0c0f16,0.6,0.4),
 zBlue:M(0x1450c8,0.4,0.75),zRed:M(0xc41a1a,0.4,0.7),zYellow:M(0xffc93f,0.35,0.6),zChest:M(0xd42020,0.3,0.6),
 gRed:M(0xb01218,0.4,0.75),gGold:M(0xd8a920,0.3,0.85),gSilver:M(0xb9c4d4,0.3,0.9),
 skin:M(0xe8b98a,0.7,0.1),suitB:M(0x27408b,0.6,0.3),suitR:M(0x8b2727,0.6,0.3),
 concrete:M(0x9aa0a8,0.9,0.05),glass:new THREE.MeshStandardMaterial({color:0x66ccff,roughness:0.1,metalness:0.2,emissive:0x1a4a66,emissiveIntensity:0.6}),
 glowR:new THREE.MeshStandardMaterial({color:0xff2222,emissive:0xff2222,emissiveIntensity:2}),
 glowB:new THREE.MeshStandardMaterial({color:0x33aaff,emissive:0x2288ff,emissiveIntensity:2}),
 glowY:new THREE.MeshStandardMaterial({color:0xffcc33,emissive:0xffaa00,emissiveIntensity:2}),
 flame:new THREE.MeshBasicMaterial({color:0xff7717,transparent:true,opacity:0.9}),
 beam:new THREE.MeshBasicMaterial({color:0xffe27a,transparent:true,opacity:0.85}),
 laser:new THREE.MeshBasicMaterial({color:0x55ffff,transparent:true,opacity:0.9}),
 carPaint:[M(0xc0392b,0.4,0.6),M(0x2980b9,0.4,0.6),M(0x27ae60,0.4,0.6),M(0xf39c12,0.4,0.6),M(0x7f8c8d,0.4,0.6)]};

/* ---------- HELPERS ---------- */
function box(w,h,d,mat,x=0,y=0,z=0,shadow=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;return m;}
function cyl(rt,rb,h,mat,x=0,y=0,z=0,seg=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}
function sph(r,mat,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),mat);m.position.set(x,y,z);m.castShadow=true;return m;}

/* ---------- PARTICLES / POOL ---------- */
const Particles={pool:[],active:[],
init(){const g=new THREE.SphereGeometry(1,6,5);for(let i=0;i<400;i++){const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xffaa00,transparent:true}));m.visible=false;scene.add(m);this.pool.push(m);}},
spawn(pos,color,count=12,speed=14,life=0.7,size=1.2,grav=-12){for(let i=0;i<count;i++){const p=this.pool.pop();if(!p)return;p.visible=true;p.position.copy(pos);p.material.color.set(color);p.material.opacity=1;p.scale.setScalar(size*rand(0.5,1.3));p.userData={vx:rand(-speed,speed),vy:rand(0,speed),vz:rand(-speed,speed),life:life*rand(0.6,1.2),max:life};this.active.push(p);}},
update(dt){for(let i=this.active.length-1;i>=0;i--){const p=this.active[i];p.userData.life-=dt;if(p.userData.life<=0){p.visible=false;this.pool.push(p);this.active.splice(i,1);continue;}p.userData.vy+=(-12)*dt;p.position.x+=p.userData.vx*dt;p.position.y+=p.userData.vy*dt;p.position.z+=p.userData.vz*dt;if(p.position.y<0.3){p.position.y=0.3;p.userData.vy*=-0.4;}p.material.opacity=p.userData.life/p.userData.max;}}
};
const Projectiles={list:[],
fire(owner,from,dir,opt){const {speed=90,dmg=8,color=0xffdd44,size=1.1,life=3,kind='bolt',homing=null}=opt;const m=new THREE.Mesh(new THREE.SphereGeometry(size,8,6),new THREE.MeshBasicMaterial({color}));m.position.copy(from);scene.add(m);const glow=new THREE.PointLight(color,8,40);m.add(glow);this.list.push({owner,mesh:m,vel:dir.clone().normalize().multiplyScalar(speed),dmg,life,kind,homing});AudioSys.missile();},
rocket(owner,from,dir,opt){const g=new THREE.Group();const body=cyl(0.5,0.5,3,M(0xcccccc,0.4,0.8));body.rotation.x=Math.PI/2;g.add(body);const tip=new THREE.Mesh(new THREE.ConeGeometry(0.5,1,8),M(0xcc2222,0.4,0.6));tip.rotation.x=Math.PI/2;tip.position.z=2;g.add(tip);g.position.copy(from);scene.add(g);this.list.push({owner,mesh:g,vel:dir.clone().normalize().multiplyScalar(opt.speed||70),dmg:opt.dmg||10,life:4,kind:'rocket',homing:null,trail:0});AudioSys.missile();},
update(dt,robots){for(let i=this.list.length-1;i>=0;i--){const p=this.list[i];p.life-=dt;if(p.kind==='rocket'){p.trail-=dt;if(p.trail<=0){p.trail=0.03;Particles.spawn(p.mesh.position,0xff8833,2,4,0.4,1);}}if(p.homing){const t=p.homing.getPos().clone().add(new THREE.Vector3(0,14,0));const d=t.sub(p.mesh.position).normalize().multiplyScalar(60*dt);p.vel.add(d);const s=p.vel.length(),mx=110;if(s>mx)p.vel.multiplyScalar(mx/s);}p.mesh.position.addScaledVector(p.vel,dt);if(p.kind==='rocket'){const l=p.mesh.position.clone().add(p.vel);p.mesh.lookAt(l);}
 let hit=false;
 for(const r of robots){if(r===p.owner||r.hp<=0)continue;const rp=r.getPos();const d=p.mesh.position.distanceTo(rp.clone().add(new THREE.Vector3(0,13,0)));const rad=r.mode==='robot'?11:7;if(d<rad){Combat.damage(p.owner,r,p.dmg,p.kind);Particles.spawn(p.mesh.position,0xffcc44,14,16,0.6,1.4);Particles.spawn(p.mesh.position,0xff5522,8,10,0.5,1);AudioSys.explosion();CameraShake.add(0.35);hit=true;break;}}
 if(!hit){const eb=EnvHit.check(p.mesh.position);if(eb){Particles.spawn(p.mesh.position,0xff9944,10,12,0.5,1.2);AudioSys.explosion();CameraShake.add(0.2);hit=true;}}
 if(hit||p.life<=0||p.mesh.position.y<0){if(p.mesh.position.y<=0.5&&!hit){Particles.spawn(p.mesh.position,0xaa8866,8,10,0.5,1.2);}scene.remove(p.mesh);this.list.splice(i,1);}}}
};
const CameraShake={v:0,add(a){if(save.shake)this.v=Math.min(2.5,this.v+a);},update(dt){this.v=Math.max(0,this.v-dt*3);},off(){if(this.v<=0.01)return new THREE.Vector3();return new THREE.Vector3(rand(-1,1)*this.v,rand(-1,1)*this.v,rand(-1,1)*this.v);}};

/* ---------- WORLD ---------- */
const World={colliders:[],buildings:[],cars:[],baseZ:null,baseG:null,arena:0,
build(){
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.MeshStandardMaterial({color:0x5d8a55,roughness:1,metalness:0}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 // sea (north)
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(4000,700),new THREE.MeshStandardMaterial({color:0x1e5f9e,roughness:0.25,metalness:0.3}));sea.rotation.x=-Math.PI/2;sea.position.set(0,0.2,-1650);scene.add(sea);
 // desert (east)
 const des=new THREE.Mesh(new THREE.PlaneGeometry(900,2000),new THREE.MeshStandardMaterial({color:0xd9b36a,roughness:1}));des.rotation.x=-Math.PI/2;des.position.set(1250,0.15,0);scene.add(des);
 // roads
 const roadM=new THREE.MeshStandardMaterial({color:0x2c2f36,roughness:0.9});
 for(let i=-3;i<=3;i++){const r=new THREE.Mesh(new THREE.PlaneGeometry(40,3000),roadM);r.rotation.x=-Math.PI/2;r.position.set(i*220,0.25,0);scene.add(r);
  const r2=new THREE.Mesh(new THREE.PlaneGeometry(3000,40),roadM);r2.rotation.x=-Math.PI/2;r2.position.set(0,0.25,i*220);scene.add(r2);}
 this.city();this.forest();this.mountains();this.military();this.bridges();this.carsInit();
 this.baseZ=this.makeBase(-700,700,'Z');this.baseG=this.makeBase(700,-700,'G');
 this.makeArena();
},
city(){for(let i=0;i<46;i++){const x=rand(-420,420),z=rand(-420,420);if(Math.abs(x)<90&&Math.abs(z)<90)continue;const w=rand(14,30),h=rand(20,75),d=rand(14,30);const c=new THREE.Color().setHSL(rand(0.55,0.65),0.25,rand(0.45,0.7));const b=new THREE.Group();const main=box(w,h,d,new THREE.MeshStandardMaterial({color:c,roughness:0.8,metalness:0.15}),0,h/2,0);b.add(main);
 // windows glow strip
 const win=box(w*0.8,h*0.7,0.3,MAT.glass,0,h/2,d/2+0.1,false);b.add(win);
 b.position.set(x,0,z);b.rotation.y=Math.random()<0.5?0:Math.PI/2;scene.add(b);this.buildings.push({g:b,hp:60,max:60,pos:new THREE.Vector3(x,0,z),w,h,d,dead:false});this.colliders.push({x,z,r:Math.max(w,d)*0.7});}},
forest(){const trunkM=M(0x6b4a2a,0.9,0),leafM=new THREE.MeshStandardMaterial({color:0x2d6a2d,roughness:0.9});for(let i=0;i<160;i++){const x=rand(-1400,-600),z=rand(-500,900);const t=new THREE.Group();t.add(cyl(0.5,0.8,5,trunkM,0,2.5,0));const l=new THREE.Mesh(new THREE.ConeGeometry(rand(2.5,4),rand(6,10),7),leafM);l.position.y=8;l.castShadow=true;t.add(l);t.position.set(x,0,z);scene.add(t);}},
mountains(){const mM=new THREE.MeshStandardMaterial({color:0x6e6e78,roughness:1});for(let i=0;i<26;i++){const a=(i/26)*Math.PI*2,r=rand(1500,1750);const h=rand(120,300);const m=new THREE.Mesh(new THREE.ConeGeometry(rand(120,220),h,6),mM);m.position.set(Math.cos(a)*r,h/2-5,Math.sin(a)*r);m.castShadow=true;scene.add(m);} // snow caps
},
military(){for(let i=0;i<10;i++){const b=box(20,8,14,MAT.concrete,rand(300,520),4,rand(300,520));scene.add(b);this.colliders.push({x:b.position.x,z:b.position.z,r:16});}
 for(let i=0;i<6;i++){const t=cyl(2,3,26,MAT.steel,rand(-500,500),13,rand(450,650));scene.add(t);}},
bridges(){const b=box(30,4,300,M(0x8a2a2a,0.6,0.4),-520,8,-900);scene.add(b);for(let z=-1020;z<-780;z+=60){scene.add(box(4,10,4,MAT.concrete,-520,3,z));}},
carsInit(){for(let i=0;i<26;i++){const g=new THREE.Group();const paint=MAT.carPaint[i%MAT.carPaint.length];g.add(box(2.2,0.9,4.6,paint,0,0.9,0));g.add(box(2,0.7,2.4,MAT.glass,0,1.6,-0.2,false));for(const [x,z]of[[-1,1.5],[1,1.5],[-1,-1.5],[1,-1.5]]){const w=cyl(0.45,0.45,0.4,MAT.black,x,0.45,z);w.rotation.z=Math.PI/2;g.add(w);}const onRoad=Math.random()<0.7;g.position.set(onRoad?(Math.floor(rand(-3,3))*220+rand(-8,8)):rand(-450,450),0,onRoad?rand(-600,600):(Math.floor(rand(-3,3))*220+rand(-8,8)));scene.add(g);this.cars.push({g,hp:15,dead:false,speed:onRoad?rand(8,18):0});}},
makeBase(bx,bz,side){
 const g=new THREE.Group();g.position.set(bx,0,bz);scene.add(g);
 const wallC=side==='Z'?0x2a4a7a:0x6a2a2a;
 const wallM=new THREE.MeshStandardMaterial({color:wallC,roughness:0.7,metalness:0.3});
 // perimeter walls + towers
 for(let i=-2;i<=2;i++){g.add(box(24,14,4,wallM,i*26,7,80));g.add(box(24,14,4,wallM,i*26,7,-80));g.add(box(4,14,24,wallM,80,7,i*26));g.add(box(4,14,24,wallM,-80,7,i*26));}
 for(const [x,z]of[[-80,-80],[80,-80],[-80,80],[80,80]]){g.add(cyl(4,5,30,MAT.steel,x,15,z));g.add(box(10,4,10,wallM,x,32,z));const l=new THREE.Mesh(new THREE.SphereGeometry(1.2,8,6),side==='Z'?MAT.glowB:MAT.glowR);l.position.set(x,35,z);g.add(l);}
 // command room
 const cmd=box(30,16,20,wallM,-30* (side==='Z'?1:-1),8,20);g.add(cmd);
 const scr=box(24,6,0.5,MAT.glass,-30*(side==='Z'?1:-1),10,30.2,false);g.add(scr);
 // hangar (robot garage)
 const hang=box(50,26,40,new THREE.MeshStandardMaterial({color:side==='Z'?0x1c2f55:0x3d1515,roughness:0.6,metalness:0.5}),20,13,-25);g.add(hang);
 g.add(box(16,20,1,wallM,20,10,-4.6)); // big door
 // launch pad + lights
 const pad=cyl(22,24,2,MAT.concrete,0,1,0,24);g.add(pad);
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const l=new THREE.Mesh(new THREE.SphereGeometry(0.8,8,6),side==='Z'?MAT.glowB:MAT.glowY);l.position.set(Math.cos(a)*21,2.6,Math.sin(a)*21);g.add(l);}
 // vehicle zone marker
 const vz=cyl(6,6,0.6,side==='Z'?MAT.glowB:MAT.glowR,-20,1.2,40,16);g.add(vz);
 // interior lights poles
 for(let i=0;i<6;i++){g.add(cyl(0.4,0.4,18,MAT.steel,-60+i*24,9,60));}
 const padWorld=new THREE.Vector3(bx,2,bz);
 const vehWorld=new THREE.Vector3(bx-20,2,bz+40);
 const hangWorld=new THREE.Vector3(bx+20,0,bz-25);
 return{group:g,padWorld,vehWorld,hangWorld,side};
},
makeArena(){const ring=cyl(110,110,1.5,M(0x555c66,0.8,0.2),0,0.75,0,40);scene.add(ring);
 const edge=new THREE.Mesh(new THREE.TorusGeometry(110,2,8,40),MAT.glowY);edge.rotation.x=Math.PI/2;edge.position.y=2;scene.add(edge);
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const p=cyl(1.5,2,20,MAT.steel,Math.cos(a)*130,10,Math.sin(a)*130);scene.add(p);const l=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),MAT.glowY);l.position.set(Math.cos(a)*130,21,Math.sin(a)*130);scene.add(l);}}
};
const EnvHit={check(p){for(const b of World.buildings){if(b.dead)continue;const dx=Math.abs(p.x-b.pos.x),dz=Math.abs(p.z-b.pos.z);if(dx<b.w/2+1&&dz<b.d/2+1&&p.y<b.h+2){Combat.damageBuilding(b,25);return true;}}for(const c of World.cars){if(c.dead)continue;if(p.distanceTo(c.g.position.clone().add(new THREE.Vector3(0,1,0)))<4){Combat.explodeCar(c);return true;}}return false;}};

/* ---------- ROBOT FACTORY ---------- */
function buildRobotMesh(kind){
 const g=new THREE.Group();
 const blue=kind==='Z'?MAT.zBlue:M(0x2a3a55,0.4,0.75),red=kind==='Z'?MAT.zRed:MAT.gRed;
 // legs
 const legL=new THREE.Group(),legR=new THREE.Group();
 legL.position.set(-3.4,9,0);legR.position.set(3.4,9,0);
 for(const leg of [legL,legR]){leg.add(box(4.4,9,5,blue,0,-4.5,0));leg.add(box(5,2.6,8,red,0,-8.5,1));}
 g.add(legL,legR);
 // torso
 const torso=new THREE.Group();torso.position.y=9;
 torso.add(box(11,9,6.5,blue,0,4.5,0));
 const chest=box(8,4.5,1, MAT.zChest,0,5,3.4,false);torso.add(chest);
 if(kind==='Z'){torso.add(box(2.6,1.6,0.6,MAT.zYellow,-2.4,5,3.9,false));torso.add(box(2.6,1.6,0.6,MAT.gold||MAT.zYellow,2.4,5,3.9,false));}
 else{const v=box(1.4,3.4,0.5,MAT.gGold,0,5,3.9,false);v.rotation.z=0;torso.add(v);}
 torso.add(box(12,2.4,7,red,0,0.6,0)); // belt
 // head
 const head=new THREE.Group();head.position.y=10.5;
 head.add(box(4.6,3.6,4.6,kind==='Z'?MAT.black:MAT.gSilver,0,1,0));
 if(kind==='Z'){head.add(box(5.4,1,1.2,MAT.zRed,0,2.4,-0.5));head.add(box(1,2.6,0.6,MAT.zYellow,-1.2,1,2.4,false));head.add(box(1,2.6,0.6,MAT.zYellow,1.2,1,2.4,false));}
 else{const fin=box(0.8,4.5,2.5,MAT.gGold,0,3,0);head.add(fin);head.add(box(3,0.8,0.6,MAT.glowY,0,1,2.4,false));}
 torso.add(head);g.add(torso);
 // arms (shoulder pivots for punch animation)
 const armL=new THREE.Group(),armR=new THREE.Group();
 armL.position.set(-7.2,16.5,0);armR.position.set(7.2,16.5,0);
 for(const [arm,side]of[[armL,-1],[armR,1]]){
  arm.add(sph(2.4,red,0,0,0));
  const fore=box(3.4,7,3.6,blue,0,-5,0);arm.add(fore);
  const fist=box(3,3,3.2,MAT.steel,0,-9.5,0);arm.add(fist);arm.userData.fist=fist;
  if(kind==='G'&&side===1){const blade=box(0.7,9,1.6,MAT.gSilver,0,-9,2.5);arm.add(blade);arm.userData.blade=blade;}
 }
 g.add(armL,armR);
 g.userData={legL,legR,torso,armL,armR,head,kind};
 // scale: robot ~19 units tall (human 1.8, building 20-75, cars tiny) => giant feel
 return g;
}
function buildVehicleMesh(kind){
 const g=new THREE.Group();
 const cM=kind==='Z'?M(0xd42a2a,0.35,0.7):M(0xb01218,0.35,0.75);
 const body=box(3.2,1.2,6.5,cM,0,0,0);g.add(body);
 const nose=new THREE.Mesh(new THREE.ConeGeometry(1.4,3,8),M(0xf2f2f2,0.4,0.6));nose.rotation.x=Math.PI/2;nose.position.z=4.5;g.add(nose);
 g.add(box(7.5,0.4,2.2,cM,0,0.2,-1.5)); // wings
 const cock=sph(1.1,MAT.glass,0,0.9,0.8);cock.scale.set(1,0.7,1.4);g.add(cock);
 const eng=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.9,1.6,8),MAT.flame);eng.rotation.x=Math.PI/2;eng.position.set(-1,0,-3.4);g.add(eng);
 const eng2=eng.clone();eng2.position.x=1;g.add(eng2);
 g.userData={eng:[eng,eng2]};
 return g;
}
function buildPilotMesh(suit){const g=new THREE.Group();g.add(cyl(0.32,0.38,1.1,suit,0,0.9,0));g.add(sph(0.28,MAT.skin,0,1.7,0));g.add(box(0.7,0.5,0.4,suit,0,1.25,0));return g;}

/* ---------- COMBAT ---------- */
const Combat={damage(att,def,amt,kind){if(def.invuln>0||def.mode==='down')return;let real=amt;
 if(def.blocking&&kind!=='beam'){real*=0.2;AudioSys.block();Particles.spawn(def.getPos().clone().add(new THREE.Vector3(0,14,0)),0x55aaff,6,8,0.4,1);}
 else{Particles.spawn(def.getPos().clone().add(new THREE.Vector3(0,14,0)),0xff6633,8,10,0.4,1.2);}
 // upgrades
 if(att.isPlayer)real*=1+save.upgrades.atk*0.08;if(def.isPlayer)real*=1-save.upgrades.def*0.06;
 def.hp=Math.max(0,def.hp-real);def.sp=Math.min(100,def.sp+real*0.35);
 if(att.isPlayer&&save.dmgNum)DmgNum.show(def,Math.round(real));
 AudioSys.punch();CameraShake.add(0.25);
 if(def.hp<=0)Game.onRobotDown(def,att);else if(def.hp<def.maxHp*0.25)def.weak=true;},
 damageBuilding(b,amt){b.hp-=amt;const s=b.hp/b.max;b.g.scale.y=Math.max(0.15,s);b.g.position.y=-(1-s)*b.h*0.4;Particles.spawn(b.pos.clone().add(new THREE.Vector3(0,b.h*s,0)),0x999999,8,12,0.6,1.5);if(b.hp<=0&&!b.dead){b.dead=true;Particles.spawn(b.pos.clone().add(new THREE.Vector3(0,10,0)),0xff6622,30,22,1,2.5);Particles.spawn(b.pos.clone().add(new THREE.Vector3(0,14,0)),0x333333,20,14,1.4,3);AudioSys.explosion();CameraShake.add(0.8);setTimeout(()=>{b.g.visible=false;},50);}},
 explodeCar(c){if(c.dead)return;c.dead=true;Particles.spawn(c.g.position.clone().add(new THREE.Vector3(0,1.5,0)),0xff7722,22,18,0.8,2);Particles.spawn(c.g.position.clone().add(new THREE.Vector3(0,2,0)),0x222222,12,10,1.2,2.5);AudioSys.explosion();c.g.visible=false;}};
const DmgNum={show(robot,txt){const el=document.createElement('div');el.className='dmgnum';el.textContent=txt;const v=robot.getPos().clone().add(new THREE.Vector3(0,26,0)).project(camera);el.style.left=((v.x*0.5+0.5)*innerWidth)+'px';el.style.top=((-v.y*0.5+0.5)*innerHeight)+'px';$('dmgfeed').appendChild(el);setTimeout(()=>el.remove(),900);}};

/* ---------- FIGHTER (robot+vehicle+pilot unified) ---------- */
let FID=0;
class Fighter{
 constructor(kind,isPlayer,base){this.id=FID++;this.kind=kind;this.isPlayer=isPlayer;this.base=base;
  this.maxHp=kind==='Z'?1200:1100;this.hp=this.maxHp*(1+save.upgrades.hp*0.1);
  this.maxEn=100;this.en=100;this.sp=0;
  this.mode='pilot';this.blocking=false;this.invuln=0;this.weak=false;this.atkCD=0;this.combo=0;this.comboT=0;this.dodgeT=0;this.grabCD=0;
  this.vel=new THREE.Vector3();this.yaw=0;this.vy=0;this.grounded=true;
  this.mesh=buildRobotMesh(kind);this.mesh.visible=false;scene.add(this.mesh);
  this.veh=buildVehicleMesh(kind);this.veh.visible=false;scene.add(this.veh);
  this.pilot=buildPilotMesh(kind==='Z'?MAT.suitB:MAT.suitR);scene.add(this.pilot);
  this.pilot.position.copy(base.vehWorld).add(new THREE.Vector3(3,0,3));
  this.vehPos=base.vehWorld.clone().add(new THREE.Vector3(0,1,0));this.vehYaw=0;this.vehVel=new THREE.Vector3();
  this.robotPos=new THREE.Vector3(kind==='Z'?-40:40,0,kind==='Z'?40:-40);
  this.dockT=0;this.skillCD=[0,0,0,0];this.ultActive=0;this.walkPh=0;this.flyMode=false;
  this.ai={state:'idle',t:0,strafe:1,diff:save.difficulty};
  this.name=kind==='Z'?'MAZINGER Z':'GREAT MAZINGER';
 }
 getPos(){if(this.mode==='pilot')return this.pilot.position.clone();if(this.mode==='vehicle')return this.vehPos.clone();return this.robotPos.clone();}
 setRobotVisible(v){this.mesh.visible=v;}
 updatePilot(dt,ctl){const sp=14;this.pilot.position.addScaledVector(new THREE.Vector3(-ctl.x,0,ctl.y).applyAxisAngle(new THREE.Vector3(0,1,0),Cam.yaw),sp*dt);
  if(ctl.x||ctl.y)this.pilot.rotation.y=Math.atan2(-ctl.x,ctl.y)+Cam.yaw;
  // board vehicle?
  const d=this.pilot.position.distanceTo(this.vehPos);
  if(d<9)Game.prompt('اضغط E / 🚪 لركوب المركبة الطائرة');
  if((ctl.exit)&&d<9){this.boardVehicle();}
  this.pilot.position.y=Math.max(0,this.pilot.position.y);
 }
 boardVehicle(){this.mode='vehicle';this.pilot.visible=false;this.veh.visible=true;this.vehPos.y=Math.max(this.vehPos.y,2);
  this.vehYaw=Math.atan2(0-this.vehPos.x,0-this.vehPos.z); // face arena on takeoff
  AudioSys.engine(0.4);Game.cine('🔥 الإقلاع! الإمساك بالمركبة... BOOST',2.2);this.boostT=1.2;Game.prompt('');}
 updateVehicle(dt,ctl,isAI){const v=this.vehPos;let ax=ctl.x,az=ctl.y; // az forward/back
  const boost=(ctl.boost||Input.held('boost')||Input.pressed('ShiftLeft'))&&this.en>1;
  if(boost){this.en=Math.max(0,this.en-18*dt);this.boostT=0.2;}else this.boostT=Math.max(0,(this.boostT||0)-dt);
  const spd=(boost?95:48)*(1+save.upgrades.spd*0.06);
  this.vehYaw+=-ax*1.6*dt+Cam.dc.x*0.5;
  const fwd=new THREE.Vector3(Math.sin(this.vehYaw),0,Math.cos(this.vehYaw));
  v.addScaledVector(fwd,-az*spd*dt);
  let vy=0;if(ctl.up)vy+=1;if(ctl.down)vy-=1;
  if(Input.pressed('Space'))vy+=1;if(Input.pressed('KeyC')&&!isAI){}if(Input.pressed('ControlLeft'))vy-=1;
  v.y=clamp(v.y+vy*30*dt+(this.boostT>0?14*dt:0),1.5,320);
  if(v.y<=2&&az>0.3&&this.mode==='vehicle'&&Game.phase==='base'){/* rolling takeoff run */}
  v.x=clamp(v.x,-1900,1900);v.z=clamp(v.z,-1900,1900);
  this.veh.position.copy(v);this.veh.rotation.y=this.vehYaw;this.veh.rotation.z=lerp(this.veh.rotation.z,ax*0.5,dt*5);
  this.veh.userData.eng.forEach(e=>e.scale.set(1,1+ (boost?2.2:0.6)+Math.random()*0.3,1));
  if(boost&&Math.random()<0.6)Particles.spawn(v.clone().add(new THREE.Vector3(0,0.5,-3).applyAxisAngle(new THREE.Vector3(0,1,0),this.vehYaw)),0x66ccff,1,3,0.3,1.4);
  this.en=Math.min(this.maxEn,this.en+(boost?0:6*dt));
  // weapons
  this.atkCD-=dt;
  if(ctl.fire&&this.atkCD<=0){this.atkCD=0.35;const dir=fwd.clone();dir.y+=0.05;Projectiles.rocket(this,v.clone().add(new THREE.Vector3(0,1,0)),dir,{dmg:9+save.upgrades.atk});}
  if(ctl.laser&&this.atkCD<=0&&this.en>8){this.atkCD=0.5;this.en-=8;const dir=fwd.clone();Projectiles.fire(this,v.clone().add(new THREE.Vector3(0,1,0)),dir,{dmg:7,color:0x55ffff,speed:160,kind:'beam'});AudioSys.laser();}
  // carnage vs ground
  for(const c of World.cars){if(!c.dead&&v.distanceTo(c.g.position)<6&&v.y<5){Combat.explodeCar(c);}}
  // arrive arena -> suggest docking
 }
 updateRobot(dt,ctl,foe){const p=this.robotPos;
  this.invuln=Math.max(0,this.invuln-dt);this.atkCD-=dt;this.grabCD-=dt;this.dodgeT-=dt;
  for(let i=0;i<4;i++)this.skillCD[i]-=dt;
  if(this.comboT>0){this.comboT-=dt;if(this.comboT<=0)this.combo=0;}
  const w=this.weak?0.85:1;const spd=(ctl.run?26:13)*(1+save.upgrades.spd*0.07)*w;
  const mv=new THREE.Vector3(-ctl.x,0,ctl.y).applyAxisAngle(new THREE.Vector3(0,1,0),Cam.yaw);
  if(this.dodgeT>0.35){p.addScaledVector(this.dodgeDir,60*dt);}else if(!this.attackLock||this.attackLock<=0){p.addScaledVector(mv,spd*dt);}
  if(this.attackLock>0)this.attackLock-=dt;
  if(mv.lengthSq()>0.01){this.yaw=Math.atan2(mv.x,mv.z);this.walkPh+=dt*(ctl.run?11:7);AudioSysStep.maybe(dt,ctl.run);}
  else this.walkPh*=0.9;
  // gravity / jump / fly
  if(this.flyMode&&this.en>1){this.vy=clamp((ctl.up?30:0)-(ctl.down?30:0),-30,30);this.en-=8*dt;p.y=clamp(p.y+this.vy*dt,0,180);}
  else{if(this.grounded&&ctl.jump){this.vy=22;this.grounded=false;AudioSys.engine(0.2);}this.vy-=55*dt;p.y+=this.vy*dt;if(p.y<=0){if(!this.grounded&&this.vy<-15){Particles.spawn(p.clone(),0x998866,16,14,0.7,2);CameraShake.add(0.5);AudioSys.explosion();}p.y=0;this.vy=0;this.grounded=true;}}
  p.x=clamp(p.x,-950,950);p.z=clamp(p.z,-950,950);
  this.mesh.position.copy(p);this.mesh.rotation.y=this.yaw;
  this.animate(dt,mv);
  this.en=Math.min(this.maxEn,this.en+7*dt);
  const dist=foe?p.distanceTo(foe.getPos()):999;
  // face foe when fighting
  if(foe&&foe.hp>0&&this.mode==='robot'&&dist<200&&!mv.lengthSq){const d=foe.getPos().sub(p);this.yaw=Math.atan2(d.x,d.z);}
  // --- attacks ---
  if(ctl.light)this.tryMelee(foe,6,'light');
  if(ctl.heavy)this.tryMelee(foe,13,'heavy');
  if(ctl.grab)this.tryGrab(foe);
  if(ctl.block!==undefined)this.blocking=!!ctl.block;
  if(ctl.dodge&&this.dodgeT<=0&&this.en>10){this.en-=10;this.dodgeT=0.5;this.dodgeDir=mv.lengthSq()>0.01?mv.clone().normalize():new THREE.Vector3(Math.sin(this.yaw),0,Math.cos(this.yaw));this.invuln=Math.max(this.invuln,0.4);Particles.spawn(p.clone().add(new THREE.Vector3(0,2,0)),0x88ccff,8,8,0.4,1.2);}
  if(ctl.skill!=null)Skills.cast(this,ctl.skill,foe);
  if(ctl.ult)Skills.ultimate(this,foe);
  if(ctl.exit){this.exitRobot();}
  if(ctl.boost&&this.en>5){this.flyMode=!this.flyMode;ctl.boost=false;Game.prompt(this.flyMode?'🚀 وضع الطيران مفعّل':'🚶 وضع المشي');AudioSys.engine(0.3);}
 }
 tryMelee(foe,dmg,kind){if(this.atkCD>0)return;const d=foe?this.robotPos.distanceTo(foe.getPos()):999;const reach=foe&&foe.mode==='robot'?30:18;
  this.atkCD=kind==='light'?0.42:0.85;this.combo++;this.comboT=1.4;this.attackLock=kind==='light'?0.28:0.5;
  this.punchAnim=0.3;this.punchHeavy=kind==='heavy';
  if(foe&&d<reach){let m=dmg+this.combo*1.2+save.upgrades.atk*2;Combat.damage(this,foe,m,'melee');if(this.combo>=3){Particles.spawn(foe.getPos().clone().add(new THREE.Vector3(0,14,0)),0xffee55,16,16,0.6,1.6);Game.flashCombo(this.combo+' HITS!');}}
  else{AudioSys.noise(0.08,0.15,2000);} }
 tryGrab(foe){if(this.grabCD>0||!foe)return;this.grabCD=2;const d=this.robotPos.distanceTo(foe.getPos());if(d<26&&foe.mode==='robot'){Combat.damage(this,foe,16,'grab');const dir=foe.getPos().sub(this.robotPos).normalize();foe.robotPos.addScaledVector(dir,30);foe.robotPos.y=8;foe.vy=5;foe.grounded=false;Particles.spawn(foe.getPos().clone().add(new THREE.Vector3(0,12,0)),0xffaa00,14,14,0.6,1.6);CameraShake.add(0.6);Game.cine('💪 GRAB & THROW!',1.2);}}
 exitRobot(){if(this.mode!=='robot')return;this.mode='vehicle';this.mesh.visible=false;this.veh.visible=true;this.vehPos.copy(this.robotPos).add(new THREE.Vector3(0,26,0));this.vehYaw=this.yaw;this.vehVel.set(0,0,0);AudioSys.transform();Game.cine('⚙️ الخروج من الروبوت — العودة إلى المركبة!',2);Game.prompt('🚀 قاتل بالمركبة! اقترب من الروبوت واضغط E للعودة');}
 dockRobot(){this.mode='robot';this.veh.visible=false;this.mesh.visible=true;this.robotPos.copy(this.vehPos);this.robotPos.y=0;this.flyMode=false;AudioSys.dock();CameraShake.add(1);Particles.spawn(this.robotPos.clone().add(new THREE.Vector3(0,16,0)),0xffe27a,30,20,0.8,2);Particles.spawn(this.robotPos.clone().add(new THREE.Vector3(0,10,0)),0x88ccff,20,14,0.8,1.8);Game.cine('⚡ DOCKING — الاندماج مع الروبوت العملاق!',2.4);}
 animate(dt,mv){const u=this.mesh.userData;const sw=Math.sin(this.walkPh)* (mv.lengthSq()>0.01?0.5:0.05);
  u.legL.rotation.x=sw;u.legR.rotation.x=-sw;
  if(this.punchAnim>0){this.punchAnim-=dt;const k=this.punchHeavy?1.6:1.1;u.armR.rotation.x=-1.8*k*Math.min(1,this.punchAnim*4);}else{u.armL.rotation.x=sw*0.7;u.armR.rotation.x=-sw*0.7;}
  u.torso.position.y=9+Math.abs(Math.sin(this.walkPh))*0.5;
  if(this.blocking){u.armL.rotation.x=-1.2;u.armR.rotation.x=-1.2;}}
}
const AudioSysStep={t:0,maybe(dt,run){this.t-=dt;if(this.t<=0){this.t=run?0.28:0.45;AudioSys.step();}}};

/* ---------- SKILLS ---------- */
const Skills={
 list(kind){return kind==='Z'?['🚀 Rocket Punch','🔥 Breast Fire','🌪️ Rust Hurricane','⚔️ Iron Cutter']:['⚡ Thunder Break','🗡️ Mazinger Blade','💨 Scramble Dash','🔥 Breast Burn'];},
 cast(f,i,foe){if(f.skillCD[i]>0||f.mode!=='robot')return;const k=f.kind;
  const need=[12,22,16,18][i];if(f.en<need){Game.prompt('⚡ طاقة غير كافية!');return;}f.en-=need;f.skillCD[i]=[2.5,5,4,6][i];
  const from=f.robotPos.clone().add(new THREE.Vector3(0,15,0));const dir=foe?foe.getPos().sub(f.robotPos).setY(0).normalize():new THREE.Vector3(Math.sin(f.yaw),0,Math.cos(f.yaw));
  if(k==='Z'){
   if(i===0){ // rocket punch: detachable fist projectile
    Projectiles.fire(f,from,dir,{dmg:22+save.upgrades.atk*2,color:0xff5533,size:2.2,speed:110,kind:'fist'});f.punchAnim=0.5;Game.cine('🚀 ROCKET PUNCH!',1.2);AudioSys.missile();}
   else if(i===1){for(let s=0;s<6;s++)setTimeout(()=>{if(f.hp<=0)return;const d2=foe?foe.getPos().sub(f.robotPos).setY(2).normalize():dir;Projectiles.fire(f,from,d2,{dmg:6,color:0xffdd55,size:1.3,speed:150,kind:'beam'});AudioSys.laser();},s*90);Game.cine('🔥 BREAST FIRE!',1.4);}
   else if(i===2){const r=foe?f.robotPos.distanceTo(foe.getPos()):999;if(foe&&r<70){Combat.damage(f,foe,20,'beam');Particles.spawn(foe.getPos().clone().add(new THREE.Vector3(0,12,0)),0x88ff88,24,20,0.8,2);}Particles.spawn(from,0x88ff88,20,18,0.7,2);Game.cine('🌪️ RUST HURRICANE!',1.4);AudioSys.noise(0.7,0.5,600);}
   else{ // iron cutter
    if(foe&&f.robotPos.distanceTo(foe.getPos())<90){const d2=foe.getPos().sub(f.robotPos).normalize();Projectiles.fire(f,from,d2,{dmg:26,color:0xccffee,size:1.8,speed:130,kind:'cutter',homing:foe});}Game.cine('⚔️ IRON CUTTER!',1.3);AudioSys.laser();}
  }else{
   if(i===0){Game.cine('⚡ THUNDER BREAK!',1.6);AudioSys.ult();const tgt=foe?foe.getPos().clone():from.clone().add(dir.clone().multiplyScalar(60));for(let s=0;s<3;s++)setTimeout(()=>{Particles.spawn(tgt.clone().add(new THREE.Vector3(0,20,0)),0xffe27a,26,24,0.7,2.4);Particles.spawn(tgt,0xffffff,16,20,0.5,2);AudioSys.explosion();CameraShake.add(0.7);if(foe&&foe.mode==='robot'&&foe.robotPos.distanceTo(tgt)<40)Combat.damage(f,foe,14,'beam');},s*220);}
   else if(i===1){const r=foe?f.robotPos.distanceTo(foe.getPos()):999;f.punchAnim=0.5;if(foe&&r<34){Combat.damage(f,foe,30,'blade');Particles.spawn(foe.getPos().clone().add(new THREE.Vector3(0,14,0)),0xaaffff,20,20,0.6,1.8);}Game.cine('🗡️ MAZINGER BLADE!',1.3);AudioSys.noise(0.3,0.4,4000);}
   else if(i===2){f.invuln=0.8;const d2=dir.clone();f.robotPos.addScaledVector(d2,45);f.attackLock=0.4;f.punchAnim=0.4;const r=foe?f.robotPos.distanceTo(foe.getPos()):999;if(foe&&r<30)Combat.damage(f,foe,18,'dash');Particles.spawn(f.robotPos.clone().add(new THREE.Vector3(0,8,0)),0xff4444,16,16,0.5,1.8);Game.cine('💨 SCRAMBLE DASH!',1.1);}
   else{for(let s=0;s<5;s++)setTimeout(()=>{const d2=foe?foe.getPos().sub(f.robotPos).setY(3).normalize():dir;Projectiles.fire(f,from,d2,{dmg:7,color:0xff8833,size:1.4,speed:140,kind:'beam'});AudioSys.laser();},s*100);Game.cine('🔥 BREAST BURN!',1.4);}
  }},
 ultimate(f,foe){if(f.sp<100||f.ultActive>0||f.mode!=='robot')return;f.sp=0;f.ultActive=3;const k=f.kind;
  Game.cine(k==='Z'?'☄️ MAZINGER Z — الهجوم النهائي السينمائي!':'☄️ GREAT MAZINGER — THUNDER BREAK FINAL!',2.8,true);AudioSys.ult();CameraShake.add(1.5);
  Cam.cinematic(2.8,f,foe);
  let hits=0;const iv=setInterval(()=>{if(hits>=6||f.hp<=0){clearInterval(iv);f.ultActive=0;return;}hits++;
   if(foe&&foe.hp>0){const tgt=foe.getPos().clone().add(new THREE.Vector3(0,14,0));Particles.spawn(tgt,k==='Z'?0xffdd44:0x88ddff,30,26,0.8,2.6);Particles.spawn(tgt,0xffffff,14,18,0.5,2);Combat.damage(f,foe,16,'ult');AudioSys.explosion();CameraShake.add(0.8);$('flash').style.opacity=0.5;setTimeout(()=>$('flash').style.opacity=0,120);}},380);}
};

/* ---------- CAMERA ---------- */
const Cam={yaw:0,pitch:0.35,mode:'third',cockpit:false,dc:{x:0,y:0},cineT:0,
 cinematic(t,f,foe){this.cineT=t;},
 update(dt,focus,foe){const dc=Input.consumeCam();this.dc=dc;
  if(Input.edgeHit('KeyC')||Input.tap('cam'))this.cycle();
  if(Input.edgeHit('KeyV'))this.cockpit=!this.cockpit;
  this.yaw+=dc.x*1.4;if(focus.mode==='vehicle'&&Math.abs(Input.axis().x)>0.1)this.yaw-=Input.axis().x*0.4*dt;
  this.pitch=clamp(this.pitch+dc.y,0.02,1.3);
  const sh=CameraShake.off();let tp=new THREE.Vector3(),lk=new THREE.Vector3();
  if(this.cineT>0&&foe){this.cineT-=dt;const t=1-this.cineT/2.8;const a=t*Math.PI*1.2;const mid=focus.getPos().add(foe.getPos()).multiplyScalar(0.5);mid.y=16;tp.set(mid.x+Math.cos(a)*70,mid.y+22,mid.z+Math.sin(a)*70);lk.copy(mid);}
  else if(focus.mode==='pilot'){tp.copy(focus.pilot.position).add(new THREE.Vector3(-Math.sin(this.yaw)*9,5,-Math.cos(this.yaw)*9));lk.copy(focus.pilot.position).add(new THREE.Vector3(0,2.5,0));}
  else if(focus.mode==='vehicle'){const v=focus.vehPos;const back=new THREE.Vector3(Math.sin(focus.vehYaw),0,Math.cos(focus.vehYaw));
   if(this.cockpit){tp.copy(v).add(new THREE.Vector3(0,2.2,0));const f2=new THREE.Vector3(Math.sin(focus.vehYaw),0.02,Math.cos(focus.vehYaw));lk.copy(tp).addScaledVector(f2,60);}
   else{tp.copy(v).addScaledVector(back,-17).add(new THREE.Vector3(0,7,0));lk.copy(v).addScaledVector(back,32);}}
  else{const p=focus.robotPos;const back=new THREE.Vector3(Math.sin(this.yaw),0,Math.cos(this.yaw));
   if(this.mode==='battle'&&foe){const mid=p.clone().add(foe.getPos()).multiplyScalar(0.5);mid.y=18;const d=p.distanceTo(foe.getPos());tp.copy(mid).add(new THREE.Vector3(d*0.35+30,26,d*0.35+30));lk.copy(mid);}
   else{tp.copy(p).addScaledVector(back,34).add(new THREE.Vector3(0,20,0));lk.copy(p).add(new THREE.Vector3(0,15,0));}}
  camera.position.lerp(tp,Math.min(1,dt*5));const cur=new THREE.Vector3();camera.getWorldDirection(cur);const want=lk.sub(camera.position).normalize();camera.lookAt(camera.position.clone().add(cur.lerp(want,Math.min(1,dt*6))));camera.position.add(sh);
 },
 cycle(){const modes=['third','battle','vehicle'];this.mode=modes[(modes.indexOf(this.mode)+1)%modes.length];Game.prompt('📷 الكاميرا: '+this.mode);}
};

/* ---------- AI ---------- */
const AI={ctl(f,foe,dt){const d=save.difficulty;const a=f.ai;a.t-=dt;
 const dist=f.getPos().distanceTo(foe.getPos());
 const react=[1.2,0.8,0.5,0.25][d],aggro=[0.35,0.55,0.75,0.95][d];
 const c={x:0,y:0,light:false,heavy:false,block:false,dodge:false,skill:null,ult:false,exit:false,boost:false,jump:false,up:false,down:false,fire:false,laser:false,run:true};
 if(f.mode==='vehicle'){
  // fly toward arena then dock
  const home=new THREE.Vector3(f.kind==='Z'?-40:40,60,f.kind==='Z'?40:-40);
  const to=home.clone().sub(f.vehPos);const distV=to.length();
  if(distV<35){f.dockRobot();Game.cine('🤖 الخصم اندمج مع روبوته!',1.6);return c;}
  const wantYaw=Math.atan2(to.x,to.z);let dy=wantYaw-f.vehYaw;while(dy>Math.PI)dy-=2*Math.PI;while(dy<-Math.PI)dy+=2*Math.PI;
  c.x=clamp(-dy*1.5,-1,1);c.y=-1;if(f.vehPos.y<50)c.up=true;
  if(distV<120&&foe.mode==='vehicle'){c.fire=Math.random()<0.05+0.03*d;}
  return c;
 }
 if(f.mode==='pilot'){return c;}
 // robot combat
 if(a.t<=0){a.t=react*rand(0.7,1.3);a.dec=Math.random();
  if(dist>150)a.plan='approach';else if(dist<20)a.plan=Math.random()<0.4?'retreat':'strafe';
  else{const r=Math.random();a.plan=r<aggro*0.55?'attack':(r<0.75?'strafe':(r<0.9?'skill':'block'));}
  a.strafe=Math.random()<0.5?-1:1;a.skillPick=Math.floor(rand(0,4));}
 const to=foe.getPos().sub(f.robotPos);const fw=new THREE.Vector3(Math.sin(f.yaw),0,Math.cos(f.yaw));const ang=Math.atan2(to.x,to.z)-f.yaw;
 const rel=((ang+Math.PI*3)%(Math.PI*2))-Math.PI;
 if(a.plan==='approach'){c.y=-1;if(Math.abs(rel)>0.4)c.x=rel>0?-1:1;if(dist>60&&Math.random()<0.2+d*0.15){f.flyMode=true;c.up=true;}else f.flyMode=false;}
 else if(a.plan==='retreat'){c.y=1;}
 else if(a.plan==='strafe'){c.x=a.strafe;if(Math.random()<0.02)c.dodge=true;}
 else if(a.plan==='attack'){if(Math.abs(rel)>0.5)c.x=rel>0?-1:1;const dd=f.robotPos.distanceTo(foe.getPos());
  if(dd<26){c.light=Math.random()<0.7;c.heavy=Math.random()<0.2+d*0.1;if(Math.random()<0.05+d*0.04)c.grab=true;}
  else c.y=-1;}
 else if(a.plan==='skill'){c.skill=a.skillPick;if(dist>100&&f.kind==='Z')c.skill=1;}
 else if(a.plan==='block'){c.block=foe.atkCD>-0.2||Math.random()<0.5;}
 // defense reactions
 if(foe.punchAnim>0&&dist<40){if(Math.random()<[0.1,0.25,0.45,0.7][d])c.block=true;if(Math.random()<[0,0.1,0.25,0.45][d])c.dodge=true;}
 if(f.sp>=100&&dist<90&&Math.random()<0.02+d*0.02)c.ult=true;
 if(f.hp<f.maxHp*0.3&&Math.random()<0.005){c.exit=true;} // AI exits to vehicle sometimes
 if(d>=2&&Math.random()<0.003)c.exit=true;
 if(f.en<20)c.skill=null;
 return c;}
};

/* ---------- GAME ---------- */
const Game={phase:'menu',player:null,enemy:null,boss:null,mode:'story',time:120,cineQ:null,trainingGod:false,
pick:'Z',foePick:'G',
init(){World.build();Particles.init();Input.init(canvas);this.statusList();this.bindUI();applyQuality(save.quality);
 $('setQuality').value=save.quality;$('setFps').value=save.fps;$('setMusic').value=save.music;$('setSfx').value=save.sfx;
 $('difficulty').value=save.difficulty;
 const loop=(t)=>{requestAnimationFrame(loop);const dt=Math.min(0.05,(t-(this._lt||t))/1000||0.016);this._lt=t;this.tick(dt);};requestAnimationFrame(loop);
 $('loading').style.display='none';
 // menu background robots
 this.menuScene();
},
menuScene(){if(this.player){scene.remove(this.player.mesh,this.player.veh,this.player.pilot);}if(this.enemy){scene.remove(this.enemy.mesh,this.enemy.veh,this.enemy.pilot);}
 const bZ=World.baseZ,bG=World.baseG;
 this.player=new Fighter('Z',true,bZ);this.enemy=new Fighter('G',false,bG);
 this.player.robotPos.set(30,0,30);this.enemy.robotPos.set(-30,0,-30);
 this.player.setRobotVisible(true);this.enemy.setRobotVisible(true);
 this.player.mode='robot';this.enemy.mode='robot';this.player.mesh.position.copy(this.player.robotPos);this.enemy.mesh.position.copy(this.enemy.robotPos);
 this.phase='menu';
},
bindUI(){
 const start=(mode)=>{AudioSys.init();this.startGame(mode);};
 $('btnStart').onclick=()=>start('story');
 $('btnSelect').onclick=()=>{AudioSys.init();this.show('select');};
 $('btnTraining').onclick=()=>start('training');
 $('btnFlightMode').onclick=()=>start('flight');
 $('btnBoss').onclick=()=>start('boss');
 $('btnSettings').onclick=()=>this.show('settings');
 $('btnStatus').onclick=()=>this.show('status');
 $('btnExit').onclick=()=>{document.body.innerHTML='<div style="display:flex;height:100vh;align-items:center;justify-content:center;flex-direction:column;gap:10px"><h1>MAZINGER Z VS GREAT MAZINGER</h1><p>شكرًا للعب! أعد تحميل الصفحة للعودة.</p></div>';};
 document.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{this.pick=b.dataset.pick;this.foePick=this.pick==='Z'?'G':'Z';save.difficulty=+$('difficulty').value;persist();start('story');});
 $('btnBackMenu').onclick=$('btnBackMenu2').onclick=$('btnBackMenu3').onclick=()=>this.show('menu');
 $('btnSaveSettings').onclick=()=>{save.quality=$('setQuality').value;save.fps=$('setFps').value;save.music=+$('setMusic').value;save.sfx=+$('setSfx').value;save.shake=$('setShake').checked;save.dmgNum=$('setDmgNum').checked;applyQuality(save.quality);AudioSys.applyVol();persist();this.show('menu');};
 $('btnSkipCine').onclick=()=>this.clearCine();
 $('btnRematch').onclick=()=>{ $('endScreen').classList.add('hidden');this.startGame(this.mode);};
 $('btnToMenu').onclick=()=>{$('endScreen').classList.add('hidden');this.menuScene();this.show('menu');};
 addEventListener('keydown',e=>{if(e.code==='Escape'&&this.cineQ)this.clearCine();});
},
show(id){['menu','select','settings','status'].forEach(s=>$(s).classList.add('hidden'));if(id)$(id).classList.remove('hidden');$('hud').classList.toggle('hidden',!(id===null));if(id===null)$('hud').classList.remove('hidden');},
startGame(mode){this.mode=mode;
 // cleanup old
 for(const f of [this.player,this.enemy,this.boss]){if(!f)continue;scene.remove(f.mesh,f.veh,f.pilot);}
 Projectiles.list.forEach(p=>scene.remove(p.mesh));Projectiles.list.length=0;
 const bZ=World.baseZ,bG=World.baseG;
 const pk=mode==='boss'?this.pick:this.pick, fk=this.foePick;
 this.player=new Fighter(pk,true,pk==='Z'?bZ:bG);
 this.enemy=mode==='boss'?this.makeBoss():new Fighter(fk,false,fk==='Z'?bZ:bG);
 this.enemy.ai.diff=save.difficulty=+$('difficulty')?.value??save.difficulty;
 this.time=mode==='training'?999:120;this.trainingGod=(mode==='training');
 if(mode==='flight'){this.phase='flight';this.player.mode='vehicle';this.player.veh.visible=true;this.player.pilot.visible=false;this.player.vehPos.copy(this.player.base.padWorld).add(new THREE.Vector3(0,30,0));this.cine('✈️ وضع الطيران الحر — استكشف المدينة والجبال والبحر!',3);}
 else if(mode==='free'){this.phase='battle';this.setupBattle(true);}
 else if(mode==='training'){this.phase='battle';this.setupBattle(true);this.enemy.hp=this.enemy.maxHp;this.cine('🎯 التدريب: جرّب كل المهارات (1-4) والنهائي (Q) — طاقة لا تنهك!',3.5);}
 else if(mode==='boss'){this.phase='battle';this.setupBattle(true);this.cine('👹 زعيم الوحوش الميكانيكية Garada-7 ظهر! اهزمه!',3);}
 else{ // story: full path base->vehicle->flight->dock->battle
  this.phase='base';this.player.mode='pilot';this.player.pilot.visible=true;
  this.player.veh.visible=true;this.player.veh.position.copy(this.player.vehPos);
  this.enemy.mode='vehicle';this.enemy.veh.visible=true;this.enemy.vehPos.copy(this.enemy.base.padWorld).add(new THREE.Vector3(0,40,0));
  AudioSys.alarm();
  this.cine('🚨 إنذار! '+this.player.name+' في قاعدته — امشِ إلى المركبة (النقطة المضيئة) واركبها بـ E',5);
 }
 this.show(null);$('endScreen').classList.add('hidden');
 $('nameP').textContent=this.player.name;$('nameE').textContent=this.enemy.name;
 if(mode==='boss')$('nameE').textContent='GARADA-7 (BOSS)';
},
makeBoss(){const b=new Fighter(this.foePick,false,World.baseG);b.name='GARADA-7';b.maxHp=1600;b.hp=1600;
 b.mesh.traverse(o=>{if(o.isMesh&&o.material===MAT.gSilver)o.material=M(0x3a2a4a,0.5,0.6);});return b;},
setupBattle(asRobot){for(const f of [this.player,this.enemy]){
 f.mode='robot';f.setRobotVisible(true);f.veh.visible=false;f.pilot.visible=false;
 f.robotPos.set(f===this.player?(f.kind==='Z'?-40:40):(f.kind==='Z'?-40:40)*-1,0,f===this.player?60:-60);
 f.mesh.position.copy(f.robotPos);}
},
cine(txt,secs,big=false){$('cine').classList.remove('hidden');$('cineText').textContent=txt;$('btnSkipCine').style.display='';this.cineQ=secs;},
clearCine(){$('cine').classList.add('hidden');this.cineQ=null;},
prompt(t){$('prompt').textContent=t;if(t)clearTimeout(this._pt),this._pt=setTimeout(()=>$('prompt').textContent='',4000);},
flashCombo(t){this.prompt('🔥 '+t);},
statusList(){const ok='✅ يعمل فعليًا',warn='⚠️ يتطلب Adapter خارجي';
 $('statusList').innerHTML=[
 ['Start / الحركة / القتال / الضرر / AI / الصحة / الفوز / الحفظ',ok],
 ['الروبوت + المركبة + الالتحام + الخروج والعودة بدون تحميل',ok],
 ['اللمس + لوحة المفاتيح + يد بلوتوث (Gamepad API)',ok],
 ['الصوت والموسيقى: مولّدة برمجيًا أصلية (ليست تسجيلات الأنمي)',ok],
 ['تصدير Android APK',warn+' — يتطلب تغليف Capacitor/Cordova أو نقل المشروع إلى Unity/Godot'],
 ['موديلات الأنمي الأصلية بدقة سينمائية',warn+' — المجسمات هنا إجرائية أصلية لتجنب النسخ'],
 ].map(([a,b])=>`<li><b>${a}:</b> ${b}</li>`).join('');},
playerCtl(){const a=Input.axis(),gp=Input.gamepad();
 const eE=Input.edgeHit('KeyE'),eQ=Input.edgeHit('KeyQ'),eF=Input.edgeHit('KeyF'),eSp=Input.edgeHit('Space'),eSh=Input.edgeHit('ShiftLeft'),eJ=Input.edgeHit('KeyJ'),eK=Input.edgeHit('KeyK');
 const c={x:a.x,y:a.y,light:eJ||Input.tap('atk')||(gp&&gp.atk&&!this._gpA),
 heavy:eK||Input.tap('heavy')||(gp&&gp.heavy&&!this._gpH),
 jump:eSp||Input.tap('jump')||(gp&&gp.jump),
 block:Input.pressed('KeyB')||Input.held('block')||(gp&&gp.block),
 dodge:eSh||Input.tap('dodge'),
 skill:null,ult:eQ||Input.tap('ult'),
 exit:false,boost:eF||Input.tap('boost'),
 fire:Input.pressed('KeyJ')||Input.held('atk'),laser:Input.pressed('KeyK')||Input.held('heavy'),
 up:Input.pressed('KeyR')||Input.held('jump'),down:Input.pressed('ControlLeft')||Input.pressed('KeyC'),
 run:Input.pressed('ShiftLeft'),cam:false};
 if(gp){c.x+=gp.move.x;c.y+=gp.move.y;this._gpA=gp.atk;this._gpH=gp.heavy;if(gp.skill&&!this._gpS)c.skill=0;this._gpS=gp.skill;if(gp.ult)c.ult=true;if(gp.exit&&!this._gpE)c.exit=true;this._gpE=gp.exit;if(gp.boost)c.boost=true;if(gp.jump)c.jump=c.jump||gp.jump;}
 for(let i=0;i<4;i++)if(Input.edgeHit('Digit'+(i+1)))c.skill=i;
 if(Input.tap('skill'))c.skill=(this._sk=(this._sk||0)+1)%4;
 if(eE)c.exit=true;if(Input.tap('exit'))c.exit=true;
 return c;},
tick(dt){
 if(save.fps==='30 FPS'){this._acc=(this._acc||0)+dt;if(this._acc<1/30)return;dt=this._acc;this._acc=0;}
 Particles.update(dt);CameraShake.update(dt);
 if(this.cineQ){this.cineQ-=dt;if(this.cineQ<=0)this.clearCine();}
 if(this.phase==='menu'){const t=performance.now()*0.001;
  camera.position.set(Math.cos(t*0.15)*90,34,Math.sin(t*0.15)*90+30);camera.lookAt(0,14,0);
  this.player.walkPh+=dt*2;this.player.animate(dt,new THREE.Vector3());this.enemy.animate(dt,new THREE.Vector3());
  Projectiles.update(dt,[]);this.hud();renderer.render(scene,camera);return;}
 const P=this.player,E=this.enemy;if(!P||!E)return;
 const pc=this.playerCtl();
 // --- phase logic ---
 if(this.phase==='base'){
  P.updatePilot(dt,pc);
  // enemy AI auto takes off in background
  E.vehPos.y+=20*dt;E.veh.position.copy(E.vehPos);E.veh.rotation.y+=dt*0.3;
  Cam.update(dt,P,E);
  if(P.mode==='vehicle'){this.phase='flight';this.cine('🛫 إقلاع ناجح! طِر نحو الساحة المضيئة (الحلقة الذهبية) ثم اضغط E للالتحام',4);}
 }else if(this.phase==='flight'){
  P.updateVehicle(dt,{x:pc.x,y:pc.y,up:pc.up||pc.jump,down:pc.down,boost:pc.boost,fire:pc.fire,laser:pc.laser},false);
  E.updateVehicle(dt,AI.ctl(E,{getPos:()=>new THREE.Vector3(0,60,0),mode:'robot',hp:1},dt),true);
  // docking check
  const dockPt=P.kind==='Z'?new THREE.Vector3(-40,0,40):new THREE.Vector3(40,0,-40);
  const dXZ=Math.hypot(P.vehPos.x-dockPt.x,P.vehPos.z-dockPt.z);
  if(dXZ<70&&P.vehPos.y<90)this.prompt('⚡ اضغط E للالتحام مع الروبوت العملاق!');
  if(pc.exit&&dXZ<90&&P.vehPos.y<110){P.dockRobot();this.phase='battle';this.setupBattleKeep(P,E);this.cine('⚡ DOCKING مكتمل — بدأ القتال! اهزم '+E.name,3);}
  else if(this.mode==='flight'){/* free roam */}
  else if(dXZ<25){/* auto? no */}
  Cam.update(dt,P,E.mode==='robot'?E:null);
 }else if(this.phase==='battle'){
  // player: robot or vehicle combat
  if(P.mode==='robot')P.updateRobot(dt,pc,E);
  else{P.updateVehicle(dt,{x:pc.x,y:pc.y,up:pc.up||pc.jump,down:pc.down,boost:pc.boost,fire:pc.fire,laser:pc.laser},false);
   const d=P.vehPos.distanceTo(P.robotPos.clone().add(new THREE.Vector3(0,20,0)));
   if(d<45)this.prompt('⚡ اضغط E للعودة إلى الروبوت!');if(pc.exit&&d<60){P.dockRobot();}}
  // enemy AI
  const ec=AI.ctl(E,P,dt);
  if(E.mode==='robot'){E.updateRobot(dt,{x:ec.x,y:ec.y,light:ec.light,heavy:ec.heavy,block:ec.block,dodge:ec.dodge,skill:ec.skill,ult:ec.ult,exit:false,boost:ec.boost,jump:ec.jump,up:false,down:false,run:ec.run},P);
   if(ec.exit)E.exitRobot();}
  else E.updateVehicle(dt,ec,true);
  // enemy re-dock
  if(E.mode==='vehicle'&&E.vehPos.distanceTo(E.robotPos.clone().add(new THREE.Vector3(0,20,0)))<40&&Math.random()<0.02)E.dockRobot();
  // timer
  if(!this.trainingGod){this.time-=dt;if(this.time<=0){this.time=0;this.finish(P.hp>=E.hp?P:E);}}
  Cam.update(dt,P.mode==='vehicle'&&E.mode==='robot'?P:(P.mode==='robot'?P:P),E);
  // ambient destruction by stomping
  for(const c of World.cars){if(!c.dead){for(const f of [P,E]){if(f.mode==='robot'&&c.g.position.distanceTo(f.robotPos)<8){Combat.explodeCar(c);}}if(!c.dead&&c.speed){c.g.position.z+=c.speed*dt;if(c.g.position.z>650)c.g.position.z=-650;c.g.rotation.y=c.speed>0?0:Math.PI;}}}
 }
 Projectiles.update(dt,[P,E]);
 // enemy plane mesh sync
 if(E.mode==='vehicle'){E.veh.visible=true;E.veh.position.copy(E.vehPos);}
 if(P.mode==='pilot'){/* pilot visible */}
 this.hud();
 renderer.render(scene,camera);
},
setupBattleKeep(P,E){ // place enemy as robot ready
 E.mode='robot';E.setRobotVisible(true);E.veh.visible=false;
 E.robotPos.set(E.kind==='Z'?-40:40,0,E.kind==='Z'?40:-40);E.mesh.position.copy(E.robotPos);},
onRobotDown(def,att){def.hp=0;def.mode='down';try{def.mesh.rotation.z=def===this.player?1.25:-1.25;}catch{}
 Particles.spawn(def.getPos().clone().add(new THREE.Vector3(0,12,0)),0xff5522,40,24,1.2,3);AudioSys.explosion();CameraShake.add(1.5);
 if(def===this.enemy||def===this.player){setTimeout(()=>{if(this.phase==='battle')this.finish(att);},1800);
  this.cine(def===this.enemy?'💥 الخصم سقط!':'💥 روبوتك سقط!',1.8);}},
finish(winner){if(this.phase==='end')return;this.phase='end';
 const win=winner===this.player;
 $('endTitle').textContent=win?'🏆 VICTORY — انتصار!':'💀 DEFEAT — هزيمة';
 $('endDesc').textContent=win?`${this.player.name} هزم ${this.enemy.name}! وقت: ${this.fmt(this.time)}`:`${this.enemy.name} هزم ${this.player.name}. حاول مجددًا! (صعوبة البوت: ${['سهل','عادي','صعب','مستحيل'][save.difficulty]})`;
 $('endScreen').classList.remove('hidden');
 if(win){save.wins[this.player.kind]=(save.wins[this.player.kind]||0)+1;save.story=Math.max(save.story,1);persist();}
 AudioSys.ult();},
fmt(t){t=Math.max(0,t|0);return String((t/60)|0).padStart(2,'0')+':'+String(t%60).padStart(2,'0');},
hud(){$('hpP').style.width=(100*this.player.hp/this.player.maxHp)+'%';$('enP').style.width=this.player.en+'%';$('spP').style.width=this.player.sp+'%';
 $('hpE').style.width=(100*this.enemy.hp/this.enemy.maxHp)+'%';$('enE').style.width=this.enemy.en+'%';$('spE').style.width=this.enemy.sp+'%';
 $('modeP').textContent=this.player.mode==='robot'?'🤖 ROBOT':this.player.mode==='vehicle'?'✈️ VEHICLE':'🧍 PILOT';
 $('modeE').textContent=this.enemy.mode==='robot'?'🤖 ROBOT':this.enemy.mode==='vehicle'?'✈️ VEHICLE':'🧍 PILOT';
 $('timer').textContent=this.fmt(this.time);}
};
Game.init();
window.Game=Game;
