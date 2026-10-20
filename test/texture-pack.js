// test/texture-pack.js — contrato del atlas reutilizable, sin navegador ni dependencias externas.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..','ant-farm-rpg');
let ok=0,fail=0;
function check(name,cond,extra){if(cond){ok++;console.log('  ok  '+name);}else{fail++;console.log('  FALLO '+name+(extra!==undefined?' → '+extra:''));}}
const jsonPath=path.join(root,'assets','textures','colony-atlas.json');
const pngPath=path.join(root,'assets','textures','colony-atlas.png');
const jsPath=path.join(root,'assets','textures','colony-atlas.manifest.js');
const manifest=JSON.parse(fs.readFileSync(jsonPath,'utf8'));
const png=fs.readFileSync(pngPath);
check('el atlas PNG tiene firma válida',png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
const width=png.readUInt32BE(16),height=png.readUInt32BE(20),colorType=png[25];
check('la hoja ampliada mide 256 × 320',width===256&&height===320,width+'×'+height);
check('la hoja conserva transparencia RGBA',colorType===6,'PNG color type '+colorType);
check('manifest y PNG declaran las mismas dimensiones',manifest.meta.width===width&&manifest.meta.height===height);
const entries=Object.entries(manifest.sprites||{});
check('el catálogo ampliado reúne 80 sprites estables',entries.length===80,entries.length);
const rects=new Set();let bounds=true,pivots=true,namespaced=true;
for(const [name,s] of entries){
  const key=[s.x,s.y,s.w,s.h].join(',');if(rects.has(key))bounds=false;rects.add(key);
  if(s.x<0||s.y<0||s.w<=0||s.h<=0||s.x+s.w>width||s.y+s.h>height)bounds=false;
  if(!s.pivot||s.pivot.x<0||s.pivot.y<0||s.pivot.x>s.w||s.pivot.y>s.h)pivots=false;
  if(!name.includes('.'))namespaced=false;
}
check('cada rectángulo es único y queda dentro de la hoja',bounds);
check('cada sprite declara un pivote válido',pivots);
check('todos los nombres están en un namespace legible',namespaced);
const required=['project.clay_jars','project.clay_jars_empty','project.forward_cache','project.forward_cache_full','project.tunnel_braces','project.tunnel_braces_reinforced','project.fungus_bed','project.worksite','project.worksite_foundation',
  'overflow.honey','overflow.berry','overflow.mushroom','overflow.seed','overflow.grain','state.cache_disabled','state.cache_flooded',
  'cargo.clay_brick','cargo.beam','cargo.fiber_bundle','cargo.stone_block','material.fiber','material.stone',
  'structure.store','structure.store_full','structure.workshop','structure.granary','structure.bridge','structure.tower','structure.mound',
  'crop.fungus_bed','crop.fungus_dry','crop.fungus_seedling'];
check('incluye toda estructura fabricada, cultivos, estados y cargas requeridos',required.every(k=>manifest.sprites[k]),required.filter(k=>!manifest.sprites[k]).join(', '));
const sandbox={globalThis:{}};vm.runInNewContext(fs.readFileSync(jsPath,'utf8'),sandbox,{filename:jsPath});
check('el manifiesto JS replica exactamente el JSON',JSON.stringify(sandbox.globalThis.COLONY_TEXTURE_MANIFEST)===JSON.stringify(manifest));
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pManifest=index.indexOf('colony-atlas.manifest.js'),pLoader=index.indexOf('js/texture-pack.js'),pApp=index.indexOf('js/app.js');
check('HTML carga manifiesto y runtime antes de app.js',pManifest>=0&&pLoader>pManifest&&pApp>pLoader);
const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
check('proyectos terminados se dibujan por nombre con variantes y fallback',app.includes("'project.clay_jars_empty'")&&app.includes("'project.forward_cache_full'")&&app.includes("'project.tunnel_braces_reinforced'")&&app.includes("'project.worksite_foundation'"));
check('estructuras, cultivos, herramientas y cargas usan la hoja común',app.includes("['structure.'+s.type]")&&app.includes("'crop.fungus_seedling'")&&app.includes("'tool.'+ant.tool")&&app.includes("cargo.fiber_bundle")&&app.includes("_drawCarriedTexture"));
check('el excedente físico usa sprites tipados del atlas',app.includes("'overflow.'+(_fk==='grassSeed'?'grain':_fk)"));
const runtime=fs.readFileSync(path.join(root,'js','texture-pack.js'),'utf8');
check('el runtime resuelve variantes futuras sin coordenadas nuevas',runtime.includes('function resolve(names)')&&runtime.includes('function drawFirst(')&&runtime.includes('function drawVariant('));
const docs=fs.readFileSync(path.join(root,'docs','TEXTURE_PACK.md'),'utf8');
check('el catálogo documenta API y flujo de ampliación',docs.includes('No gameplay code may hard-code atlas coordinates')&&docs.includes('## Adding a texture')&&docs.includes('`project.clay_jars`'));
const generator=fs.readFileSync(path.join(root,'scripts','generate-colony-atlas.py'),'utf8');
check('la hoja es reproducible desde una fuente versionada',generator.includes('SPECS = [')&&generator.includes('atlas.save(PNG_PATH'));
console.log('\n'+ok+' ok · '+fail+' FALLOS');process.exit(fail?1:0);
