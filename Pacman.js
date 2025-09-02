/**
 * Pacman.js — Integración final
 * - Lógica original (A*, personalidades, colisiones) preservada.
 * - Animaciones mejoradas: Pac-Man (boca ligada al movimiento), fantasmas (patas, pupilas suaves, parpadeo frightened).
 * - Countdown 3-2-1 READY! con beep.
 * - GAME OVER overlay.
 *
 * Reemplaza todo tu Pacman.js por este archivo.
 */

/* ------------------ CONFIG ------------------ */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TILE = 16; // px por tile
const COLS = 28, ROWS = 31;

const SCORE_PELLET = 10;
const SCORE_POWER = 50;
const SCORE_EAT_GHOST = 200;

const FRIGHT_SECONDS = 8; // segundos
const PAC_SPEED = 90; // px/s
const GHOST_SPEED = 55; // px/s

/* ------------------ SOUNDS (Howler) ------------------ */
const sounds = {
  chomp: new Howl({ src: ['https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg'], volume: 0.25 }),
  eatGhost: new Howl({ src: ['https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg'], volume: 0.35 }),
  death: new Howl({ src: ['https://actions.google.com/sounds/v1/alarms/beep_short.ogg'], volume: 0.5 })
};
const beep = new Howl({ src: ['https://actions.google.com/sounds/v1/alarms/beep_short.ogg'], volume: 0.45 });

/* ------------------ HUD / Estado ------------------ */
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');

let score = 0, lives = 3, level = 1;

/* ------------------ MAP (28x31) ------------------
  1 = pared
  0 = pellet pequeño
  2 = power pellet
  9 = vacío (comido)
*/
const LEVEL_MAP = [
"1111111111111111111111111111",
"1000000000110000000000000001",
"1011111110110111111111101101",
"1020000000000000000000020001",
"1010111110111111101111101101",
"1000100000000000000000100001",
"1110101111110111111011101011",
"1000001000000100000010000001",
"1011111011110111111011111101",
"1000000010000001000000000001",
"1111111010111111010111111111",
"1000000010000001000000000001",
"1111111010111111010111111111",
"1000000010000001000000000001",
"1011111011110111111011111101",
"1000001000000100000010000001",
"1110101111110111111011101011",
"1000100000000000000000100001",
"1010111110111111101111101101",
"1020000000000000000000020001",
"1011111110110111111111101101",
"1000000000110000000000000001",
"1111111111110011111111111111",
"1000000000000000000000000001",
"1011111111110111111111111101",
"1000000000010000000000000001",
"1011110111110111111011111101",
"1000000100000000001000000001",
"1011111110110111111111101101",
"1000000000110000000000000001",
"1111111111111111111111111111"
];

let map = LEVEL_MAP.map(r => r.split('').map(ch => Number(ch)));

/* ------------------ PAC-MAN ------------------ */
const startTile = { x: 14, y: 23 };
let pac = {
  tx: startTile.x, ty: startTile.y,
  x: startTile.x * TILE, y: startTile.y * TILE,
  speed: PAC_SPEED,
  dirX: 0, dirY: 0,
  nextDirX: 0, nextDirY: 0,
  mouthPhase: 0 // para animación de boca
};

/* ------------------ GHOSTS ------------------ */
let ghosts = [
  { type:'blinky', tx:13, ty:11, x:13*TILE, y:11*TILE, home:{x:13,y:11}, corner:{x:COLS-2,y:0}, color:'#ff0000', frightened:0, ex:0, ey:0, feetPhase:0 },
  { type:'pinky',  tx:14, ty:11, x:14*TILE, y:11*TILE, home:{x:14,y:11}, corner:{x:1,y:0}, color:'#ffb8ff', frightened:0, ex:0, ey:0, feetPhase:0 },
  { type:'inky',   tx:12, ty:13, x:12*TILE, y:13*TILE, home:{x:12,y:13}, corner:{x:COLS-2,y:ROWS-2}, color:'#00ffff', frightened:0, ex:0, ey:0, feetPhase:0 },
  { type:'clyde',  tx:15, ty:13, x:15*TILE, y:13*TILE, home:{x:15,y:13}, corner:{x:0,y:ROWS-2}, color:'#ffb852', frightened:0, ex:0, ey:0, feetPhase:0 }
];

/* ------------------ Sprites loader (optional) ------------------ */
const SPRITE_PATH = 'assets/sprites/'; // si no existen, se usan shapes
const sprites = {};
['pacman','blinky','pinky','inky','clyde'].forEach(name => {
  const img = new Image();
  img.src = `${SPRITE_PATH}${name}.png`;
  img.onload = () => { sprites[name] = img; };
  img.onerror = () => { /* fallback a canvas */ };
});

