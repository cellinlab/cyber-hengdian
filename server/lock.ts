import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
/** One process owns a workspace. Tests may still instantiate Store in isolation. */
export function lockWorkspace(dir:string){
 const file=join(dir,'server.lock');
 if(existsSync(file)){
  const pid=Number(readFileSync(file,'utf8'));let alive=false;
  if(Number.isInteger(pid)&&pid>0){try{process.kill(pid,0);alive=true;}catch(error){if((error as NodeJS.ErrnoException).code==='EPERM')alive=true;}}
  if(alive)throw Error('该工作空间已由另一个服务打开。请连接原服务，或使用不同的 HENGDIAN_DATA。');
  unlinkSync(file);
 }
 writeFileSync(file,String(process.pid),{flag:'wx'});
 const release=()=>{try{if(readFileSync(file,'utf8')===String(process.pid))unlinkSync(file);}catch{/* already released */}};
 process.once('exit',release);
 for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{release();process.exit(0);});
 return release;
}
