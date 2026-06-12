const socket = io();

const telaLogin = document.getElementById('tela-login');
const inputNickname = document.getElementById('nickname-input');
const btnEntrar = document.getElementById('btn-entrar');

const jogoContainer = document.getElementById('jogo-container');
const cenarioFundo = document.getElementById('cenario-fundo');
const portasContainer = document.getElementById('portas-container');
const jogadorLocal = document.getElementById('jogador');
const nomeJogadorLocal = document.getElementById('nome-jogador');
const balaoChatLocal = document.getElementById('balao-chat');

const chatUi = document.getElementById('chat-ui');
const chatInput = document.getElementById('chat-input');
const controlesExtras = document.getElementById('controles-extras');
const btnMortal = document.getElementById('btn-mortal');

let meuNickname = "";
let meuCenarioAtual = "central"; // O mapa que você colocou para debugar
let mudandoDeCenario = false;
let timerBalaoLocal;
let outrasCapivaras = {}; 

const VELOCIDADE_CAPIVARA = 300; 

// ==========================================
// 1. SISTEMA DE CENÁRIOS E HITBOXES
// ==========================================
const cenarios = {
    centro: { 
        fundo: 'url("centro.png")',
        portas: [
            { destino: 'parque', top: '40%', left: '0%', width: '10%', height: '40%', spawnTop: '40%', spawnLeft: '83%' },
            { destino: 'praia', top: '30%', left: '90%', width: '10%', height: '60%', spawnTop: '33%', spawnLeft: '25%' },
            { destino: 'cafeteria', top: '30%', left: '49%', width: '9%', height: '20%', spawnTop: '35%', spawnLeft: '45%' }
        ]
    },
    parque: { 
        fundo: 'url("parque.png")',
        portas: [
            { destino: 'centro', top: '0%', left: '90%', width: '25%', height: '30%', spawnTop: '80%', spawnLeft: '10%' } // Volta
        ]
    },
    cafeteria: { 
        fundo: 'url("cafeteria.png")',
        portas: [
            { destino: 'centro',top: '0%', left: '42%', width: '10%', height: '30%', spawnTop: '55%', spawnLeft: '50%' } // Volta
        ]
    },
    praia: { 
        fundo: 'url("praia.png")',
        portas: [
            { destino: 'centro', top: '20%', left: '0%', width: '10%', height: '60%', spawnTop: '80%', spawnLeft: '80%' } // Volta
        ]
    }
};

function carregarCenario(nomeCenario) {
    if (cenarios[nomeCenario]) {
        meuCenarioAtual = nomeCenario;
        cenarioFundo.style.backgroundImage = cenarios[nomeCenario].fundo;
        portasContainer.innerHTML = '';

        cenarios[nomeCenario].portas.forEach(porta => {
            const divPorta = document.createElement('div');
            divPorta.classList.add('hitbox');
            
            // ☢️ MODO FORÇADO: Ignora o arquivo CSS e pinta direto no navegador!
            divPorta.style.position = 'absolute';
            divPorta.style.top = porta.top;
            divPorta.style.left = porta.left;
            divPorta.style.width = porta.width;
            divPorta.style.height = porta.height;
            divPorta.style.backgroundColor = 'rgba(255, 0, 0, 0.5)'; // Fundo vermelho
            divPorta.style.border = '4px dashed #00FF00'; // Borda verde neon
            divPorta.style.zIndex = '9999'; // Prioridade infinita (Nada cobre ela)
            divPorta.style.pointerEvents = 'none';

            divPorta.dataset.destino = porta.destino;
            divPorta.dataset.spawnTop = porta.spawnTop;
            divPorta.dataset.spawnLeft = porta.spawnLeft;
            
            portasContainer.appendChild(divPorta);
        });
    }
}

// ==========================================
// 2. MOTOR DE COLISÃO
// ==========================================
function loopColisao() {
    if (!mudandoDeCenario && jogadorLocal.style.display !== 'none') {
        const rectJogador = jogadorLocal.getBoundingClientRect();
        const portas = document.querySelectorAll('.hitbox');

        portas.forEach(porta => {
            const rectPorta = porta.getBoundingClientRect();
            if (
                rectJogador.left < rectPorta.right &&
                rectJogador.right > rectPorta.left &&
                rectJogador.top < rectPorta.bottom &&
                rectJogador.bottom > rectPorta.top
            ) {
                mudandoDeCenario = true;
                const destino = porta.dataset.destino;
                const spawnTop = porta.dataset.spawnTop;
                const spawnLeft = porta.dataset.spawnLeft;

                jogadorLocal.style.transition = 'none';
                jogadorLocal.style.top = spawnTop;
                jogadorLocal.style.left = spawnLeft;

                Object.values(outrasCapivaras).forEach(boneco => boneco.remove());
                outrasCapivaras = {}; 

                carregarCenario(destino);

                socket.emit('mudarSala', { sala: destino, x: spawnLeft, y: spawnTop });

                setTimeout(() => { mudandoDeCenario = false; }, 500);
            }
        });
    }
    requestAnimationFrame(loopColisao);
}

