import { describe,it,expect } from 'vitest';
import {editSource,inspectSource,instrumentSource} from './source';
const source='export function Hero(){return <h1 data-local-edit="hero">Hot meat.<br /><em>No small talk.</em></h1>}';
describe('source visual editor',()=>{
 it('updates text without losing nested markup and escapes JSX-looking text',()=>{
  const result=editSource(source,'hero',['Straight meat.','<script>{"test"}</script>'],{});
  expect(result).toContain('<br /><em>');expect(inspectSource(result)[0].texts).toEqual(['Straight meat.','<script>{"test"}</script>']);
 });
 it('adds, replaces and removes only allowlisted style overrides',()=>{
  const result=editSource(source,'hero',['Hot meat.','No small talk.'],{fontSize:40,color:'#123456'});expect(inspectSource(result)[0].style).toEqual({fontSize:40,color:'#123456'});
  const removed=editSource(result,'hero',['Hot meat.','No small talk.'],{});expect(inspectSource(removed)[0].style).toEqual({});
  expect(()=>editSource(source,'hero',['a','b'],{backgroundImage:'url(x)'})).toThrow();
 });
 it('rejects missing, ambiguous, dynamic or structurally mismatched targets',()=>{
  expect(()=>editSource(source,'missing',['a','b'],{})).toThrow();expect(()=>editSource(source+source,'hero',['a','b'],{})).toThrow();expect(()=>editSource(source,'hero',['a'],{})).toThrow();
  expect(inspectSource('<p data-local-edit="count">{count}</p>')).toEqual([]);
 });
 it('instruments static text only and preserves current user copy',()=>{
  const input='<><h1>Straight meat.<br/><em>No small talk.</em></h1><p>{count}</p></>';
  const output=instrumentSource(input,'jm');expect(inspectSource(output)).toHaveLength(1);expect(output).toContain('Straight meat.');expect(output).toContain('process.env.NODE_ENV === "development"');
 });
});

it('instrumentation is repeatable and assigns fresh IDs to new text',()=>{
 const once=instrumentSource('<h1>Hello</h1>','page');
 expect(instrumentSource(once,'page')).toBe(once);
 const added=instrumentSource('<p>New</p>'+once,'page');
 const ids=inspectSource(added).map(item=>item.id);
 expect(new Set(ids).size).toBe(2);
});

it('reserves IDs even when previously static elements become dynamic',()=>{
 const output=instrumentSource('<><p data-local-edit="page-1">{count}</p><h2>New heading</h2></>','page');
 expect(inspectSource(output)[0].id).toBe('page-2');
});
