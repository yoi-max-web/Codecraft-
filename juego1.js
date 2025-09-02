function jugar(eleccionJugador) {
  let opciones = ["✊","✋","✌"];
  let eleccionCPU = opciones[Math.floor(Math.random() * 3)];

  let manoJugador = document.getElementById("manoJugador");
  let manoCPU = document.getElementById("manoCPU");

  let sonidoGanar = document.getElementById("sonidoGanar");
  let sonidoPerder = document.getElementById("sonidoPerder");
  let sonidoEmpate = document.getElementById("sonidoEmpate");

  // Reset a ✊
  manoJugador.textContent = "✊"; 
  manoCPU.textContent = "✊"; 
  manoJugador.classList.remove("revelar","chocar");
  manoCPU.classList.remove("revelar","chocar");

  // Animación de choque
  setTimeout(() => {
    manoJugador.classList.add("chocar");
    manoCPU.classList.add("chocar");
  }, 300);

  // Revelar jugadas
  setTimeout(() => {
    manoJugador.textContent = eleccionJugador;
    manoCPU.textContent = eleccionCPU;

    manoJugador.classList.add("revelar");
    manoCPU.classList.add("revelar");

    // Resultado
    let resultado = "";
if (eleccionJugador === eleccionCPU) {
  resultado = "😅 Empate: ambos sacaron " + eleccionJugador;
  sonidoEmpate.play();
} else if (
  (eleccionJugador === "✊" && eleccionCPU === "✌") ||
  (eleccionJugador === "✋" && eleccionCPU === "✊") ||
  (eleccionJugador === "✌" && eleccionCPU === "✋")
) {
  resultado = "🎉 ¡Ganaste!: " + eleccionJugador + " vence a " + eleccionCPU;
  sonidoGanar.play();
  lanzarConfeti();
} else {
  resultado = "😭 Perdiste: " + eleccionCPU + " vence a " + eleccionJugador;
  sonidoPerder.play();
}


    document.getElementById("resultado").innerText = resultado;

  }, 1000);
}

// 🎉 Confeti cuando ganas
function lanzarConfeti() {
  confetti({
    particleCount: 120,
    spread: 70,
    origin: { y: 0.6 }
  });
}
