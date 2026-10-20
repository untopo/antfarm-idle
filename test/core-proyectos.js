// test/core-proyectos.js — contrato puro de reservas, compromisos y un solo proyecto activo.
const P=require('../ant-farm-rpg/core/proyectos.js');
const E=require('../ant-farm-rpg/core/economia.js');
let ok=0,fail=0;
function check(name,cond,detail=''){if(cond){ok++;console.log('  ok  '+name);}else{fail++;console.log('  FAIL '+name+(detail?' → '+detail:''));}}

const defs=P.COLONY_PROJECT_ORDER.map(P.projectDefinition);
check('hay exactamente cuatro proyectos iniciales',defs.length===4&&defs.map(x=>x.name).join('|')==='CLAY JARS|FORWARD CACHE|TUNNEL BRACES|FUNGUS BED');
check('cada obra declara coste, trabajo, efecto y sacrificio',defs.every(d=>Object.keys(d.cost).length&&d.work>0&&d.effect&&d.tradeoff));

const book=P.createColonyProjects();
const ledger=E.createEconomyLedger({materials:{clay:10,fiber:8,wood:6,stone:5}});
book.setReserve('clay',4);ledger.setMaterialFloor('clay',4);
check('el mínimo configurable reduce disponibilidad, no el saldo',ledger.materials.clay===10&&ledger.materialAvailable('clay')===6);
const started=book.start('clay_jars',{c:4,r:8},ledger.availableMaterials(),{time:12});
check('CLAY JARS se aprueba con saldo disponible',started.ok,started.reason);
check('el saldo no baja al aprobar',ledger.materials.clay===10&&ledger.materials.fiber===8);
const held=ledger.holdMaterials(started.project.id,book.holds(),{reason:'test project'});
check('el compromiso es atómico y separado del saldo',!!held&&ledger.materialHeld('clay')===3&&ledger.materialAvailable('clay')===3);
check('herramientas no pueden gastar unidades retenidas',!ledger.payMaterials({clay:4},'ordinary tool')&&ledger.materials.clay===10);
check('un segundo proyecto queda rechazado',book.start('tunnel_braces',{c:8,r:9},ledger.availableMaterials()).reason==='one_active_project');

const pickBook=book.pickup('clay',1,{time:20});
const pickLedger=ledger.consumeHeldMaterial(started.project.id,'clay',1,{reason:'worker pickup'});
check('recoger mueve una unidad a tránsito y recién entonces baja el saldo',pickBook.ok&&pickLedger===1&&ledger.materials.clay===9&&book.active().inTransit.clay===1);
const delivery=book.deliver('clay',1,{time:22});
check('entrega física pasa tránsito a obra sin tocar otra vez el saldo',delivery.ok&&book.active().delivered.clay===1&&ledger.materials.clay===9);
check('trabajo no avanza antes de recibir todos los costes',book.addWork(999,'A1').reason==='materials_pending'&&book.active().work===0);
for(const kind of Object.keys(book.active().cost)){
  while(book.outstanding(kind)>0){
    const p=book.pickup(kind,1);const paid=ledger.consumeHeldMaterial(started.project.id,kind,1);
    if(!p.ok||paid!==1)break;
    book.deliver(kind,1);
  }
}
check('todas las unidades comprometidas fueron transportadas',book.allDelivered()&&Object.keys(book.holds()).length===0&&ledger.materialHeld('clay')===0);
const done=book.addWork(84,'A1',{time:40});
check('trabajo visible completa y archiva una sola obra',done.completed&&book.active()===null&&book.completedCount('clay_jars')===1&&done.project.builtBy[0]==='A1');
check('el coste total, no más, salió del saldo',ledger.materials.clay===7&&ledger.materials.fiber===6);

const cancelBook=P.createColonyProjects();
const cancelLedger=E.createEconomyLedger({materials:{wood:8,stone:7}});
const c=cancelBook.start('tunnel_braces',{c:5,r:7},cancelLedger.availableMaterials());
cancelLedger.holdMaterials(c.project.id,cancelBook.holds());
const cancelled=cancelBook.cancel();cancelLedger.releaseHold(c.project.id);
check('cancelar antes de recoger libera compromiso sin crear devolución',cancelled.ok&&cancelLedger.materials.wood===8&&cancelLedger.materialHeld('wood')===0);
const noSite=cancelBook.start('forward_cache',null,{clay:9,fiber:9,wood:9});
check('las obras espaciales exigen un sitio físico',!noSite.ok&&noSite.reason==='site_required');

const survival=E.createEconomyLedger({materials:{wood:3}});survival.setMaterialFloor('wood',1);survival.holdMaterials('CP-X',{wood:2});
check('gasto ordinario respeta mínimo y compromiso',survival.debitMaterial('wood',1)===0);
const emergencyPaid=survival.debitMaterial('wood',1,{survival:true});
const firstCommitted=survival.consumeHeldMaterial('CP-X','wood',1),secondCommitted=survival.consumeHeldMaterial('CP-X','wood',1);
check('una emergencia puede tomar prioridad sin inventar material',emergencyPaid===1&&survival.materials.wood===1&&survival.materialHeld('wood')===1&&firstCommitted===1&&secondCommitted===0);

const contextual=P.createColonyProjects();
const deep=contextual.proposals({storeBuilt:true,workers:12,gardens:2,fillRatio:.2,depthCells:29,longHaul:180,collapseRisk:0,digs:18,stock:{clay:8,fiber:8,wood:8,stone:8},available:{clay:8,fiber:8,wood:8,stone:8}},3);
const full=contextual.proposals({storeBuilt:true,workers:5,gardens:1,fillRatio:1.15,depthCells:8,longHaul:10,collapseRisk:0,digs:3,stock:{clay:8,fiber:8,wood:8,stone:8},available:{clay:8,fiber:8,wood:8,stone:8}},3);
const risky=contextual.proposals({storeBuilt:true,workers:5,gardens:1,fillRatio:.1,depthCells:12,longHaul:5,collapseRisk:9,digs:35,stock:{clay:3,fiber:3,wood:8,stone:8},available:{clay:3,fiber:3,wood:8,stone:8}},3);
const hungryGarden=contextual.proposals({storeBuilt:true,workers:22,gardens:0,fillRatio:.1,depthCells:7,longHaul:0,collapseRisk:0,digs:2,stock:{clay:8,fiber:20,wood:3,stone:3},available:{clay:8,fiber:20,wood:3,stone:3}},3);
check('las propuestas cambian con el estado real del mundo',deep[0].id==='forward_cache'&&full[0].id==='clay_jars'&&risky[0].id==='tunnel_braces'&&hungryGarden[0].id==='fungus_bed',[deep[0].id,full[0].id,risky[0].id,hungryGarden[0].id].join(' / '));
check('nunca se presentan más de tres propuestas',deep.length===3&&full.length===3&&risky.length===3&&hungryGarden.length===3);

const snap=P.createColonyProjects();snap.setReserve('fiber',3);const s=snap.start('fungus_bed',{c:7,r:10},{fiber:9,clay:9});snap.pickup('fiber',1);const saved=snap.snapshot();
const restored=P.createColonyProjects(saved);
check('snapshot conserva reserva, tránsito y proyecto activo',restored.reserve('fiber')===3&&restored.active().type==='fungus_bed'&&restored.active().inTransit.fiber===1);
const legacy=P.createColonyProjects();legacy.load(null);
check('una partida F sin campo de proyectos migra vacía',legacy.active()===null&&legacy.completed().length===0&&legacy.reserve('clay')===0);

console.log(`\n${ok} ok · ${fail} FALLOS`);
process.exit(fail?1:0);