/* ------------------ PATH CACHE (LRU) ------------------ */
const PATH_CACHE = new Map();
const PATH_CACHE_MAX = 1000;
function cacheSet(key, val){
  if(PATH_CACHE.size >= PATH_CACHE_MAX){
    const k = PATH_CACHE.keys().next().value;
    PATH_CACHE.delete(k);
  }
  PATH_CACHE.set(key, val);
}
function cacheGet(key){
  const v = PATH_CACHE.get(key);
  if(!v) return null;
  PATH_CACHE.delete(key);
  PATH_CACHE.set(key, v);
  return v;
}

/* ------------------ UTILIDADES DE MAPA ------------------ */
function inBounds(tx, ty){ return tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS; }
function isWall(tx, ty){ if(!inBounds(tx,ty)) return true; return map[ty][tx] === 1; }
function canMoveTile(tx, ty){ return inBounds(tx,ty) && map[ty][tx] !== 1; }

/* ------------------ TECLADO ------------------ */
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if(k==='arrowup' || k==='w'){ pac.nextDirX = 0; pac.nextDirY = -1; e.preventDefault(); }
  if(k==='arrowdown' || k==='s'){ pac.nextDirX = 0; pac.nextDirY = 1; e.preventDefault(); }
  if(k==='arrowleft' || k==='a'){ pac.nextDirX = -1; pac.nextDirY = 0; e.preventDefault(); }
  if(k==='arrowright' || k==='d'){ pac.nextDirX = 1; pac.nextDirY = 0; e.preventDefault(); }
});

/* ------------------ FRIGHTENED ------------------ */
function activateFrightened(){
  ghosts.forEach(g => g.frightened = FRIGHT_SECONDS);
}

/* ------------------ A* PATHFINDING (cached) ------------------ */
function astar(start, goal){
  if(!inBounds(start.x,start.y) || !inBounds(goal.x,goal.y)) return null;
  const key = `${start.x},${start.y}->${goal.x},${goal.y}`;
  const cached = cacheGet(key);
  if(cached) return cached;

  function neigh(p){ return [{x:p.x+1,y:p.y},{x:p.x-1,y:p.y},{x:p.x,y:p.y+1},{x:p.x,y:p.y-1}].filter(n=>canMoveTile(n.x,n.y)); }
  function h(a,b){ return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }

  const open = new Map();
  const closed = new Set();
  const startNode = { pos:{x:start.x,y:start.y}, g:0, f:h(start,goal), prev:null };
  open.set(`${start.x},${start.y}`, startNode);

  while(open.size){
    let current = null;
    for(const node of open.values()){
      if(!current || node.f < current.f) current = node;
    }
    const ckey = `${current.pos.x},${current.pos.y}`;
    if(current.pos.x === goal.x && current.pos.y === goal.y){
      const path = [];
      let cur = current;
      while(cur){ path.push({x:cur.pos.x,y:cur.pos.y}); cur = cur.prev; }
      path.reverse();
      cacheSet(key, path);
      return path;
    }
    open.delete(ckey); closed.add(ckey);

    for(const nb of neigh(current.pos)){
      const nk = `${nb.x},${nb.y}`;
      if(closed.has(nk)) continue;
      const tentativeG = current.g + 1;
      const existing = open.get(nk);
      if(!existing || tentativeG < existing.g){
        const node = { pos:{x:nb.x,y:nb.y}, g:tentativeG, f:tentativeG + h(nb, goal), prev: current };
        open.set(nk, node);
      }
    }
  }
  return null;
}

/* ------------------ GHOST TARGET (personalidades) ------------------ */
function ghostTargetTile(ghost){
  if(ghost.frightened > 0){
    const tx = ghost.tx - (pac.tx - ghost.tx);
    const ty = ghost.ty - (pac.ty - ghost.ty);
    return { x: Math.max(0, Math.min(COLS-1, Math.round(tx))) , y: Math.max(0, Math.min(ROWS-1, Math.round(ty))) };
  }
  switch(ghost.type){
    case 'blinky':
      return { x: pac.tx, y: pac.ty };
    case 'pinky':
      return { x: pac.tx + pac.dirX*4, y: pac.ty + pac.dirY*4 };
    case 'inky': {
      const blinky = ghosts.find(g=>g.type==='blinky');
      const projX = pac.tx + pac.dirX*2;
      const projY = pac.ty + pac.dirY*2;
      const tx = (projX - blinky.tx)*2 + blinky.tx;
      const ty = (projY - blinky.ty)*2 + blinky.ty;
      return { x: Math.round(tx), y: Math.round(ty) };
    }
    case 'clyde': {
      const dist = Math.hypot(ghost.tx - pac.tx, ghost.ty - pac.ty);
      return (dist > 8) ? { x: pac.tx, y: pac.ty } : { x: ghost.corner.x, y: ghost.corner.y };
    }
  }
  return { x: pac.tx, y: pac.ty };
}

