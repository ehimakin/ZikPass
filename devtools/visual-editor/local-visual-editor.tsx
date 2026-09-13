'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editable, EditStyle } from './source';
import styles from './local-visual-editor.module.css';
type Entry=Editable & {file:string;hash:string};
type Snapshot={token:string;entries:Entry[];canUndo:boolean};
function textNodes(element:Element):Text[]{const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);const nodes:Text[]=[];let node;while((node=walker.nextNode()))if(node.textContent?.trim())nodes.push(node as Text);return nodes;}
export function LocalVisualEditor(){
  const [enabled,setEnabled]=useState(false),[snapshot,setSnapshot]=useState<Snapshot>(),[entry,setEntry]=useState<Entry>(),[texts,setTexts]=useState<string[]>([]),[style,setStyle]=useState<EditStyle>({}),[message,setMessage]=useState('Select Edit page, then click highlighted text.'),[busy,setBusy]=useState(false);
  const selected=useRef<{element:HTMLElement;nodes:Text[];originals:string[];style:string|null} | undefined>(undefined);
  const panel=useRef<HTMLElement>(null);
  const restore=useCallback(()=>{const s=selected.current;if(s){s.nodes.forEach((n,i)=>n.textContent=s.originals[i]);if(s.style===null)s.element.removeAttribute('style');else s.element.setAttribute('style',s.style);s.element.removeAttribute('data-local-selected');selected.current=undefined;}},[]);
  const refresh=useCallback(async()=>{const response=await fetch('/api/local-editor',{cache:'no-store'});if(!response.ok)throw Error('The editor is available only on a local development server.');const value:Snapshot=await response.json();setSnapshot(value);return value;},[]);
  async function start(){try{await refresh();setEnabled(true);setMessage('Click outlined text. Dynamic application values are not editable.');}catch(e){setMessage((e as Error).message);}}
  function close(){restore();setEnabled(false);setEntry(undefined);}
  useEffect(()=>{if(!enabled)return;document.documentElement.classList.add(styles.editing);
    function choose(event:MouseEvent){const target=event.target;if(!(target instanceof Element)||panel.current?.contains(target))return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      const element=target.closest<HTMLElement>('[data-local-edit]');const item=snapshot?.entries.find(e=>e.id===element?.dataset.localEdit);
      if(!element||!item){setMessage('This element is dynamic or not mapped yet. Choose outlined text.');return;}
      restore();const nodes=textNodes(element);if(nodes.length!==item.texts.length){setMessage('Rendered text differs from its source. Reload and try again.');return;}
      selected.current={element,nodes,originals:nodes.map(n=>n.textContent??''),style:element.getAttribute('style')};element.dataset.localSelected='true';setEntry(item);setTexts(item.texts);setStyle(item.style);setMessage('Preview changes below. Save writes the actual component file.');
    }
    window.addEventListener('click',choose,true);return()=>{document.documentElement.classList.remove(styles.editing);window.removeEventListener('click',choose,true);};
  },[enabled,snapshot,restore]);
  useEffect(()=>()=>restore(),[restore]);
  function previewText(index:number,value:string){setTexts(previous=>previous.map((t,i)=>i===index?value:t));const node=selected.current?.nodes[index];if(node)node.textContent=value;}
  function previewStyle(key:keyof EditStyle,value:string){const next={...style};if(value==='')delete next[key];else if(key==='fontSize'||key==='borderRadius')next[key]=Number(value);else next[key]=value;setStyle(next);
    const s=selected.current;if(!s)return;if(s.style===null)s.element.removeAttribute('style');else s.element.setAttribute('style',s.style);
    for(const key of ['font-size','color','background-color','border-radius'])s.element.style.removeProperty(key);
    for(const [k,v] of Object.entries(next))s.element.style[k as 'fontSize']=typeof v==='number'?`${v}px`:v;
  }
  const save=useCallback(async()=>{if(!entry||!snapshot||busy)return;setBusy(true);setMessage('Saving source…');try{const response=await fetch('/api/local-editor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:snapshot.token,file:entry.file,hash:entry.hash,id:entry.id,texts,style})});const result=await response.json();if(!response.ok)throw Error(result.error);selected.current?.element.removeAttribute('data-local-selected');selected.current=undefined;setEntry(undefined);setEnabled(false);await refresh();setMessage('Saved to source. The change survives refresh.');setBusy(false);}catch(e){setMessage((e as Error).message);setBusy(false);}},[entry,snapshot,busy,texts,style,refresh]);
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{if(!enabled)return;if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void save();}if(event.key==='Escape'){restore();setEnabled(false);setEntry(undefined);}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[enabled,save,restore]);
  
  async function undo(){if(!snapshot)return;setBusy(true);try{restore();const response=await fetch('/api/local-editor',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:snapshot.token})});const result=await response.json();if(!response.ok)throw Error(result.error);setEntry(undefined);setEnabled(false);await refresh();setMessage('Undone. The previous source has been restored.');setBusy(false);}catch(e){setMessage((e as Error).message);setBusy(false);}}
  return <aside ref={panel} className={styles.editor} aria-label="Local visual editor">
    <div className={styles.header}><strong>Local page editor</strong><span>Development only</span></div>
    <p role="status" aria-live="polite">{message}</p>
    {!enabled?<button onClick={()=>void start()}>Edit page</button>:<>
      <button onClick={close} disabled={busy}>Exit editing / discard preview</button>
      {entry&&<div className={styles.controls}><small>{entry.tag} · {entry.file}</small>
        {texts.map((text,i)=><label key={i}>Text {i+1}<textarea aria-label={`Edit text ${i+1}`} value={text} onChange={e=>previewText(i,e.target.value)} rows={2} maxLength={4000} disabled={busy}/></label>)}
        <p className={styles.hint}>Each box is one text segment. Existing italics, links and line breaks stay in place.</p>
        <button onClick={()=>void save()} disabled={busy}>Save to source (⌘S)</button>
        {entry.styleEditable&&<fieldset disabled={busy}><legend>Style overrides (blank uses existing CSS)</legend>
          <label>Font size (px)<input aria-label="Font size" type="number" min={8} max={160} value={style.fontSize??''} onChange={e=>previewStyle('fontSize',e.target.value)}/></label>
          <label>Corner radius (px)<input aria-label="Corner radius" type="number" min={0} max={200} value={style.borderRadius??''} onChange={e=>previewStyle('borderRadius',e.target.value)}/></label>
          <label>Text colour<input aria-label="Text colour" placeholder="#ffffff" value={style.color??''} onChange={e=>previewStyle('color',e.target.value)}/></label>
          <label>Background colour<input aria-label="Background colour" placeholder="#111111" value={style.backgroundColor??''} onChange={e=>previewStyle('backgroundColor',e.target.value)}/></label>
        </fieldset>}
      </div>}
      {snapshot?.canUndo&&<button onClick={()=>void undo()} disabled={busy}>Undo last source save</button>}
    </>}
  </aside>;
}
