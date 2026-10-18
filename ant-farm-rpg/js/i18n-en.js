/* ANT FARM — English presentation layer.
 *
 * Simulation identifiers remain stable (many saves contain the original internal role/state names),
 * while every string presented through the DOM or a canvas is rendered in English. This keeps old
 * farms compatible and lets the simulation continue evolving independently of the display language.
 */
(function (root) {
  'use strict';

  const phrases = [
    [/Elige qué hacer • Forja tu colonia/gi, 'Choose your path • Forge your colony'],
    [/Tamaños asesorados para tu equipo/gi, 'Sizes tuned for your device'],
    [/ELIGE TAMAÑO DEL MUNDO/gi, 'CHOOSE WORLD SIZE'],
    [/Hecho con Topo/gi, 'Made with Topo'],
    [/1 — PON MIEL/gi, '1 — DROP HONEY'],
    [/2 — CAVA/gi, '2 — DIG'],
    [/3 — MÍRALAS/gi, '3 — WATCH THEM'],
    [/¡A JUGAR!/gi, 'PLAY!'],
    [/Mantén/gi, 'Hold'],
    [/en la tierra para cavar túneles\./gi, 'underground to dig tunnels.'],
    [/Toca una hormiga para ver su ficha\. Arriba verás tu/gi, 'Tap an ant to open her profile. Your live'],
    [/en vivo\./gi, 'is shown above.'],
    [/¡Mundo listo!/gi, 'World ready!'],
    [/Pinta ⬢ CIAN y vuelve\./gi, 'She paints ⬢ CYAN and returns.'],
    [/Pinta ⬢ CYAN y vuelve\./gi, 'She paints ⬢ CYAN and returns.'],
    [/\bva a (?:cavar|dig)\b/gi, 'goes to dig'],
    [/\bVA A (?:CAVAR|DIG)\b/g, 'GOES TO DIG'],
    [/todas ([0-9]+)/gi, 'all $1'],
    [/chicas ([0-9]+)/gi, 'minims $1'],
    [/soldadoras ([0-9]+)/gi, 'soldiers $1'],
    [/Día ([0-9]+) de ([^•\n]+) • Año ([0-9]+) • Semana ([0-9]+) \(([^)]+)\)/gi, 'Day $1 of $2 • Year $3 • Week $4 ($5)'],
    [/Day ([0-9]+) de ([^•\n]+) • Year ([0-9]+) • Week ([0-9]+) \(([^)]+)\)/gi, 'Day $1 of $2 • Year $3 • Week $4 ($5)'],
    [/Day ([0-9]+) de ([^-\n]+) - Year/gi, 'Day $1 of $2 - Year'],
    [/\bALE\b/g, 'JOY'],
    [/\bIRA\b/g, 'ANGR'],
    [/\bMIE\b/g, 'FEAR'],
    [/\bTRI\b/g, 'SAD'],
    [/\bLEA\b/g, 'LOY'],
    [/\bEST\b/g, 'STRS'],
    [/\bCUID\b/g, 'CARE'],
    [/Móvil o PC modesta · colonia corta/gi, 'Mobile or modest PC · small colony'],
    [/PC buena · colonia larga/gi, 'Fast PC · large colony'],
    [/Click en un tamaño para crear → verás guía rápida/gi, 'Choose a size to create → quick guide follows'],
    [/Arte pixel 16-BIT • Motor propio/gi, '16-BIT pixel art • Custom engine'],
    [/GIGANTE · 16-BIT · LECTURA INSTANTÁNEA/gi, 'LARGE · 16-BIT · READ AT A GLANCE'],
    [/Icono \+ número • hover para detalle/gi, 'Icon + number • hover for details'],
    [/CLICK = MIEL · SHIFT\+CLICK = CAVAR · CLICK HORMIGA = SEGUIR/gi, 'CLICK = HONEY · SHIFT+CLICK = DIG · CLICK ANT = FOLLOW'],
    [/PIXEL REAL · CAVADO ANIMADO/gi, 'REAL PIXELS · ANIMATED DIGGING'],
    [/ARRASTRA · RUEDA ZOOM · DOBLE CLICK CENTRA/gi, 'DRAG · WHEEL TO ZOOM · DOUBLE-CLICK TO CENTER'],
    [/100=real/gi, '100=baseline'],
    [/NODOS/gi, 'NODES'],
    [/QUÉ TAN BIEN LE VA/gi, 'HOW WELL SHE IS DOING'],
    [/LO QUE ESTA PENSANDO/gi, 'WHAT SHE IS THINKING'],
    [/ver numeros/gi, 'show numbers'],
    [/ocultar los números/gi, 'hide numbers'],
    [/RASGOS BASE \(genoma\)/gi, 'BASE TRAITS (genome)'],
    [/HUEVOS TOTAL/gi, 'TOTAL EGGS'],
    [/CRÍAS \/ COLONIA/gi, 'BROOD / COLONY'],
    [/SEASON PROGR\./gi, 'SEASON PROGRESS'],
    [/WORLD AGE/gi, 'WORLD AGE'],
    [/OBRERAS ▾ LISTA/gi, 'WORKERS ▾ LIST'],
    [/Historia importante \(inventos, religión, crímenes\)/gi, 'Important history (inventions, religion, crimes)'],
    [/huevo de reina/gi, 'queen egg'],
    [/¿Sobrescribir tu granja actual\?/gi, 'Overwrite your current farm?'],
    [/¿Borrar todo\?/gi, 'Delete everything?'],
    [/¿Seguro\?/gi, 'Are you sure?'],
    [/EL MOTOR NO ARRANCO/gi, 'THE ENGINE DID NOT START'],
    [/Cada tamaño trae sus propias cuentas:[\s\S]*?cargar después\./gi, 'Each size has its own balance: more land, buried chests, pantry jars, and mouths to feed. Work scales with the terrain: SMALL runs lightly, BIG supports a longer colony, and MEDIUM is the balanced choice. You can create several farms and load them later.'],
    [/Cada tamaño trae sus propias cuentas: más terreno, más cofres enterrados, más tarros en la despensa y más bocas que alimentar\. Y el trabajo va con el terreno, no por decreto: un/gi, 'Each size has its own balance: more land, buried chests, pantry jars, and mouths to feed. Work scales with the terrain:'],
    [/siembra y se mueve más suelto que un/gi, 'runs lighter than'],
    [/es el parejo\. Puedes crear varias granjas y cargar después\./gi, 'is the balanced choice. You can create several farms and load them later.'],
    [/Si cierras la pestaña, tu granja sigue viviendo en tiempo normal \(no acelerado\) y la recuperas aquí\./gi, 'If you close the tab, your farm keeps living at normal speed and will be waiting here.'],
    [/Tu granja se guarda sola cada 4 segundos\./gi, 'Your farm saves itself every 4 seconds.'],
    [/ESC abre este menú desde el juego\./gi, 'ESC opens this menu during play.'],
    [/Toca el pasto verde de arriba para soltar miel\./gi, 'Tap the green meadow above to drop honey.'],
    [/Mantén SHIFT \+ click en la tierra para cavar túneles\./gi, 'Hold SHIFT and click underground to dig tunnels.'],
    [/Toca una hormiga para ver su ficha\. Arriba verás tu economía en vivo\./gi, 'Tap an ant to open its profile. Your live economy is shown above.'],
    [/Cada bloque da forma a tu hogar/gi, 'Every block shapes your home'],
    [/Colonia despierta\. Todo es pixel gordo y legible\. Mira las burbujas sobre cada hormiga\./gi, 'The colony awakens. Chunky, readable pixels show every ant at work.'],
    [/Lee sin leer:[\s\S]*?sin letras raras\./gi, 'Read at a glance: every ant carries a large status bubble. Honey to home means delivery; DIG shows excavation progress; cyan symbols call out food. Pure readable pixel art.'],
    [/Pinta tinta — más alto = más charla/gi, 'Paints ink — higher means more communication'],
    [/SVO\/SOV \+ sufijos reales • como simlish pero evoluciona a idioma real traducible/gi, 'SVO/SOV plus real suffixes — evolving from babble into a translatable language'],
    [/Tinta:[\s\S]*?otras la leen\./gi, 'Ink: cyan means food, yellow means help, and magenta marks discoveries; ants paint the ground and others read it.'],
    [/Pincha una fila para abrir su perfil y su cerebro\./gi, 'Select a row to open that ant’s profile and mind.'],
    [/Su cuerpo y sus antenas le dicen estas cosas, y de ahí sale lo que hace\./gi, 'Her body and antennae provide these signals; her actions emerge from them.'],
    [/Cada cuadro es una neurona\.[\s\S]*?T2\)\./gi, 'Each box is a neuron. Green lines excite and red lines inhibit; thicker lines have more influence. LEFT is perception, CENTER combines it, and RIGHT decides TURN, SPEED, DIG, T1, and T2.'],
    [/Fertilidad=huevos\/día • Feromona=control • Maternal=cuidado/gi, 'Fertility=eggs/day • Pheromone=control • Maternal=care'],
    [/RASGOS · de 0 a 100/gi, 'TRAITS · from 0 to 100'],
    [/Lo suyo: ([^(]+) \(([0-9]+) de 100\)\. Lo que menos: ([^(]+) \(([0-9]+)\)\./gi, 'Best trait: $1 ($2 of 100). Weakest: $3 ($4).'],
    [/hace ([0-9]+) segundos/gi, '$1 seconds ago'],
    [/([0-9]+) min reales/gi, '$1 min real time'],
    [/tope ([0-9]+)/gi, 'cap $1'],
    [/Ve lejos/gi, 'Sees far'],
    [/fundación pixel/gi, 'pixel foundation'],
    [/feromonas - hormigas reales/gi, 'pheromones — real ants'],
    [/llamada de feromona/gi, 'pheromone call'],
    [/Este es tu vidrio\. Obsérvalas, aliméntalas y ve cómo construyen su mundo\./gi, 'This is your observation glass. Watch them, feed them, and see how they build their world.'],
    [/IR AL ALMACÉN/gi, 'GO TO STORAGE'],
    [/sin colonia — elige un tamaño/gi, 'No colony — choose a size'],
    [/LINAJE REAL/gi, 'ROYAL LINEAGE'],
    [/([0-9]+) ent • ([0-9]+) exc/gi, '$1 deliveries • $2 digs'],
    [/Ink: ⬢ CYAN = food, ⬣ AMARILLO = help, ◆ MAGENTA — pintan the soil and others the leen\./gi, 'Ink: ⬢ CYAN = food, ⬣ YELLOW = help, ◆ MAGENTA = discovery; ants paint the ground and others read it.'],
    [/La colonia siguió mientras no mirabas/gi, 'The colony continued while you were away'],
    [/La pradera respira\. El pasto crece poco a poco\. Riega con lluvia natural\./gi, 'The meadow breathes. Grass grows slowly and natural rain waters it.'],
    [/Florecen las primeras flores\. Las hormigas ya cosechan néctar\./gi, 'The first flowers bloom. Ants can now harvest nectar.'],
    [/Arbustos de bayas aparecen donde hay fertilidad\. El mundo se diversifica\./gi, 'Berry bushes appear on fertile ground. The world grows more diverse.'],
    [/¡Materiales! Cavan piedra, arcilla y arena según la capa\. Ya inventan\./gi, 'Materials discovered! They mine stone, clay, and sand by layer and begin inventing.'],
    [/Bosquecillos jóvenes crecen\. Hongos en cuevas húmedas\. Sigue lloviendo\./gi, 'Young groves grow. Fungi spread through damp caves. Rain continues.'],
    [/No hay granjas guardadas todavía\./gi, 'There are no saved farms yet.'],
    [/Crea una desde el menú y se guardará sola cada 4 segundos\./gi, 'Create one from the menu; it will save itself every 4 seconds.'],
    [/Se van la granja guardada y el archivo completo\. No hay vuelta atrás\./gi, 'The active farm and the complete archive will be deleted. This cannot be undone.'],
    [/Al crear otra, la actual pasa a «Archivadas» y podrás recuperarla desde CARGAR\./gi, 'When you create another farm, the current one moves to Archived and remains available from LOAD.'],
    [/Reintenta desde CREAR NUEVA GRANJA\. Si se repite, recarga \(Ctrl\+Shift\+R\): la colonia se guarda sola cada pocos segundos\./gi, 'Try CREATE NEW FARM again. If it repeats, hard-refresh with Ctrl+Shift+R; the colony saves itself every few seconds.'],
    [/Tu colonia te espera/gi, 'Your colony is waiting'],
    [/Toca el pasto/gi, 'Tap the meadow'],
    [/Toca una hormiga/gi, 'Tap an ant'],
    [/La colonia huele piedra mojada y algo mas duro/gi, 'The colony smells wet stone and something harder'],
    [/el mapa llega a ([0-9]+) filas/gi, 'the map reaches $1 rows'],
    [/la losa de la fila ([0-9]+) cedio/gi, 'the slab on row $1 gave way'],
    [/El mundo crece a ([0-9]+) filas - las excavadoras llegaron al fondo/gi, 'The world grows to $1 rows — the diggers reached the bottom'],
    [/progresivo: más profundo = más duro y más recompensas/gi, 'progressive: deeper means harder and more rewarding'],
    [/Inundación detectada: una obrera prepara un dique/gi, 'Flood detected: a worker prepares a barrier'],
    [/Techo drenante: corta el agua sin cerrar el paso de las hormigas/gi, 'Drainage cover: blocks water without closing the ants’ path'],
    [/Dique de arcilla; el agua fue desplazada, no borrada/gi, 'Clay barrier; water was displaced, not deleted'],
    [/Dique de tierra compactada; el agua fue desplazada, no borrada/gi, 'Packed-earth barrier; water was displaced, not deleted'],
    [/Ya usan PIEDRA para reforzar túneles/gi, 'They now reinforce tunnels with STONE'],
    [/¡Inventaron mampostería de piedra!/gi, 'They invented stone masonry!'],
    [/Tapial \+ arcilla apisonada/gi, 'Rammed earth plus packed clay'],
    [/¡Dominan la arcilla!/gi, 'They mastered clay!'],
    [/Trenzan briznas y hojas para techar/gi, 'They weave blades and leaves into roofing'],
    [/¡Tejen fibra vegetal!/gi, 'They can weave plant fiber!'],
    [/Usan RAMAS del arbolito para apuntalar/gi, 'They use BRANCHES to shore up tunnels'],
    [/¡Carpintería básica!/gi, 'Basic carpentry!'],
    [/Granja subterránea de hongos/gi, 'Underground fungus farm'],
    [/¡Granja de hongos subterránea!/gi, 'Underground fungus farming!'],
    [/La colonia alimenta una heredera antes de que muera la reina/gi, 'The colony feeds an heir before the queen dies'],
    [/La colonia prepara heredera antes de la vejez/gi, 'The colony prepares an heir before old age'],
    [/la reina espera a la heredera que ya crece/gi, 'the queen waits for the growing heir'],
    [/la reina se aguanta: aún no hay heredera/gi, 'the queen holds on: there is no heir yet'],
    [/Llevaba un día entero sin fuerzas - la colonia da paso a la heredera/gi, 'She spent a full day without strength; the colony makes way for the heir'],
    [/La colonia no se rinde/gi, 'The colony will not give up'],
    [/La colonia alimenta una larva para salvar la corona/gi, 'The colony feeds a larva to save the crown'],
    [/Metamorfosis extrema por supervivencia/gi, 'Extreme metamorphosis for survival'],
    [/Una nodriza se transforma en reina por supervivencia/gi, 'A nurse transforms into a queen for survival'],
    [/gesta una futura reina/gi, 'carries a future queen'],
    [/Larva muere de hambre - sin nodriza ni despensa/gi, 'Larva starves — no nurse and no pantry food'],
    [/Guerra civil posible - Facciones:/gi, 'Possible civil war — factions:'],
    [/Sin reina viva:/gi, 'With no living queen:'],
    [/La cria refunda la dinastia/gi, 'The brood restores the dynasty'],
    [/Pupa espera: colonia en tope ([0-9]+)/gi, 'Pupa waits: colony at cap $1'],
    [/No se pierde: eclosiona en cuanto quede una plaza/gi, 'It is not lost: it hatches as soon as a slot opens'],
    [/Jardín fúngico perdido - le cavaron el suelo de debajo/gi, 'Fungus garden lost — its supporting floor was excavated'],
    [/Jardín fúngico muere - falta cuidado\/humedad/gi, 'Fungus garden dies — it lacks care or moisture'],
    [/Las obreras aprenden a mantener el hongo donde tiran el sustrato/gi, 'Workers learn to tend fungus where they leave substrate'],
    [/Nuevo jardín fúngico, en el rincón que ellas usan/gi, 'New fungus garden in the corner the ants chose'],
    [/No hay ninguna en este filtro\./gi, 'No ants match this filter.'],
    [/la colonia no cabe entera en una hoja: usa los filtros/gi, 'the whole colony does not fit on one sheet; use the filters'],
    [/Shift\+Click solo bajo tierra cerca del borde\./gi, 'Shift-click only works underground near the frontier.'],
    [/Suelta miel y espera entregas\./gi, 'Drop honey and wait for deliveries.'],
    [/La reina aún no puso huevos\./gi, 'The queen has not laid any eggs yet.'],
    [/Sin descendencia registrada aún - pon el primer huevo/gi, 'No offspring recorded yet — lay the first egg'],
    [/Sin historial - es joven\. Cada huevo y migración quedará aquí\./gi, 'No history yet — she is young. Every egg and migration will appear here.'],
    [/Necesitas 2 🍯 para alimentar a la reina/gi, 'You need 2 🍯 to feed the queen'],
    [/Cava una sala más grande primero/gi, 'Excavate a larger chamber first'],
    [/Brote - todo germina/gi, 'Sprout — everything germinates'],
    [/Sol - calor y cosecha rápida/gi, 'Sun — heat and fast harvest'],
    [/Cosecha - bayas y hongos/gi, 'Harvest — berries and fungi'],
    [/Escarcha - lento y frío/gi, 'Frost — slow and cold'],
    [/Granja lista: túneles claros, suelo oscuro, colonia activa/gi, 'Farm ready: clear tunnels, dark soil, active colony'],
    [/Cada hormiga muestra qué hace con su burbuja/gi, 'Every ant shows her current task in a status bubble'],
    [/Tu granja está lista\./gi, 'Your farm is ready.'],
    [/Mira las burbujas:/gi, 'Read the bubbles:'],
    [/Pulsa para entrar/gi, 'Press to enter'],
    [/Pradera fértil en expansión/gi, 'Expanding fertile meadow'],
    [/Cofres según quepa en el terreno/gi, 'Chests placed to fit the terrain'],
    [/Llamando a la fundadora/gi, 'Calling the foundress'],
    [/Reina \+ obreras listas/gi, 'Queen and workers ready'],
    [/js\/app\.js no termino de cargar\. Suele ser cache vieja: recarga forzada \(Ctrl\+Shift\+R\)\./gi, 'js/app.js did not finish loading. This is usually stale cache; hard-refresh with Ctrl+Shift+R.'],
    [/error de carga/gi, 'load error'],
    [/Facción nueva por decisión del jugador/gi, 'New faction created by player decision'],
    [/Guía 1-a-1 a comida - colonia pequeña/gi, 'One-to-one guide to food — small colony'],
    [/La naturaleza evita extinción/gi, 'Nature prevents extinction'],
    [/Las arquitectas mudan la despensa a cámara más amplia/gi, 'Architects move the pantry to a larger chamber'],
    [/La reina se muda a palacio más amplio y bonito/gi, 'The queen moves to a larger, finer palace'],
    [/No estaba en granero\/despensa - Dwarf Fortress stockpile/gi, 'It was outside the granary or pantry — Dwarf Fortress stockpile rule'],
    [/Nada asombroso todavia\. Hay que bajar a la PIZARRA o mas hondo para encontrar reliquias\./gi, 'Nothing remarkable yet. Reach SLATE or deeper to find relics.'],
    [/Pupa espera/gi, 'Pupa waiting'],
    [/Última reina muerta → nodriza asciende/gi, 'Last queen dead → nurse ascends'],
    [/La reina sacrifica vida para no extinguirse/gi, 'The queen sacrifices health to prevent extinction'],
    [/la colonia no muere/gi, 'the colony survives'],
    [/la colonia sigue viva/gi, 'the colony remains alive'],
    [/la colonia crece/gi, 'the colony grows'],
    [/la colonia sobrevive/gi, 'the colony survives'],
    [/la colonia busca heredera/gi, 'the colony seeks an heir'],
    [/la colonia atesora/gi, 'the colony stores'],
    [/la colonia diseña sus cuartos/gi, 'the colony designs its rooms'],
    [/la colonia no cabe/gi, 'the colony does not fit'],
    [/sin reina viva/gi, 'with no living queen'],
    [/sin padres registrados/gi, 'no recorded parents'],
    [/sin palabras fijas aún/gi, 'no fixed words yet'],
    [/sin idioma aún/gi, 'no language yet'],
    [/sin palabra aún/gi, 'no word yet'],
    [/sin raíz fija/gi, 'no stable root'],
    [/sin culto/gi, 'no cult'],
    [/sin reporte/gi, 'no report'],
    [/sin cámara excavada/gi, 'no excavated chamber'],
    [/colonia única/gi, 'single colony'],
    [/falta cuidado\/humedad/gi, 'needs care or moisture'],
    [/falta cantería/gi, 'requires masonry'],
    [/más boca que alimentar/gi, 'more mouths required'],
    [/más profundo = más duro/gi, 'deeper means harder'],
    [/no hay crías/gi, 'there is no brood'],
    [/no puedes poner huevo/gi, 'cannot lay an egg'],
    [/no hay cámara mejor/gi, 'there is no better chamber'],
    [/no se puede cavar aquí/gi, 'cannot dig here'],
    [/muy lejos del frente/gi, 'too far from the frontier'],
    [/aún cavan tierra común/gi, 'still digging ordinary soil'],
    [/nada asombroso todavía/gi, 'nothing remarkable yet'],
    [/la losa del fondo aguanta/gi, 'the bottom slab holds'],
    [/el fondo ya es minable/gi, 'the bottom can now be mined'],
    [/próximo huevo/gi, 'next egg'],
    [/huevo en camino/gi, 'egg on the way'],
    [/Reina gestando/gi, 'Queen is gestating'],
    [/mundo recién creado/gi, 'newly created world'],
    [/mundo nuevo/gi, 'new world'],
    [/mundo vivo/gi, 'living world'],
    [/historia importante/gi, 'important history'],
    [/idioma completo/gi, 'complete language'],
    [/proto-idioma/gi, 'proto-language'],
    [/señales simples/gi, 'simple signals'],
    [/balbuceo inicial/gi, 'early babble'],
    [/lengua pasó a/gi, 'language changed to'],
    [/Última mutación/gi, 'Latest mutation'],
    [/inicialización/gi, 'initialization'],
    [/mordida ([0-9]+)%/gi, '$1% damaged'],
    [/([0-9]+) excavadoras cavando/gi, '$1 diggers working'],
    [/([0-9]+) bloques cavados en total/gi, '$1 total blocks excavated'],
    [/([0-9]+) pozos cavados/gi, '$1 tunnels excavated'],
    [/([0-9]+) entregas/gi, '$1 deliveries'],
    [/([0-9]+) tintas pintadas/gi, '$1 ink marks'],
    [/([0-9]+) obreras/gi, '$1 workers'],
    [/([0-9]+) reinas/gi, '$1 queens'],
    [/([0-9]+) crías/gi, '$1 brood'],
    [/([0-9]+) días/gi, '$1 days'],
    [/([0-9]+) semanas/gi, '$1 weeks'],
    [/([0-9]+) cámaras/gi, '$1 chambers'],
    [/([0-9]+) eventos/gi, '$1 events'],
    [/([0-9]+) celdas/gi, '$1 cells'],
    [/Día ([0-9]+)/gi, 'Day $1'],
    [/Año ([0-9]+)/gi, 'Year $1'],
    [/Semana ([0-9]+)/gi, 'Week $1'],
    [/piso ([0-9]+)/gi, 'floor $1'],
    [/fila ([0-9]+)/gi, 'row $1'],
    [/vida ([0-9]+)%/gi, '$1% health'],
    [/([0-9]+)% vida/gi, '$1% health'],
    [/([0-9]+)d por vivir/gi, '$1d remaining'],
    [/Huevo ([^·\n]+)/gi, 'Egg $1'],
  ];

  const words = {
    'sí':'yes','seguro':'sure','volver':'back','crear':'create','cargar':'load','continuar':'continue','recargar':'reload','borrar':'delete','limpiar':'clear','saltar':'skip','siguiente':'next','grande':'large','pequeño':'small','pequeña':'small','mediano':'medium','recomendado':'recommended','equilibrado':'balanced','tamaño':'size','tamaños':'sizes','móvil':'mobile','celdas':'cells','celda':'cell','mundo':'world','granja':'farm','granjas':'farms','archivo':'archive','archivadas':'archived','activo':'active','activa':'active','dañada':'damaged','dañado':'damaged','fecha':'date','ninguna':'none','todavía':'yet','ahora':'now','aquí':'here','menú':'menu','créditos':'credits','hecho':'made','motor':'engine','propio':'custom','generando':'generating','tallando':'carving','terreno':'terrain','suelo':'soil','plantas':'plants','tesoros':'treasures','gigante':'large','lectura':'readability','instantánea':'instant','comida':'food','economía':'economy','miel':'honey','criar':'breed','mutar':'mutate','velocidad':'speed','vel':'speed','icono':'icon','número':'number','detalle':'details','ojos':'eyes','rastro':'trail','tinta':'ink','frente':'frontier','cámaras':'chambers','cámara':'chamber','arrastra':'drag','rueda':'wheel','doble':'double','centra':'center','colonia':'colony','población':'population','despensa':'pantry','raciones':'rations','recolect':'foragers','excav':'diggers','nodriza':'nurse','nodrizas':'nurses','explor':'scouts','recomp':'rewards','cian':'cyan','reina':'queen','reinas':'queens','cría':'brood','crías':'brood','grávida':'gravid','hambrienta':'hungry','poner':'lay','huevo':'egg','huevos':'eggs','eclosionar':'hatch','eclosión':'hatching','sociedad':'society','estable':'stable','fértil':'fertile','facciones':'factions','facción':'faction','ánimo':'mood','colectivo':'collective','paz':'peace','guerra':'war','culto':'cult','idioma':'language','palabras':'words','obrera':'worker','obreras':'workers','elenco':'roster','evolución':'evolution','fertilidad':'fertility','primavera':'spring','verano':'summer','otoño':'autumn','invierno':'winter','brote':'sprout','sol':'sun','cosecha':'harvest','escarcha':'frost','claro':'clear','lluvia':'rain','lluvioso':'rainy','seco':'dry','húmedo':'damp','materiales':'materials','piedra':'stone','arcilla':'clay','arena':'sand','fibra':'fiber','madera':'wood','cobre':'copper','hierro':'iron','oro':'gold','cuarzo':'quartz','gema':'gem','obsidiana':'obsidian','vitrina':'relic case','vacía':'empty','vacío':'empty','profundidad':'depth','losa':'slab','losas':'slabs','cerebro':'brain','simple':'simple','experto':'expert','giro':'turn','cava':'dig','cavar':'dig','cavando':'digging','sensores':'sensors','rasgos':'traits','rasgo':'trait','explora':'explores','explorar':'explore','construye':'builds','recolecta':'collects','precisa':'precise','cuida':'cares','comunica':'communicates','genoma':'genome','mutación':'mutation','historial':'history','recompensas':'rewards','semillas':'seeds','agua':'water','hongo':'fungus','hongos':'fungi','almacén':'storage','hormigas':'ants','hormiga':'ant','activas':'active','lista':'list','edad':'age','vida':'health','estado':'status','árbol':'tree','mente':'mind','qué':'what','bien':'well','peleas':'fights','seguidoras':'followers','pensando':'thinking','números':'numbers','lineas':'lines','últimos':'latest','seguir':'follow','exiliar':'exile','personalidad':'personality','feromona':'pheromone','maternal':'maternal','cuidado':'care','base':'base','nivel':'level','linaje':'lineage','real':'real','alta':'high','próximo':'next','feliz':'happy','clima':'weather','vacia':'empty','feromonas':'pheromones','casa':'home','peligro':'danger','frases':'phrases','ej':'e.g.','llamada':'call','entrega':'delivers','amarillo':'yellow','pintan':'paint','leen':'read','cuidar':'care for','suyo':'strength','segundos':'seconds','reales':'real','tope':'cap','vidrio':'glass','obsérvalas':'watch them','aliméntalas':'feed them','cuadro':'box','neurona':'neuron','verdes':'green','empujan':'excite','rojas':'red','frenan':'inhibit','gruesa':'thick','manda':'influences','percibe':'perceives','centro':'center','mezcla':'integrates','decide':'decides','leer':'read','burbuja':'bubble','encima':'above','picando':'digging','grita':'calls','letras':'letters','raras':'odd','ir':'go','alimentar':'feed','migrar':'relocate','migración':'relocation','día':'day','días':'days','año':'year','años':'years','semana':'week','semanas':'weeks','estación':'season','hoy':'today','actual':'current','pasado':'past','futuro':'future','amanecer':'dawn','mediodía':'noon','obrera':'worker','obreras':'workers','recolectora':'forager','recolectoras':'foragers','excavadora':'digger','excavadoras':'diggers','exploradora':'scout','exploradoras':'scouts','líder':'leader','entrada':'entrance','cubierta':'covered','brecha':'breach','sellada':'sealed','sellado':'sealed','dique':'barrier','inundación':'flood','invento':'invention','cantería':'masonry','cerámica':'ceramics','tejido':'weaving','carpintería':'carpentry','cultivo':'cultivation','sucesión':'succession','heredera':'heir','vejez':'old age','muere':'dies','murió':'died','vieja':'old age','agotada':'exhaustion','emergencia':'emergency','corona':'crown','sobrevive':'survives','nace':'is born','nueva':'new','nuevo':'new','dinastía':'dynasty','cisma':'schism','riesgo':'risk','hambre':'hunger','jardín':'garden','fúngico':'fungus','huerto':'garden','tráfico':'traffic','única':'single','entregas':'deliveries','pozos':'tunnels','cavados':'excavated','comunicarse':'communicate','fundadora':'foundress','madre':'mother','padre':'father','padres':'parents','descendencia':'offspring','joven':'young','destierro':'exile','político':'political','asesinada':'murdered','roba':'steals','golpe':'coup','estado':'state','ayuda':'help','tesoro':'treasure','sale':'leaves','basalto':'basalt','roca':'rock','veta':'vein','derrumbe':'cave-in','túnel':'tunnel','túneles':'tunnels','colapsa':'collapses','esculpe':'carves','muro':'wall','reconstrucción':'reconstruction','tierra':'soil','entregó':'delivered','encontró':'found','dura':'hard','orden':'order','mirar':'watch','polvo':'dust','descansar':'rest','descansando':'resting','agotada':'exhausted','fatiga':'fatigue','controlar':'control','huir':'escape','derecha':'right','izquierda':'left','rápido':'fast','lento':'slow','ganas':'urge','pared':'wall','paredes':'walls','fuerzas':'energy','lleva':'carries','mandíbulas':'mandibles','aviso':'signal','demás':'others','ángulo':'angle','cercanía':'proximity','fuerza':'strength','entrada':'input','movimiento':'movement','seleccionada':'selected','falta':'need','lejos':'far','avanzando':'advancing','simulado':'simulated','guardado':'saved','cargar':'load','centrada':'centered','reubicada':'relocated','relocada':'relocated','ordenada':'ordered','calor':'heat','rápida':'fast','frío':'cold','noche':'night','reanudada':'resumed','fundada':'founded','creada':'created','listo':'ready','lista':'list','dia':'day','sem':'week','pinta':'paints','vuelve':'returns','mantén':'hold','pon':'drop','mira':'watch','miralas':'watch them','míralas':'watch them','jugar':'play','elige':'choose','forja':'forge','asesorados':'tuned','equipo':'device','el':'the','la':'the','los':'the','las':'the','un':'a','una':'a','de':'of','del':'of the','en':'in','con':'with','sin':'without','para':'for','por':'by','que':'that','y':'and','o':'or','su':'her','sus':'their','tu':'your','se':'is','le':'her','lo':'it','ya':'already','aún':'still','no':'no','hay':'there is','está':'is','es':'is','son':'are','fue':'was','antes':'before','después':'after','desde':'from','hasta':'until','donde':'where','mientras':'while','cuando':'when','como':'as','cada':'each','otra':'another','otras':'others','capas':'layers','cofres':'chests','llamando':'calling','siembra':'creation','atascó':'stalled','sobrescribir':'overwrite','construcciones':'structures','común':'ordinary','reliquias':'relics','reliquia':'relic','excavación':'excavation','arquitectura':'architecture','civilizado':'civilized','torre':'tower','vigía':'watchtower','manzanos':'apple trees','frutales':'fruit-bearing','pradera':'meadow','pasto':'grass','flores':'flowers','néctar':'nectar','arbustos':'bushes','bayas':'berries','bosquecillos':'groves','cuevas':'caves','regando':'watering','religión':'religion','crímenes':'crimes','crimen':'crime','todo':'all','todas':'all','chicas':'minims','soldadoras':'soldiers','inventos':'inventions','filtro':'filter','notó':'noticed','hace':'does','huele':'smells','ningún':'no','ninguna':'no','cansancio':'fatigue','rápido':'fast','paseo':'stroll','tortuga':'crawl','símbolo':'symbol','avisar':'alert','ocultar':'hide','enseñar':'show','ver':'show','reporte':'report','ficha':'profile','arriba':'above','abajo':'below','alto':'high','bajo':'low','más':'more','menos':'less','día':'day','ano':'year','obrera':'worker'
  };

  const wordKeys = Object.keys(words).sort((a, b) => b.length - a.length);
  const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordPattern = wordKeys.length
    ? new RegExp('(^|[^\\p{L}])(' + wordKeys.map(escapeRe).join('|') + ')(?=$|[^\\p{L}])', 'giu')
    : null;

  function matchCase(source, translated) {
    if (source === source.toUpperCase()) return translated.toUpperCase();
    if (source[0] === source[0].toUpperCase()) return translated[0].toUpperCase() + translated.slice(1);
    return translated;
  }

  function text(value) {
    if (value === null || value === undefined) return value;
    let out = String(value);
    for (const pair of phrases) out = out.replace(pair[0], pair[1]);
    if (wordPattern) {
      out = out.replace(wordPattern, (whole, lead, token) => {
        const translated = words[token.toLocaleLowerCase('es')] || token;
        return lead + matchCase(token, translated);
      });
    }
    return out.replace(/[¡¿]/g, '');
  }

  function translateTextNode(node) {
    const before = node.nodeValue;
    const after = text(before);
    if (after !== before) node.nodeValue = after;
  }

  function translateElement(el) {
    if (!el || el.nodeType !== 1) return;
    for (const attr of ['title', 'aria-label', 'placeholder']) {
      if (el.hasAttribute && el.hasAttribute(attr)) {
        const before = el.getAttribute(attr);
        const after = text(before);
        if (after !== before) el.setAttribute(attr, after);
      }
    }
  }

  function translateTree(start) {
    if (!start || typeof document === 'undefined') return;
    if (start.nodeType === 3) { translateTextNode(start); return; }
    translateElement(start);
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateTextNode(node);
      else translateElement(node);
    }
  }

  function patchCanvas() {
    if (typeof CanvasRenderingContext2D === 'undefined') return;
    const proto = CanvasRenderingContext2D.prototype;
    if (!proto || proto.__antFarmEnglish) return;
    for (const method of ['fillText', 'strokeText']) {
      const original = proto[method];
      if (typeof original !== 'function') continue;
      proto[method] = function (value) {
        const args = Array.prototype.slice.call(arguments);
        args[0] = text(value);
        return original.apply(this, args);
      };
    }
    Object.defineProperty(proto, '__antFarmEnglish', { value: true });
  }

  function install() {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = 'en';
    translateTree(document.body || document.documentElement);
    if (typeof MutationObserver !== 'undefined' && document.body) {
      const observer = new MutationObserver(records => {
        for (const record of records) {
          if (record.type === 'characterData') translateTextNode(record.target);
          else if (record.type === 'attributes') translateElement(record.target);
          else for (const node of record.addedNodes) translateTree(node);
        }
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });
      root.__antFarmEnglishObserver = observer;
    }
    patchCanvas();
  }

  root.AntFarmEnglish = { text, translateTree, install };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
