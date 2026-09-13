import ts from 'typescript';
import { createHash } from 'node:crypto';
export type EditStyle = { fontSize?: number; color?: string; backgroundColor?: string; borderRadius?: number };
export type Editable = { id: string; tag: string; texts: string[]; style: EditStyle; styleEditable: boolean };
export const sourceHash = (s: string) => createHash('sha256').update(s).digest('hex');
const tags = new Set(['h1','h2','h3','p','a','button','strong','small','span','em']);
export function parse(source: string) { return ts.createSourceFile('component.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX); }
function idOf(node: ts.JsxElement): string | undefined {
  const attribute = node.openingElement.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText()==='data-local-edit');
  if (!attribute || !ts.isJsxAttribute(attribute)) return;
  const value=attribute.initializer;
  if(value&&ts.isStringLiteral(value))return value.text;
  if(value&&ts.isJsxExpression(value)&&value.expression&&ts.isConditionalExpression(value.expression)&&ts.isStringLiteral(value.expression.whenTrue))return value.expression.whenTrue.text;
}
type Segment = {start:number;end:number;text:string};
function renderedJsxText(text:string):string {
  const output=ts.transpileModule(`const value=<span>${text}</span>`,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
  const ast=ts.createSourceFile('text.js',output,ts.ScriptTarget.Latest,true);let value='';
  function visit(node:ts.Node){if(ts.isCallExpression(node)&&node.arguments.length===3&&ts.isStringLiteral(node.arguments[2]))value=node.arguments[2].text;ts.forEachChild(node,visit);}visit(ast);return value;
}

function segments(node: ts.JsxElement, sourceFile: ts.SourceFile): Segment[] | undefined {
  const result:Segment[]=[];
  for(const child of node.children){
    if(ts.isJsxText(child)){if(child.text.trim())result.push({start:child.pos,end:child.end,text:renderedJsxText(child.text)});}
    else if(ts.isJsxExpression(child)&&child.expression&&ts.isStringLiteral(child.expression))result.push({start:child.getStart(sourceFile),end:child.end,text:child.expression.text});
    else if(ts.isJsxSelfClosingElement(child)&&child.tagName.getText(sourceFile)==='br')continue;
    else if(ts.isJsxElement(child)&&['em','strong','span','small','b','i'].includes(child.openingElement.tagName.getText(sourceFile))){const nested=segments(child,sourceFile);if(!nested)return;result.push(...nested);}
    else return;
  }
  return result.length?result:undefined;
}
function styleOf(node:ts.JsxElement):{style:EditStyle;attribute?:ts.JsxAttribute;editable:boolean}{
  const attr=node.openingElement.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText()==='style');
  if(!attr)return {style:{},editable:!node.openingElement.attributes.properties.some(ts.isJsxSpreadAttribute)};
  if(!ts.isJsxAttribute(attr)||!attr.initializer||!ts.isJsxExpression(attr.initializer)||!attr.initializer.expression||!ts.isObjectLiteralExpression(attr.initializer.expression))return {style:{},editable:false};
  const style:Record<string,string|number>={};
  for(const prop of attr.initializer.expression.properties){
    if(!ts.isPropertyAssignment(prop))return {style:{},editable:false};
    const key=prop.name.getText().replace(/^['"]|['"]$/g,'');
    if(!['fontSize','color','backgroundColor','borderRadius'].includes(key))return {style:{},editable:false};
    if(ts.isStringLiteral(prop.initializer))style[key]=prop.initializer.text;
    else if(ts.isNumericLiteral(prop.initializer))style[key]=Number(prop.initializer.text);
    else return {style:{},editable:false};
  }
  try{return {style:validateStyle(style),attribute:attr,editable:true};}catch{return {style:{},editable:false};}
}
export function validateStyle(value:unknown):EditStyle{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid style.');
  for(const [key,v] of Object.entries(value)){
    if(key==='fontSize'||key==='borderRadius'){if(typeof v!=='number'||!Number.isFinite(v)||v<(key==='fontSize'?8:0)||v>(key==='fontSize'?160:200))throw Error('Invalid size.');}
    else if(key==='color'||key==='backgroundColor'){if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw Error('Use a six-digit hex colour.');}
    else throw Error('Unsupported style property.');
  }
  return value as EditStyle;
}
export function inspectSource(source:string):Editable[]{
  const file=parse(source),items:Editable[]=[];
  function visit(node:ts.Node){if(ts.isJsxElement(node)){const id=idOf(node),text=segments(node,file);if(id&&text){const s=styleOf(node);items.push({id,tag:node.openingElement.tagName.getText(file),texts:text.map(t=>t.text),style:s.style,styleEditable:s.editable});}}ts.forEachChild(node,visit);}
  visit(file);return items;
}
export function editSource(source:string,id:string,texts:unknown,style:unknown):string{
  if(!Array.isArray(texts)||texts.length>40||texts.some(t=>typeof t!=='string'||t.length>4000)||texts.every(t=>!t.trim()))throw Error('Invalid text.');
  const newStyle=validateStyle(style),file=parse(source);const matches:ts.JsxElement[]=[];
  function visit(n:ts.Node){if(ts.isJsxElement(n)&&idOf(n)===id)matches.push(n);ts.forEachChild(n,visit);}visit(file);
  if(matches.length!==1)throw Error('Editable element is missing or ambiguous.');
  const node=matches[0],parts=segments(node,file);if(!parts||parts.length!==texts.length)throw Error('This text is dynamic or its structure changed.');
  const patches=parts.map((part,i)=>({start:part.start,end:part.end,text:`{${JSON.stringify(texts[i])}}`}));
  const oldStyle=styleOf(node);
  if(JSON.stringify(oldStyle.style)!==JSON.stringify(newStyle)){
    if(!oldStyle.editable)throw Error('This element has a computed style; edit its source directly.');
    const replacement=Object.keys(newStyle).length?`style={${JSON.stringify(newStyle)}}`:'';
    if(oldStyle.attribute)patches.push({start:oldStyle.attribute.getStart(file),end:oldStyle.attribute.end,text:replacement});
    else patches.push({start:node.openingElement.end-1,end:node.openingElement.end-1,text:` ${replacement}`});
  }
  let output=source;for(const p of patches.sort((a,b)=>b.start-a.start))output=output.slice(0,p.start)+p.text+output.slice(p.end);
  return output;
}
/** Repeatable setup instrumentation. Existing behaviour/markup is retained. */
export function instrumentSource(source:string,prefix:string):string{
  const file=parse(source),patches:{at:number;text:string}[]=[];let count=0;const used=new Set(inspectSource(source).map(item=>item.id));
  function nextId(){let id;do{id=`${prefix}-${++count}`;}while(used.has(id));used.add(id);return id;}
  function visit(n:ts.Node){
    if(ts.isJsxElement(n)&&tags.has(n.openingElement.tagName.getText(file))&&segments(n,file)){
      if(!idOf(n))patches.push({at:n.openingElement.end-1,text:` data-local-edit={process.env.NODE_ENV === "development" ? "${nextId()}" : undefined}`});
      return;
    }
    ts.forEachChild(n,visit);
  }visit(file);
  for(const p of patches.sort((a,b)=>b.at-a.at))source=source.slice(0,p.at)+p.text+source.slice(p.at);
  return source;
}
