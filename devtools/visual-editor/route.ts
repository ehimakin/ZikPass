import { NextResponse } from 'next/server';
import { editorAvailable } from './guard';
import type { EditorScope } from './discovery';
export function createEditorHandlers(scope:EditorScope){
 const store=async()=> (await import('./store')).createStore(scope);
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function GET(request:Request){if(!editorAvailable(request))return json({error:'Not found.'},404);return json(await (await store()).editorSnapshot());}
async function body(request:Request):Promise<Record<string,unknown>>{
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('content-type')!=='application/json')throw Error('Same-origin JSON request required.');
  const reader=request.body?.getReader();if(!reader)throw Error('Missing request.');let text='';const decoder=new TextDecoder();let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>24000){await reader.cancel();throw Error('Edit is too large.');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
  const value:unknown=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid edit.');return value as Record<string,unknown>;
}
async function POST(request:Request){if(!editorAvailable(request))return json({error:'Not found.'},404);try{await (await store()).saveEdit(await body(request));return json({ok:true});}catch(error){return json({error:error instanceof Error?error.message:'Unable to save.'},409);}}
async function DELETE(request:Request){if(!editorAvailable(request))return json({error:'Not found.'},404);try{const input=await body(request);if(Object.keys(input).join(',')!=='token')throw Error('Invalid undo.');await (await store()).undoEdit(input.token);return json({ok:true});}catch(error){return json({error:error instanceof Error?error.message:'Unable to undo.'},409);}}

async function PUT(request:Request){if(!editorAvailable(request))return json({error:'Not found.'},404);try{const input=await body(request);if(Object.keys(input).join(',')!=='token')throw Error('Invalid mapping request.');return json(await (await store()).prepareEditor(input.token));}catch(error){return json({error:error instanceof Error?error.message:'Unable to map source.'},409);}}
return {GET,POST,DELETE,PUT};
}
