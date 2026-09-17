import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { resetDemo, chooseStore, readCustomerCode, clerkConfirm, payWithSimulator } from './helpers';
const name='Privacy Canary Alice';const address='91 Canary Lane, London, SW1A 1AA, United Kingdom';const email='canary@example.test';const secret='correct horse battery staple';
async function createVault(page:Page){await page.goto('/vault-legacy');await page.getByLabel('Legal name',{exact:true}).fill(name);await page.getByLabel('Delivery address',{exact:true}).fill(address);await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Passphrase',{exact:true}).fill(secret);await page.getByRole('button',{name:'Save Vault',exact:true}).click();await expect(page.getByText('Encrypted Vault saved on this device.')).toBeVisible();}
async function issue(page:Page,request:APIRequestContext){await page.goto('/find');await page.getByLabel(/postcode or area/i).fill('W1');await chooseStore(page,'zik-london-001');await page.getByRole('button',{name:/^Start/}).click();await clerkConfirm(request,await readCustomerCode(page),'zik-london-001');await expect(page.getByText(/ID check confirmed/i)).toBeVisible();await payWithSimulator(page,'success');await expect(page.getByRole('heading',{name:/Your pass is ready/i})).toBeVisible({timeout:20000});}
test.beforeEach(async({request})=>{await resetDemo(request);});
test('Vault reload, wrong secret, edit, encrypted storage and deletion',async({page})=>{
  await createVault(page);await page.reload();await expect(page.getByLabel('Legal name',{exact:true})).toHaveCount(0);
  await page.getByLabel('Passphrase',{exact:true}).fill('incorrect passphrase');await page.getByRole('button',{name:'Unlock Vault',exact:true}).click();await expect(page.getByText(/Unable to unlock/)).toBeVisible();
  await page.getByLabel('Passphrase',{exact:true}).fill(secret);await page.getByRole('button',{name:'Unlock Vault',exact:true}).click();await expect(page.getByLabel('Legal name',{exact:true})).toHaveValue(name);
  await page.getByLabel('Legal name',{exact:true}).fill(name+' edited');await page.getByLabel('Passphrase',{exact:true}).fill(secret);await page.getByRole('button',{name:'Save Vault',exact:true}).click();await expect(page.getByText('Encrypted Vault saved on this device.')).toBeVisible();
  const disk=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('zik-local-vault',1);r.onsuccess=()=>resolve(r.result);});return new Promise<string>(resolve=>{const r=db.transaction('encrypted').objectStore('encrypted').get('profile');r.onsuccess=()=>{resolve(JSON.stringify(r.result));db.close();};});});
  expect(disk).not.toContain(name);expect(disk).not.toContain(address);expect(disk).not.toContain(secret);expect(JSON.parse(disk).ciphertext).toBeTruthy();
  await page.getByRole('button',{name:'Delete Vault',exact:true}).click();await expect(page.getByText('Vault deleted from this device.')).toBeVisible();await page.reload();await expect(page.getByText('Create your local Vault.')).toBeVisible();
});
test('retail cancel, locked approval, exact optional omission, and Zik payload privacy',async({page,request})=>{
  await issue(page,request);await createVault(page);
  const zikBodies:string[]=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))zikBodies.push(r.postData()??'');});
  await page.goto('/retail-demo');await page.getByRole('button',{name:'Fill with Zik'}).click();await expect(page.getByRole('button',{name:'Approve and fill'})).toBeDisabled();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByText('Cancelled. No details shared.')).toBeVisible();
  await page.getByRole('button',{name:'Fill with Zik'}).click();await page.getByLabel('Passphrase',{exact:true}).fill(secret);await page.getByRole('button',{name:'Unlock Vault',exact:true}).click();await expect(page.getByText('Vault unlocked on this device.')).toBeVisible();await expect(page.getByRole('checkbox')).not.toBeChecked();
  const resultPromise=page.waitForResponse(r=>r.url().includes('/api/demo-merchant/redeem'));
  await page.getByRole('button',{name:'Approve and fill'}).click();const result=await (await resultPromise).json();
  await expect(page.getByLabel('Checkout Legal name',{exact:true})).toHaveValue(name);await expect(page.getByLabel('Checkout Delivery address',{exact:true})).toHaveValue(address);await expect(page.getByLabel('Checkout Email',{exact:true})).toHaveCount(0);
  expect(Object.keys(result.fields).sort()).toEqual(['delivery_address','legal_name']);expect(result.fields.legal_name.provenance).toBe('self_entered');expect(result.age.provenance).toBe('zik_verified');
  for(const body of zikBodies)for(const value of [name,address,email,secret])expect(body).not.toContain(value);
  const submitted=zikBodies.map(b=>{try{return JSON.parse(b);}catch{return {};}}).find(b=>b.envelope);expect(submitted.envelope.ciphertext).toBeTruthy();expect(submitted.envelope.wrapped_key).toBeTruthy();
});
test('age-only never opens Vault storage and never transmits profile',async({page,request})=>{
  await issue(page,request);await createVault(page);
  await page.addInitScript(()=>{const original=IDBFactory.prototype.open;IDBFactory.prototype.open=function(...args:Parameters<IDBFactory['open']>){if(args[0]==='zik-local-vault'){sessionStorage.setItem('unexpected-vault-access','yes');throw Error('Age-only opened Vault');}return original.apply(this,args);};});
  const payloads:string[]=[];page.on('request',r=>{if(r.url().includes('/api/'))payloads.push(r.postData()??'');});
  await page.goto('/affiliate-demo');await page.getByRole('button',{name:/^Verify with Zik$/i}).click();await page.getByRole('button',{name:/Confirm I.?m over 18/i}).click();await expect(page.getByText(/Age verified with Zik/i)).toBeVisible({timeout:20000});
  expect(await page.evaluate(()=>sessionStorage.getItem('unexpected-vault-access'))).toBeNull();for(const payload of payloads)for(const value of [name,address,email])expect(payload).not.toContain(value);
});
test('optional email is included only when selected; responsive consent and keyboard cancellation',async({page,request})=>{
  await issue(page,request);await createVault(page);await page.goto('/retail-demo');await page.getByRole('button',{name:'Fill with Zik'}).click();await page.getByLabel('Passphrase',{exact:true}).fill(secret);await page.getByRole('button',{name:'Unlock Vault',exact:true}).click();await expect(page.getByText('Vault unlocked on this device.')).toBeVisible();
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Approve and fill'}).click();await expect(page.getByLabel('Checkout Email',{exact:true})).toHaveValue(email);
  await page.getByRole('button',{name:'Fill with Zik'}).click();
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`docs/sprint-6/evidence/consent-${width}.png`,fullPage:true});}
  await page.getByRole('button',{name:'Cancel',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'Fill with Zik'})).toBeFocused();
});
