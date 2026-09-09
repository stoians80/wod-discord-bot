
import http from "node:http";
import "./discord-bot.mjs";

const PORT=Number(process.env.PORT || 3000);
const HOST="0.0.0.0";

const server=http.createServer((req,res)=>{
  if(req.url==="/health"){
    res.writeHead(200,{"content-type":"application/json"});
    return res.end(JSON.stringify({ok:true}));
  }

  res.writeHead(200,{"content-type":"text/html; charset=utf-8"});
  res.end(`<!doctype html>
  <html>
  <head><meta charset="utf-8"><title>WOD Discord Bot</title></head>
  <body style="font-family:system-ui;background:#0b0e13;color:#edf3fa;padding:40px">
    <h1>WOD Discord Bot</h1>
    <p>Online.</p>
    <p><code>/gear https://warofdragons.com/user_info.php?nick=...</code></p>
  </body>
  </html>`);
});

server.listen(PORT,HOST,()=>{
  console.log(`Health server listening on http://${HOST}:${PORT}`);
});
