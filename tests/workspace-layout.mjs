import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const vite = await createServer({ server: { host:'127.0.0.1', port: 5182 }, logLevel: 'error' });
await vite.listen();
const browser = await chromium.launch({args:['--no-sandbox']});
const output = 'artifacts/workspace-layout';
await mkdir(output,{recursive:true});
const results=[];
try {
 for (const [label,width,height] of [['desktop',1440,900],['mobile',390,844],['small-phone',320,640]]) {
  const page=await browser.newPage({viewport:{width,height}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5182/tests/workspace-layout.html');
  await page.getByRole('heading',{name:'Good morning, Michael.'}).waitFor();
  await page.screenshot({path:`${output}/${label}-home.png`});
  const prompt=page.getByRole('textbox',{name:'Ask a question',exact:true});
  await prompt.fill('Summarize the key findings in my documents.');
  await prompt.press('Enter');
  await page.getByText('This is a layout preview of a sourced answer.').waitFor();
  const chat=page.getByRole('textbox',{name:'Ask Signal87',exact:true});
  const before=await chat.boundingBox();
  await chat.fill(Array(12).fill('Check that all of this text fits within the workspace.').join('\n'));
  const after=await chat.boundingBox();
  assert(after.height > before.height,`${label}: textarea grows with input`);
  assert(after.height <= 201,`${label}: textarea respects height limit`);
  const form=await chat.evaluate(el=>{const f=el.closest('form').getBoundingClientRect();const c=el.closest('form').parentElement.parentElement.getBoundingClientRect();return {left:f.left,right:f.right,width:f.width,column:c.width,scroll:document.documentElement.scrollWidth,viewport:innerWidth,bottom:f.bottom,height:innerHeight};});
  assert(form.left>=0&&form.right<=width,`${label}: composer stays within viewport`);
  assert(Math.abs(form.width-form.column)<2,`${label}: composer fills content column`);
  assert(form.scroll<=form.viewport,`${label}: no horizontal overflow`);
  assert(form.bottom<=form.height,`${label}: send button stays on screen`);
  await chat.fill('');
  assert((await chat.boundingBox()).height <= before.height+1,`${label}: textarea shrinks when cleared`);
  await page.screenshot({path:`${output}/${label}-ask.png`});
  for(const name of ['Files','Notes']) {
   await page.getByRole('button',{name,exact:true}).click();
   await page.getByRole('heading',{name,exact:true,level:1}).waitFor();
   await page.screenshot({path:`${output}/${label}-${name.toLowerCase()}.png`});
  }
  if(label==='desktop') {
   for(const name of ['Team','Settings']) {await page.getByRole('button',{name,exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();await page.screenshot({path:`${output}/${label}-${name.toLowerCase()}.png`});}
   await page.getByText('Answer preferences',{exact:true}).click();
   await page.getByLabel('Response profile').selectOption('gemini-2.5-pro');
   await page.getByRole('button',{name:'Home',exact:true}).click();
   await page.getByRole('button',{name:'Create a note',exact:true}).click();
   assert(await page.getByPlaceholder('Note title').count() || await page.getByRole('button',{name:/save/i}).count(),'Home note shortcut opens editor');
  }
  assert.equal(errors.length,0,errors.join('\n'));
  results.push(`${label}: layout, input sizing, navigation and console passed`);
  await page.close();
 }
 console.log(results.join('\n'));
} finally {await browser.close();await vite.close();}
