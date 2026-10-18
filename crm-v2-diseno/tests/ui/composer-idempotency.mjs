/** Envíos ficticios: claves estables tras red/409 y nuevas tras éxito/edición. */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const built = await build({stdin:{contents:`
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Composer} from './src/components/inbox/composer';
import {UNCERTAIN_SEND} from './src/components/inbox/send-attempt';
window.textCalls=[];
function Harness(){
 const [open,setOpen]=useState(true);window.setOpen=setOpen;
 const [ai,setAi]=useState(true);window.setAi=setAi;
 return <Composer conversation={{id:'cv_ficticia',aiEnabled:ai,handoffAt:null,windowOpen:open,windowRemainingMs:10000,contact:{name:'Persona ficticia'}}}
 onSend={async(text,key)=>{window.textCalls.push({text,key});return window.textCalls.length===1?UNCERTAIN_SEND:null;}}
 onSent={()=>{window.sent=(window.sent||0)+1;}} onAccessDenied={()=>{window.denied=true;}}/>;
}
createRoot(document.getElementById('root')).render(<Harness/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',alias:{'@':resolve('src')}});
const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?built.outputFiles[0].text:'<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage(); const calls=[];
 await page.route('**/api/**',async route=>{
  const request=route.request();
  if(request.method()==='GET')return route.fulfill({json:{templates:[{id:'tpl_ficticia',name:'saludo',body:'Hola',status:'approved',language:'es'}]}});
  let body;
  if(request.url().endsWith('/media')){
   const form=await new Request(request.url(),{method:'POST',headers:request.headers(),body:request.postDataBuffer()}).formData();
   body={idempotencyKey:form.get('idempotencyKey')};
  }else body=request.postDataJSON();
  calls.push({path:new URL(request.url()).pathname,...body});
  const same=calls.filter(c=>c.path===new URL(request.url()).pathname);
  if(same.length===1){
   if(request.url().endsWith('/media'))return route.abort('connectionreset');
   return route.fulfill({status:409,json:{error:{code:'send_uncertain'}}});
  }
  return route.fulfill({status:200,json:{messageId:'msg_ficticio'}});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByText('Toma la conversación para responder',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Enviar',exact:true}).count(),0);
 await page.evaluate(()=>window.setAi(false));
 const input=page.getByPlaceholder('Escribe una respuesta…');
 await input.fill('Mensaje ficticio'); await page.getByRole('button',{name:'Enviar',exact:true}).click();
 await page.getByRole('alert').waitFor();
 await page.getByRole('button',{name:'Enviar',exact:true}).click();
 await page.waitForFunction(()=>window.textCalls.length===2);
 let textCalls=await page.evaluate(()=>window.textCalls);
 assert.equal(textCalls[0].key,textCalls[1].key);
 await input.fill('Mensaje ficticio'); await page.getByRole('button',{name:'Enviar',exact:true}).click();
 await page.waitForFunction(()=>window.textCalls.length===3);
 textCalls=await page.evaluate(()=>window.textCalls);assert.notEqual(textCalls[1].key,textCalls[2].key);
 await page.locator('input[type=file]').setInputFiles({name:'ficticio.txt',mimeType:'text/plain',buffer:Buffer.from('prueba ficticia')});
 await page.getByRole('button',{name:'Enviar',exact:true}).click();await page.getByRole('alert').waitFor();
 assert.equal(calls.length,1); // no reenvío automático tras resultado incierto
 await page.getByRole('button',{name:'Enviar',exact:true}).click();
 await page.waitForFunction(()=>window.sent===1);
 assert.equal(calls[0].idempotencyKey,calls[1].idempotencyKey);
 await page.getByRole('button',{name:'Enviar ubicación',exact:true}).click();
 await page.getByLabel('Coordenadas o enlace de Google Maps').fill('0, 0');
 await page.getByRole('button',{name:'Enviar ubicación',exact:true}).filter({hasText:'Enviar ubicación'}).click();await page.getByRole('alert').waitFor();
 assert.equal(calls.length,3);
 await page.getByRole('button',{name:'Enviar ubicación',exact:true}).filter({hasText:'Enviar ubicación'}).click();await page.waitForFunction(()=>window.sent===2);
 assert.equal(calls[2].idempotencyKey,calls[3].idempotencyKey);
 await page.getByRole('button',{name:'Compartir contacto',exact:true}).click();
 await page.getByLabel('Nombre',{exact:true}).fill('Contacto ficticio');await page.getByLabel('Teléfono',{exact:true}).fill('000000000');
 await page.getByRole('button',{name:'Enviar contacto',exact:true}).click();await page.waitForFunction(()=>window.sent===3);
 assert.ok(calls[4].idempotencyKey);assert.notEqual(calls[3].idempotencyKey,calls[4].idempotencyKey);
 await page.evaluate(()=>window.setOpen(false));await page.getByLabel('Plantilla aprobada').selectOption('tpl_ficticia');
 await page.getByRole('button',{name:'Enviar plantilla',exact:true}).click();await page.getByRole('alert').waitFor();
 assert.equal(calls.length,6);
 await page.getByRole('button',{name:'Enviar plantilla',exact:true}).click();await page.waitForFunction(()=>window.sent===4);
 assert.equal(calls[5].idempotencyKey,calls[6].idempotencyKey);
 console.log('✓ texto, media, ubicación, contacto y plantilla: idempotencia/retry manual/409');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
