#!/usr/bin/env bash
# AI AGENT OS — custom start: serve static ai-agent-os/ in the foreground on PORT (default 3000).
set -euo pipefail
cd "$(dirname "$0")"
/usr/bin/time -p pwd
PORT="${PORT:-3000}"
export PORT
/usr/bin/time -p printenv PORT
PROJECT_ROOT="/home/runner/work/PlayGround/PlayGround"
/usr/bin/time -p test -d "$PROJECT_ROOT/ai-agent-os"
STATIC_DIR="$PROJECT_ROOT/ai-agent-os"
/usr/bin/time -p test -f "$STATIC_DIR/index.html"
# Pure-static app: install/build only if a package project appears later.
if /usr/bin/time -p test -f "$STATIC_DIR/package.json"; then
  /usr/bin/time -p npm --prefix "$STATIC_DIR" install --no-audit --no-fund
  /usr/bin/time -p npm --prefix "$STATIC_DIR" run build --if-present
  if /usr/bin/time -p test -d "$STATIC_DIR/dist"; then STATIC_DIR="$STATIC_DIR/dist"; fi
else
  /usr/bin/time -p echo "STATIC_ONLY: no package.json, skipping install/build"
fi
export STATIC_DIR
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
export WEB_DIR
/usr/bin/time -p mkdir -p "$WEB_DIR"
/usr/bin/time -p mkdir -p /home/runner/work/_temp/omgithub-web
/usr/bin/time -p printf '{"project":"/home/runner/work/PlayGround/PlayGround","directory":"%s"}' "$STATIC_DIR" > "$WEB_DIR/deployment-output.json"
if /usr/bin/time -p test "$WEB_DIR" != /home/runner/work/_temp/omgithub-web; then
  /usr/bin/time -p cp "$WEB_DIR/deployment-output.json" /home/runner/work/_temp/omgithub-web/deployment-output.json
fi
/usr/bin/time -p cat "$WEB_DIR/deployment-output.json"
/usr/bin/time -p bash -c 'echo ""'
# Foreground static server (node built-ins only, no deps). exec so signals propagate.
exec node -e '
const {createServer}=require("node:http");
const {readFileSync,existsSync,statSync}=require("node:fs");
const {resolve,join,extname}=require("node:path");
const root=resolve(process.env.STATIC_DIR);
const port=Number(process.env.PORT||3000);
const mime={".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".webmanifest":"application/manifest+json",".wasm":"application/wasm"};
const server=createServer((req,res)=>{
  try{
    const url=new URL(req.url,"http://localhost");
    let path=resolve(root,"."+decodeURIComponent(url.pathname));
    if(path!==root&&!path.startsWith(root+"/")){res.writeHead(404);res.end();return;}
    try{if(statSync(path).isDirectory())path=join(path,"index.html");}catch{path=join(root,"index.html");}
    if(!existsSync(path))path=join(root,"index.html");
    res.setHeader("Content-Type",mime[extname(path)]||"application/octet-stream");
    res.setHeader("Cache-Control","no-cache");
    res.end(readFileSync(path));
  }catch{res.writeHead(404);res.end("Not found");}
});
server.listen(port,"0.0.0.0",()=>console.log("AI AGENT OS serving "+root+" on "+port));
'
