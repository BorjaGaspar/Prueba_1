// ==========================================
// LÓGICA DEL SISTEMA BASE (SAMIRADTX)
// ==========================================
let dificultadSeleccionada = null;
let animoSeleccionado = null;
let nivelUsuario = typeof NIVEL_DEL_SISTEMA !== 'undefined' ? NIVEL_DEL_SISTEMA : 1;
let csrfToken = typeof TOKEN_DJANGO !== 'undefined' ? TOKEN_DJANGO : '';

let puntosTotales = 0;

// VOZ
document.getElementById('btn-leer-instrucciones').addEventListener('click', function () {
    window.speechSynthesis.cancel();
    const texto = document.getElementById('texto-instrucciones').innerText;
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-ES';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
});

function comenzarJuego() {
    window.speechSynthesis.cancel();
    document.getElementById('pantalla-instrucciones').style.display = 'none';
    document.getElementById('pantalla-juego').style.display = 'flex';
    iniciarTuJuego();
}

// AUTOPERCEPCIÓN
function seleccionarDificultad(valor, btnElement) {
    dificultadSeleccionada = valor;
    document.querySelectorAll('.btn-prom-dif').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    comprobarFormularioProm();
}

function seleccionarAnimo(valor, btnElement) {
    animoSeleccionado = valor;
    document.querySelectorAll('.btn-prom-ani').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    comprobarFormularioProm();
}

function comprobarFormularioProm() {
    if (dificultadSeleccionada !== null && animoSeleccionado !== null) {
        document.getElementById('btn-continuar-prom').disabled = false;
    }
}

function finalizarJuegoGlobal() {
    const modalProm = new bootstrap.Modal(document.getElementById('modalAutopercepcion'));
    modalProm.show();
}

function enviarAutopercepcion() {
    const modalPromEl = document.getElementById('modalAutopercepcion');
    const modalPromInstance = bootstrap.Modal.getInstance(modalPromEl);
    modalPromInstance.hide();

    const modalResultados = new bootstrap.Modal(document.getElementById('modalFinJuego'));
    document.getElementById('puntos-finales').innerText = puntosTotales;

    const mensaje = document.getElementById('mensaje-final');
    if (puntosTotales >= 800) mensaje.innerText = "¡Increíble! Nivel Oro";
    else if (puntosTotales >= 400) mensaje.innerText = "¡Muy bien! Nivel Plata";
    else mensaje.innerText = "¡Bien hecho!";

    modalResultados.show();
    guardarSesion(puntosTotales, dificultadSeleccionada, animoSeleccionado);
}

function guardarSesion(puntos, dificultad, animo) {
    const datos = {
        juego: "Encuentra la Bolita",
        nivel: nivelUsuario,
        puntos: puntos,
        tiempo: 0,
        completado: true,
        dificultad_percibida: dificultad,
        estado_animo: animo
    };

    fetch('/api/guardar-progreso/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify(datos)
    }).then(response => {
        if (response.ok) console.log("Guardado en SamiraDTx con éxito");
    });
}

// ==========================================
// JAVASCRIPT DE TU JUEGO (LOS VASOS)
// ==========================================

function iniciarTuJuego() {
    const CONFIG_NIVELES = {
        // Nivel:     1, 2, 3, 4, 5
        vasos: [2, 3, 4, 5, 6],
        movimientos: [1, 2, 3, 4, 5],
        velocidades: [450, 350, 280, 220, 150]
    };
    const idx = Math.min(Math.max(nivelUsuario - 1, 0), 4);
    const ajustes = {
        numVasos: CONFIG_NIVELES.vasos[idx],
        movs: CONFIG_NIVELES.movimientos[idx],
        vel: CONFIG_NIVELES.velocidades[idx]
    };

    const contenedor = document.getElementById('contenedor-tu-juego');
    contenedor.innerHTML = '<canvas id="gameCanvas" width="800" height="400" style="background:#fff; border-radius:15px; cursor:pointer; border:1px solid #ddd; max-width:100%; height:auto;"></canvas>';
    new MotorJuego(ajustes);
}

