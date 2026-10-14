const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');
const [c, r] = process.argv[2] === 'big' ? [96, 48] : process.argv[2] === 'medium' ? [64, 36] : [48, 28];
sb.topoCreateFreshWorld(c, r);
vm.runInContext('paused=false; gameSpeed=1;', ctx);
// 260 frames de simulación + render, como en juego
const t0 = Date.now();
for (let i = 0; i < 260; i++) vm.runInContext('loop(performance.now());', ctx);
const ms = Date.now() - t0;
const st = vm.runInContext('({ants:workers.length, cells:COLS*ROWS, day, food:colonyFood})', ctx);
console.log(`${c}x${r}: ${ms} ms para 260 frames -> ${(ms / 260).toFixed(2)} ms/frame · ${JSON.stringify(st)}`);