/* ------------------ MOVIMIENTO PAC ------------------ */
function updatePac(dt){
  // during countdown or gameOver we want pac frozen (handled in loop)
  const nxTile = pac.tx + pac.nextDirX;
  const nyTile = pac.ty + pac.nextDirY;
  if(canMoveTile(nxTile,nyTile)){
    pac.dirX = pac.nextDirX; pac.dirY = pac.nextDirY;
  }
  const moveX = pac.dirX * pac.speed * dt;
  const moveY = pac.dirY * pac.speed * dt;
  const newX = pac.x + moveX, newY = pac.y + moveY;
  const centerNextTileX = Math.round(newX / TILE);
  const centerNextTileY = Math.round(newY / TILE);

  if(canMoveTile(centerNextTileX, centerNextTileY)){
    pac.x = newX; pac.y = newY;
    pac.tx = Math.round(pac.x / TILE); pac.ty = Math.round(pac.y / TILE);
  } else {
    pac.x = pac.tx * TILE; pac.y = pac.ty * TILE;
    pac.dirX = 0; pac.dirY = 0;
  }

  // pellets / power
  const cell = map[pac.ty][pac.tx];
  if(cell === 0){
    score += SCORE_PELLET; map[pac.ty][pac.tx] = 9; scoreEl.textContent = score;
    sounds.chomp.play();
  } else if(cell === 2){
    score += SCORE_POWER; map[pac.ty][pac.tx] = 9; scoreEl.textContent = score;
    activateFrightened();
    sounds.chomp.play();
  }

  // mouth animation depends on movement speed
  const speedFactor = Math.hypot(pac.dirX, pac.dirY); // 0..1
  const freq = 2 + 4*speedFactor; // more speed -> faster mouth
  pac.mouthPhase += dt * freq;
}

/* ------------------ GHOSTS UPDATE (keep original AI but add anim params) ------------------ */
function updateGhosts(dt){
  ghosts.forEach(g=>{
    if(g.frightened > 0) g.frightened = Math.max(0, g.frightened - dt);

    g.tx = Math.round(g.x / TILE); g.ty = Math.round(g.y / TILE);

    const atCenter = (Math.abs((g.x % TILE)) < 1e-6) && (Math.abs((g.y % TILE)) < 1e-6);
    const targetTile = ghostTargetTile(g);
    const targetKey = `${targetTile.x},${targetTile.y}`;

    const pathReqKey = `${g.tx},${g.ty}->${targetKey}`;

    if(!g.path || g.pathKey !== pathReqKey || (g.pathIndex !== undefined && g.pathIndex >= (g.path.length || 0) && atCenter)){
      const path = astar({x:g.tx,y:g.ty}, {x:targetTile.x,y:targetTile.y});
      if(path && path.length >= 2){
        g.path = path;
        g.pathIndex = 1;
        g.pathKey = pathReqKey;
      } else {
        g.path = null; g.pathIndex = 0; g.pathKey = null;
      }
    }

    if(g.path && g.pathIndex < g.path.length){
      const next = g.path[g.pathIndex];
      const targetPxX = next.x * TILE, targetPxY = next.y * TILE;
      const vx = targetPxX - g.x, vy = targetPxY - g.y;
      const dist = Math.hypot(vx, vy);
      if(dist > 1){
        g.x += (vx / dist) * GHOST_SPEED * dt;
        g.y += (vy / dist) * GHOST_SPEED * dt;
      } else {
        g.x = targetPxX; g.y = targetPxY; g.tx = next.x; g.ty = next.y; g.pathIndex++;
      }
    } else {
      // fallback random neighbor if stuck
      const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
      for(const d of dirs){
        const ntx = g.tx + d.x, nty = g.ty + d.y;
        if(canMoveTile(ntx, nty)){
          g.path = [{x:g.tx,y:g.ty},{x:ntx,y:nty}];
          g.pathIndex = 1; g.pathKey = `${g.tx},${g.ty}->${ntx},${nty}`;
          break;
        }
      }
    }

    // animation helpers
    g.feetPhase = (g.feetPhase || 0) + dt * 8;

    // eyes: smooth follow toward pac center
    const dirPX = (pac.x - g.x);
    const dirPY = (pac.y - g.y);
    const mag = Math.hypot(dirPX, dirPY) || 1;
    const targetEx = (dirPX/mag) * 2.0; // offset ~2px
    const targetEy = (dirPY/mag) * 2.0;
    g.ex = (g.ex || 0) + (targetEx - (g.ex||0)) * Math.min(1, dt*10);
    g.ey = (g.ey || 0) + (targetEy - (g.ey||0)) * Math.min(1, dt*10);
  });
}

