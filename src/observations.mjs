import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {normalizeDetection} from '../public/core.js';
import {DetectionError} from './detector.mjs';

const validId = id => /^[a-f0-9]{64}$/.test(id);
async function readJson(path) { return JSON.parse(await readFile(path,'utf8')); }
async function atomicJson(path,value) {
  const temporary=path+'.'+randomUUID()+'.tmp';
  await writeFile(temporary,JSON.stringify(value,null,2));
  await rename(temporary,path);
}

// Local handoff only: no model call, account token, or background agent is involved.
export function createObservationStore(directory) {
  const folder=id=>{
    if(!validId(id))throw new DetectionError('观察任务编号无效。');
    return join(directory,id);
  };
  async function status(id) {
    const location=folder(id);
    let request;
    try {request=await readJson(join(location,'request.json'));}
    catch(error){if(error.code==='ENOENT')throw new DetectionError('没有找到这个观察任务。',404);throw error;}
    try {
      const result=await readJson(join(location,'result.json'));
      if(result.observationId!==id || result.source!=='assistant-observation')throw new Error('Invalid observation result');
      return {id,state:'complete',result};
    } catch(error) {if(error.code!=='ENOENT')throw error;}
    return {id,state:'pending',createdAt:request.createdAt};
  }
  return {
    status,
    async prepare({profile,image}) {
      const id=createHash('sha256').update(JSON.stringify({profile,image})).digest('hex');
      const location=folder(id);
      await mkdir(location,{recursive:true});
      const format=image.dataUrl.slice(11,image.dataUrl.indexOf(';'));
      const imageFile='image.'+(format==='jpeg'?'jpg':format);
      const request={schemaVersion:1,id,profile,image:{width:image.width,height:image.height,file:imageFile},createdAt:new Date().toISOString(),coordinateSystem:'Return x,y in 0..1000 over the full image; null for invisible points.'};
      await writeFile(join(location,imageFile),Buffer.from(image.dataUrl.split(',')[1],'base64'));
      await atomicJson(join(location,'request.json'),request);
      await atomicJson(join(directory,'current.json'),{id,profile:profile.name,imageFile:join(id,imageFile),requestFile:join(id,'request.json')});
      return status(id);
    },
    async complete(id,raw) {
      const location=folder(id);
      const request=await readJson(join(location,'request.json'));
      const points=normalizeDetection(raw,request.profile);
      const result={schemaVersion:1,observationId:id,source:'assistant-observation',model:'Codex 会话观察',profile:request.profile,image:{width:request.image.width,height:request.image.height},points,durationMs:null,createdAt:new Date().toISOString()};
      await atomicJson(join(location,'result.json'),result);
      return result;
    },
  };
}
