/* Ahorcado — versión mejorada
   - teclado físico + teclado virtual
   - animaciones suaves en canvas por pasos
   - UI mejorada y header/side como pediste
   - revisado "letra por letra" para evitar errores
*/

// ===== CONFIG =====
const palabras = [
  "jugar","amigos","camino","castillo","fantasma","corona","dragon","misterio","aventura",
  "tesoro","leyenda","magia","bosque","hechizo","princesa","caballero","monstruo","isla",
  "pirata","nave","mapa","secreto","batalla","reino","espada","programa","computador","teclado"
];

const MAX_INTENTOS = 6; // número de partes que puede dibujar el ahorcado

// ===== ESTADO =====
let palabraSecreta = "";
let letrasAdivinadas = []; // letras acertadas
let letrasUsadas = [];     // todas las letras probadas
let intentosRestantes = MAX_INTENTOS;

// control de animaciones por partes
let reservedPartsCount = 0;   // partes reservadas para animar (inmediato cuando se falla)
let completedPartsCount = 0;  // partes ya dibujadas COMPLETAS
let animationQueue = [];      // indices de partes pendientes de animar
let isAnimating = false;

// ===== DOM =====
const palabraElemento = document.getElementById("wordDisplay");
const mensajeElemento = document.getElementById("message");
const intentosElemento = document.getElementById("attemptsLeft");
const inputLetra = document.getElementById("letterInput");
const adivinarBtn = document.getElementById("guessButton");
const reiniciarBtn = document.getElementById("restartButton");
const tecladoDiv = document.getElementById("keyboard");
const canvas = document.getElementById("ahorcadoCanvas");
const ctx = canvas.getContext("2d");

// tamaño retina-safe (opcional)
function setupCanvasForDPR() {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width;
  const height = canvas.height;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.scale(dpr, dpr);
}
setupCanvasForDPR();

// ===== DIBUJOS (base + partes completas + animaciones) =====
function drawBaseAndPost() {
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#fff";

  // base
  ctx.beginPath();
  ctx.moveTo(20, canvas.height/ (canvas.height/ (canvas.height/1) * 1) ); // dummy to avoid lint; not used
  // we will use pixel coordinates compatibles con nuestro canvas (no escalado extra)
  ctx.beginPath();
  ctx.moveTo(20, canvas.height/ (canvas.height/ (canvas.height/1) * 1) );
  // simpler: use constants relative to canvas displayed size (320x320)
  // clear and draw using known coordinates:
  // base
  ctx.beginPath();
  ctx.moveTo(20, 300);
  ctx.lineTo(140, 300);
  ctx.stroke();

  // poste vertical
  ctx.beginPath();
  ctx.moveTo(80, 300);
  ctx.lineTo(80, 20);
  ctx.stroke();
}

// Full-draw functions for each part (order matters)
function drawTravesanoFull() {
  ctx.beginPath();
  ctx.moveTo(80, 20);
  ctx.lineTo(220, 20);
  ctx.stroke();
}
function drawRopeAndHeadFull() {
  // cuerda
  ctx.beginPath();
  ctx.moveTo(220, 20);
  ctx.lineTo(220, 60);
  ctx.stroke();
  // cabeza
  ctx.beginPath();
  ctx.arc(220, 90, 28, 0, Math.PI * 2);
  ctx.stroke();
}
function drawTorsoFull() {
  ctx.beginPath();
  ctx.moveTo(220, 118);
  ctx.lineTo(220, 200);
  ctx.stroke();
}
function drawLeftArmFull() {
  ctx.beginPath();
  ctx.moveTo(220, 140);
  ctx.lineTo(180, 170);
  ctx.stroke();
}
function drawRightArmFull() {
  ctx.beginPath();
  ctx.moveTo(220, 140);
  ctx.lineTo(260, 170);
  ctx.stroke();
}
function drawLegsFull() {
  // piernas
  ctx.beginPath();
  ctx.moveTo(220, 200);
  ctx.lineTo(190, 250);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(220, 200);
  ctx.lineTo(250, 250);
  ctx.stroke();
  // ojos X
  ctx.strokeStyle = "#ff6b6b";
  ctx.lineWidth = 3;
  // ojo izq
  ctx.beginPath();
  ctx.moveTo(212 - 8, 86 - 8);
  ctx.lineTo(212 + 8, 86 + 8);
  ctx.moveTo(212 + 8, 86 - 8);
  ctx.lineTo(212 - 8, 86 + 8);
  ctx.stroke();
  // ojo der
  ctx.beginPath();
  ctx.moveTo(228 - 8, 86 - 8);
  ctx.lineTo(228 + 8, 86 + 8);
  ctx.moveTo(228 + 8, 86 - 8);
  ctx.lineTo(228 - 8, 86 + 8);
  ctx.stroke();
  // restore
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 6;
}

