const fs = require('fs');
const dir = process.argv[2];
const f = fs.readdirSync(dir).filter(x => x.endsWith('.cpuprofile'))[0];
const p = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8'));
const byId = new Map(p.nodes.map(n => [n.id, n]));
const self = new Map();
const total = p.samples.length;
const dt = (p.endTime - p.startTime) / total;
for (const s of p.samples) self.set(s, (self.get(s) || 0) + 1);
const rows = [...self.entries()].map(([id, n]) => {
  const nd = byId.get(id);
  const cf = nd.callFrame;
  const name = (cf.functionName || '(anon)') + '  ' + (cf.url || '').split('/').pop() + ':' + (cf.lineNumber + 1);
  return { name, ms: (n * dt) / 1000, pct: (100 * n) / total };
}).sort((a, b) => b.ms - a.ms).slice(0, 14);
const wall = (p.endTime - p.startTime) / 1000;
console.log(`\n== ${dir}  (muestreo ${Math.round(wall)} ms de CPU) ==`);
for (const r of rows) console.log(`${r.pct.toFixed(1).padStart(5)}%  ${r.ms.toFixed(1).padStart(8)} ms  ${r.name}`);
