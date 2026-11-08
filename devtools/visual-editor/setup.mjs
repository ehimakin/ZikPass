import fs from 'node:fs';
import path from 'node:path';
import Module, {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fs.realpathSync(process.cwd());
const require=createRequire(path.join(root,'package.json'));
const ts=require('typescript');
function load(name){
 const filename=fileURLToPath(new URL(name,import.meta.url));
 const compiled=new Module(filename);
 compiled.paths=Module._nodeModulePaths(root);
 compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,filename);
 return compiled.exports;
}
const source=load('./source.ts'),discovery=load('./discovery.ts');
const config=discovery.normalizeScope(JSON.parse(fs.readFileSync(path.join(root,'visual-editor.config.json'),'utf8')));
const changes=(await discovery.resolveFiles(root,config)).map(file=>{
 const full=path.join(root,file);if(fs.realpathSync(full)!==full)throw Error('Linked source files are unsupported.');
 const before=fs.readFileSync(full,'utf8');
 return {full,before,after:source.instrumentSource(before,'ve-'+source.sourceHash(file).slice(0,12))};
});
for(const {full,before,after} of changes){if(before!==after)fs.writeFileSync(full,after);console.log(path.relative(root,full)+(before===after?' — already mapped':' — mapped'));}
