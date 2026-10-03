// Isolated UI verification fixture. It does NOT recognize images or call a model.
// This script is never imported by the application. All results are labelled TEST.
import {createApp} from '../../server.mjs';
import {readConfig} from '../../src/detector.mjs';
const config={...readConfig({}),ready:true,model:'TEST FIXTURE — not vision',provider:'local test fixture'};
const detector=async(request,{signal})=>{
  await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,800);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Cancelled test'));},{once:true});});
  return {
    schemaVersion:1,source:'test-fixture',model:config.model,profile:request.profile,image:{width:request.image.width,height:request.image.height},
    points:request.profile.points.map((p,i)=>({...p,status:i===2?'not_visible':i===1?'uncertain':'found',x:i===2?null:[.3,.4,.5,.7,.8,.9][i%6],y:i===2?null:[.3,.4,.5,.6,.7,.8][i%6],reason:'TEST FIXTURE: interface verification only, not recognition.'})),
    durationMs:800,createdAt:new Date().toISOString()
  };
};
createApp({config,detector}).listen(4398,'127.0.0.1',()=>console.log('Isolated TEST FIXTURE (not vision): http://127.0.0.1:4398'));
