import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {profiles} from '../public/profiles.js';
import {readConfig,validateRequest,detectLandmarks} from '../src/detector.mjs';
const config=readConfig();
if(!config.ready){console.error('未配置 VISION_API_KEY / VISION_MODEL；真实模型验证未运行。');process.exitCode=2;}
else {
  // Explicit invocation sends ONLY the two bundled, attributed public photographs.
  await mkdir(new URL('../.verification/',import.meta.url),{recursive:true});
  for(const [id,width,height] of [['dog',800,600],['tree',3872,2576]]){
    const bytes=await readFile(new URL('../public/assets/'+id+'.jpg',import.meta.url));
    const request=validateRequest({profile:profiles.find(p=>p.id===id),image:{width,height,dataUrl:'data:image/jpeg;base64,'+bytes.toString('base64')}});
    const result=await detectLandmarks(request,{config});
    await writeFile(new URL('../.verification/'+id+'-live.json',import.meta.url),JSON.stringify(result,null,2));
    console.log(id+': '+result.points.filter(p=>p.x!==null).length+'/'+result.points.length+' coordinates returned; inspect accuracy against the photograph.');
  }
}
