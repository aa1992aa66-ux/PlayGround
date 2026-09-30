/* AI AGENT OS — Registries: Providers, Agents (38 per spec Phase 10), Models, Workers */
const PROVIDERS = [
  {id:'openai',name:'OpenAI',proto:'REST/SSE',color:'🟢'},{id:'gemini',name:'Google Gemini',proto:'REST/SSE',color:'🔵'},
  {id:'anthropic',name:'Anthropic',proto:'REST/SSE',color:'🟠'},{id:'deepseek',name:'DeepSeek',proto:'OpenAI-compatible',color:'🟣'},
  {id:'qwen',name:'Qwen',proto:'OpenAI-compatible',color:'💜'},{id:'kimi',name:'Kimi/Moonshot',proto:'OpenAI-compatible',color:'🌙'},
  {id:'mistral',name:'Mistral',proto:'REST',color:'🟧'},{id:'xai',name:'xAI Grok',proto:'REST',color:'⬛'},
  {id:'minimax',name:'MiniMax',proto:'REST/WS',color:'🔴'},{id:'openrouter',name:'OpenRouter',proto:'OpenAI-compatible',color:'🔀'},
  {id:'ollama',name:'Ollama Local',proto:'Local REST',color:'🦙'},{id:'custom',name:'Custom / Private',proto:'REST/SSE/WS',color:'⚙️'}
];
/* status: supported | partial | adapter-required | worker-required | unavailable — never fake */
const AGENTS = [
  ["qwen-code","Qwen Code","Coding","💜","partial"],["gemini-cli","Gemini CLI","General","🔵","partial"],
  ["mistral-vibe","Mistral Vibe","Coding","🟧","adapter-required"],["openclaude","OpenClaude","General","🟣","partial"],
  ["claude-code","Claude Code","Coding","🟠","partial"],["openclaw","OpenClaw","Automation","🦞","worker-required"],
  ["ollama","Ollama","Local","🦙","supported"],["codex-cli","Codex CLI","Coding","🟢","worker-required"],
  ["codex","Codex","Coding","🟢","adapter-required"],["opencode","OpenCode","Coding","⚡","supported"],
  ["engram","Engram","Memory","🧠","adapter-required"],["codegraph","CodeGraph","Analysis","🕸️","adapter-required"],
  ["pi-agent","Pi Coding Agent","Coding","🥧","adapter-required"],["antigravity-cli","Antigravity CLI","General","🛸","worker-required"],
  ["minimax-cli","MiniMax CLI","Media","🔴","partial"],["gentle-ai","Gentle AI","Assistant","🌿","adapter-required"],
  ["guardian","Gentleman Guardian Angel","Safety","😇","supported"],["hermes","Hermes Agent","Router","🪽","supported"],
  ["mimocode","MiMoCode","Coding","🌀","adapter-required"],["kimi-code","Kimi Code","Coding","🌙","partial"],
  ["command-code","Command Code","DevOps","⌨️","adapter-required"],["kimchi","Kimchi","Fun","🥬","adapter-required"],
  ["freebuff","Freebuff","General","🎁","adapter-required"],["kilocode","KiloCode CLI","Coding","📦","adapter-required"],
  ["context7","Context7","Docs","📚","supported"],["openspec","OpenSpec","Specs","📋","supported"],
  ["qoder","Qoder CLI","Coding","❓","worker-required"],["cline","Cline CLI","Coding","📉","worker-required"],
  ["ohmy-pi","Oh-My-Pi","Terminal","🐧","adapter-required"],["cursor-cli","Cursor CLI","Coding","🖱️","worker-required"],
  ["supercode","SuperCode CLI","Coding","🦸","worker-required"],["droid-factory","Droid Factory","Android","🤖","supported"],
  ["keelcode","KeelCode","Coding","⛵","adapter-required"],["goose","Goose CLI","Automation","🪿","worker-required"],
  ["agent-zero","Agent Zero","General","0️⃣","worker-required"],["n8n","n8n","Workflows","🔗","supported"],
  ["antigravity","Google Antigravity","General","🌌","worker-required"],["custom-agent","Custom Agent","Custom","⚙️","supported"]
].map(([id,name,role,icon,status])=>({id,name,role,icon,status,
  desc:{Coding:'كتابة ومراجعة الكود',General:'مساعد عام',Automation:'أتمتة مهام',Local:'يعمل محلياً',Media:'صوت وصورة وفيديو',Assistant:'مساعد ذكي',Safety:'مراجعة أمان',Router:'توجيه ذكي',DevOps:'بناء ونشر',Workflows:'سير عمل',Docs:'توثيق',Specs:'مواصفات',Terminal:'طرفية',Android:'بناء أندرويد',Memory:'ذاكرة',Analysis:'تحليل',Custom:'مخصص',Fun:'ترفيه'}[role]||role}));
