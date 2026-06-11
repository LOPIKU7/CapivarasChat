// Conecta automaticamente ao Socket.IO do servidor (funciona local e no Render)
const socket = io();

const telaLogin = document.getElementById('tela-login');
const inputNickname = document.getElementById('nickname-input');
const btnEntrar = document.getElementById('btn-entrar');

const jogoContainer = document.getElementById('jogo-container');
const jogadorLocal = document.getElementById('jogador');
const nomeJogadorLocal = document.getElementById('nome-jogador');
const balaoChatLocal = document.getElementById('balao-chat');

const chatUi = document.getElementById('chat-ui');
const chatInput = document.getElementById('chat-input');

let meuNickname = "";
let timerBalaoLocal;
let outrasCapivaras = {}; // Guarda as divs das outras capivaras na tela

// --- LOGIN ---
btnEntrar.addEventListener('click', entrarNoJogo);
inputNickname.addEventListener('keypress', (e) => { if (e.key === 'Enter') entrarNoJogo(); });

function entrarNoJogo() {
    const nickDigitado = inputNickname.value.trim();
    if (nickDigitado !== "") {
        meuNickname = nickDigitado;
        nomeJogadorLocal.innerText = meuNickname;

        telaLogin.style.display = 'none';
        jogadorLocal.style.display = 'block';
        chatUi.style.display = 'flex';

        jogadorLocal.style.top = '50%';
        jogadorLocal.style.left = '50%';

        // AVISA O SERVIDOR QUE ENTRAMOS
        socket.emit('entrarNoJogo', { nickname: meuNickname });
    }
}

// --- MOVIMENTAÇÃO POR CLIQUE ---
jogoContainer.addEventListener('click', (e) => {
    if (telaLogin.style.display !== 'none') return; // Bloqueia se não logou

    const rect = jogoContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const novaPosLeft = `${x - 50}px`;
    const novaPosTop = `${y - 50}px`;

    // Move o seu pinguim/capivara local
    jogadorLocal.style.left = novaPosLeft;
    jogadorLocal.style.top = novaPosTop;

    // AVISA O SERVIDOR PARA ONDE VOCÊ FOI
    socket.emit('movimentoJogador', { x: novaPosLeft, y: novaPosTop });
});

chatInput.addEventListener('click', (e) => { e.stopPropagation(); });

// --- ENVIAR MENSAGEM ---
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        let mensagem = chatInput.value.trim();
        if (mensagem.length > 30) mensagem = mensagem.substring(0, 30);

        if (mensagem !== '') {
            // Manda pro servidor (ele vai rebater para todo mundo, inclusive você)
            socket.emit('enviarMensagem', mensagem);
            chatInput.value = '';
            chatInput.blur();
        }
    }
});

// ==========================================
// ESCUTANDO OS EVENTOS MULTIPLAYER DO SERVIDOR
// ==========================================

// Recebe todos os jogadores que já estavam na sala antes de você entrar
socket.on('jogadoresAtuais', (jogadores) => {
    Object.keys(jogadores).forEach((id) => {
        if (id !== socket.id) {
            criarOutraCapivara(jogadores[id]);
        }
    });
});

// Uma nova capivara acabou de entrar no servidor
socket.on('novoJogador', (dadosJogador) => {
    criarOutraCapivara(dadosJogador);
});

// Outro jogador se moveu
socket.on('jogadorMoveu', (dados) => {
    if (outrasCapivaras[dados.id]) {
        outrasCapivaras[dados.id].style.left = dados.x;
        outrasCapivaras[dados.id].style.top = dados.y;
    }
});

// Alguém enviou uma mensagem (pode ser você ou outro)
socket.on('mensagemRecebida', (dados) => {
    if (dados.id === socket.id) {
        // Se a mensagem for sua, mostra no seu balão local
        mostrarBalao(balaoChatLocal, dados.texto);
    } else if (outrasCapivaras[dados.id]) {
        // Se for de outro, busca o balão dele na tela
        const balaoOutro = outrasCapivaras[dados.id].querySelector('.balao');
        mostrarBalao(balaoOutro, dados.texto);
    }
});

// Um jogador saiu do jogo
socket.on('jogadorDesconectou', (id) => {
    if (outrasCapivaras[id]) {
        outrasCapivaras[id].remove(); // Remove o boneco da tela
        delete outrasCapivaras[id];
    }
});

// --- FUNÇÕES AUXILIARES ---

// Cria visualmente a capivara de outro jogador na sua tela
function criarOutraCapivara(dados) {
    if (outrasCapivaras[dados.id]) return; // Evita duplicar

    // Cria a estrutura idêntica à do index.html de forma dinâmica
    const novaCapivara = document.createElement('div');
    novaCapivara.id = dados.id;
    novaCapivara.classList.add('outro-jogador'); // Mesmos estilos no CSS
    novaCapivara.style.position = 'absolute';
    novaCapivara.style.width = '100px';
    novaCapivara.style.height = '100px';
    novaCapivara.style.backgroundColor = '#A0522D'; // Uma cor ligeiramente diferente pra diferenciar
    novaCapivara.style.zIndex = '10';
    novaCapivara.style.transition = 'top 1s linear, left 1s linear';
    novaCapivara.style.left = dados.x;
    novaCapivara.style.top = dados.y;

    // Balão de chat dele
    const balao = document.createElement('div');
    balao.classList.add('balao');
    novaCapivara.appendChild(balao);

    // Nome dele
    const nome = document.createElement('div');
    nome.id = 'nome-jogador'; // Copia o estilo do CSS
    nome.innerText = dados.nickname;
    novaCapivara.appendChild(nome);

    jogoContainer.appendChild(novaCapivara);
    outrasCapivaras[dados.id] = novaCapivara; // Salva na nossa lista de controle
}

// Controla a exibição e o sumiço do balão de fala após 15 segundos
function mostrarBalao(elementoBalao, texto) {
    elementoBalao.innerText = texto;
    elementoBalao.style.display = 'block';

    if (elementoBalao.timerBalao) {
        clearTimeout(elementoBalao.timerBalao);
    }

    elementoBalao.timerBalao = setTimeout(() => {
        elementoBalao.style.display = 'none';
    }, 15000); // 15 segundos na tela
}
