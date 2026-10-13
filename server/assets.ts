import { createHash } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
export function storeGlb(data:Buffer,dir:string){
 if(data.length<20||data.length>50*1024*1024||data.readUInt32LE(0)!==0x46546c67||data.readUInt32LE(4)!==2||data.readUInt32LE(8)!==data.length)throw Error('需要有效的自包含 GLB 2.0 文件（最多 50 MB）');
 const length=data.readUInt32LE(12);if(data.readUInt32LE(16)!==0x4e4f534a||20+length>data.length)throw Error('无效 GLB JSON 区块');
 const json=JSON.parse(data.subarray(20,20+length).toString('utf8'));
 for(const item of [...(json.buffers??[]),...(json.images??[])])if(item.uri)throw Error('请先把外部图片和缓冲区嵌入 GLB');
 if(json.extensionsRequired?.some((e:string)=>!['KHR_materials_unlit','KHR_materials_clearcoat','KHR_materials_transmission','KHR_materials_ior','KHR_materials_sheen','KHR_materials_specular','KHR_materials_emissive_strength','KHR_texture_transform','KHR_mesh_quantization','EXT_mesh_gpu_instancing'].includes(e)))throw Error('模型包含当前运行器不支持的必需扩展；请导出未压缩 GLB');
 const asset=createHash('sha256').update(data).digest('hex')+'.glb';if(!existsSync(join(dir,asset)))writeFileSync(join(dir,asset),data,{flag:'wx'});return asset;
}