// ==========================================
// 3. LOGIN & MOVIMENTO CONSTANTE E DIREÇÃO
// ==========================================
btnEntrar.addEventListener('click', entrarNoJogo);
inputNickname.addEventListener('keypress', (e) => { if (e.key === 'Enter') entrarNoJogo(); });

function entrarNoJogo() {
    if (inputNickname.value.trim() !== "") {
        meuNickname = inputNickname.value.trim();
        nomeJogadorLocal.innerText = meuNickname;
        telaLogin.style.display = 'none';
        jogadorLocal.style.display = 'block';
        
        jogadorLocal.classList.add('virado-esquerda'); 
        jogadorLocal.classList.remove('virado-direita');

        chatUi.style.display = 'flex';
        controlesExtras.style.display = 'block';
        
        jogadorLocal.style.top = '70%';
        jogadorLocal.style.left = '50%';
        carregarCenario(meuCenarioAtual);
        loopColisao(); 

        socket.emit('entrarNoJogo', { nickname: meuNickname, sala: meuCenarioAtual, direcao: 'esquerda' });
    }
}

jogoContainer.addEventListener('click', (e) => {
    if (telaLogin.style.display !== 'none' || mudandoDeCenario) return;

    const rect = jogoContainer.getBoundingClientRect();
    const destX = e.clientX - rect.left - 50; 
    const destY = e.clientY - rect.top - 50;

    const estiloComputado = window.getComputedStyle(jogadorLocal);
    const atualX = parseFloat(estiloComputado.left) || destX;
    const atualY = parseFloat(estiloComputado.top) || destY;

    let minhaNovaDirecao = 'esquerda'; 
    
    if (destX > atualX) {
        minhaNovaDirecao = 'direita';
        jogadorLocal.classList.add('virado-direita');
        jogadorLocal.classList.remove('virado-esquerda');
    } else if (destX < atualX) {
        minhaNovaDirecao = 'esquerda';
        jogadorLocal.classList.add('virado-esquerda');
        jogadorLocal.classList.remove('virado-direita');
    }

    const distanciaX = destX - atualX;
    const distanciaY = destY - atualY;
    const distanciaTotal = Math.sqrt((distanciaX * distanciaX) + (distanciaY * distanciaY));
    const tempoEmSegundos = distanciaTotal / VELOCIDADE_CAPIVARA;

    jogadorLocal.style.transition = `top ${tempoEmSegundos}s linear, left ${tempoEmSegundos}s linear`;
    const novaPosLeft = `${destX}px`;
    const novaPosTop = `${destY}px`;
    
    jogadorLocal.style.left = novaPosLeft;
    jogadorLocal.style.top = novaPosTop;

    socket.emit('movimentoJogador', { 
        x: novaPosLeft, 
        y: novaPosTop, 
        tempo: tempoEmSegundos, 
        sala: meuCenarioAtual,
        direcao: minhaNovaDirecao 
    });
});

chatInput.addEventListener('click', (e) => { e.stopPropagation(); });

// ==========================================
// 4. CHAT E MULTIPLAYER (Onde o bug estava)
// ==========================================
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        let mensagem = chatInput.value.trim().substring(0, 30);
        if (mensagem !== '') {
            socket.emit('enviarMensagem', mensagem);
            chatInput.value = '';
            chatInput.blur();
        }
    }
});

socket.on('jogadoresAtuais', (jogadores) => {
    Object.keys(outrasCapivaras).forEach(id => {
        outrasCapivaras[id].remove();
        delete outrasCapivaras[id];
    });

    Object.keys(jogadores).forEach((id) => {
        if (id !== socket.id && jogadores[id].sala === meuCenarioAtual) {
            criarOutraCapivara(jogadores[id]);
        }
    });
});

