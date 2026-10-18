/** Prueba real del componente en Chromium, sin API, base ni datos de pacientes. */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const result = await build({
  stdin: { contents: `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {ConversationActions} from './src/components/inbox/conversation-actions';
    function Harness() {
      const [enabled,setEnabled]=useState(true);
      const [deleted,setDeleted]=useState(false);
      return deleted ? <p>Conversación eliminada</p> : <ConversationActions
        conversation={{id:'cv_ficticia',aiEnabled:enabled,handoffAt:null}}
        onToggle={async (next) => { await new Promise(resolve => window.finish=resolve); setEnabled(next); }}
        onDelete={async () => { if(window.failDelete) throw Error('Error ficticio. Intenta de nuevo.'); setDeleted(true); }}
      />;
    }
    createRoot(document.getElementById('root')).render(<Harness/>);
  `, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'browser', jsx: 'automatic',
  alias: { '@': resolve('src') },
});
const server = createServer((req,res) => {
  res.setHeader('content-type', req.url === '/bundle.js' ? 'text/javascript' : 'text/html');
  res.end(req.url === '/bundle.js' ? result.outputFiles[0].text : '<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button',{name:'Tomar conversación',exact:true}).click();
  await page.getByRole('button',{name:'Procesando…'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Eliminar conversación',exact:true}).isDisabled(),true);
  await page.evaluate(() => window.finish());
  await page.getByText('Eli pausada · atención humana',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Devolver a Eli',exact:true}).click();
  await page.evaluate(() => window.finish());
  await page.getByRole('button',{name:'Tomar conversación',exact:true}).waitFor();
  const trigger = page.getByRole('button',{name:'Eliminar conversación',exact:true});
  await trigger.click();
  const modal = page.getByRole('dialog');
  await modal.waitFor();
  assert.equal(await page.getByRole('button',{name:'Cancelar',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Escape');
  assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  await trigger.focus(); await page.keyboard.press('Enter');
  await modal.waitFor();
  await page.evaluate(()=>window.failDelete=true);
  await modal.getByRole('button',{name:'Eliminar conversación',exact:true}).click();
  await page.getByRole('alert').getByText('Error ficticio. Intenta de nuevo.').waitFor();
  assert.equal(await modal.isVisible(),true);
  await page.evaluate(()=>window.failDelete=false);
  await modal.getByRole('button',{name:'Eliminar conversación',exact:true}).click();
  await page.getByText('Conversación eliminada',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('✓ toma/devolución, pending, teclado/foco, error y eliminación confirmada');
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
