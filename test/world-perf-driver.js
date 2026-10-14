const { sb, ctx, vm } = require('/home/user/test/world-perf-proflib.js');
const size = process.argv[2] === 'big' ? [96,48] : process.argv[2] === 'medium' ? [64,36] : [48,28];
for (let i = 0; i < 400; i++) sb.topoCreateFreshWorld(size[0], size[1]);
console.log('listo', size.join('x'));
