import { expect,it,vi } from 'vitest';
import { disclosureFailure, readDisclosureBody } from '@/lib/server/disclosure-http';
import { DISCLOSURE_DENIAL } from '@/lib/server/disclosure-service';
it('redacts arbitrary errors and rejects surplus payload at domain boundary',async()=>{
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 const response=disclosureFailure(new Error('private profile secret stack'));
 expect(await response.json()).toEqual({error:DISCLOSURE_DENIAL});expect(warn).toHaveBeenCalledWith('disclosure_denied','invalid');warn.mockRestore();
});
it('rejects cross-origin, non-JSON, oversized bodies',async()=>{
 for(const [origin,type,body] of [['https://evil.test','application/json','{}'],['http://localhost','text/plain','{}'],['http://localhost','application/json','x'.repeat(25000)]])await expect(readDisclosureBody(new Request('http://localhost/api/disclosure/approve',{method:'POST',headers:{origin,'content-type':type},body}))).rejects.toThrow();
});
