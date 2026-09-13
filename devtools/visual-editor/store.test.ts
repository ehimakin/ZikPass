import {it,expect,vi} from 'vitest';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {editorAvailable} from './guard';
import {createStore} from './store';
it('requires development, loopback host and rejects cross-site requests',()=>{
 vi.stubEnv('NODE_ENV','development');
 const request=(host:string,site='same-origin')=>new Request(`http://${host}/api/local-editor`,{headers:{host,'sec-fetch-site':site}});
 expect(editorAvailable(request('localhost:3001'))).toBe(true);expect(editorAvailable(request('evil.test'))).toBe(false);expect(editorAvailable(request('localhost:3001','cross-site'))).toBe(false);
 vi.stubEnv('NODE_ENV','production');expect(editorAvailable(request('localhost:3001'))).toBe(false);vi.unstubAllEnvs();
});
it('rejects stale/path/token writes, serializes saves and undoes without losing external work',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'jm-editor-store-'));const cwd=vi.spyOn(process,'cwd').mockReturnValue(root);
 try{
  const {editorSnapshot,saveEdit,undoEdit}=createStore(['components/jerkmeat-site.tsx','components/affiliate-demo-landing.tsx']);
  await fs.mkdir(path.join(root,'components'));
  const original='<h1 data-local-edit="hero">Straight meat.</h1>';
  await fs.writeFile(path.join(root,'components/jerkmeat-site.tsx'),original);await fs.writeFile(path.join(root,'components/affiliate-demo-landing.tsx'),'<p>Dynamic</p>');
  const s=await editorSnapshot(),entry=s.entries[0];const input={token:s.token,file:entry.file,hash:entry.hash,id:entry.id,texts:['Changed'],style:{}};
  await expect(saveEdit({...input,file:'../outside.tsx'})).rejects.toThrow();await expect(saveEdit({...input,token:'wrong'})).rejects.toThrow();await expect(saveEdit({...input,extra:true})).rejects.toThrow();
  const results=await Promise.allSettled([saveEdit(input),saveEdit(input)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const file=path.join(root,entry.file),saved=await fs.readFile(file,'utf8');await fs.writeFile(file,saved+'\n// external work');await expect(undoEdit(s.token)).rejects.toThrow();expect(await fs.readFile(file,'utf8')).toContain('// external work');
  await fs.writeFile(file,saved);await undoEdit(s.token);expect(await fs.readFile(file,'utf8')).toBe(original);
 }finally{cwd.mockRestore();await fs.rm(root,{recursive:true,force:true});}
});

it('rejects invalid configuration and keeps sessions separate',async()=>{
 expect(()=>createStore(['../other.tsx'])).toThrow();
 const a=createStore(['components/a.tsx']),b=createStore(['components/b.tsx']);
 await expect(a.undoEdit('bad')).rejects.toThrow('expired');
 await expect(b.undoEdit('bad')).rejects.toThrow('expired');
});
