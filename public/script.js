// Elementos da Interface
const telaLogin = document.getElementById('tela-login');
const inputNickname = document.getElementById('nickname-input');
const btnEntrar = document.getElementById('btn-entrar');

const jogoContainer = document.getElementById('jogo-container');
const jogador = document.getElementById('jogador');
const nomeJogador = document.getElementById('nome-jogador');
const balaoChat = document.getElementById('balao-chat');

const chatUi = document.getElementById('chat-ui');
const chatInput = document.getElementById('chat-input');

let meuNickname = "";
let timerBalao; // Guarda o timer do chat para podermos resetar

// ==========================================
// 1. SISTEMA DE LOGIN (ENTRAR NA CIDADE)
// ==========================================
btnEntrar.addEventListener('click', entrarNoJogo);
inputNickname.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') entrarNoJogo();
});

function entrarNoJogo() {
    const nickDigitado = inputNickname.value.trim();
    
    if (nickDigitado !== "") {
        meuNickname = nickDigitado;
        nomeJogador.innerText = meuNickname;

        // Esconde a tela de login
        telaLogin.style.display = 'none';
        
        // Mostra o jogador e a barra de chat
        jogador.style.display = 'block';
        chatUi.style.display = 'flex';

        // Spawna o jogador no meio da tela principal
        jogador.style.top = '50%';
        jogador.style.left = '50%';
    }
}

// ==========================================
// 2. SISTEMA DE MOVIMENTAÇÃO (CLIQUE)
// ==========================================
jogoContainer.addEventListener('click', (e) => {
    // Pega as dimensões e a posição do container
    const rect = jogoContainer.getBoundingClientRect();
    
    // Calcula a posição do clique relativa à tela do jogo
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Subtrai 50px (metade do tamanho do jogador que é 100x100 no CSS) 
    // para centralizar a capivara exatamente onde o mouse clicou
    jogador.style.left = `${x - 50}px`; 
    jogador.style.top = `${y - 50}px`;
});

// Impede que clicar no input de texto faça o personagem andar
chatInput.addEventListener('click', (e) => {
    e.stopPropagation(); 
});

// ==========================================
// 3. SISTEMA DE CHAT (15 SEGUNDOS)
// ==========================================
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        let mensagem = chatInput.value.trim();
        
        // Corta pra 30 caracteres por segurança
        if (mensagem.length > 30) {
            mensagem = mensagem.substring(0, 30);
        }

        if (mensagem !== '') {
            falar(mensagem);
            
            chatInput.value = ''; // Limpa a barra
            chatInput.blur(); // Tira o foco para não atrapalhar a movimentação
        }
    }
});

function falar(texto) {
    balaoChat.innerText = texto;
    balaoChat.style.display = 'block';

    // Se já tinha um timer contando pra sumir, nós cancelamos ele
    if (timerBalao) {
        clearTimeout(timerBalao);
    }

    // Cria um novo timer de 15 segundos (15000 milissegundos)
    timerBalao = setTimeout(() => {
        balaoChat.style.display = 'none';
    }, 15000);
}