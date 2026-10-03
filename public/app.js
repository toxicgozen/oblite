import {profiles} from './profiles.js';
import {validateProfile,parsePointLines,pixelPosition} from './core.js';

const $=id=>document.getElementById(id);
let currentImage=null,result=null,activeId=null,controller=null,revision=0,ticker=null,loadRevision=0;
let config={ready:false,model:'',provider:''},sources={};
const statusText={found:'已定位',uncertain:'待确认',not_visible:'未定位'};
const el=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};

function message(text='',error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function selectedProfile(){
  if($('profileSelect').value!=='custom')return profiles.find(p=>p.id===$('profileSelect').value);
  return validateProfile({id:'custom',name:'自定义点位',subject:$('customSubject').value,points:parsePointLines($('customPoints').value)});
}
function cancelDetection(announce=false){
  revision++;controller?.abort();controller=null;
  clearInterval(ticker);ticker=null;
  $('detecting').hidden=true;$('cancelButton').hidden=true;
  $('sessionStatus').hidden=true;
  if(announce)message($('observationMode').value==='session'?'已停止等待；观察任务仍保留在本机。':'检测已取消。');
  updateControls();
}
function invalidate(){
  cancelDetection();result=null;activeId=null;renderResults();message();
}
function updateControls(){
  let valid=true;try{selectedProfile();}catch{valid=false;}

  const session=$('observationMode').value==='session';
  $('detectButton').disabled=!currentImage||(!session&&!config.ready)||!valid||Boolean(controller)||!$('loadingImage').hidden;
  $('detectButton').textContent=controller?(session?'等待会话结果':'检测中…'):(session?'准备会话观察':'检测点位');
  $('sendNote').textContent=session?'图片和方案将保存到本机，供当前 Codex 会话读取。准备后，在聊天发送「处理当前图片」；已有结果会直接载入。':config.ready?'点击检测后，图片会发送给 '+config.provider+'。':'API 未配置。可切换到会话观察，无需密钥。';
  $('exportButton').disabled=!result;
}
function renderProfile(){
  const custom=$('profileSelect').value==='custom';
  $('customFields').hidden=!custom;$('definitionDetails').hidden=custom;
  const profile=custom?null:selectedProfile();
  $('profileDescription').textContent=profile?.subject || '定义要找的对象和点位，同一张图只观察一个主要对象。';
  $('definitions').replaceChildren();
  for(const p of profile?.points ?? [])$('definitions').append(el('dt','',p.label),el('dd','',p.instruction));
  invalidate();
}
function selectPoint(id){
  activeId=id;
  for(const node of document.querySelectorAll('[data-point-id]')){
    node.classList.toggle('selected',node.dataset.pointId===id);
    if(node.tagName==='BUTTON')node.setAttribute('aria-pressed',String(node.dataset.pointId===id));
  }
}
function renderResults(){
  $('overlay').replaceChildren();$('pointList').replaceChildren();
  $('overlay').classList.toggle('hide-labels',!$('showLabels').checked);
  $('resultMeta').textContent='';
  let profile;try{profile=selectedProfile();}catch{profile=null;}
  if(!result){
    $('count').textContent='等待检测';
    $('resultHint').textContent=currentImage?'检测后可选择点位，在图片上查看位置。':'检测结果会叠加在原图上。';
    for(const p of profile?.points ?? []){
      const row=el('div','point-row');row.append(el('span','point-name',p.label),el('span','point-state','未检测'));$('pointList').append(row);
    }
    updateControls();return;
  }
  const located=result.points.filter(p=>p.status==='found').length;
  const uncertain=result.points.filter(p=>p.status==='uncertain').length;
  const positioned=result.points.filter(p=>p.x!==null).length;
  $('count').textContent=positioned+' / '+result.points.length+' 有坐标';
  $('resultHint').textContent=uncertain?located+' 个已定位，'+uncertain+' 个待确认。空心点为暂定位置；空坐标不绘制。':'选择点位可在原图上高亮。坐标以原图左上角为起点。';
  for(const p of result.points){
    const position=pixelPosition(p,currentImage.width,currentImage.height);
    const row=el(position?'button':'div','point-row '+p.status);row.dataset.pointId=p.id;
    row.append(el('span','point-name',p.label),el('span','point-state',statusText[p.status]));
    if(position){
      row.type='button';row.setAttribute('aria-pressed',String(activeId===p.id));row.classList.toggle('selected',activeId===p.id);
      row.append(el('span','point-coordinates','x '+position.x+'　y '+position.y+' px'));
      row.addEventListener('click',()=>selectPoint(p.id));
      const marker=el('button','point-marker '+p.status);marker.type='button';marker.dataset.pointId=p.id;
      marker.style.left=(p.x*100)+'%';marker.style.top=(p.y*100)+'%';
      marker.classList.toggle('label-left',p.x>.7);marker.classList.toggle('selected',activeId===p.id);
      marker.setAttribute('aria-pressed',String(activeId===p.id));marker.setAttribute('aria-label',p.label+'，'+statusText[p.status]+'，x '+position.x+'，y '+position.y);
      marker.title=p.label+'：'+(p.reason||statusText[p.status]);
      marker.append(el('span','point-label',p.label));marker.addEventListener('click',()=>selectPoint(p.id));$('overlay').append(marker);
    }
    if(p.reason)row.append(el('span','point-reason',p.reason));
    $('pointList').append(row);
  }
  $('resultMeta').textContent=result.source==='assistant-observation'?'来源：Codex 会话观察 · 看图估计，可复用此结果；并非网页自动检测。':'模型检测：'+result.model+' · '+(result.durationMs/1000).toFixed(1)+' 秒';
  updateControls();
}
function fitImage(){
  if(!currentImage)return;
  const stage=$('stage'),width=stage.clientWidth,height=stage.clientHeight;
  const scale=Math.min(width/currentImage.width,height/currentImage.height);
  $('imagePlane').style.width=(currentImage.width*scale)+'px';
  $('imagePlane').style.height=(currentImage.height*scale)+'px';
}
new ResizeObserver(fitImage).observe($('stage'));

function setCredit(source){
  $('credit').replaceChildren();
  if(!source){$('credit').textContent='本地图片 · 仅在点击检测时发送';return;}
  const a=el('a','',source.author);a.href=source.page;a.target='_blank';a.rel='noreferrer';
  const license=el('a','',source.license);license.href=source.licenseUrl;license.target='_blank';license.rel='noreferrer';
  $('credit').append(document.createTextNode('照片：'),a,document.createTextNode(' / '),license);
}

async function loadImage(blob,name,source=null){
  const ticket=++loadRevision;
  invalidate();$('loadingImage').hidden=false;updateControls();
  let url;
  try{
    if(!['image/jpeg','image/png','image/webp'].includes(blob.type))throw new Error('请选择 JPEG、PNG 或 WebP 图片。');
    if(blob.size>20*1024*1024)throw new Error('图片不能超过 20 MB。');
    url=URL.createObjectURL(blob);
    const decoded=new Image();decoded.src=url;await decoded.decode();
    if(decoded.naturalWidth*decoded.naturalHeight>40000000)throw new Error('图片超过 4000 万像素，请先缩小。');
    if(ticket!==loadRevision){URL.revokeObjectURL(url);return;}
    if(currentImage?.url)URL.revokeObjectURL(currentImage.url);
    currentImage={url,name,width:decoded.naturalWidth,height:decoded.naturalHeight,decoded,source};
    $('photo').src=url;$('photo').alt=name;$('imagePlane').hidden=false;$('empty').hidden=true;
    $('imageName').textContent=name;$('imageSize').textContent=currentImage.width+' × '+currentImage.height;
    setCredit(source);
    for(const button of document.querySelectorAll('[data-sample]'))button.classList.toggle('active',source?.id===button.dataset.sample);
    fitImage();renderResults();
  }catch(error){
    if(url)URL.revokeObjectURL(url);
    if(ticket===loadRevision)message('载入失败：'+error.message,true);
  }finally{
    if(ticket===loadRevision){$('loadingImage').hidden=true;updateControls();}
  }
}

async function sample(id){
  // Reserve a load generation before fetching, so a later upload always wins.
  const ticket=++loadRevision;
  invalidate();$('loadingImage').hidden=false;updateControls();
  try{
    const response=await fetch('/assets/'+id+'.jpg');
    if(!response.ok)throw new Error('示例图片未找到。');
    const blob=await response.blob();
    if(ticket!==loadRevision)return;
    $('profileSelect').value=id;renderProfile();
    await loadImage(blob,id==='dog'?'Tucker · 金毛犬':'热那亚的树',sources[id]||null);
  }catch(error){if(ticket===loadRevision){message(error.message,true);$('loadingImage').hidden=true;updateControls();}}
}
function imageForModel(){
  const scale=Math.min(1,1600/Math.max(currentImage.width,currentImage.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(currentImage.width*scale);canvas.height=Math.round(currentImage.height*scale);
  const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(currentImage.decoded,0,0,canvas.width,canvas.height);
  return {dataUrl:canvas.toDataURL('image/jpeg',.92),width:currentImage.width,height:currentImage.height};
}

async function observeInSession(){
  if(!currentImage||controller)return;
  let profile;try{profile=selectedProfile();}catch(error){message(error.message,true);return;}
  invalidate();
  const ticket=revision;controller=new AbortController();const localController=controller;
  $('cancelButton').hidden=false;updateControls();
  const readPayload=async response=>{
    const payload=await response.json();
    if(!response.ok)throw new Error(payload.error||'本地观察服务不可用。');
    return payload;
  };
  try{
    let payload=await readPayload(await fetch('/api/observations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:imageForModel(),profile}),signal:localController.signal}));
    if(ticket!==revision)return;
    $('sessionStatus').hidden=false;
    $('sessionStatus').textContent='观察任务 '+payload.id.slice(0,8)+' 已准备。请在当前 Codex 聊天发送「处理当前图片」。助手写回结果后，这里会自动显示；没有后台检测正在运行。';
    while(payload.state==='pending'){
      await new Promise((resolve,reject)=>{
        const stop=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};
        const timer=setTimeout(()=>{localController.signal.removeEventListener('abort',stop);resolve();},1500);
        localController.signal.addEventListener('abort',stop,{once:true});
      });
      payload=await readPayload(await fetch('/api/observations/'+payload.id,{signal:localController.signal}));
      if(ticket!==revision)return;
    }
    result=payload.result;activeId=result.points.find(p=>p.x!==null)?.id??null;
    $('sessionStatus').textContent='已载入这张图片和当前方案的会话观察结果。';
    renderResults();message('点位来自助手看图估计。空心点需要确认，无法判断的点保留为空。');
  }catch(error){
    if(ticket!==revision)return;
    if(error.name!=='AbortError')message(error.message||'读取观察结果失败，请重新准备。',true);
    $('sessionStatus').hidden=true;
  }finally{
    if(ticket===revision){controller=null;$('cancelButton').hidden=true;updateControls();}
  }
}

async function detect(){
  if(!currentImage||controller)return;
  let profile;try{profile=selectedProfile();}catch(error){message(error.message,true);return;}
  if(!config.ready){$('settingsDialog').showModal();return;}
  invalidate();
  const ticket=revision;controller=new AbortController();const localController=controller;
  $('cancelButton').hidden=false;$('detecting').hidden=false;$('detectButton').textContent='检测中…';
  message();updateControls();
  const started=Date.now();$('elapsed').textContent='';
  ticker=setInterval(()=>{$('elapsed').textContent=' '+Math.floor((Date.now()-started)/1000)+' 秒';},1000);
  try{
    const image=imageForModel();
    const response=await fetch('/api/detect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,profile}),signal:localController.signal});
    const payload=await response.json();
    if(!response.ok)throw new Error(payload.error||'检测失败，请重试。');
    if(ticket!==revision)return;
    result=payload;activeId=result.points.find(p=>p.x!==null)?.id??null;
    renderResults();
    message(result.points.some(p=>p.x!==null)?'检测完成。可点击点位查看对应位置。':'本次没有定位到可见点。请核对观察方案或换一张图片。');
  }catch(error){
    if(ticket!==revision)return;
    if(error.name!=='AbortError')message(error.message||'连接中断，请重试。',true);
  }finally{
    if(ticket===revision){controller=null;clearInterval(ticker);$('detecting').hidden=true;$('cancelButton').hidden=true;$('detectButton').textContent='检测点位';updateControls();}
  }
}

async function loadConfig(){
  try{
    const response=await fetch('/api/config');if(!response.ok)throw new Error('本地服务不可用。');
    config=await response.json();
    $('connection').classList.toggle('ready',config.ready);
    $('connectionText').textContent=config.ready?'API 已配置':'会话观察可用';
    $('settingsStatus').textContent=config.ready?'已配置 '+config.provider+' / '+config.model+'。这只确认本地配置完整，实际连通性以检测结果为准。':'尚未配置检测服务。';
    $('sendNote').textContent=config.ready?'点击检测后，图片会发送给 '+config.provider+'。':'配置检测服务后即可开始，点击右上角查看配置方法。';
  }catch(error){
    config.ready=false;$('connection').classList.remove('ready');$('connectionText').textContent='本地服务未连接';
    $('settingsStatus').textContent='无法连接本地服务，请在项目目录运行 npm start。';message(error.message,true);
  }
  updateControls();
}
$('uploadButton').onclick=$('emptyUpload').onclick=()=>$('fileInput').click();
$('fileInput').onchange=e=>{const file=e.target.files[0];if(file)void loadImage(file,file.name);e.target.value='';};
for(const button of document.querySelectorAll('[data-sample]'))button.onclick=()=>void sample(button.dataset.sample);
$('profileSelect').onchange=renderProfile;
$('customSubject').oninput=$('customPoints').oninput=()=>{invalidate();updateControls();};
$('showLabels').onchange=()=>$('overlay').classList.toggle('hide-labels',!$('showLabels').checked);
$('detectButton').onclick=()=>void ($('observationMode').value==='session'?observeInSession():detect());
$('observationMode').onchange=invalidate;
$('cancelButton').onclick=()=>cancelDetection(true);
$('connection').onclick=()=>$('settingsDialog').showModal();
$('closeSettings').onclick=()=>$('settingsDialog').close();
$('refreshConfig').onclick=()=>void loadConfig();
$('settingsDialog').addEventListener('click',e=>{if(e.target===$('settingsDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('exportButton').onclick=()=>{
  if(!result)return;
  const output={...result,image:{...result.image,name:currentImage.name,source:currentImage.source?.page??null},coordinateSystem:'normalized-0-to-1; origin top-left; pixel indices 0..width-1 and 0..height-1',points:result.points.map(p=>({...p,pixel:pixelPosition(p,currentImage.width,currentImage.height)}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));
  const link=el('a');link.href=url;link.download='oblite-points.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
document.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();});
$('stage').addEventListener('dragover',e=>{e.preventDefault();$('stage').classList.add('drag-over');});
$('stage').addEventListener('dragleave',e=>{if(!$('stage').contains(e.relatedTarget))$('stage').classList.remove('drag-over');});
$('stage').addEventListener('drop',e=>{e.preventDefault();$('stage').classList.remove('drag-over');const file=e.dataTransfer.files[0];if(file)void loadImage(file,file.name);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&controller)cancelDetection(true);});
renderProfile();
try{const response=await fetch('/assets/sources.json');if(response.ok)sources=await response.json();}catch{message('照片来源信息暂时不可用。',true);}
await loadConfig();