// array con las funciones full (para dibujar las partes ya completadas)
const partsFull = [
  drawTravesanoFull,
  drawRopeAndHeadFull,
  drawTorsoFull,
  drawLeftArmFull,
  drawRightArmFull,
  drawLegsFull
];

// --- util: dibujar partes completas hasta n ---
function drawCompletedPartsFull(n) {
  for (let i = 0; i < n && i < partsFull.length; i++) {
    partsFull[i]();
  }
}

// animaciones por partes (dibujar parcial)
function animateLinePartial(x1,y1,x2,y2, t) {
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  const cx = x1 + (x2 - x1) * t;
  const cy = y1 + (y2 - y1) * t;
  ctx.lineTo(cx, cy);
  ctx.stroke();
}
function animateArcRadius(cx, cy, r, t) {
  ctx.beginPath();
  ctx.arc(cx, cy, r * t, 0, Math.PI * 2);
  ctx.stroke();
}

// animador de una parte por índice
function animatePart(index, duration = 300, cb = () => {}) {
  if (index < 0 || index >= partsFull.length) { cb(); return; }
  isAnimating = true;
  const start = performance.now();

  function frame(now) {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / duration);

    // limpiar
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // dibujar base y poste siempre
    drawBaseAndPost();

    // dibujar las partes COMPLETAS (antes de la parte animada)
    drawCompletedPartsFull(completedPartsCount);

    // dibujar la parte index parcialmente según índice
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#fff";

    switch(index) {
      case 0: // travesaño
        animateLinePartial(80,20,220,20, t);
        break;
      case 1: // cuerda + cabeza (t dividido)
        if (t < 0.5) {
          animateLinePartial(220,20,220,60, t / 0.5);
        } else {
          // cuerda completa
          ctx.beginPath(); ctx.moveTo(220,20); ctx.lineTo(220,60); ctx.stroke();
          // cabeza con progreso
          animateArcRadius(220,90,28, (t - 0.5)/0.5);
        }
        break;
      case 2: // torso
        animateLinePartial(220,118,220,200, t);
        break;
      case 3: // brazo izquierdo
        animateLinePartial(220,140,180,170, t);
        break;
      case 4: // brazo derecho
        animateLinePartial(220,140,260,170, t);
        break;
      case 5: // piernas (dos líneas; t 0..1 controla secuencia)
        if (t < 0.5) {
          animateLinePartial(220,200,190,250, t/0.5);
        } else {
          animateLinePartial(220,200,190,250, 1);
          animateLinePartial(220,200,250,250, (t - 0.5)/0.5);
        }
        break;
      default:
        break;
    }

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      // terminó: marcar parte como completada
      completedPartsCount++;
      isAnimating = false;
      cb();
      // si hay pendientes, procesar la siguiente
      processAnimationQueue();
    }
  }

  requestAnimationFrame(frame);
}

// procesar queue de animaciones
function processAnimationQueue() {
  if (isAnimating) return;
  if (animationQueue.length === 0) return;
  const nextIndex = animationQueue.shift();
  animatePart(nextIndex);
}

// dibujar el estado completo (sin animación) — útil al perder
function drawAllFullParts() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBaseAndPost();
  drawCompletedPartsFull(partsFull.length);
  // asegurar completed counters
  completedPartsCount = partsFull.length;
  reservedPartsCount = partsFull.length;
}

// dibujar estado inicial (base + poste)
function dibujarInicial() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBaseAndPost();
}

// ===== TECLADO VIRTUAL =====
function crearTeclado() {
  tecladoDiv.innerHTML = "";
  const letras = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  for (const ch of letras) {
    const btn = document.createElement("button");
    btn.textContent = ch;
    btn.className = "tecla";
    btn.dataset.letra = ch.toLowerCase();
    btn.addEventListener("click", () => {
      const letra = btn.dataset.letra;
      btn.disabled = true;
      adivinarLetra(letra);
      // marcar visual temporal (clase aplicada en adivinarLetra)
    });
    tecladoDiv.appendChild(btn);
  }
}

