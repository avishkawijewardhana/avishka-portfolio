import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAdminServer } from './server.mjs';
import http from 'node:http';

test('local editor saves durable content, detects conflicts and protects files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-admin-'));
  const html = '<html><body><script id="portfolio-settings" type="application/json">{}</script><script src="./script.js"></script></body></html>';
  await writeFile(join(directory, 'index.html'), html);
  const server = createAdminServer(directory);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const initial = await (await fetch(origin + '/api/content')).json();
    assert.equal(initial.html, html);
    const post = (path, data, headers = {}) => fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Admin-Token': initial.token, ...headers }, body: JSON.stringify(data) });
    assert.equal((await post('/api/content', {}, { 'X-Admin-Token': 'wrong' })).status, 403);
    assert.equal((await post('/api/content', {}, { Origin: 'https://outside.example' })).status, 403);
    const badHostStatus = await new Promise((resolve, reject) => {
      http.get(origin + '/api/content', { headers: { Host: 'outside.example' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
    assert.equal(badHostStatus, 403);
    assert.equal((await fetch(origin + '/.git/config')).status, 404);
    assert.equal((await fetch(origin + '/admin/server.mjs')).status, 404);
    assert.equal((await post('/api/content', { html: 'broken', revision: initial.revision })).status, 400);
    const updated = html.replace('<body>', '<body><h1>Updated portfolio</h1>');
    const saved = await post('/api/content', { html: updated, revision: initial.revision });
    assert.equal(saved.status, 200);
    assert.equal(await readFile(join(directory, 'index.html'), 'utf8'), updated);
    assert.equal((await post('/api/content', { html, revision: initial.revision })).status, 409);
    assert.equal((await post('/api/upload', { name: 'bad.html', base64: 'YQ==' })).status, 400);
    const upload = await post('/api/upload', { name: '../../portrait.png', base64: 'aW1hZ2U=' });
    assert.equal(upload.status, 200);
    const asset = await upload.json();
    assert.match(asset.path, /^\.\/assets\/uploads\/[\w-]+\.png$/);
    assert.equal(await readFile(join(directory, asset.path), 'utf8'), 'image');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
