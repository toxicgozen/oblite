import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {createApp} from '../server.mjs';
import {profiles} from '../public/profiles.js';
import {readConfig,validateRequest,detectLandmarks,buildModelRequest} from '../src/detector.mjs';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOioAAAAASUVORK5CYII=';
const request={profile:profiles[0],image:{dataUrl:png,width:800,height:600}};
const config={...readConfig({}),ready:true,model:'TEST-FIXTURE',apiKey:'test-secret'};
async function app(t,options={}){
  const server=createApp({config,...options});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  return 'http://127.0.0.1:'+server.address().port;
}
const post=(url,body=request,headers={})=>fetch(url+'/api/detect',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('missing configuration fails honestly and public config never exposes credentials',async t=>{
  const url=await app(t,{config:readConfig({})});
  const c=await (await fetch(url+'/api/config')).json();assert.equal(c.ready,false);assert.equal(c.apiKey,undefined);
  const res=await post(url);assert.equal(res.status,503);assert.match((await res.json()).error,/未配置/);
});
test('actual HTTP contract returns normalized points and the original profile snapshot',async t=>{
  let called=0;
  const detector=(req,options)=>detectLandmarks(req,{...options,fetchImpl:async (url,init)=>{
    called++;assert.equal(url,'https://api.openai.com/v1/chat/completions');
    const body=JSON.parse(init.body);assert.equal(body.messages[1].content[1].image_url.url,png);
    assert.equal(body.response_format.type,'json_schema');
    return Response.json({choices:[{message:{content:JSON.stringify({points:[{id:'nose',status:'found',x:300,y:400,reason:''}]})}}]});
  }});
  const url=await app(t,{detector});const res=await post(url);assert.equal(res.status,200);
  const data=await res.json();assert.equal(called,1);assert.equal(data.points[0].x,.3);assert.equal(data.points[1].x,null);
  assert.deepEqual(data.profile,profiles[0]);assert.equal(data.image.width,800);
  assert.equal(data.source,'model');assert.ok(data.durationMs>=0);
});
test('host/origin, bad files, duplicate definitions and private files are rejected',async t=>{
  const url=await app(t,{detector:()=>{throw new Error('Must not call provider');}});
  assert.equal((await post(url,request,{Origin:'https://unrelated.example'})).status,403);
  const hostStatus=await new Promise((resolve,reject)=>{const req=httpRequest(url+'/api/config',{headers:{Host:'unrelated.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
  assert.equal(hostStatus,403);
  assert.equal((await fetch(url+'/.env')).status,404);
  assert.equal((await fetch(url+'/src/detector.mjs')).status,404);
  assert.equal((await post(url,{...request,image:{...request.image,dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}})).status,400);
  const duplicate=structuredClone(request);duplicate.profile.points.push(duplicate.profile.points[0]);
  assert.equal((await post(url,duplicate)).status,400);
});
test('provider authentication and malformed output do not leak upstream bodies or secret',async()=>{
  await assert.rejects(()=>detectLandmarks(request,{config,fetchImpl:async()=>new Response('test-secret private-data',{status:401})}),e=>e.status===502&&!e.message.includes('test-secret')&&e.message.includes('密钥无效'));
  await assert.rejects(()=>detectLandmarks(request,{config,fetchImpl:async()=>Response.json({choices:[{message:{content:'not json'}}]})}),/有效 JSON/);
  await assert.rejects(()=>detectLandmarks(request,{config,fetchImpl:async()=>Response.json({choices:[{message:{content:JSON.stringify({points:[{id:'nose',status:'found',x:1100,y:10,reason:''}]})}}]})}),/越界/);
});
test('one active detection at a time; slot is available again after failure',async t=>{
  let release;const started=new Promise(resolve=>{release=resolve;});
  let unblock;
  const url=await app(t,{detector:async()=>{release();await new Promise(resolve=>{unblock=resolve;});throw new Error('test');}});
  const first=post(url);await started;
  assert.equal((await post(url)).status,409);
  unblock();assert.equal((await first).status,500);
});
test('provider formats and unsafe remote plaintext endpoints are explicit',()=>{
  assert.throws(()=>readConfig({VISION_BASE_URL:'http://remote.example/v1'}),/HTTPS/);
  assert.throws(()=>readConfig({VISION_BASE_URL:'https://user:secret@remote.example/v1'}),/凭据/);
  assert.equal(buildModelRequest(request,{...config,format:'json_object'}).response_format.type,'json_object');
  assert.throws(()=>validateRequest({...request,image:{...request.image,width:0}}),/尺寸/);
});