const MODELS_SEED = [
  {id:'llama31',name:'Llama 3.1',vendor:'Meta',type:'LLM',size:'8B',status:'متواقف',local:true},
  {id:'qwen25',name:'Qwen 2.5',vendor:'Alibaba',type:'Coding',size:'7B',status:'متواقف',local:true},
  {id:'mistral-large',name:'Mistral Large',vendor:'Mistral',type:'LLM',size:'API',status:'متواقف',local:false},
  {id:'phi3',name:'Phi-3',vendor:'Microsoft',type:'Mini',size:'3.8B',status:'غير مثبت',local:true},
  {id:'sdxl',name:'Stable Diffusion XL',vendor:'Stability',type:'Image',size:'6.9GB',status:'متواقف',local:true}
];
const WORKERS_SEED = [
  {id:'android',name:'Android Native',caps:'App, Media, TTS/STT',status:'READY'},
  {id:'browser',name:'Browser Worker',caps:'Web, Preview, Canvas Render',status:'READY'},
  {id:'termux',name:'Termux',caps:'Shell, Git, Python',status:'Requires Permission'},
  {id:'linux-gpu',name:'Linux GPU',caps:'Build, Video, LLM',status:'Requires Worker'},
  {id:'cloud',name:'Cloud',caps:'Heavy Render, Training',status:'Requires Cloud'}
];
function seedIfEmpty(){
  if(!Store.get('projects',null)){
    Store.set('projects',[
      {id:'p1',name:'Game Project',kind:'Unity • Game',icon:'🎮',updated:'منذ 5 ساعات',files:124,tasks:7,tools:12,agents:3,desc:'مشروع لعبة Unity ثلاثي الأبعاد'},
      {id:'p2',name:'Video Studio',kind:'Video • Editing',icon:'🎬',updated:'منذ 5 ساعات',files:48,tasks:2,tools:8,agents:4,desc:'مونتاج فيديو احترافي'},
      {id:'p3',name:'Mobile App',kind:'Android • Kotlin',icon:'📱',updated:'منذ يوم',files:96,tasks:5,tools:9,agents:2,desc:'تطبيق أندرويد Kotlin'},
      {id:'p4',name:'Website Project',kind:'Web • Next.js',icon:'🌐',updated:'منذ يومين',files:210,tasks:4,tools:10,agents:3,desc:'موقع Next.js متكامل'},
      {id:'p5',name:'AI Assistant',kind:'AI • Multi-Agent',icon:'🤖',updated:'منذ 3 أيام',files:32,tasks:6,tools:14,agents:6,desc:'مساعد متعدد الوكلاء'}
    ]);
  }
  if(!Store.get('tasks',null)) Store.set('tasks',[
    {id:'t1',title:'بناء Unity — GameScene',agent:'Claude Code',pct:68,status:'Running'},
    {id:'t2',title:'إصدار الأوامر الفرعية',agent:'Hermes',pct:23,status:'Running'}
  ]);
  if(!Store.get('memory',null)) Store.set('memory',[{scope:'User',key:'اللغة المفضلة',value:'العربية'}]);
  if(!Store.get('user_providers',null)) Store.set('user_providers',[]);
}
