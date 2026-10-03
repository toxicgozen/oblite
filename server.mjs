import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readConfig,validateRequest,detectLandmarks,DetectionError} from './src/detector.mjs';
import {createObservationStore} from './src/observations.mjs';

const root = fileURLToPath(new URL('./public/',import.meta.url));
const staticFiles = new Map([
  ['/',['index.html','text/html; charset=utf-8']],
  ['/index.html',['index.html','text/html; charset=utf-8']],
  ...['app.js','core.js','profiles.js'].map(p=>['/'+p,[p,'text/javascript; charset=utf-8']]),
  ['/styles.css',['styles.css','text/css; charset=utf-8']],
  ['/assets/dog.jpg',['assets/dog.jpg','image/jpeg']],
  ['/assets/tree.jpg',['assets/tree.jpg','image/jpeg']],
  ['/assets/sources.json',['assets/sources.json','application/json; charset=utf-8']],
]);
const MAX_BODY = 8500000;
const send = (res,status,value) => { if (!res.destroyed) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); } };
async function readBody(req) {
  if (Number(req.headers['content-length']) > MAX_BODY) throw new DetectionError('图片请求过大。',413);
  const chunks=[]; let size=0;
  for await (const chunk of req) {
    size+=chunk.length;
    if (size > MAX_BODY) throw new DetectionError('图片请求过大。',413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new DetectionError('请求不是有效 JSON。'); }
}

export function createApp({config=readConfig(),detector=detectLandmarks,observationDirectory=fileURLToPath(new URL('./.observations/',import.meta.url))}={}) {
  const observations=createObservationStore(observationDirectory);
  let busy=false;
  return http.createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' blob: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    const port=req.socket.localPort;
    const allowedHosts = ['127.0.0.1:'+port,'localhost:'+port,'[::1]:'+port];
    if (!allowedHosts.includes(req.headers.host)) return send(res,403,{error:'仅允许本机访问。'});
    const origin = req.headers.origin;
    if (origin && !allowedHosts.some(h=>origin === 'http://'+h)) return send(res,403,{error:'不接受其他网页发起的请求。'});
    let path;
    try { path=new URL(req.url,'http://localhost').pathname; } catch { return send(res,400,{error:'无效路径。'}); }
    if (req.method === 'GET' && path === '/api/config') return send(res,200,{ready:config.ready,model:config.model,provider:config.provider});

    if (path === '/api/observations' && req.method === 'POST') {
      if (!req.headers['content-type']?.startsWith('application/json')) return send(res,415,{error:'请使用 JSON 请求。'});
      try { return send(res,200,await observations.prepare(validateRequest(await readBody(req)))); }
      catch(error){return send(res,error instanceof DetectionError ? error.status : 500,{error:error instanceof DetectionError ? error.message : '无法准备本地观察任务。'});}
    }
    if (path.startsWith('/api/observations/') && req.method === 'GET') {
      try {return send(res,200,await observations.status(path.slice('/api/observations/'.length)));}
      catch(error){return send(res,error instanceof DetectionError ? error.status : 500,{error:error instanceof DetectionError ? error.message : '无法读取会话观察结果。'});}
    }
    if (path === '/api/detect' && req.method === 'POST') {
      if (!req.headers['content-type']?.startsWith('application/json')) return send(res,415,{error:'请使用 JSON 请求。'});
      if (busy) return send(res,409,{error:'已有检测正在进行，请稍后重试。'});
      busy=true;
      const controller=new AbortController();
      res.on('close',()=>{if (!res.writableEnded) controller.abort();});
      try {
        const request=validateRequest(await readBody(req));
        const result=await detector(request,{config,signal:controller.signal});
        send(res,200,result);
      } catch(error) {
        send(res,error instanceof DetectionError ? error.status : 500,{error:error instanceof DetectionError ? error.message : '本地服务遇到错误，请重试。'});
      } finally {busy=false;}
      return;
    }
    const asset=staticFiles.get(path);
    if (asset && ['GET','HEAD'].includes(req.method)) {
      try {
        const bytes=await readFile(resolve(root,asset[0]));
        res.writeHead(200,{'Content-Type':asset[1],'Content-Length':bytes.length,'Cache-Control':'no-cache'});
        res.end(req.method === 'HEAD' ? undefined : bytes);
      } catch {send(res,404,{error:'文件不存在。'});}
      return;
    }
    send(res,404,{error:'没有这个页面。'});
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config=readConfig();
  const port=Number(process.env.PORT || 4399);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须为 1–65535。');
  const app=createApp({config});
  app.on('error',error=>{console.error(error.code === 'EADDRINUSE' ? '端口 '+port+' 已被占用，请更改 PORT。' : error.message);process.exitCode=1;});
  app.listen(port,'127.0.0.1',()=>console.log('oblite: http://127.0.0.1:'+port+'\n'+(config.ready ? '检测模型：'+config.model : '会话观察已就绪；可选配置 .env 后启用 API 自动检测。')));
}