/* ------------------ COLLISIONS ------------------ */
let gameOver = false;
let gameOverTime = 0;

/* ------------------ RESET ------------------ */
function resetPositions(){
  pac.tx = startTile.x; pac.ty = startTile.y; pac.x = pac.tx * TILE; pac.y = pac.ty * TILE;
  pac.dirX = 0; pac.dirY = 0; pac.nextDirX = 0; pac.nextDirY = 0; pac.mouthPhase = 0;
  ghosts.forEach(g => {
    g.x = g.home.x * TILE; g.y = g.home.y * TILE; g.tx = g.home.x; g.ty = g.home.y; g.path = null; g.pathIndex = 0; g.frightened = 0; g.pathKey = null;
    g.ex = 0; g.ey = 0; g.feetPhase = 0;
  });
}

/* ------------------ DRAWING (improved animations) ------------------ */
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);

  // map: walls, pellets, power pellets (kept exactly as original)
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const v = map[r][c]; const px = c*TILE, py = r*TILE;
      if(v === 1){
        ctx.fillStyle = '#0529d9'; ctx.fillRect(px,py,TILE,TILE);
        ctx.fillStyle = '#031a8f'; ctx.fillRect(px+1,py+1,TILE-2,TILE-2);
      } else if(v === 0){
        ctx.fillStyle = '#ffd'; ctx.beginPath(); ctx.arc(px+TILE/2,py+TILE/2,2,0,Math.PI*2); ctx.fill();
      } else if(v === 2){
        ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(px+TILE/2,py+TILE/2,5,0,Math.PI*2); ctx.fill();
      }
    }
  }

  // Pac-Man (smooth mouth based on mouthPhase, closed when stopped)
  const pacX = pac.x + TILE/2, pacY = pac.y + TILE/2;
  const moving = Math.hypot(pac.dirX, pac.dirY) > 0.1;
  const mouthOpen = moving ? (0.12 + 0.18 * (0.5 + 0.5*Math.sin(pac.mouthPhase * Math.PI*2))) : 0.05;
  let angle = 0;
  if(pac.dirX === -1) angle = Math.PI;
  else if(pac.dirY === -1) angle = -Math.PI/2;
  else if(pac.dirY === 1) angle = Math.PI/2;

  ctx.save();
  ctx.translate(pacX, pacY);
  ctx.rotate(angle);

  if(sprites.pacman){
    ctx.drawImage(sprites.pacman, -TILE/2, -TILE/2, TILE, TILE);
  } else {
    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0,TILE/2 - 1, mouthOpen*Math.PI, (2 - mouthOpen)*Math.PI);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Ghosts: body (head + body), feet wave, eyes with smooth pupils, frightened blink
  ghosts.forEach(g => {
    const gx = g.x + TILE/2, gy = g.y + TILE/2;
    const frightenedBlink = (g.frightened > 0 && g.frightened < 2 && Math.floor(performance.now()/200)%2===0);

    const baseColor = g.frightened>0 ? (frightenedBlink ? '#cfe6ff' : '#4455ff') : g.color;

    // body shape
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(gx, gy - 1, TILE/2 - 1, Math.PI, 0);
    ctx.rect(gx - (TILE/2 - 1), gy - 1, TILE - 2, TILE/2);
    // feet wave
    const footTop = gy + TILE/2 - 1;
    const amp = 2;
    const phase = g.feetPhase || 0;
    const bumps = 3;
    const span = TILE - 2;
    ctx.moveTo(gx - (TILE/2 - 1), footTop);
    for(let i=0;i<=bumps;i++){
      const x = gx - (TILE/2 - 1) + (span/bumps)*i;
      const y = footTop + Math.sin(phase + i*Math.PI/2) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(gx + (TILE/2 - 1), footTop);
    ctx.closePath();
    ctx.fill();

    // eyes
    const eyeLX = gx - 5, eyeRX = gx + 5, eyeY = gy - 3;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(eyeLX, eyeY, 3, 0, Math.PI*2); ctx.arc(eyeRX, eyeY, 3, 0, Math.PI*2); ctx.fill();

    // pupils (use g.ex/g.ey from updateGhosts)
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(eyeLX + (g.ex||0), eyeY + (g.ey||0), 1.5, 0, Math.PI*2);
    ctx.arc(eyeRX + (g.ex||0), eyeY + (g.ey||0), 1.5, 0, Math.PI*2);
    ctx.fill();
  });

  // HUD top label
  ctx.fillStyle = '#cfe6ff'; ctx.font = '12px monospace'; ctx.fillText('PAC-MAN ULTIMATE', 8, 14);
}

