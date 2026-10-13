import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { applyTransaction, Conflict } from '../src/core/project';
import { projectSchema, transactionSchema, type Project, type Transaction } from '../src/core/schema';
import { createProject } from '../src/core/catalog';
type History={project:Project,label:string};
type Receipt={id:string,hash:string,result:Project};
type State={project:Project,past:History[],future:History[],receipts:Receipt[]};
export class Store {
 state:State;file:string;
 constructor(dir:string){mkdirSync(dir,{recursive:true});this.file=join(dir,'workspace.json');
   this.state=existsSync(this.file)?JSON.parse(readFileSync(this.file,'utf8')):{project:createProject(),past:[],future:[],receipts:[]};
   projectSchema.parse(this.state.project);this.state.past.forEach(h=>projectSchema.parse(h.project));this.state.future.forEach(h=>projectSchema.parse(h.project));
   if(!existsSync(this.file))this.persist(this.state);
 }
 private persist(next:State){const tmp=this.file+'.tmp';writeFileSync(tmp,JSON.stringify(next,null,2));renameSync(tmp,this.file);this.state=next;}
 get project(){return structuredClone(this.state.project);}
 history(){return {canUndo:!!this.state.past.length,canRedo:!!this.state.future.length,entries:this.state.past.map(h=>({label:h.label,revision:h.project.revision}))};}
 transact(input:Transaction){const tx=transactionSchema.parse(input);const hash=createHash('sha256').update(JSON.stringify(tx)).digest('hex');
   const receipt=this.state.receipts.find(r=>r.id===tx.requestId);if(receipt){if(receipt.hash!==hash)throw new Conflict('requestId 已用于其他内容');return structuredClone(receipt.result);}
   const next=applyTransaction(this.state.project,tx);
   this.persist({project:next,past:[...this.state.past,{project:this.state.project,label:tx.label}].slice(-50),future:[],receipts:[...this.state.receipts,{id:tx.requestId,hash,result:next}].slice(-50)});return this.project;
 }
 replace(input:unknown,baseRevision:number,label='载入工程'){
   if(baseRevision!==this.state.project.revision)throw new Conflict('工程已更新，请重新读取');const p=projectSchema.parse(input);p.revision=this.state.project.revision+1;
   this.persist({...this.state,project:p,past:[...this.state.past,{project:this.state.project,label}].slice(-50),future:[]});return this.project;
 }
 travel(direction:'undo'|'redo',baseRevision:number){
   if(baseRevision!==this.state.project.revision)throw new Conflict('工程已更新，请重新读取');
   const source=direction==='undo'?'past':'future',dest=direction==='undo'?'future':'past';const history=this.state[source];const item=history.at(-1);if(!item)throw Error('没有可恢复的历史');
   const next=structuredClone(this.state);next[source].pop();next[dest].push({project:next.project,label:item.label});next.project={...item.project,revision:next.project.revision+1};this.persist(next);return this.project;
 }
}
