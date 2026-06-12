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

let meuNickname = "";
let meuCenarioAtual = "centro";
// let meuCenarioAtual = "praia";
// let meuCenarioAtual = "parque";
let mudandoDeCenario = false;
let timerBalaoLocal;
let outrasCapivaras = {}; 

const VELOCIDADE_CAPIVARA = 300; // Pixels por segundo (Aumente para correr, diminua para andar lento)

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

        // Desenha as hitboxes na tela para você poder enxergar e ajustar
        cenarios[nomeCenario].portas.forEach(porta => {
            const divPorta = document.createElement('div');
            divPorta.classList.add('hitbox');
            divPorta.style.top = porta.top;
            divPorta.style.left = porta.left;
            divPorta.style.width = porta.width;
            divPorta.style.height = porta.height;
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
            // Verifica se a capivara encostou na caixa vermelha
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

                // Cancela o movimento e joga no ponto de spawn
                jogadorLocal.style.transition = 'none';
                jogadorLocal.style.top = spawnTop;
                jogadorLocal.style.left = spawnLeft;

                carregarCenario(destino);

                // Avisa o servidor que fomos pra outra sala
                socket.emit('mudarSala', { sala: destino, x: spawnLeft, y: spawnTop });

                // Trava rápida pra não teleportar duas vezes seguidas
                setTimeout(() => { mudandoDeCenario = false; }, 500);
            }
        });
    }
    requestAnimationFrame(loopColisao);
}

// ==========================================
// 3. LOGIN & MOVIMENTO CONSTANTE
// ==========================================
btnEntrar.addEventListener('click', entrarNoJogo);
inputNickname.addEventListener('keypress', (e) => { if (e.key === 'Enter') entrarNoJogo(); });

function entrarNoJogo() {
    if (inputNickname.value.trim() !== "") {
        meuNickname = inputNickname.value.trim();
        nomeJogadorLocal.innerText = meuNickname;
        telaLogin.style.display = 'none';
        jogadorLocal.style.display = 'block';
        chatUi.style.display = 'flex';
        
        jogadorLocal.style.top = '70%';
        jogadorLocal.style.left = '50%';
        
        // 🛠️ MUDANÇA AQUI: Mude de 'centro' para meuCenarioAtual
        carregarCenario(meuCenarioAtual); 
        loopColisao(); 

        // 🛠️ MUDANÇA AQUI: Envie o cenário atual para o servidor saber onde você nasceu
        socket.emit('entrarNoJogo', { nickname: meuNickname, sala: meuCenarioAtual });
    }
}

jogoContainer.addEventListener('click', (e) => {
    if (telaLogin.style.display !== 'none' || mudandoDeCenario) return;

    const rect = jogoContainer.getBoundingClientRect();
    const destX = e.clientX - rect.left - 50; 
    const destY = e.clientY - rect.top - 50;

    // Pega a posição exata de onde o boneco está agora
    const estiloComputado = window.getComputedStyle(jogadorLocal);
    const atualX = parseFloat(estiloComputado.left) || destX;
    const atualY = parseFloat(estiloComputado.top) || destY;

    // Teorema de Pitágoras para achar a distância em pixels
    const distanciaX = destX - atualX;
    const distanciaY = destY - atualY;
    const distanciaTotal = Math.sqrt((distanciaX * distanciaX) + (distanciaY * distanciaY));

    // Calcula o tempo baseado na velocidade fixa (Tempo = Distância / Velocidade)
    const tempoEmSegundos = distanciaTotal / VELOCIDADE_CAPIVARA;

    // Aplica o tempo dinâmico
    jogadorLocal.style.transition = `top ${tempoEmSegundos}s linear, left ${tempoEmSegundos}s linear`;
    const novaPosLeft = `${destX}px`;
    const novaPosTop = `${destY}px`;
    
    jogadorLocal.style.left = novaPosLeft;
    jogadorLocal.style.top = novaPosTop;

    socket.emit('movimentoJogador', { 
        x: novaPosLeft, 
        y: novaPosTop, 
        tempo: tempoEmSegundos, 
        sala: meuCenarioAtual 
    });
});

chatInput.addEventListener('click', (e) => { e.stopPropagation(); });

// ==========================================
// 4. CHAT E MULTIPLAYER
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

// Sincroniza a sala dos jogadores
function gerenciarPresenca(dados) {
    // --- ADICIONE ESTA LINHA AQUI PARA MATAR O CLONE ---
    if (dados.id === socket.id) return; // Ignora a criação se for o seu próprio boneco!
    
    if (dados.sala !== meuCenarioAtual) {
        if (outrasCapivaras[dados.id]) {
            outrasCapivaras[dados.id].remove();
            delete outrasCapivaras[dados.id];
        }
        return;
    }
    
    if (!outrasCapivaras[dados.id]) {
        criarOutraCapivara(dados);
    } else {
        outrasCapivaras[dados.id].style.transition = 'none'; // Corta animação ao mudar de sala
        outrasCapivaras[dados.id].style.left = dados.x;
        outrasCapivaras[dados.id].style.top = dados.y;
    }
}

socket.on('jogadoresAtuais', (jogadores) => {
    Object.keys(jogadores).forEach((id) => {
        if (id !== socket.id) gerenciarPresenca(jogadores[id]);
    });
});

socket.on('novoJogador', gerenciarPresenca);
socket.on('atualizarSala', gerenciarPresenca);

socket.on('jogadorMoveu', (dados) => {
    if (dados.sala !== meuCenarioAtual) return;

    if (outrasCapivaras[dados.id]) {
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

// Funções base de UI (Balão e Criação)
function criarOutraCapivara(dados) {
    const nova = document.createElement('div');
    nova.id = dados.id;
    nova.classList.add('outro-jogador', 'capivara-sprite'); 
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
