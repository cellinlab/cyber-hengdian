import { Stage, type Pass } from './runtime/stage';
import { projectSchema, type Project } from './core/schema';
export async function initRender(){
 document.body.style.margin='0';const canvas=document.createElement('canvas');document.body.append(canvas);const stage=new Stage(canvas,false);
 let project:Project;
 const api={
   inspect(){return stage.inspectFrame();},
   async load(input:unknown,w:number,h:number){project=projectSchema.parse(input);stage.renderer.setPixelRatio(1);stage.resize(w,h);await stage.load(project);return true;},
   frame(shotId:string,time:number,pass:Pass='rgb'){const shot=project.shots.find(s=>s.id===shotId);if(!shot)throw Error('Shot not found');stage.update(shot,time);stage.render(stage.camera,pass);return canvas.toDataURL('image/png').split(',')[1];},
 };
 (window as unknown as {hengdianRender:typeof api}).hengdianRender=api;
}
