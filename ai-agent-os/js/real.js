/* AI AGENT OS — Real Execution Layer (WebContainer + FFmpeg.wasm + Real LLM Streaming) */
import { WebContainer } from '@webcontainer/api';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let webcontainer = null;
let wcReady = false;
let ffmpeg = null;
let ffmpegReady = false;

const Real = {
  /* ---- WebContainer: Real Terminal + File System + Node.js ---- */
  async bootWC(){
    if(wcReady) return webcontainer;
    const status = document.getElementById('wc-status');
    if(status) status.textContent = '🔄 جاري تشغيل بيئة Node.js حقيقية (WebContainer)...';
    try{
      webcontainer = await WebContainer.boot();
      wcReady = true;
      if(status) status.textContent = '✅ WebContainer جاهز — Node.js ' + (await this.wcRun('node --version')).trim();
      Bus.emit('wc',{type:'ready'});
      return webcontainer;
    }catch(e){
      if(status) status.textContent = '❌ فشل تشغيل WebContainer: ' + e.message;
      Logger.error('wc',e); throw e;
    }
  },
  async wcRun(cmd, opts={}){
    if(!wcReady) await this.bootWC();
    const proc = await webcontainer.spawn('sh', ['-c', cmd], opts);
    const output = [];
    proc.output.pipeTo(new WritableStream({
      write(chunk){ output.push(new TextDecoder().decode(chunk)); }
    }));
    await proc.exit;
    return output.join('');
  },
  async wcWriteFile(path, content){
    if(!wcReady) await this.bootWC();
    await webcontainer.fs.writeFile(path, content);
  },
  async wcReadFile(path){
    if(!wcReady) await this.bootWC();
    return await webcontainer.fs.readFile(path, 'utf-8');
  },
  async wcListDir(path='.'){
    if(!wcReady) await this.bootWC();
    const entries = await webcontainer.fs.readdir(path, {withFileTypes:true});
    return entries.map(e=>({name:e.name, isDir:e.isDirectory()}));
  },
  async wcRemove(path){
    if(!wcReady) await this.bootWC();
    await webcontainer.fs.rm(path, {recursive:true, force:true});
  },
  /* Port forwarding for preview servers */
  async wcPreview(port){
    if(!wcReady) await this.bootWC();
    const info = await webcontainer.getServerInfo(port);
    return info?.url || null;
  },

  /* ---- FFmpeg.wasm: Real Video/Audio Processing ---- */
  async initFFmpeg(){
    if(ffmpegReady) return ffmpeg;
    const status = document.getElementById('ff-status');
    if(status) status.textContent = '🔄 جاري تحميل FFmpeg.wasm (قد يستغرق دقيقة)...';
    try{
      ffmpeg = createFFmpeg({log:true});
      const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript')
      });
      ffmpegReady = true;
      if(status) status.textContent = '✅ FFmpeg.wasm جاهز — تحرير/تصدير فيديو حقيقي';
      Bus.emit('ffmpeg',{type:'ready'});
      return ffmpeg;
    }catch(e){
      if(status) status.textContent = '❌ فشل تحميل FFmpeg: ' + e.message;
      Logger.error('ffmpeg',e); throw e;
    }
  },
  async ffmpegRun(args, inputFiles={}, outputFile='output.mp4'){
    if(!ffmpegReady) await this.initFFmpeg();
    for(const [name,data] of Object.entries(inputFiles)){
      ffmpeg.FS('writeFile', name, await fetchFile(data));
    }
    await ffmpeg.run(...args);
    const data = ffmpeg.FS('readFile', outputFile);
    ffmpeg.FS('unlink', outputFile);
    return new Blob([data.buffer], {type:'video/mp4'});
  },
  /* Quick video ops */
  async ffmpegTrim(input, start, duration, output='trimmed.mp4'){
    return this.ffmpegRun(['-ss',start,'-t',duration,'-i','input.mp4','-c','copy',output],{'input.mp4':input},output);
  },
  async ffmpegConcat(inputs, output='concat.mp4'){
    const list = inputs.map((_,i)=>`file 'input${i}.mp4'`).join('\n');
    const files = {'list.txt': new Blob([list],{type:'text/plain'})};
    inputs.forEach((v,i)=> files[`input${i}.mp4`] = v);
    return this.ffmpegRun(['-f','concat','-safe','0','-i','list.txt','-c','copy',output],files,output);
  },
  async ffmpegAddSubtitle(video, srt, output='subtitled.mp4'){
    return this.ffmpegRun(['-i','input.mp4','-vf',`subtitles=sub.srt`,output],{'input.mp4':video,'sub.srt':srt},output);
  },
  async ffmpegExtractAudio(video, output='audio.mp3'){
    return this.ffmpegRun(['-i','input.mp4','-vn','-acodec','libmp3lame',output],{'input.mp4':video},output);
  },

  /* ---- Real LLM Streaming ---- */
  async llmStream(prompt, provider, onChunk){
    const secret = await Vault.use(Vault.secrets.find(s=>s.provider===provider.id)?.id);
    if(!secret) throw new Error('No API key for '+provider.name);
    const base = (provider.base||'https://openrouter.ai/api/v1').replace(/\/$/,'');
    const res = await fetch(base+'/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+secret},
      body:JSON.stringify({model:provider.model||'openai/gpt-4o-mini', messages:[{role:'user',content:prompt}], stream:true})
    });
    if(!res.ok) throw new Error('LLM error '+res.status);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full='';
    while(true){
      const {done,value} = await reader.read();
      if(done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l=>l.startsWith('data: '));
      for(const line of lines){
        if(line==='data: [DONE]') return full;
        try{
          const data = JSON.parse(line.slice(6));
          const delta = data.choices?.[0]?.delta?.content || '';
          if(delta){ full+=delta; onChunk(delta); }
        }catch{}
      }
    }
    return full;
  },

  /* ---- Real Project Generators ---- */
  async genAndroidProject(spec){
    await this.bootWC();
    const files = {
      'settings.gradle.kts': `pluginManagement { repositories { gradlePluginPortal() google() mavenCentral() } } dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS) repositories { google() mavenCentral() } } rootProject.name = "${spec.name}" include(":app")`,
      'build.gradle.kts': `plugins { id("com.android.application") version "8.4.0" apply false id("org.jetbrains.kotlin.android") version "1.9.22" apply false }`,
      'app/build.gradle.kts': `plugins { id("com.android.application") id("org.jetbrains.kotlin.android") } android { namespace = "com.aiagent.${spec.name.toLowerCase()}" compileSdk = 34 defaultConfig { applicationId = "com.aiagent.${spec.name.toLowerCase()}" minSdk = 24 targetSdk = 34 versionCode = 1 versionName = "1.0" } buildTypes { release { isMinifyEnabled = false } } compileOptions { sourceCompatibility = JavaVersion.VERSION_1_8 targetCompatibility = JavaVersion.VERSION_1_8 } kotlinOptions { jvmTarget = "1.8" } } dependencies { implementation("androidx.core:core-ktx:1.12.0") implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0") implementation("androidx.activity:activity-compose:1.8.2") implementation(platform("androidx.compose:compose-bom:2024.02.00")) implementation("androidx.compose.ui:ui") implementation("androidx.compose.ui:ui-graphics") implementation("androidx.compose.ui:ui-tooling-preview") implementation("androidx.compose.material3:material3") implementation("androidx.room:room-runtime:2.6.1") kapt("androidx.room:room-compiler:2.6.1") implementation("androidx.room:room-ktx:2.6.1") testImplementation("junit:junit:4.13.2") androidTestImplementation("androidx.test.ext:junit:1.1.5") androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1") }`,
      'app/src/main/AndroidManifest.xml': `<?xml version="1.0" encoding="utf-8"?><manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:allowBackup="true" android:icon="@mipmap/ic_launcher" android:label="${spec.name}" android:roundIcon="@mipmap/ic_launcher_round" android:supportsRtl="true" android:theme="@style/Theme.${spec.name}"><activity android:name=".MainActivity" android:exported="true" android:theme="@style/Theme.${spec.name}"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>`,
      'app/src/main/java/com/aiagent/name/MainActivity.kt': `package com.aiagent.${spec.name.toLowerCase()}\nimport android.os.Bundle\nimport androidx.activity.ComponentActivity\nimport androidx.activity.compose.setContent\nimport androidx.compose.material3.Text\nimport androidx.compose.material3.Surface\nimport androidx.compose.runtime.Composable\nimport androidx.compose.ui.Alignment\nimport androidx.compose.ui.Modifier\nimport androidx.compose.ui.unit.sp\nimport androidx.compose.foundation.layout.Arrangement\nimport androidx.compose.foundation.layout.Column\nimport androidx.compose.foundation.layout.fillMaxSize\nimport androidx.compose.foundation.layout.padding\n\nclass MainActivity : ComponentActivity() {\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        setContent { ${spec.name}Screen() }\n    }\n}\n@Composable fun ${spec.name}Screen() {\n    Surface(modifier = Modifier.fillMaxSize()) {\n        Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {\n            Text(text = "${spec.name} — Built by AI AGENT OS", fontSize = 24.sp)\n        }\n    }\n}`,
      'gradle.properties': `android.useAndroidX=true\nandroid.enableJetifier=true\nkotlin.code.style=official\norg.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8`,
      'gradlew': '#!/bin/sh\nexec java -jar gradle/wrapper/gradle-wrapper.jar "$@"',
      'gradle/wrapper/gradle-wrapper.properties': 'distributionBase=GRADLE_USER_HOME\ndistributionPath=wrapper/dists\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-8.5-bin.zip\nzipStoreBase=GRADLE_USER_HOME\nzipStorePath=wrapper/dists',
    };
    for(const [path,content] of Object.entries(files)){
      await this.wcWriteFile('/project/'+path, content);
    }
    return {path:'/project', files:Object.keys(files)};
  },
  async genNextProject(spec){
    await this.bootWC();
    const files = {
      'package.json': JSON.stringify({name:spec.name.toLowerCase(),version:'0.1.0',private:true,scripts:{dev:'next dev',build:'next build',start:'next start',lint:'next lint'},dependencies:{next:'14.2.0',react:'18.3.0','react-dom':'18.3.0'},devDependencies:{typescript:'5.4.0','@types/node':'20.12.0','@types/react':'18.3.0','@types/react-dom':'18.3.0',eslint:'8.57.0','eslint-config-next':'14.2.0'}},null,2),
      'tsconfig.json': JSON.stringify({compilerOptions:{lib:['dom','dom.iterable','esnext'],allowJs:true,skipLibCheck:true,strict:true,noEmit:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'preserve',incremental:true,plugins:[{name:'next'}],paths:{'@/*':['./*']}},include:['next-env.d.ts','**/*.ts','**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']},null,2),
      'next.config.js': '/** @type {import("next").NextConfig} */\nconst nextConfig = {}\nmodule.exports = nextConfig',
      'app/layout.tsx': 'export const metadata = { title: "'+spec.name+'", description: "Generated by AI AGENT OS" }\nexport default function RootLayout({children}:{children:React.ReactNode}){return(<html lang="ar" dir="rtl"><body>{children}</body></html>)}',
      'app/page.tsx': 'export default function Home(){return(<main style={{padding:"2rem",fontFamily:"system-ui"}}><h1>'+spec.name+'</h1><p>تطبيق Next.js تم إنشاؤه بواسطة AI AGENT OS</p><p dir="ltr">npm run dev</p></main>)}',
      'app/globals.css': '*{box-sizing:border-box}body{margin:0;font-family:system-ui}',
      '.gitignore': '# dependencies\nnode_modules\n.next\nout\nbuild\n*.log\n.DS_Store\n*.pem\n.env*\n!.env.example',
      'README.md': '# '+spec.name+'\n\nتم إنشاؤه بواسطة **AI AGENT OS**\n\n## التشغيل\n```bash\nnpm install\nnpm run dev\n```'
    };
    for(const [path,content] of Object.entries(files)){
      await this.wcWriteFile('/project/'+path, content);
    }
    return {path:'/project', files:Object.keys(files)};
  },
  async genUnityProject(spec){
    await this.bootWC();
    const files = {
      'Assets/Scripts/PlayerController.cs': `using UnityEngine;\n\npublic class PlayerController : MonoBehaviour\n{\n    public float speed = 5f;\n    public float jumpForce = 10f;\n    private Rigidbody rb;\n    private bool isGrounded;\n\n    void Start() { rb = GetComponent<Rigidbody>(); }\n\n    void Update()\n    {\n        float h = Input.GetAxis("Horizontal");\n        float v = Input.GetAxis("Vertical");\n        Vector3 move = new Vector3(h, 0, v) * speed * Time.deltaTime;\n        transform.Translate(move, Space.World);\n\n        if (Input.GetKeyDown(KeyCode.Space) && isGrounded)\n        { rb.AddForce(Vector3.up * jumpForce, ForceMode.Impulse); isGrounded = false; }\n    }\n\n    void OnCollisionEnter(Collision c) { if(c.gameObject.CompareTag("Ground")) isGrounded = true; }\n}`,
      'Assets/Scripts/EnemyAI.cs': `using UnityEngine;\nusing UnityEngine.AI;\n\npublic class EnemyAI : MonoBehaviour\n{\n    public Transform player;\n    public float chaseDistance = 10f;\n    private NavMeshAgent agent;\n\n    void Start() { agent = GetComponent<NavMeshAgent>(); }\n\n    void Update()\n    {\n        if (player == null) return;\n        float dist = Vector3.Distance(transform.position, player.position);\n        if (dist <= chaseDistance) agent.SetDestination(player.position);\n    }\n}`,
      'Assets/Scenes/MainScene.unity': '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!1 &1\nGameObject:\n  m_ObjectHideFlags: 0\n  m_Name: MainScene\n  serializedVersion: 6\n  m_Component:\n  - component: {fileID: 4}\n--- !u!4 &4\nTransform:\n  m_LocalPosition: {x: 0, y: 0, z: 0}\n  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}\n  m_LocalScale: {x: 1, y: 1, z: 1}',
      'ProjectSettings/ProjectVersion.txt': 'm_EditorVersion: 2022.3.0f1\n',
      'Packages/manifest.json': JSON.stringify({dependencies:{"com.unity.render-pipelines.universal":"14.0.9","com.unity.inputsystem":"1.7.0","com.unity.ai.navigation":"1.1.3"}},null,2),
      'README.md': '# '+spec.name+' (Unity)\n\nتم إنشاؤه بواسطة **AI AGENT OS**\n\n## الفتح\nافتح المجلد في **Unity Hub** → الإصدار 2022.3 LTS أو أحدث\n\n## السكريبتات المولّدة\n- `PlayerController.cs` — حركة اللاعب + قفز\n- `EnemyAI.cs` — ملاحقة اللاعب عبر NavMesh\n\n## البناء\nFile → Build Settings → Android / WebGL / Windows → Build'
    };
    for(const [path,content] of Object.entries(files)){
      await this.wcWriteFile('/project/'+path, content);
    }
    return {path:'/project', files:Object.keys(files)};
  },
  async genGodotProject(spec){
    await this.bootWC();
    const files = {
      'project.godot': `[application]\nconfig/name="${spec.name}"\nconfig/icon="res://icon.svg"\nrun/main_scene="res://scenes/Main.tscn"\n\n[input]\nmove_left = {\n"deadzone": 0.5,\n"events": [\n{"type": "Key", "key": "A"},\n{"type": "Key", "key": "Left"}\n]\n}\nmove_right = {...}\nmove_up = {...}\nmove_down = {...}\njump = {"deadzone": 0.5,"events":[{"type":"Key","key":"Space"}]}\n`,
      'scenes/Main.tscn': `[gd_scene load_steps=3 format=3 uid://main]\n[ext_resource type="Script" path="res://scripts/player.gd" id="1"]\n[ext_resource type="Script" path="res://scripts/enemy.gd" id="2"]\n[node name="Main" type="Node2D"]\n[node name="Player" type="CharacterBody2D" parent="." instance=ExtResource("1")]\nposition = Vector2(100, 100)\n[node name="Enemy" type="CharacterBody2D" parent="." instance=ExtResource("2")]\nposition = Vector2(400, 100)\n`,
      'scripts/player.gd': `extends CharacterBody2D\n@export var speed := 300.0\n@export var jump_velocity := -400.0\n\nfunc _physics_process(delta):\n    var velocity = Velocity\n    if not is_on_floor():\n        velocity += get_gravity() * delta\n    else:\n        if Input.is_action_just_pressed("jump"):\n            velocity.y = jump_velocity\n    var direction = Input.get_axis("move_left", "move_right")\n    if direction:\n        velocity.x = direction * speed\n    else:\n        velocity.x = move_toward(velocity.x, 0, speed)\n    Velocity = velocity\n    move_and_slide()\n`,
      'scripts/enemy.gd': `extends CharacterBody2D\n@export var speed := 150.0\n@export var chase_range := 300.0\n@onready var player = get_parent().get_node("Player")\n\nfunc _physics_process(delta):\n    var velocity = Velocity\n    if player:\n        var dist = position.distance_to(player.position)\n        if dist <= chase_range:\n            var dir = (player.position - position).normalized()\n            velocity.x = dir.x * speed\n    Velocity = velocity\n    move_and_slide()\n`,
      'README.md': '# '+spec.name+' (Godot)\n\nتم إنشاؤه بواسطة **AI AGENT OS**\n\n## الفتح\nافتح المجلد في **Godot 4.2+** → Project → Import\n\n## السكريبتات المولّدة\n- `player.gd` — حركة اللاعب 2D + قفز\n- `enemy.gd` — ملاحقة اللاعب في نطاق معين\n\n## التصدير\nProject → Export → اختر المنصة → Export Project'
    };
    for(const [path,content] of Object.entries(files)){
      await this.wcWriteFile('/project/'+path, content);
    }
    return {path:'/project', files:Object.keys(files)};
  },

  /* ---- Real Multi-Agent Execution ---- */
  async runAgentTask(agentId, task, context={}){
    const agent = AGENTS.find(a=>a.id===agentId);
    if(!agent) throw new Error('Agent not found');
    const providers = Store.get('user_providers',[]);
    if(!providers.length) throw new Error('No provider configured');
    const provider = providers[0];
    const systemPrompt = `أنت ${agent.name} (${agent.role}). ${agent.desc}.
مهمتك: ${task}
السياق: ${JSON.stringify(context).slice(0,2000)}
أجب بتنفيذ حقيقي، أو اذكر بوضوح ما يتطلب Worker/Cloud/External.`;
    return this.llmStream(systemPrompt, provider, (c)=>{});
  }
};

window.Real = Real;
export { Real };