class Vaso {
    constructor(x, y, tieneBola) {
        this.x = x; this.y = y; this.tieneBola = tieneBola;
        this.offsetY = 0; this.revelado = false;
    }
    dibujar(ctx, mezclando) {
        if (this.tieneBola && !mezclando && (this.revelado || this.offsetY > 20)) {
            ctx.fillStyle = "#ff4757"; ctx.beginPath();
            ctx.arc(this.x, this.y - 15, 12, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "#2f3542"; ctx.beginPath();
        ctx.moveTo(this.x - 35, this.y - this.offsetY);
        ctx.lineTo(this.x + 35, this.y - this.offsetY);
        ctx.lineTo(this.x + 25, this.y - 90 - this.offsetY);
        ctx.lineTo(this.x - 25, this.y - 90 - this.offsetY);
        ctx.closePath(); ctx.fill();
    }
}

class MotorJuego {
    constructor(ajustes) {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.config = ajustes;
        this.vasos = [];
        this.rondas = 0;
        this.estaMezclando = false;
        this.puedeInteractuar = false;
        this.canvas.onclick = (e) => this.manejarClick(e);
        this.iniciarRonda();
        this.renderizar();
    }

    iniciarRonda() {
        if (this.rondas >= 5) {
            finalizarJuegoGlobal();
            return;
        }
        this.vasos = [];
        const spacing = 110;
        const totalW = (this.config.numVasos - 1) * spacing;
        const startX = (this.canvas.width - totalW) / 2;
        const winIdx = Math.floor(Math.random() * this.config.numVasos);

        for (let i = 0; i < this.config.numVasos; i++) {
            this.vasos.push(new Vaso(startX + i * spacing, 320, i === winIdx));
        }
        this.secuencia();
    }

    async secuencia() {
        await new Promise(r => setTimeout(r, 600));
        await this.animarV(true);
        await new Promise(r => setTimeout(r, 800));
        await this.animarV(false);
        this.estaMezclando = true;
        for (let i = 0; i < this.config.movs; i++) {
            let a = Math.floor(Math.random() * this.vasos.length);
            let b = Math.floor(Math.random() * this.vasos.length);
            while (a === b) b = Math.floor(Math.random() * this.vasos.length);
            await this.swap(a, b);
        }
        this.estaMezclando = false;
        this.puedeInteractuar = true;
    }

    async swap(iA, iB) {
        const vA = this.vasos[iA], vB = this.vasos[iB], sA = vA.x, sB = vB.x;
        const inicio = performance.now();
        return new Promise(r => {
            const a = (t) => {
                let p = Math.min((t - inicio) / this.config.vel, 1);
                vA.x = sA + (sB - sA) * p; vB.x = sB + (sA - sB) * p;
                if (p < 1) requestAnimationFrame(a);
                else { [this.vasos[iA], this.vasos[iB]] = [this.vasos[iB], this.vasos[iA]]; r(); }
            }; requestAnimationFrame(a);
        });
    }

    async animarV(up) {
        const inicio = performance.now();
        return new Promise(r => {
            const a = (t) => {
                let p = Math.min((t - inicio) / 400, 1);
                this.vasos.forEach(v => v.offsetY = up ? p * 80 : (1 - p) * 80);
                if (p < 1) requestAnimationFrame(a); else r();
            }; requestAnimationFrame(a);
        });
    }

    manejarClick(e) {
        if (!this.puedeInteractuar) return;
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        this.vasos.forEach(v => {
            if (mx > v.x - 40 && mx < v.x + 40 && my > v.y - 100 && my < v.y) {
                this.seleccionarVaso(v);
            }
        });
    }

    async seleccionarVaso(v) {
        this.puedeInteractuar = false;
        v.revelado = true;
        if (v.tieneBola) puntosTotales += 200;
        else puntosTotales = Math.max(0, puntosTotales - 100);
        document.getElementById('score').innerText = puntosTotales;

        const inicio = performance.now();
        await new Promise(r => {
            const a = (t) => {
                let p = Math.min((t - inicio) / 400, 1); v.offsetY = p * 80;
                if (p < 1) requestAnimationFrame(a); else r();
            }; requestAnimationFrame(a);
        });
        setTimeout(() => { this.rondas++; this.iniciarRonda(); }, 1200);
    }

    renderizar() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.vasos.forEach(v => v.dibujar(this.ctx, this.estaMezclando));
        requestAnimationFrame(() => this.renderizar());
    }
}