function gerenciarPresenca(dados) {
    if (dados.id === socket.id) return; 

    if (dados.sala === meuCenarioAtual) {
        if (!outrasCapivaras[dados.id]) {
            criarOutraCapivara(dados); 
        } else {
            outrasCapivaras[dados.id].style.transition = 'none';
            outrasCapivaras[dados.id].style.left = dados.x;
            outrasCapivaras[dados.id].style.top = dados.y;
            
            if (dados.direcao === 'direita') {
                outrasCapivaras[dados.id].classList.add('virado-direita');
                outrasCapivaras[dados.id].classList.remove('virado-esquerda');
            } else {
                outrasCapivaras[dados.id].classList.add('virado-esquerda');
                outrasCapivaras[dados.id].classList.remove('virado-direita');
            }
        }
    } else {
        if (outrasCapivaras[dados.id]) {
            outrasCapivaras[dados.id].remove();
            delete outrasCapivaras[dados.id];
        }
    }
}

// ⚠️ ESSAS ERAM AS DUAS LINHAS QUE HAVIAM SUMIDO! ⚠️
socket.on('novoJogador', gerenciarPresenca);
socket.on('atualizarSala', gerenciarPresenca);
// ===================================================

socket.on('jogadorMoveu', (dados) => {
    if (dados.sala !== meuCenarioAtual) {
        if (outrasCapivaras[dados.id]) {
            outrasCapivaras[dados.id].remove();
            delete outrasCapivaras[dados.id];
        }
        return; 
    }

    if (outrasCapivaras[dados.id]) {
        if (dados.direcao === 'direita') {
            outrasCapivaras[dados.id].classList.add('virado-direita');
            outrasCapivaras[dados.id].classList.remove('virado-esquerda');
        } else if (dados.direcao === 'esquerda') {
            outrasCapivaras[dados.id].classList.add('virado-esquerda');
            outrasCapivaras[dados.id].classList.remove('virado-direita');
        }

        outrasCapivaras[dados.id].style.transition = `top ${dados.tempo}s linear, left ${dados.tempo}s linear`;
        outrasCapivaras[dados.id].style.left = dados.x;
        outrasCapivaras[dados.id].style.top = dados.y;
    }
});

socket.on('mensagemRecebida', (dados) => {
    if (dados.id === socket.id) {
        mostrarBalao(balaoChatLocal, dados.texto);
    } else if (outrasCapivaras[dados.id]) {
        mostrarBalao(outrasCapivaras[dados.id].querySelector('.balao'), dados.texto);
    }
});

socket.on('jogadorDesconectou', (id) => {
    if (outrasCapivaras[id]) {
        outrasCapivaras[id].remove();
        delete outrasCapivaras[id];
    }
});

// ==========================================
// 5. FUNÇÕES AUXILIARES E MORTAL
// ==========================================
function criarOutraCapivara(dados) {
    const nova = document.createElement('div');
    nova.id = dados.id;
    nova.classList.add('outro-jogador', 'capivara-sprite'); 
    
    if(dados.direcao === 'direita') {
        nova.classList.add('virado-direita');
    } else {
        nova.classList.add('virado-esquerda'); 
    }

    nova.style.left = dados.x;
    nova.style.top = dados.y;

    const balao = document.createElement('div');
    balao.classList.add('balao');
    nova.appendChild(balao);

    const nome = document.createElement('div');
    nome.id = 'nome-jogador'; 
    nome.innerText = dados.nickname;
    nova.appendChild(nome);

    jogoContainer.appendChild(nova);
    outrasCapivaras[dados.id] = nova; 
}

function mostrarBalao(elementoBalao, texto) {
    elementoBalao.innerText = texto;
    elementoBalao.style.display = 'block';
    if (elementoBalao.timerBalao) clearTimeout(elementoBalao.timerBalao);
    elementoBalao.timerBalao = setTimeout(() => { elementoBalao.style.display = 'none'; }, 15000); 
}

btnMortal.addEventListener('click', (e) => {
    e.stopPropagation(); 
    fazerMortal(jogadorLocal); 
    socket.emit('fazerMortal'); 
});

socket.on('outroFezMortal', (dados) => {
    if (dados.sala === meuCenarioAtual && outrasCapivaras[dados.id]) {
        fazerMortal(outrasCapivaras[dados.id]);
    }
});

function fazerMortal(elemento) {
    if (!elemento || elemento.classList.contains('animacao-mortal')) return;
    elemento.classList.add('animacao-mortal');
    setTimeout(() => { elemento.classList.remove('animacao-mortal'); }, 800); 
}
