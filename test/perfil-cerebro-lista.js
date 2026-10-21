/**
 * Historical filename, new contract (2026-10-21).
 *
 * This test used to require five profile tabs, a neural graph, 11 sensor values and five
 * raw outputs. That requirement directly contradicted the current product decision: profiles
 * are now one-view decision cards. Neural simulation remains in app.js; its debug readout is
 * not part of the normal worker or queen profile.
 *
 * The full browser/geometry contract lives in test/hojas-legibles.js. This fast guard makes
 * the removal explicit so the obsolete UI cannot quietly return.
 */
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'ant-farm-rpg/index.html'),'utf8');
const js=fs.readFileSync(path.join(ROOT,'ant-farm-rpg/js/app.js'),'utf8');
let pass=0,fail=0;
const ok=(v,m)=>{if(v){pass++;console.log('  ok   '+m);}else{fail++;console.log('  FAIL '+m);}};
const between=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const worker=between(html,'id="antProfile"','id="queenProfile"');
const queen=between(html,'id="queenProfile"','<!-- CONTROLES ESQUINA FIJA');

console.log('\n· compact profile contract');
ok(!/data-ptab|profileTabs|profileTab_/.test(worker),'worker has no tabs');
ok(!/data-qtab|queenProfileTabs|queenTab_/.test(queen),'queen has no tabs');
ok(!/profileNn|profileMind|btnCerebroNumeros|profileTree|profileHistory/.test(worker),'worker has no brain, tree or personal-history widgets');
ok(!/queenDnaStr|queenGenomeId|queenProfileTree|queenProfileHistory|queenProfilePersonalities|queenProfileTraits/.test(queen),'queen has no DNA, lineage, history or trait grids');
ok(/id="profileIdentity"/.test(worker)&&/id="profileTask"/.test(worker)&&/id="profileCondition"/.test(worker),'worker keeps identity, current task and condition');
ok(/id="btnFollowAnt"/.test(worker)&&/id="btnExileAnt"/.test(worker),'worker keeps only useful map/exile actions');
ok(/id="queenProfileIdentity"/.test(queen)&&/id="queenProfileTask"/.test(queen)&&/id="queenProfileCondition"/.test(queen),'queen keeps identity, current task and condition');
ok(/id="queenProgressLbl"/.test(queen)&&/id="btnFeedQueen"/.test(queen),'queen keeps egg progress and the feed decision');
ok(!/profileTab_cerebro|pintarCerebroHoja|_cerebroNums|btnCerebroNumeros/.test(js),'obsolete profile-brain runtime wiring is absent');
ok(/const PROFILE_TASKS/.test(js)&&/function _profileConditionText/.test(js),'plain-language task and condition summaries own the profile');
ok(/ROSTRO_GRUPOS=\[\['TODAS','ALL'\],\['REINA','QUEENS'\],\['OBRERA','WORKERS'\]\]/.test(js),'roster exposes exactly ALL, QUEENS and WORKERS');
ok(!/GEN \+ \(\(a\.genome|edad|ageD.*GEN/.test(between(js,'function pintarRoster','function abrirRoster')),'roster renderer does not print age or generation');
console.log(`\n${pass} ok · ${fail} FAILURES`);
process.exit(fail?1:0);
