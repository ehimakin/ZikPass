import fs from 'node:fs';
import path from 'node:path';
import Module, {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const filename=fileURLToPath(new URL('./source.ts',import.meta.url));
const compiled=new Module(filename);
compiled.paths=Module._nodeModulePaths(path.dirname(filename));
compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const root=fs.realpathSync(process.cwd());
const config=JSON.parse(fs.readFileSync(path.join(root,'visual-editor.config.json'),'utf8'));
if(Object.keys(config).join(',')!=='files'||!Array.isArray(config.files)||!config.files.length)throw Error('Expected a files allowlist.');
const changes=config.files.map(file=>{
 if(typeof file!=='string'||!/^(src\/)?components\/[a-zA-Z0-9_./-]+\.tsx$/.test(file)||file.split('/').includes('..'))throw Error('Invalid component path.');
 const full=path.join(root,file);if(fs.realpathSync(full)!==full)throw Error('Linked components are unsupported.');
 const before=fs.readFileSync(full,'utf8');
 const prefix='ve-'+compiled.exports.sourceHash(file).slice(0,12);
 return {full,before,after:compiled.exports.instrumentSource(before,prefix)};
});
for(const {full,before,after} of changes){if(before!==after)fs.writeFileSync(full,after);console.log(path.relative(root,full)+ (before===after?' — already mapped':' — mapped'));}
