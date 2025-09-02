// 12 frutas (8 originales + 4 nuevas para columnas extra)
const icons = [
  "🍎","🍌","🍓","🍇","🍍","🥑","🍉","🥝",
  "🍒","🍑","🥥","🍋"
];
const MAX_MOVES = 25;

let firstCard=null, secondCard=null, lockBoard=false;
let moves=0, matches=0, gameOver=false;

const board=document.getElementById("gameBoard");
const movesSpan=document.getElementById("moves");
const matchesSpan=document.getElementById("matches");
const maxMovesSpan=document.getElementById("maxMoves");

const winOverlay=document.getElementById("winOverlay");
const loseOverlay=document.getElementById("loseOverlay");
const restartButtonWin=document.getElementById("restartButtonWin");
const restartButtonLose=document.getElementById("restartButtonLose");

const flipSound=document.getElementById("flipSound");
const winSound=document.getElementById("winSound");
const loseSound=document.getElementById("loseSound");
const screamSound=document.getElementById("screamSound");

const fireworksCanvas=document.getElementById("fireworks");
const ctx=fireworksCanvas.getContext("2d");
let particles=[], animationId=null;

function shuffle(a){return a.sort(()=>Math.random()-0.5);}
function stopAllSounds(){
  [loseSound,screamSound,flipSound,winSound].forEach(a=>{
    if(a){a.pause();a.currentTime=0;}
  });
}

function initGame(){
  stopFireworks(); stopAllSounds();
  board.innerHTML=""; moves=0; matches=0;
  firstCard=null; secondCard=null; lockBoard=false; gameOver=false;
  movesSpan.textContent=moves; matchesSpan.textContent=matches; maxMovesSpan.textContent=MAX_MOVES;
  winOverlay.classList.add("hidden"); loseOverlay.classList.add("hidden");

  const deck=shuffle([...icons,...icons]);
  deck.forEach(icon=>{
    const card=document.createElement("div");
    card.className="card"; card.dataset.icon=icon;
    card.innerHTML=`
      <div class="card-inner">
        <div class="card-front">${icon}</div>
        <div class="card-back">?</div>
      </div>`;
    card.addEventListener("click",()=>onCardClick(card));
    board.appendChild(card);
  });
}

function onCardClick(card){
  if(lockBoard||gameOver||card.classList.contains("flipped"))return;
  card.classList.add("flipped");

  // sonido de voltear
  flipSound.currentTime=0;
  flipSound.play().catch(()=>{});

  if(!firstCard){firstCard=card;return;}
  secondCard=card; checkMatch();
}

function checkMatch(){
  lockBoard=true; moves++; movesSpan.textContent=moves;
  if(firstCard.dataset.icon===secondCard.dataset.icon){
    firstCard=null; secondCard=null; lockBoard=false;
    matches++; matchesSpan.textContent=matches;
    if(matches===icons.length) showWin();
  }else{
    setTimeout(()=>{
      firstCard.classList.remove("flipped");
      secondCard.classList.remove("flipped");
      firstCard=null; secondCard=null; lockBoard=false;
    },800);
  }
  if(moves>=MAX_MOVES && matches<icons.length && !gameOver) showLose();
}

function showWin(){
  gameOver=true;
  winOverlay.classList.remove("hidden");
  winSound.currentTime=0;
  winSound.play().catch(()=>{});
  startFireworks();
}

function showLose(){
  gameOver=true;
  loseOverlay.classList.remove("hidden");
  loseSound.currentTime=0; loseSound.play().catch(()=>{});
  setTimeout(()=>{screamSound.currentTime=0;screamSound.play().catch(()=>{});},250);
}

// fireworks
function resizeCanvas(){fireworksCanvas.width=window.innerWidth;fireworksCanvas.height=window.innerHeight;}
function createParticles(){
  for(let i=0;i<80;i++){
    particles.push({x:Math.random()*fireworksCanvas.width,y:Math.random()*fireworksCanvas.height*0.8,
      angle:Math.random()*2*Math.PI,speed:1+Math.random()*3,radius:2+Math.random()*4,alpha:1});
  }
}
function animate(){
  ctx.fillStyle="rgba(0,0,0,0.15)";ctx.fillRect(0,0,fireworksCanvas.width,fireworksCanvas.height);
  particles.forEach(p=>{
    p.x+=Math.cos(p.angle)*p.speed;p.y+=Math.sin(p.angle)*p.speed;p.alpha-=0.008;
    ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);
    ctx.fillStyle=`rgba(${Math.floor(Math.random()*255)},${Math.floor(Math.random()*255)},${Math.floor(Math.random()*255)},${p.alpha})`;ctx.fill();
  });
  particles=particles.filter(p=>p.alpha>0);
  if(particles.length<30) createParticles();
  animationId=requestAnimationFrame(animate);
}
function startFireworks(){resizeCanvas();window.addEventListener("resize",resizeCanvas);particles=[];createParticles();if(animationId)cancelAnimationFrame(animationId);animate();}
function stopFireworks(){if(animationId)cancelAnimationFrame(animationId);animationId=null;particles=[];ctx.clearRect(0,0,fireworksCanvas.width,fireworksCanvas.height);window.removeEventListener("resize",resizeCanvas);}

// botones
restartButtonWin.addEventListener("click",()=>initGame());
restartButtonLose.addEventListener("click",()=>initGame());
document.addEventListener("keydown",e=>{if(e.key.toLowerCase()==="r")initGame();});

// start
initGame();