function marcarTeclaUI(letra, tipo) {
  const btn = tecladoDiv.querySelector(`button[data-letra="${letra}"]`);
  if (!btn) return;
  if (tipo === "acierto") {
    btn.classList.add("acierto");
    btn.disabled = true;
  } else if (tipo === "fallo") {
    btn.classList.add("fallo");
    btn.disabled = true;
  } else {
    btn.disabled = true;
  }
}

// ===== LÓGICA DEL JUEGO =====
function iniciarJuego() {
  // elegir palabra aleatoria
  palabraSecreta = palabras[Math.floor(Math.random() * palabras.length)].toLowerCase();
  letrasAdivinadas = [];
  letrasUsadas = [];
  intentosRestantes = MAX_INTENTOS;
  reservedPartsCount = 0;
  completedPartsCount = 0;
  animationQueue = [];
  isAnimating = false;

  intentosElemento.textContent = intentosRestantes;
  mensajeElemento.textContent = "";
  reiniciarBtn.style.display = "none";
  crearTeclado();
  dibujarInicial();
  mostrarPalabra();
  attachKeyboard(); // asegurar listener único al iniciar
}

function mostrarPalabra() {
  const display = palabraSecreta
    .split("")
    .map(ch => (letrasAdivinadas.includes(ch) ? ch : "_"))
    .join(" ");
  palabraElemento.textContent = display;

  if (!display.includes("_")) {
    mensajeElemento.textContent = "🎉 ¡Ganaste! Pulsa Reiniciar para otra ronda.";
    reiniciarBtn.style.display = "inline-block";
    palabraElemento.classList.add("win");
    desactivarTodo();
  } else {
    palabraElemento.classList.remove("win");
  }
}

function adivinarLetra(letra) {
  if (!letra || typeof letra !== "string") return;
  letra = letra.toLowerCase();
  if (!/^[a-zñ]$/.test(letra)) return; // solo letras

  if (letrasUsadas.includes(letra)) return; // ya probado

  letrasUsadas.push(letra);

  // si acierta
  if (palabraSecreta.includes(letra)) {
    if (!letrasAdivinadas.includes(letra)) letrasAdivinadas.push(letra);
    marcarTeclaUI(letra, "acierto");
    mostrarPalabra();
    // pequeño mensaje
    mensajeElemento.textContent = "✅ ¡Bien!";
  } else {
    // fallo
    intentosRestantes--;
    intentosElemento.textContent = intentosRestantes;
    marcarTeclaUI(letra, "fallo");
    mensajeElemento.textContent = "❌ Fallaste";

    // reservar siguiente parte para animar y encolarla
    const reserveIndex = reservedPartsCount;
    reservedPartsCount++;
    animationQueue.push(reserveIndex);
    processAnimationQueue();
  }

  // perder
  if (intentosRestantes <= 0) {
    mensajeElemento.textContent = `😢 Perdiste. La palabra era "${palabraSecreta}".`;
    reiniciarBtn.style.display = "inline-block";
    // si hay animaciones pendientes o en curso, cancelarlas y mostrar todo completo:
    // (para simplificar, dibujo todo completo inmediatamente)
    drawAllFullParts();
    desactivarTodo();
    // revelar palabra completa
    letrasAdivinadas = Array.from(new Set(palabraSecreta.split("")));
    mostrarPalabra();
  }
}

// ===== EVENTOS Y CONTROL DEL TECLADO FÍSICO =====
function keydownHandler(e) {
  const key = e.key.toLowerCase();
  if (/^[a-zñ]$/.test(key)) {
    adivinarLetra(key);
  }
}

function attachKeyboard() {
  // evitar múltiples listeners
  document.removeEventListener("keydown", keydownHandler);
  document.addEventListener("keydown", keydownHandler);
}
function detachKeyboard() {
  document.removeEventListener("keydown", keydownHandler);
}

// desactivar todo (al ganar o perder)
function desactivarTodo() {
  detachKeyboard();
  // desactivar teclas virtuales
  document.querySelectorAll("#keyboard .tecla").forEach(b => b.disabled = true);
}

// ===== BOTONES =====
adivinarBtn.addEventListener("click", () => {
  const letra = inputLetra.value.trim().toLowerCase();
  inputLetra.value = "";
  if (letra) adivinarLetra(letra[0]);
  inputLetra.focus();
});

reiniciarBtn.addEventListener("click", () => {
  iniciarJuego();
});

// permitir Enter en input (si está visible)
inputLetra.addEventListener("keyup", (e) => {
  if (e.key === "Enter") adivinarBtn.click();
});

// iniciar primera partida
iniciarJuego();
