#!/usr/bin/env node
/* Servidor de desarrollo de Ant Farm RPG.
   Sirve ./ant-farm-rpg sin cache: con HTML nuevo y app.js viejo el juego se comporta raro y no
   se puede depurar. Uso:  node dev-server.js [puerto]   (por defecto 8017)  */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'ant-farm-rpg');
const PORT = Number(process.argv[2] || 8017);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json', '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('fuera de la raiz'); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('404 ' + p + '\n(raiz: ' + path.relative(__dirname, ROOT) + ')');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Ant Farm RPG en http://0.0.0.0:' + PORT + '/  (raiz ' + ROOT + ', sin cache)');
  console.log('Pruebas de navegador: node test/browser-smoke.js (usa su propio puerto 8123)');
});
server.on('error', e => { console.error('no se pudo escuchar el puerto ' + PORT + ': ' + e.code + ' - prueba con otro puerto'); process.exit(1); });
