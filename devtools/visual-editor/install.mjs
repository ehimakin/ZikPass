import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const root=fs.realpathSync(process.cwd());
const source=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(path.join(root,'package.json'));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if(!pkg.dependencies?.next)throw Error('This installer supports Next.js App Router projects.');
const ts=require('typescript');
const app=fs.existsSync(path.join(root,'app/layout.tsx'))?'app':fs.existsSync(path.join(root,'src/app/layout.tsx'))?'src/app':null;
if(!app)throw Error('Expected app/layout.tsx or src/app/layout.tsx. No files changed.');
const layoutPath=path.join(root,app,'layout.tsx');
const before=fs.readFileSync(layoutPath,'utf8');
const ast=ts.createSourceFile('layout.tsx',before,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const bodies=[];
function visit(n){if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(ast)==='body')bodies.push(n);ts.forEachChild(n,visit);}visit(ast);
if(bodies.length!==1)throw Error('Expected one literal <body> in layout. No files changed.');
const destination=path.join(root,'devtools/visual-editor');
const configPath=path.join(root,'visual-editor.config.json');
const config=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8')):{directories:app.startsWith('src/')?['src/components','src/app']:['components','app']};
const validFile=f=>typeof f==='string'&&/^(src\/)?(components|app)\/.+\.tsx$/.test(f)&&!f.includes('\\')&&!f.split('/').some(p=>p==='..'||p==='.'||!p);
if(!config||Object.keys(config).length!==1||('files' in config?(!Array.isArray(config.files)||!config.files.length||config.files.some(f=>!validFile(f))):(!Array.isArray(config.directories)||!config.directories.length||config.directories.some(d=>!['components','app','src/components','src/app'].includes(d)))))throw Error('Invalid editor config. No files changed.');
const relative=(from,to)=>{const p=path.relative(from,to).split(path.sep).join('/');return p.startsWith('.')?p:'./'+p;};
const routeDir=path.join(root,app,'api/local-editor');
const routePath=path.join(routeDir,'route.ts');
const route=`// Installed by local-visual-editor\nimport { createEditorHandlers } from ${JSON.stringify(relative(routeDir,path.join(destination,'route')))};\nimport config from ${JSON.stringify(relative(routeDir,configPath))};\nexport const runtime = "nodejs";\nexport const dynamic = "force-dynamic";\nexport const { GET, POST, DELETE, PUT } = createEditorHandlers(config);\n`;
if(fs.existsSync(routePath)&&!fs.readFileSync(routePath,'utf8').includes('createEditorHandlers'))throw Error('An unrelated local-editor route exists. No files changed.');
let after=before;
if(!before.includes('<LocalVisualEditor')){
 const at=bodies[0].closingElement.getStart(ast);
 after=before.slice(0,at)+'{process.env.NODE_ENV === "development" && <LocalVisualEditor />}\n'+before.slice(at);
 after=`import { LocalVisualEditor } from ${JSON.stringify(relative(path.dirname(layoutPath),path.join(destination,'local-visual-editor')))};\n`+after;
}
if(source!==destination){
 if(fs.existsSync(destination))throw Error('Destination tool folder already exists; update it explicitly. No files changed.');
 fs.cpSync(source,destination,{recursive:true,filter:p=>!['.git','node_modules'].includes(path.basename(p))});
}
fs.mkdirSync(routeDir,{recursive:true});
fs.writeFileSync(routePath,route);
if(!fs.existsSync(configPath))fs.writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
if(after!==before)fs.writeFileSync(layoutPath,after);
execFileSync(process.execPath,[path.join(destination,'setup.mjs')],{cwd:root,stdio:'inherit'});
console.log('Installed. Start/restart your development server, open localhost, and click Edit page. Review the source diff before committing.');