/* ------------------ MAIN LOOP + Countdown + GameOver ------------------ */
let last = performance.now();
let paused = false;

// countdown variables
let countdownActive = false;
let countdownTime = 0;
let lastCountdownSec = 0;

function startCountdown(seconds = 3){
  countdownActive = true;
  countdownTime = seconds;
  lastCountdownSec = Math.ceil(countdownTime) + 1;
}

function loop(now){
  if(paused){ last = now; requestAnimationFrame(loop); return; }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // countdown logic
  if(countdownActive){
    countdownTime -= dt;
    const secs = Math.ceil(countdownTime);
    if(secs !== lastCountdownSec && secs > 0){
      beep.play();
      lastCountdownSec = secs;
    }
    if(countdownTime <= 0){
      countdownActive = false;
    }
  }

  // if game over -> draw overlay and stop logic updates (but keep overlay anim)
  if(gameOver){
    draw(); // final frame
    const elapsed = (performance.now() - gameOverTime) / 1000;
    const alpha = 0.65 + 0.35 * Math.sin(elapsed * 3);

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.shadowColor = "rgba(255,0,0,0.85)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = `rgba(255,0,0,${alpha})`;
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2);

    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#fff";
    ctx.font = '16px monospace';
    ctx.fillText("Puntaje: " + score, canvas.width/2, canvas.height/2 + 40);
    ctx.restore();

    requestAnimationFrame(loop);
    return;
  }

  // when countdown active, we draw overlays but freeze movement updates
  if(!countdownActive){
    updatePac(dt);
    updateGhosts(dt);
    checkCollisions();
  }
  draw();

  // draw countdown overlay if active
  if(countdownActive){
    const secs = Math.ceil(countdownTime);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffea00";
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = "center";
    if(secs > 0) ctx.fillText(secs, canvas.width/2, canvas.height/2);
    else ctx.fillText("READY!", canvas.width/2, canvas.height/2);
  }

  requestAnimationFrame(loop);
}

/* ------------------ COLLISIONS (kept as your original but with gameOver flag) ------------------ */
function checkCollisions(){
  for(const g of ghosts){
    const gTileX = Math.round(g.x / TILE), gTileY = Math.round(g.y / TILE);
    if(gTileX === pac.tx && gTileY === pac.ty){
      if(g.frightened > 0){
        // eat ghost
        score += SCORE_EAT_GHOST; scoreEl.textContent = score;
        sounds.eatGhost.play();
        // send ghost home
        g.x = g.home.x * TILE; g.y = g.home.y * TILE; g.tx = g.home.x; g.ty = g.home.y; g.path = null; g.pathIndex = 0; g.frightened = 0;
      } else {
        // Pac dies
        sounds.death.play();
        lives -= 1; livesEl.textContent = lives;
        resetPositions();
        if(lives <= 0){
          gameOver = true;
          gameOverTime = performance.now();
        } else {
          // start short countdown before resuming
          startCountdown(6)
    
        }
      }
    }
  }
}

/* ------------------ INIT & BUTTONS ------------------ */
function hardReset(){
  score = 0; lives = 3; level = 1;
  scoreEl.textContent = score; livesEl.textContent = lives; levelEl.textContent = level;
  map = LEVEL_MAP.map(r => r.split('').map(ch => Number(ch)));
  PATH_CACHE.clear();
  gameOver = false; gameOverTime = 0;
  resetPositions();
  startCountdown(3);
}

resetPositions();
scoreEl.textContent = score; livesEl.textContent = lives; levelEl.textContent = level;
startCountdown(3);
requestAnimationFrame(loop);

document.getElementById('btnStart').addEventListener('click', ()=> { if(gameOver){ hardReset(); } else { countdownActive = false; paused = false; last = performance.now(); } });
document.getElementById('btnPause').addEventListener('click', ()=> { paused = true; });
document.getElementById('btnReset').addEventListener('click', hardReset);

/* ------------------ FIN ------------------ */
/*
 - Reemplacé todo Pacman.js por este.
 - Si al pegar da algún error, abre la consola (F12 -> Console) y pégame el mensaje aquí.
 - Si quieres que reduzca la intensidad de las sombras, o que los sprites reemplacen las shapes, dime y lo integro.
*/
