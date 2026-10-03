import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createObservationStore} from '../src/observations.mjs';
const [id,pointsFile]=process.argv.slice(2);
if(!id||!pointsFile){
  console.error('Usage: node scripts/complete-observation.mjs <observation-id> <points-json-file>');
  process.exitCode=2;
}else{
  const raw=JSON.parse(await readFile(pointsFile,'utf8'));
  const store=createObservationStore(fileURLToPath(new URL('../.observations/',import.meta.url)));
  const result=await store.complete(id,raw);
  console.log('Saved session observation: '+result.points.filter(p=>p.x!==null).length+'/'+result.points.length+' visible coordinates.');
}
