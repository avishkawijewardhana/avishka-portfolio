import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf' };

export function createAdminServer(base = root) {
  const token = randomBytes(32).toString('hex');
  let saving = false;
  return http.createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${res.socket.localPort}`;
    const send = (status, value, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN' });
      res.end(type === 'application/json' ? JSON.stringify(value) : value);
    };
    try {
      const path = decodeURIComponent(new URL(req.url, origin).pathname);
      if (req.headers.host !== new URL(origin).host || (path.startsWith('/api/') && ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site'))) return send(403, { error: 'Use the local admin address printed in your terminal.' });
      if (req.method === 'GET' && path === '/api/content') {
        const html = await readFile(resolve(base, 'index.html'), 'utf8');
        return send(200, { html, revision: hash(html), token });
      }
      if (req.method === 'POST' && (path === '/api/content' || path === '/api/upload')) {
        if (req.headers['x-admin-token'] !== token || req.headers.origin !== origin) return send(403, { error: 'Invalid admin session. Reload the dashboard.' });
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 16 * 1024 * 1024) return send(413, { error: 'File too large. Maximum upload is 10 MB.' });
        }
        let data;
        try { data = JSON.parse(body); } catch { return send(400, { error: 'Invalid JSON.' }); }
        if (path === '/api/upload') {
          const extension = extname(String(data.name)).toLowerCase();
          if (!['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf'].includes(extension) || typeof data.base64 !== 'string') return send(400, { error: 'Use PNG, JPG, WebP, GIF or PDF.' });
          const bytes = Buffer.from(data.base64, 'base64');
          if (!bytes.length || bytes.length > 10 * 1024 * 1024) return send(400, { error: 'Upload must be between 1 byte and 10 MB.' });
          const name = `${String(data.name).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 60) || 'asset'}-${randomBytes(4).toString('hex')}${extension}`;
          await mkdir(resolve(base, 'assets/uploads'), { recursive: true });
          await writeFile(resolve(base, 'assets/uploads', name), bytes, { flag: 'wx' });
          return send(200, { path: `./assets/uploads/${name}` });
        }
        if (saving) return send(409, { error: 'A save is in progress. Try again.' });
        if (typeof data.html !== 'string' || !data.html.includes('<html') || !data.html.includes('id="portfolio-settings"') || !data.html.includes('./script.js')) return send(400, { error: 'Incomplete portfolio document.' });
        saving = true;
        try {
          const file = resolve(base, 'index.html');
          const current = await readFile(file, 'utf8');
          if (data.revision !== hash(current)) return send(409, { error: 'The portfolio changed outside this tab. Reload before editing again to avoid overwriting it.' });
          await writeFile(`${file}.tmp`, data.html, 'utf8');
          await rename(`${file}.tmp`, file);
          return send(200, { revision: hash(data.html) });
        } finally { saving = false; }
      }
      if (req.method !== 'GET') return send(405, { error: 'Method not allowed.' });
      if (path === '/admin') { res.writeHead(302, { Location: '/admin/' }); return res.end(); }
      const relative = path === '/' ? 'index.html' : path === '/admin' || path === '/admin/' ? 'admin/index.html' : path.slice(1);
      const file = resolve(base, relative);
      const allowed = ['index.html', 'styles.css', 'script.js', 'admin/index.html', 'admin/admin.js', 'admin/admin.css'].includes(relative) || relative.startsWith('assets/');
      if (!allowed || !file.startsWith(base + sep) || relative.split(/[\\/]/).some(part => part.startsWith('.'))) return send(404, { error: 'Not found.' });
      send(200, await readFile(file), mime[extname(file)] || 'application/octet-stream');
    } catch (error) {
      send(error.code === 'ENOENT' ? 404 : 500, { error: error.code === 'ENOENT' ? 'Not found.' : 'Could not complete request. Check your local files and try again.' });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createAdminServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port 4173 is busy. Close the other admin server and retry.' : error.message); process.exitCode = 1; });
  server.listen(4173, '127.0.0.1', () => console.log('Portfolio admin: http://127.0.0.1:4173/admin/\nKeep this terminal open. Press Ctrl+C to stop.'));
}
