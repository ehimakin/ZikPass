import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { editSource, inspectSource, instrumentSource, sourceHash } from './source';
import { normalizeScope, resolveFiles, type EditorScope } from './discovery';
type Undo={file:string;before:string;afterHash:string};
type EditorState={token:string;queue:Promise<unknown>;undo:Undo[]};
const globalEditor=globalThis as typeof globalThis & {__localVisualEditors?:Map<string,EditorState>};
const states=globalEditor.__localVisualEditors??=new Map<string,EditorState>();
export function createStore(scope: EditorScope) {
 const config=normalizeScope(scope);
 const projectRoot=process.cwd();
 const key=JSON.stringify([projectRoot,config]);
 const mapped=(source:string,file:string)=>instrumentSource(source,'ve-'+sourceHash(file).slice(0,12));
 let existing=states.get(key);if(!existing){existing={token:randomBytes(32).toString('hex'),queue:Promise.resolve(),undo:[]};states.set(key,existing);}
 const state=existing;
function serial<T>(fn:()=>Promise<T>):Promise<T>{const result=state.queue.then(fn);state.queue=result.catch(()=>undefined);return result;}
async function safePath(file:string){if(!(await resolveFiles(await fs.realpath(projectRoot),config)).includes(file))throw Error('File not editable.');const root=await fs.realpath(projectRoot);const actual=await fs.realpath(path.join(root,file));if(actual!==path.join(root,file))throw Error('Linked files are not editable.');return actual;}
function authorizedToken(token:unknown){if(typeof token!=='string')return false;const a=Buffer.from(token),b=Buffer.from(state.token);return a.length===b.length&&timingSafeEqual(a,b);}
async function editorSnapshot(){return serial(async()=>{
  const entries=[];for(const file of await resolveFiles(await fs.realpath(projectRoot),config)){const source=await fs.readFile(await safePath(file),'utf8');entries.push(...inspectSource(source).map(item=>({...item,file,hash:sourceHash(source)})));}
  return {token:state.token,entries,canUndo:state.undo.length>0};
});}
async function atomicWrite(file:string,source:string){const stat=await fs.stat(file);const tmp=`${file}.${randomBytes(8).toString('hex')}.tmp`;try{await fs.writeFile(tmp,source,{mode:stat.mode});await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true});}}
// Mapping is an explicit authenticated mutation, never a side effect of GET.
async function prepareEditor(token:unknown){return serial(async()=>{
  if(!authorizedToken(token))throw Error('Editor session expired.');
  let changed=0;
  for(const relative of await resolveFiles(await fs.realpath(projectRoot),config)){
    const file=await safePath(relative),before=await fs.readFile(file,'utf8');
    const after=mapped(before,relative);
    if(after===before)continue;
    if(await fs.readFile(file,'utf8')!==before)throw Error('Source changed during mapping. Try again.');
    await atomicWrite(file,after);changed++;
  }
  return {changed};
});}
async function saveEdit(input:Record<string,unknown>){return serial(async()=>{
  if(Object.keys(input).sort().join(',')!=='file,hash,id,style,texts,token')throw Error('Invalid save request.');
  if(!authorizedToken(input.token)||typeof input.file!=='string'||typeof input.id!=='string')throw Error('Editor session expired. Reload the page.');
  const file=await safePath(input.file),source=await fs.readFile(file,'utf8');
  if(sourceHash(source)!==input.hash)throw Error('Source changed since selection. Reload the editor before saving.');
  const edited=editSource(source,input.id,input.texts,input.style);if(edited===source)return;
  // Recheck immediately before replacing; the serial queue protects browser saves.
  if(sourceHash(await fs.readFile(file,'utf8'))!==input.hash)throw Error('Source changed. Reload before saving.');
  await atomicWrite(file,edited);state.undo.push({file:input.file,before:source,afterHash:sourceHash(edited)});if(state.undo.length>20)state.undo.shift();
});}
async function undoEdit(token:unknown){return serial(async()=>{
  if(!authorizedToken(token))throw Error('Editor session expired.');const undo=state.undo.at(-1);if(!undo)throw Error('Nothing to undo.');
  const file=await safePath(undo.file);if(sourceHash(await fs.readFile(file,'utf8'))!==undo.afterHash)throw Error('Source changed after the last save. Undo would overwrite another edit.');
  await atomicWrite(file,undo.before);state.undo.pop();
});}

return {editorSnapshot,prepareEditor,saveEdit,undoEdit};
}
