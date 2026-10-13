import { projectSchema, transactionSchema, type Project, type Transaction, type Transform, type Key, type Vec3, type Shot } from './schema';
export class Conflict extends Error { status=409; }
export function applyTransaction(project:Project,input:Transaction):Project {
  const tx=transactionSchema.parse(input);
  if(tx.baseRevision!==project.revision) throw new Conflict(`工程已更新：当前版本 ${project.revision}，提交版本 ${tx.baseRevision}。请重新读取后修改。`);
  const p=structuredClone(project);
  const entity=(id:string)=>{const e=p.entities.find(e=>e.id===id);if(!e)throw Error('对象不存在');return e;};
  const shot=(id:string)=>{const s=p.shots.find(s=>s.id===id);if(!s)throw Error('镜头不存在');return s;};
  for(const op of tx.operations){
    switch(op.type){
      case 'project.update': { const {type,...fields}=op;Object.assign(p,fields);break; }
      case 'entity.add': p.entities.push(op.entity);break;
      case 'entity.update': {const e=entity(op.id);if(e.locked && op.changes.transform)throw Error('对象已锁定');Object.assign(e,op.changes);if(op.changes.asset===null||e.kind!=='glb')delete e.asset;break;}
      case 'entity.remove': entity(op.id);p.entities=p.entities.filter(e=>e.id!==op.id);for(const s of p.shots){if(s.camera.follow===op.id)s.camera.follow=null;delete s.tracks[op.id];}p.notes=p.notes.map(n=>n.entityId===op.id?{...n,entityId:null}:n);break;
      case 'shot.add': p.shots.push(op.shot);break;
      case 'shot.update': Object.assign(shot(op.id),op.changes);break;
      case 'shot.remove': shot(op.id);if(p.shots.length===1)throw Error('至少保留一个镜头');p.shots=p.shots.filter(s=>s.id!==op.id);p.notes=p.notes.filter(n=>n.shotId!==op.id);break;
      case 'key.set': {if(entity(op.entityId).locked)throw Error('对象已锁定');const s=shot(op.shotId);s.tracks[op.entityId]=[...(s.tracks[op.entityId]??[]).filter(k=>Math.abs(k.time-op.key.time)>.00001),op.key].sort((a,b)=>a.time-b.time);break;}
      case 'key.remove': {entity(op.entityId);const s=shot(op.shotId);s.tracks[op.entityId]=(s.tracks[op.entityId]??[]).filter(k=>k.time!==op.time);break;}
      case 'note.add': p.notes.push(op.note);break;
      case 'note.remove': p.notes=p.notes.filter(n=>n.id!==op.id);break;
    }
  }
  p.revision++;return projectSchema.parse(p);
}
export const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export const mix3=(a:Vec3,b:Vec3,t:number)=>a.map((v,i)=>lerp(v,b[i],t)) as Vec3;
export function interpolate(a:Transform,b:Transform,t:number):Transform {
  let q2=[...b.rotation];let dot=a.rotation.reduce((sum,x,i)=>sum+x*q2[i],0);
  if(dot<0){q2=q2.map(x=>-x);dot=-dot;}
  let q:number[];
  if(dot>.9995) q=a.rotation.map((x,i)=>lerp(x,q2[i],t));
  else {const theta=Math.acos(Math.min(dot,1));q=a.rotation.map((x,i)=>(Math.sin((1-t)*theta)*x+Math.sin(t*theta)*q2[i])/Math.sin(theta));}
  const n=Math.hypot(...q);return {position:mix3(a.position,b.position,t),scale:mix3(a.scale,b.scale,t),rotation:q.map(x=>x/n) as Transform['rotation']};
}
export function sampleTransform(base:Transform,keys:Key[],time:number):Transform {
  if(!keys.length)return structuredClone(base);
  if(time<=keys[0].time){const {time:_,...t}=keys[0];return structuredClone(t);}
  for(let i=1;i<keys.length;i++)if(time<=keys[i].time)return interpolate(keys[i-1],keys[i],(time-keys[i-1].time)/(keys[i].time-keys[i-1].time));
  const {time:_,...last}=keys[keys.length-1];return structuredClone(last);
}
export function evaluate(project:Project,shot:Shot,time:number){
  const t=Math.max(0,Math.min(shot.duration,time));const progress=t/shot.duration;
  const entities=project.entities.map(e=>({...e,transform:sampleTransform(e.transform,shot.tracks[e.id]??[],t)}));
  const followed=entities.find(e=>e.id===shot.camera.follow);
  const target=followed ? mix3(followed.transform.position,[followed.transform.position[0],followed.transform.position[1]+1.1,followed.transform.position[2]],1) : mix3(shot.camera.target,shot.camera.targetEnd,progress);
  return {entities,camera:{position:mix3(shot.camera.from,shot.camera.to,progress),target,fov:shot.camera.fov},time:t};
}
export function inspect(project:Project){
  const warnings:string[]=[];
  for(const e of project.entities){if(e.kind==='glb'&&!e.license)warnings.push(`${e.name} 未填写资产许可`);}
  for(const s of project.shots){if(Math.hypot(...s.camera.from.map((v,i)=>v-s.camera.target[i]))<.01)warnings.push(`${s.name} 的摄影机与目标重合`);}
  return {valid:true,revision:project.revision,entities:project.entities.length,shots:project.shots.length,totalSeconds:project.shots.reduce((v,s)=>v+s.duration,0),warnings};
}
