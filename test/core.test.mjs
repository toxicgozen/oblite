import test from 'node:test';
import assert from 'node:assert/strict';
import {profiles} from '../public/profiles.js';
import {validateProfile,normalizeDetection,pixelPosition,parsePointLines} from '../public/core.js';

test('profiles keep stable identities and reject duplicate points',()=>{
  for(const profile of profiles)assert.deepEqual(validateProfile(profile),profile);
  const bad=structuredClone(profiles[0]);bad.points.push(bad.points[0]);
  assert.throws(()=>validateProfile(bad),/唯一/);
  assert.throws(()=>validateProfile({...profiles[0],points:[]}),/1–24/);
});
test('returned points follow profile order; missing observations stay null, never zero',()=>{
  const profile=profiles[0];
  const result=normalizeDetection({points:[{id:'tail-tip',status:'found',x:1000,y:0,reason:''},{id:'nose',status:'found',x:300,y:400,reason:''}]},profile);
  assert.deepEqual(result.map(p=>p.id),profile.points.map(p=>p.id));
  assert.equal(result[1].status,'not_visible');assert.equal(result[1].x,null);
  assert.deepEqual(pixelPosition(result[0],800,600),{x:240,y:240});
  assert.deepEqual(pixelPosition(result[4],800,600),{x:799,y:0});
  assert.equal(pixelPosition(result[1],800,600),null);
});
test('invalid, hidden, unknown and duplicate coordinates cannot become overlay points',()=>{
  const valid={id:'nose',status:'found',x:20,y:30,reason:''};
  for(const bad of [{...valid,x:1001},{...valid,x:'20'},{...valid,x:null},{...valid,status:'not_visible'},{...valid,status:'maybe'},{...valid,id:'other'}]){
    assert.throws(()=>normalizeDetection({points:[bad]},profiles[0]));
  }
  assert.throws(()=>normalizeDetection({points:[valid,valid]},profiles[0]),/重复/);
});
test('uncertainty preserves its own status; custom definitions support explicit semantics',()=>{
  const result=normalizeDetection({points:[{id:'nose',status:'uncertain',x:20,y:30,reason:'轮廓不清'}]},profiles[0]);
  assert.equal(result[0].status,'uncertain');assert.equal(result[0].x,.02);
  assert.deepEqual(parsePointLines('喙尖 | 最前端\n\n眼睛'),[{id:'point-1',label:'喙尖',instruction:'最前端'},{id:'point-2',label:'眼睛',instruction:'眼睛'}]);
});
