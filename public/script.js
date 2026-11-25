// ==========================================
// CONFIGURAÇÕES
// ==========================================
const VELOCIDADE_PX_S = 260;     // velocidade da capivara andando
const TEMPO_BALAO_MS = 15000;    // quanto tempo o balão fica na cabeça
const TEMPO_DIGITANDO_MS = 2500; // depois disso sem digitar, some o "..."
const MAX_MENSAGENS_LOG = 100;

const EMOJI_EMOTES = {
    mortal: '🔄',
    acenar: '👋',
    dancar: '💃',
    pular: '⬆️',
    coracao: '❤️',
    risada: '😂',
    dormir: '💤',
};

// Cenários de cada sala e suas portas.
// As portas usam o mesmo sistema de antes: top/left/width/height da área da porta e
// spawnTop/spawnLeft = onde o canto de cima/esquerda da capivara aparece na sala de destino.
const CENARIOS = {
    centro: {
        fundo: 'centro.png',
        portas: [
            { destino: 'parque', top: '40%', left: '0%', width: '10%', height: '40%', spawnTop: '40%', spawnLeft: '83%' },
            { destino: 'praia', top: '30%', left: '90%', width: '10%', height: '60%', spawnTop: '33%', spawnLeft: '25%' },
            { destino: 'cafeteria', top: '30%', left: '49%', width: '9%', height: '20%', spawnTop: '35%', spawnLeft: '45%' },
        ],
    },
    parque: {
        fundo: 'parque.png',
        portas: [
            { destino: 'centro', top: '0%', left: '90%', width: '25%', height: '30%', spawnTop: '80%', spawnLeft: '10%' },
        ],
    },
    cafeteria: {
        fundo: 'cafeteria.png',
        portas: [
            { destino: 'centro', top: '0%', left: '42%', width: '10%', height: '30%', spawnTop: '55%', spawnLeft: '50%' },
        ],
    },
    praia: {
        fundo: 'praia.png',
        portas: [
            { destino: 'centro', top: '20%', left: '0%', width: '10%', height: '60%', spawnTop: '80%', spawnLeft: '80%' },
        ],
    },
};
const TAMANHO_SPRITE_PX = 100;

// ==========================================
// ELEMENTOS DA INTERFACE
// ==========================================
const $ = (id) => document.getElementById(id);

const telaLogin = $('tela-login');
const inputNickname = $('nickname-input');
const inputCor = $('cor-input');
const inputSala = $('sala-input');
const btnEntrar = $('btn-entrar');
const erroLogin = $('erro-login');
const onlineLogin = $('online-login');
const previewCapivara = $('preview-capivara');

const jogoContainer = $('jogo-container');
const cenarioFundo = $('cenario-fundo');
const portasContainer = $('portas-container');
const camadaJogadores = $('camada-jogadores');
const marcadorDestino = $('marcador-destino');

const barraSalas = $('barra-salas');
const painel = $('painel');
const btnFecharPainel = $('btn-fechar-painel');
const btnAbrirPainel = $('btn-abrir-painel');
const badgeNaoLidas = $('badge-nao-lidas');
const listaMensagens = $('lista-mensagens');
const listaOnline = $('lista-online');
const contadorOnline = $('contador-online');

const chatUi = $('chat-ui');
const chatInput = $('chat-input');
const inputCorJogo = $('cor-jogo-input');
const toast = $('toast');
const statusConexao = $('status-conexao');

// ==========================================
// ESTADO
// ==========================================
const socket = io();

let meuId = null;
let meusDados = null;      // { nick, cor, sala } usados para reconectar
let salaAtual = null;      // { id, nome, minY }
let salas = [];
let contagem = {};
const jogadores = new Map(); // id -> { dados, el, sprite, balao, digitando, timers }

// ==========================================
// UTILITÁRIOS
// ==========================================
function corDoNick(cor) {
    // A capivara base é marrom (~30° de matiz); o nick acompanha a cor escolhida
    return `hsl(${(30 + Number(cor)) % 360}, 65%, 38%)`;
}

function aplicarCor(el, cor) {
    el.style.filter = `hue-rotate(${cor}deg) drop-shadow(0 4px 3px rgba(0,0,0,0.35))`;
}

function formatarHora(timestamp) {
    return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

let timerToast;
function mostrarToast(texto) {
    toast.textContent = texto;
    toast.classList.add('visivel');
    clearTimeout(timerToast);
    timerToast = setTimeout(() => toast.classList.remove('visivel'), 3000);
}

// ==========================================
// 1. SISTEMA DE LOGIN (ENTRAR NA CIDADE)
// ==========================================
inputNickname.value = localStorage.getItem('capivara:nick') || '';
inputCor.value = localStorage.getItem('capivara:cor') || 0;
aplicarCor(previewCapivara, inputCor.value);

inputCor.addEventListener('input', () => aplicarCor(previewCapivara, inputCor.value));
btnEntrar.addEventListener('click', entrarNoJogo);
inputNickname.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') entrarNoJogo();
});

socket.on('salas', (dados) => {
    salas = dados.salas;
    contagem = dados.contagem;
    const salaSalva = localStorage.getItem('capivara:sala');
    inputSala.replaceChildren(...salas.map((s) => {
        const opcao = document.createElement('option');
        opcao.value = s.id;
        opcao.textContent = `${s.nome} (${contagem[s.id] || 0} online)`;
        if (s.id === salaSalva) opcao.selected = true;
        return opcao;
    }));
    atualizarOnlineLogin();
});

function atualizarOnlineLogin() {
    const total = Object.values(contagem).reduce((a, b) => a + b, 0);
    onlineLogin.textContent = total === 1 ? '1 capivara online agora' : `${total} capivaras online agora`;
}

function entrarNoJogo() {
    const nick = inputNickname.value.trim();
    if (!nick) {
        erroLogin.textContent = 'Digite um nickname.';
        return;
    }
    erroLogin.textContent = '';
    btnEntrar.disabled = true;

    const dados = { nick, cor: Number(inputCor.value), sala: inputSala.value };
    socket.emit('entrar', dados, (resposta) => {
        btnEntrar.disabled = false;
        if (!resposta.ok) {
            erroLogin.textContent = resposta.erro;
            return;
        }

        localStorage.setItem('capivara:nick', nick);
        localStorage.setItem('capivara:cor', dados.cor);
        meusDados = { ...dados, nick: resposta.eu.nick };
        if (resposta.eu.nick !== nick) {
            mostrarToast(`O nick "${nick}" já estava em uso, você é "${resposta.eu.nick}"`);
        }

        telaLogin.style.display = 'none';
        document.body.classList.add('em-jogo');
        inputCorJogo.value = dados.cor;
        configurarLoja(resposta.loja);
        atualizarPerfil(resposta.perfil);
        // O painel começa fechado para não tapar as saídas das salas,
        // a não ser que a pessoa tenha deixado aberto da última vez (e não esteja no celular)
        const celular = window.matchMedia('(max-width: 700px)').matches;
        if (celular || localStorage.getItem('capivara:painel') !== 'aberto') fecharPainel(false);
        carregarSala(resposta);
    });
}

// ==========================================
// 2. SALAS
// ==========================================
function carregarSala(resposta) {
    meuId = resposta.eu.id;
    salaAtual = resposta.sala;
    if (resposta.salas) salas = resposta.salas;
    meusDados.sala = salaAtual.id;
    localStorage.setItem('capivara:sala', salaAtual.id);

    jogoContainer.dataset.sala = salaAtual.id;
    document.title = `${salaAtual.nome} · CapivarasChat`;

    // Limpa a sala anterior
    for (const j of jogadores.values()) limparTimers(j);
    jogadores.clear();
    camadaJogadores.replaceChildren();
    listaMensagens.replaceChildren();
    marcadorDestino.classList.remove('visivel');

    desenharCenario(salaAtual.id);
    btnBola.hidden = !salaAtual.bolaDeNeve;
    if (!salaAtual.bolaDeNeve) alternarMira(false);
    estadoPesca = null; // trocar de sala cancela a pescaria
    if (garcom) { clearInterval(garcom.timer); garcom = null; }
    garcomEl.hidden = true;
    atualizarBotaoMinigame();
    mostrarQuiz(resposta.quiz);
    resposta.jogadores.forEach(adicionarJogador);
    // Se nasceu em cima de uma porta, ela só vale depois de sair e entrar de novo
    portasDentro = portasTocando();
    resposta.historico.forEach(adicionarMensagemLog);
    renderizarBarraSalas();
    renderizarListaOnline();
}

function nomeDaSala(salaId) {
    const sala = salas.find((x) => x.id === salaId);
    return sala ? sala.nome : salaId;
}

function desenharCenario(salaId) {
    const cenario = CENARIOS[salaId];
    cenarioFundo.style.backgroundImage = cenario ? `url("${cenario.fundo}")` : 'none';
    portasContainer.replaceChildren();
    if (!cenario) return;

    for (const porta of cenario.portas) {
        const el = document.createElement('div');
        el.className = 'porta';
        el.style.top = porta.top;
        el.style.left = porta.left;
        el.style.width = porta.width;
        el.style.height = porta.height;
        const esquerda = parseFloat(porta.left), largura = parseFloat(porta.width);
        if (esquerda + largura > 100) el.style.justifyContent = 'flex-start';
        else if (esquerda < 0) el.style.justifyContent = 'flex-end';
        el.dataset.destino = porta.destino;
        el.dataset.spawnTop = porta.spawnTop;
        el.dataset.spawnLeft = porta.spawnLeft;

        const rotulo = document.createElement('span');
        rotulo.textContent = `➜ ${nomeDaSala(porta.destino)}`;
        el.appendChild(rotulo);
        portasContainer.appendChild(el);
    }
}

function renderizarBarraSalas() {
    barraSalas.replaceChildren(...salas.map((s) => {
        const btn = document.createElement('button');
        btn.className = 'btn-sala' + (salaAtual && s.id === salaAtual.id ? ' ativa' : '');
        const nome = document.createElement('span');
        nome.textContent = s.nome;
        const qtd = document.createElement('span');
        qtd.className = 'qtd';
        qtd.textContent = contagem[s.id] || 0;
        btn.append(nome, qtd);
        btn.addEventListener('click', () => trocarSala(s.id));
        return btn;
    }));
}

let trocandoSala = false;
function trocarSala(salaId, posicao) {
    if (!salaAtual || salaId === salaAtual.id || trocandoSala) return;
    trocandoSala = true;
    socket.emit('trocarSala', { sala: salaId, posicao }, (resposta) => {
        trocandoSala = false;
        if (resposta.ok) carregarSala(resposta);
        else if (resposta.erro) mostrarToast(resposta.erro);
    });
}

// ==========================================
// PORTAS (andar até a porta troca de sala)
// ==========================================
let portasDentro = new Set(); // portas que a capivara já está tocando

function portasTocando() {
    const eu = jogadores.get(meuId);
    const tocando = new Set();
    if (!eu) return tocando;
    const r = eu.sprite.getBoundingClientRect();
    for (const porta of portasContainer.children) {
        const p = porta.getBoundingClientRect();
        if (r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top) tocando.add(porta);
    }
    return tocando;
}

// O spawn das portas é o canto de cima/esquerda da capivara; aqui viramos o ponto das patas.
function spawnDaPorta(porta) {
    const rect = jogoContainer.getBoundingClientRect();
    return {
        x: parseFloat(porta.dataset.spawnLeft) + (TAMANHO_SPRITE_PX / 2 / rect.width) * 100,
        y: parseFloat(porta.dataset.spawnTop) + (TAMANHO_SPRITE_PX / rect.height) * 100,
    };
}

function loopPortas() {
    if (salaAtual && !trocandoSala) {
        const agora = portasTocando();
        // Só troca de sala ao ENTRAR numa porta (não ao nascer em cima de uma)
        for (const porta of agora) {
            if (!portasDentro.has(porta)) {
                trocarSala(porta.dataset.destino, spawnDaPorta(porta));
                break;
            }
        }
        portasDentro = agora;
    }
    requestAnimationFrame(loopPortas);
}
requestAnimationFrame(loopPortas);

socket.on('contagemSalas', (dados) => {
    contagem = dados.contagem;
    if (salaAtual) renderizarBarraSalas();
    else atualizarOnlineLogin();
});

// ==========================================
// 3. JOGADORES NA TELA
// ==========================================
function adicionarJogador(dados) {
    if (jogadores.has(dados.id)) return;

    const el = document.createElement('div');
    el.className = 'jogador' + (dados.id === meuId ? ' eu' : '');

    const balao = document.createElement('div');
    balao.className = 'balao';

    const digitando = document.createElement('div');
    digitando.className = 'balao balao-digitando';
    digitando.textContent = '...';

    const emote = document.createElement('div');
    emote.className = 'emote-flutuante';

    // Corpo = capivara + cosméticos da loja
    const partes = criarCorpo();
    const { sprite } = partes;

    const nome = document.createElement('div');
    nome.className = 'nome-jogador';
    nome.textContent = dados.nick;

    const gelo = document.createElement('div');
    gelo.className = 'gelo';

    const vara = document.createElement('div');
    vara.className = 'vara';
    vara.textContent = '🎣';
    const boia = document.createElement('div');
    boia.className = 'boia';

    const atividade = document.createElement('div');
    atividade.className = 'icone-atividade';
    atividade.textContent = dados.atividade || '';

    el.append(balao, digitando, emote, partes.corpo, gelo, vara, boia, atividade, nome);
    camadaJogadores.appendChild(el);

    const jogador = { dados: { ...dados }, el, sprite, partes, balao, digitando, emote, atividade, timers: {} };
    jogadores.set(dados.id, jogador);

    aplicarCor(sprite, dados.cor);
    desenharVisual(partes, dados.visual);
    posicionar(jogador, dados.x, dados.y, false);
    virar(jogador, dados.direcao);
    if (dados.congelado > 0) congelar(jogador, dados.congelado);
    if (dados.pescando) el.classList.add('pescando');
    renderizarListaOnline();
}

function removerJogador(id) {
    const jogador = jogadores.get(id);
    if (!jogador) return;
    limparTimers(jogador);
    jogador.el.classList.add('saindo');
    setTimeout(() => jogador.el.remove(), 300);
    jogadores.delete(id);
    renderizarListaOnline();
}

function limparTimers(jogador) {
    Object.values(jogador.timers).forEach(clearTimeout);
}

function virar(jogador, direcao) {
    // A imagem original olha para a esquerda; direcao 1 = direita
    jogador.dados.direcao = direcao;
    jogador.sprite.classList.toggle('virado', direcao === 1);
    jogador.el.classList.toggle('olhando-direita', direcao === 1);
}

function posicionar(jogador, x, y, animar = true) {
    const { el } = jogador;
    const rect = jogoContainer.getBoundingClientRect();

    let duracao = 0;
    if (animar) {
        // Mesma velocidade independente da distância
        const dx = ((x - jogador.dados.x) / 100) * rect.width;
        const dy = ((y - jogador.dados.y) / 100) * rect.height;
        duracao = Math.hypot(dx, dy) / VELOCIDADE_PX_S;
    }

    el.style.transitionDuration = `${duracao}s`;
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    // Quem está mais embaixo na tela fica na frente
    el.style.zIndex = Math.round(y * 10);

    jogador.dados.x = x;
    jogador.dados.y = y;

    if (duracao > 0) {
        el.classList.add('andando');
        clearTimeout(jogador.timers.andar);
        jogador.timers.andar = setTimeout(() => {
            el.classList.remove('andando');
            if (jogador.dados.id === meuId) marcadorDestino.classList.remove('visivel');
        }, duracao * 1000);
    }
}

function moverJogador(jogador, x, y) {
    if (x !== jogador.dados.x) virar(jogador, x > jogador.dados.x ? 1 : -1);
    posicionar(jogador, x, y);
}

socket.on('jogadorEntrou', adicionarJogador);
socket.on('jogadorSaiu', removerJogador);

socket.on('jogadorMoveu', ({ id, x, y }) => {
    const jogador = jogadores.get(id);
    if (jogador) moverJogador(jogador, x, y);
});

socket.on('jogadorMudouCor', ({ id, cor }) => {
    const jogador = jogadores.get(id);
    if (!jogador) return;
    jogador.dados.cor = cor;
    aplicarCor(jogador.sprite, cor);
    renderizarListaOnline();
});

// ==========================================
// 4. MOVIMENTAÇÃO (CLIQUE)
// ==========================================
// Ponto do clique em % da tela
function pontoClicado(e) {
    const rect = jogoContainer.getBoundingClientRect();
    return {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
    };
}

jogoContainer.addEventListener('click', (e) => {
    const eu = jogadores.get(meuId);
    if (!eu) return;
    if (modoMira) return jogarBola(e);
    if (estaCongelado(eu)) return mostrarToast('Você está congelado! ❄️');

    const ponto = pontoClicado(e);
    const x = Math.min(98, Math.max(2, ponto.x));
    const y = Math.min(99, Math.max(salaAtual.minY, ponto.y));

    marcadorDestino.style.left = `${x}%`;
    marcadorDestino.style.top = `${y}%`;
    marcadorDestino.classList.remove('visivel');
    void marcadorDestino.offsetWidth; // reinicia a animação
    marcadorDestino.classList.add('visivel');

    moverJogador(eu, x, y);
    socket.emit('mover', { x, y });
});

// ==========================================
// BOLA DE NEVE
// ==========================================
const btnBola = $('btn-bola');
const ALTURA_MAO_PX = 55; // de onde a bola sai, acima das patas
let modoMira = false;

function podeJogarBola() {
    return Boolean(salaAtual && salaAtual.bolaDeNeve);
}

function estaCongelado(jogador) {
    return jogador.el.classList.contains('congelado');
}

function alternarMira(ligar = !modoMira) {
    modoMira = ligar && podeJogarBola();
    jogoContainer.classList.toggle('mirando', modoMira);
    btnBola.classList.toggle('ativo', modoMira);
}

btnBola.addEventListener('click', () => {
    if (!podeJogarBola()) return mostrarToast('Não dá para jogar bola de neve aqui!');
    alternarMira();
});

// Botão direito do mouse joga direto, sem precisar ligar a mira
jogoContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    jogarBola(e);
});

// B liga/desliga a mira, Esc desliga
document.addEventListener('keydown', (e) => {
    if (!salaAtual || (document.activeElement && document.activeElement.tagName === 'INPUT')) return;
    if (e.key === 'b' || e.key === 'B') alternarMira();
    else if (e.key === 'Escape') alternarMira(false);
});

function jogarBola(e) {
    const eu = jogadores.get(meuId);
    if (!eu) return;
    if (!podeJogarBola()) return mostrarToast('Não dá para jogar bola de neve aqui!');
    if (estaCongelado(eu)) return mostrarToast('Você está congelado! ❄️');
    socket.emit('jogarBola', pontoClicado(e));
}

// Onde estão as patas da capivara AGORA na tela (em %), mesmo no meio de uma caminhada
function posicaoNaTela(jogador) {
    const c = jogoContainer.getBoundingClientRect();
    const r = jogador.sprite.getBoundingClientRect();
    return {
        x: ((r.left + r.width / 2 - c.left) / c.width) * 100,
        y: ((r.bottom - c.top) / c.height) * 100,
    };
}

socket.on('bolaJogada', ({ bolaId, id, x, y, duracao, direcao }) => {
    const atirador = jogadores.get(id);
    if (!atirador) return;

    virar(atirador, direcao);
    atirador.el.classList.remove('arremessando');
    void atirador.el.offsetWidth;
    atirador.el.classList.add('arremessando');
    clearTimeout(atirador.timers.arremesso);
    atirador.timers.arremesso = setTimeout(() => atirador.el.classList.remove('arremessando'), 300);

    // A bola faz um arco; a sombra vai em linha reta pelo chão
    const inicio = posicaoNaTela(atirador);
    const c = jogoContainer.getBoundingClientRect();
    const distanciaPx = Math.hypot(((x - inicio.x) / 100) * c.width, ((y - inicio.y) / 100) * c.height);
    const arco = Math.min(160, 40 + distanciaPx * 0.3);

    const bola = document.createElement('div');
    bola.className = 'bola-de-neve';
    const sombra = document.createElement('div');
    sombra.className = 'sombra-bola';
    camadaJogadores.append(sombra, bola);

    const quadrosBola = [];
    const quadrosSombra = [];
    for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const px = inicio.x + (x - inicio.x) * t;
        const py = inicio.y + (y - inicio.y) * t;
        const altura = ALTURA_MAO_PX * (1 - t) + arco * 4 * t * (1 - t);
        quadrosBola.push({ left: `${px}%`, top: `calc(${py}% - ${altura}px)` });
        quadrosSombra.push({ left: `${px}%`, top: `${py}%` });
    }

    sombra.animate(quadrosSombra, { duration: duracao, fill: 'forwards' });
    bola.animate(quadrosBola, { duration: duracao, fill: 'forwards' });

    // Timer em vez de "fim da animação": o navegador pausa animações em abas
    // em segundo plano, e quem está lá também precisa poder ser atingido.
    setTimeout(() => {
        const aindaNaSala = bola.isConnected; // se trocou de sala no meio, ignora
        bola.remove();
        sombra.remove();
        if (!aindaNaSala) return;
        respingo(x, y);
        conferirSeFuiAtingido(bolaId, id, x, y);
    }, duracao);
});

function respingo(x, y) {
    const el = document.createElement('div');
    el.className = 'respingo';
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    camadaJogadores.appendChild(el);
    setTimeout(() => el.remove(), 500);
}

// Cada um confere se a bola caiu na própria capivara (do jeito que está vendo na tela)
function conferirSeFuiAtingido(bolaId, atiradorId, x, y) {
    const eu = jogadores.get(meuId);
    if (!eu || atiradorId === meuId || estaCongelado(eu)) return;

    const c = jogoContainer.getBoundingClientRect();
    const r = eu.sprite.getBoundingClientRect();
    const px = c.left + (x / 100) * c.width;
    const py = c.top + (y / 100) * c.height;
    // A imagem tem uma margem transparente em cima; a área de acerto é o corpo
    const acertou = px >= r.left + 5 && px <= r.right - 5 && py >= r.top + r.height * 0.2 && py <= r.bottom + 8;
    if (acertou) socket.emit('atingido', { bolaId, ...posicaoNaTela(eu) });
}

function congelar(jogador, duracao, x, y) {
    // Para exatamente onde está
    if (x !== undefined) posicionar(jogador, x, y, false);
    clearTimeout(jogador.timers.andar);
    jogador.el.classList.remove('andando', 'atingido');
    void jogador.el.offsetWidth;
    jogador.el.classList.add('congelado', 'atingido');

    clearTimeout(jogador.timers.congelado);
    jogador.timers.congelado = setTimeout(() => jogador.el.classList.remove('congelado', 'atingido'), duracao);
}

socket.on('congelado', ({ id, x, y, duracao, porId, porNick }) => {
    const jogador = jogadores.get(id);
    if (!jogador) return;
    congelar(jogador, duracao, x, y);

    if (id === meuId) {
        marcadorDestino.classList.remove('visivel');
        mostrarToast(`${porNick} te congelou! ❄️`);
    } else if (porId === meuId) {
        mostrarToast(`Você acertou ${jogador.dados.nick}! 🎯`);
    }
});

// ==========================================
// PESCARIA (Praia)
// ==========================================
const btnMinigame = $('btn-minigame');
let estadoPesca = null; // null | 'esperando' | 'mordeu'

// Cada sala tem seu minigame: 🎣 Praia, ☕ Cafeteria, 🧠 Centro
function atualizarBotaoMinigame() {
    btnMinigame.classList.remove('esperando', 'mordeu');
    btnMinigame.hidden = !salaAtual || !(salaAtual.pesca || salaAtual.garcom || salaAtual.quiz);
    if (btnMinigame.hidden) return;

    if (salaAtual.pesca) {
        btnMinigame.classList.toggle('esperando', estadoPesca === 'esperando');
        btnMinigame.classList.toggle('mordeu', estadoPesca === 'mordeu');
        btnMinigame.textContent =
            estadoPesca === 'mordeu' ? '❗ PUXAR!' :
            estadoPesca === 'esperando' ? '🎣 Esperando a mordida...' :
            '🎣 Pescar';
    } else if (salaAtual.garcom) {
        btnMinigame.textContent = '☕ Ser garçom';
    } else if (salaAtual.quiz) {
        btnMinigame.textContent = '🧠 Chamar quiz';
    }
}

function acaoMinigame() {
    if (!salaAtual) return;
    if (salaAtual.pesca) acaoPesca();
    else if (salaAtual.garcom) iniciarGarcom();
    else if (salaAtual.quiz) chamarQuiz();
}

function acaoPesca() {
    if (!salaAtual || !salaAtual.pesca) return;
    if (estadoPesca) {
        // Puxar antes da mordida faz o peixe fugir: faz parte do jogo!
        socket.emit('puxar');
        return;
    }
    socket.emit('pescar', (resposta) => {
        if (!resposta.ok) {
            if (resposta.erro) mostrarToast(resposta.erro);
            return;
        }
        estadoPesca = 'esperando';
        atualizarBotaoMinigame();
    });
}

btnMinigame.addEventListener('click', acaoMinigame);

// Espaço também puxa a vara (quando não está digitando)
document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || !estadoPesca) return;
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    e.preventDefault();
    acaoPesca();
});

function mostrarFlutuante(jogador, texto, duracao = 2200) {
    const el = jogador.emote;
    el.textContent = texto;
    el.classList.remove('visivel');
    void el.offsetWidth;
    el.classList.add('visivel');
    clearTimeout(jogador.timers.emote);
    jogador.timers.emote = setTimeout(() => el.classList.remove('visivel'), duracao);
}

socket.on('pescando', ({ id }) => {
    const jogador = jogadores.get(id);
    if (jogador) jogador.el.classList.add('pescando');
});

socket.on('mordeu', ({ id }) => {
    const jogador = jogadores.get(id);
    if (jogador) jogador.el.classList.add('mordeu');
    if (id === meuId) {
        estadoPesca = 'mordeu';
        atualizarBotaoMinigame();
    }
});

socket.on('pescaFim', ({ id, peixe, motivo }) => {
    const jogador = jogadores.get(id);
    if (jogador) {
        jogador.el.classList.remove('pescando', 'mordeu');
        if (peixe) mostrarFlutuante(jogador, peixe.emoji);
    }
    if (id !== meuId) return;

    estadoPesca = null;
    atualizarBotaoMinigame();
    if (peixe) {
        mostrarToast(peixe.id === 'bota'
            ? 'Você pescou uma 👢 Bota velha... 😅'
            : `Você pescou: ${peixe.emoji} ${peixe.nome}! +${peixe.valor} 💰${peixe.raro ? ' Que raro! ✨' : ''}`);
    } else if (motivo === 'cedo') {
        mostrarToast('Puxou cedo demais! O peixe fugiu 🐟💨');
    } else if (motivo === 'tarde') {
        mostrarToast('Demorou demais! O peixe levou a isca 🐟💨');
    } else if (motivo === 'cancelada') {
        mostrarToast('Você guardou a vara de pesca.');
    }
});

// ==========================================
// MOEDAS E PERFIL
// ==========================================
const hudMoedas = $('hud-moedas');
const qtdMoedas = $('qtd-moedas');
let meuPerfil = null;

function atualizarPerfil(perfil) {
    if (!perfil) return;
    const ganhou = meuPerfil && perfil.moedas > meuPerfil.moedas;
    meuPerfil = perfil;
    qtdMoedas.textContent = perfil.moedas;
    if (ganhou) {
        hudMoedas.classList.remove('ganhou');
        void hudMoedas.offsetWidth;
        hudMoedas.classList.add('ganhou');
    }
    if (!painelRanking.hidden) pedirRanking();
    if (!lojaEl.hidden) renderizarLoja();
}

socket.on('perfil', atualizarPerfil);

// "+3 💰" subindo em cima de quem ganhou moedas (todo mundo na sala vê)
socket.on('ganhouMoedas', ({ id, qtd }) => {
    const jogador = jogadores.get(id);
    if (!jogador) return;
    const el = document.createElement('div');
    el.className = 'moedas-flutuante';
    el.textContent = `+${qtd} 💰`;
    jogador.el.appendChild(el);
    setTimeout(() => el.remove(), 1400);
});

// Ícone do que a capivara está fazendo (ex.: 🍽️ garçom)
socket.on('atividade', ({ id, icone }) => {
    const jogador = jogadores.get(id);
    if (jogador) jogador.atividade.textContent = icone || '';
});

hudMoedas.addEventListener('click', () => abrirPainel('ranking'));

// ==========================================
// RANKING
// ==========================================
const painelRanking = $('painel-ranking');
const rankingCategorias = $('ranking-categorias');
const listaRanking = $('lista-ranking');
const meusNumeros = $('meus-numeros');

const CATEGORIAS_RANKING = [
    { campo: 'moedas', nome: '💰 Moedas' },
    { campo: 'acertos', nome: '❄️ Bolas' },
    { campo: 'peixes', nome: '🎣 Peixes' },
    { campo: 'pedidos', nome: '☕ Pedidos' },
    { campo: 'quiz', nome: '🧠 Quiz' },
];
let categoriaRanking = 'moedas';
let ultimoRanking = null;

function pedirRanking() {
    socket.emit('pedirRanking', (dados) => {
        ultimoRanking = dados;
        atualizarPerfil(dados.eu);
        renderizarRanking();
    });
}

function renderizarRanking() {
    rankingCategorias.replaceChildren(...CATEGORIAS_RANKING.map(({ campo, nome }) => {
        const chip = document.createElement('button');
        chip.className = 'chip' + (campo === categoriaRanking ? ' ativo' : '');
        chip.textContent = nome;
        chip.addEventListener('click', () => {
            categoriaRanking = campo;
            renderizarRanking();
        });
        return chip;
    }));

    if (!ultimoRanking) return;
    const lista = ultimoRanking.categorias[categoriaRanking] || [];
    const medalhas = ['🥇', '🥈', '🥉'];
    if (lista.length === 0) {
        const li = document.createElement('li');
        li.className = 'vazio';
        li.textContent = 'Ninguém pontuou aqui ainda. Seja o primeiro!';
        listaRanking.replaceChildren(li);
    } else {
        listaRanking.replaceChildren(...lista.map((item, i) => {
            const li = document.createElement('li');
            if (meuPerfil && item.nick.toLowerCase() === meuPerfil.nick.toLowerCase()) li.className = 'eu';
            const posicao = document.createElement('span');
            posicao.className = 'posicao';
            posicao.textContent = medalhas[i] || `${i + 1}º`;
            const nick = document.createElement('span');
            nick.className = 'nick';
            nick.textContent = item.nick;
            const valor = document.createElement('strong');
            valor.textContent = item.valor;
            li.append(posicao, nick, valor);
            return li;
        }));
    }

    const p = ultimoRanking.eu;
    meusNumeros.textContent =
        `Você: 💰 ${p.moedas} moedas · ❄️ ${p.acertos} acertos · 🎣 ${p.peixes} peixes · ` +
        `☕ ${p.pedidos} pedidos (recorde ${p.recordeGarcom}) · 🧠 ${p.quiz} quiz`;
}

// ==========================================
// QUIZ (Centro)
// ==========================================
const quizBanner = $('quiz-banner');
const quizPergunta = $('quiz-pergunta');
const quizProgresso = $('quiz-progresso');
let timerQuizBanner;

function mostrarQuiz(estado) {
    clearTimeout(timerQuizBanner);
    if (!estado || !salaAtual || !salaAtual.quiz) {
        quizBanner.hidden = true;
        return;
    }
    quizBanner.classList.remove('resultado');
    quizPergunta.textContent = estado.pergunta + ' (responda no chat)';
    quizBanner.hidden = false;

    // Barra de tempo diminuindo até zero
    quizProgresso.style.transition = 'none';
    quizProgresso.style.width = `${(estado.restante / estado.duracao) * 100}%`;
    void quizProgresso.offsetWidth;
    quizProgresso.style.transition = `width ${estado.restante}ms linear`;
    quizProgresso.style.width = '0%';
}

socket.on('quiz', mostrarQuiz);

socket.on('quizFim', ({ vencedor, resposta }) => {
    if (!salaAtual || !salaAtual.quiz) return;
    quizBanner.classList.add('resultado');
    quizPergunta.textContent = vencedor
        ? `🏆 ${vencedor} acertou! Resposta: ${resposta}`
        : `⏰ Ninguém acertou. A resposta era: ${resposta}`;
    quizBanner.hidden = false;
    clearTimeout(timerQuizBanner);
    timerQuizBanner = setTimeout(() => { quizBanner.hidden = true; }, 5000);
});

function chamarQuiz() {
    socket.emit('quizAgora', (resposta) => {
        if (!resposta.ok && resposta.erro) mostrarToast(resposta.erro);
    });
}

// ==========================================
// GARÇOM (Cafeteria)
// ==========================================
const CARDAPIO_EMOJI = {
    cafe: { emoji: '☕', nome: 'Café' },
    suco: { emoji: '🧃', nome: 'Suco' },
    bolo: { emoji: '🍰', nome: 'Bolo' },
    croissant: { emoji: '🥐', nome: 'Croissant' },
    biscoito: { emoji: '🍪', nome: 'Biscoito' },
    cha: { emoji: '🍵', nome: 'Chá' },
};
const MAX_BANDEJA = 6;

const garcomEl = $('garcom');
const garcomJogo = $('garcom-jogo');
const garcomFim = $('garcom-fim');
const garcomTempo = $('garcom-tempo');
const garcomPlacar = $('garcom-placar');
const garcomClienteEmoji = $('garcom-cliente-emoji');
const garcomClienteCaixa = document.querySelector('.garcom-cliente');
const garcomPedido = $('garcom-pedido');
const garcomBandejaCaixa = document.querySelector('.garcom-bandeja');
const garcomBandeja = $('garcom-bandeja');
const garcomCardapio = $('garcom-cardapio');
const garcomResultado = $('garcom-resultado');

let garcom = null; // { cardapio, bandeja, fim, timer, entregando }

function iniciarGarcom() {
    socket.emit('garcomIniciar', (resposta) => {
        if (!resposta.ok) {
            if (resposta.erro) mostrarToast(resposta.erro);
            return;
        }
        garcom = { cardapio: resposta.cardapio, bandeja: [], fim: Date.now() + resposta.duracao, entregando: false };
        garcomEl.hidden = false;
        garcomJogo.hidden = false;
        garcomFim.hidden = true;
        garcomPlacar.textContent = '✅ 0';

        garcomCardapio.replaceChildren(...garcom.cardapio.map((id, i) => {
            const btn = document.createElement('button');
            btn.title = `${CARDAPIO_EMOJI[id].nome} (tecla ${i + 1})`;
            btn.append(CARDAPIO_EMOJI[id].emoji);
            const nome = document.createElement('small');
            nome.textContent = `${i + 1}. ${CARDAPIO_EMOJI[id].nome}`;
            btn.appendChild(nome);
            btn.addEventListener('click', () => colocarNaBandeja(id));
            return btn;
        }));

        mostrarPedido(resposta.pedido);
        atualizarTempoGarcom();
        garcom.timer = setInterval(atualizarTempoGarcom, 250);
    });
}

function atualizarTempoGarcom() {
    if (!garcom) return;
    const restante = Math.max(0, Math.ceil((garcom.fim - Date.now()) / 1000));
    garcomTempo.textContent = `⏱️ ${restante}s`;
    garcomTempo.classList.toggle('acabando', restante <= 10);
}

function mostrarPedido(pedido) {
    garcomClienteEmoji.textContent = pedido.cliente;
    garcomPedido.replaceChildren(...pedido.itens.map((id) => {
        const span = document.createElement('span');
        span.textContent = CARDAPIO_EMOJI[id].emoji;
        span.title = CARDAPIO_EMOJI[id].nome;
        return span;
    }));
    garcom.bandeja = [];
    renderizarBandeja();
}

function renderizarBandeja() {
    garcomBandeja.replaceChildren(...garcom.bandeja.map((id, i) => {
        const span = document.createElement('span');
        span.textContent = CARDAPIO_EMOJI[id].emoji;
        span.title = 'Clique para tirar';
        span.addEventListener('click', () => {
            garcom.bandeja.splice(i, 1);
            renderizarBandeja();
        });
        return span;
    }));
}

function colocarNaBandeja(id) {
    if (!garcom || garcom.bandeja.length >= MAX_BANDEJA) return;
    garcom.bandeja.push(id);
    renderizarBandeja();
}

function entregarPedido() {
    if (!garcom || garcom.entregando || garcom.bandeja.length === 0) return;
    garcom.entregando = true;
    socket.emit('garcomEntregar', garcom.bandeja, (resposta) => {
        if (!garcom) return;
        garcom.entregando = false;
        if (!resposta.ok) return;
        if (resposta.certo) {
            garcomPlacar.textContent = `✅ ${resposta.entregues}`;
            garcomClienteCaixa.classList.remove('certo');
            void garcomClienteCaixa.offsetWidth;
            garcomClienteCaixa.classList.add('certo');
            mostrarPedido(resposta.pedido);
        } else {
            garcomBandejaCaixa.classList.remove('errado');
            void garcomBandejaCaixa.offsetWidth;
            garcomBandejaCaixa.classList.add('errado');
            setTimeout(() => garcomBandejaCaixa.classList.remove('errado'), 300);
        }
    });
}

socket.on('garcomFim', ({ entregues, moedas, recorde }) => {
    if (garcom) clearInterval(garcom.timer);
    garcom = null;
    garcomJogo.hidden = true;
    garcomFim.hidden = false;
    garcomEl.hidden = false;
    const plural = entregues === 1 ? 'pedido' : 'pedidos';
    garcomResultado.textContent = `Fim do turno! ☕\nVocê atendeu ${entregues} ${plural} e ganhou ${moedas} 💰.\nSeu recorde: ${recorde}`;
    garcomResultado.style.whiteSpace = 'pre-line';
});

function fecharGarcom() {
    if (garcom) socket.emit('garcomSair'); // o servidor manda 'garcomFim' com o resultado
    else garcomEl.hidden = true;
}

$('garcom-entregar').addEventListener('click', entregarPedido);
$('garcom-limpar').addEventListener('click', () => {
    if (!garcom) return;
    garcom.bandeja = [];
    renderizarBandeja();
});
$('garcom-sair').addEventListener('click', fecharGarcom);
$('garcom-fechar').addEventListener('click', () => { garcomEl.hidden = true; });
$('garcom-denovo').addEventListener('click', iniciarGarcom);

// Atalhos do garçom (capturados antes dos outros atalhos do jogo)
window.addEventListener('keydown', (e) => {
    if (garcomEl.hidden) return;
    if (e.key === 'Escape') {
        fecharGarcom();
    } else if (garcom && /^[1-6]$/.test(e.key)) {
        colocarNaBandeja(garcom.cardapio[Number(e.key) - 1]);
    } else if (garcom && e.key === 'Backspace') {
        garcom.bandeja.pop();
        renderizarBandeja();
    } else if (garcom && e.key === 'Enter') {
        entregarPedido();
    } else {
        return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
}, true);

// ==========================================
// LOJA DE COSMÉTICOS
// ==========================================
const lojaEl = $('loja');
const lojaAbas = $('loja-abas');
const lojaItens = $('loja-itens');
const lojaSaldo = $('loja-saldo');
const lojaPreview = $('loja-preview');
const lojaDica = $('loja-dica');
const DICA_LOJA = 'Passe o mouse num item para provar 👀';

let slotsLoja = [];
let catalogoLoja = new Map();
let slotLojaAtual = 'cabeca';
let itemConfirmando = null;
let timerConfirmar;

// O catálogo vem do servidor (loja.js) quando a pessoa entra no jogo
function configurarLoja(dados) {
    if (!dados) return;
    slotsLoja = dados.slots;
    catalogoLoja = new Map(dados.catalogo.map((item) => [item.id, item]));
}

function itemDaLoja(id) {
    return id ? catalogoLoja.get(id) || null : null;
}

// Capivara + camadas de cosméticos (usado nos jogadores e no provador da loja)
function criarCorpo() {
    const corpo = document.createElement('div');
    corpo.className = 'corpo';
    const cosmeticosAtras = document.createElement('div');
    cosmeticosAtras.className = 'cosmeticos';
    const sprite = document.createElement('div');
    sprite.className = 'capivara-sprite';
    const cosmeticos = document.createElement('div');
    cosmeticos.className = 'cosmeticos';
    corpo.append(cosmeticosAtras, sprite, cosmeticos);
    return { corpo, sprite, cosmeticos, cosmeticosAtras };
}

function desenharVisual(partes, visual) {
    partes.cosmeticos.replaceChildren();
    partes.cosmeticosAtras.replaceChildren();
    for (const itemId of Object.values(visual || {})) {
        const item = itemDaLoja(itemId);
        if (!item) continue;

        if (item.slot === 'efeito') {
            const efeito = document.createElement('div');
            efeito.className = 'efeito';
            for (let i = 0; i < 4; i++) {
                const particula = document.createElement('span');
                particula.textContent = item.emoji;
                efeito.appendChild(particula);
            }
            partes.cosmeticos.appendChild(efeito);
            continue;
        }

        const el = document.createElement('span');
        el.className = 'cosmetico';
        el.textContent = item.emoji;
        el.style.left = `${item.x}%`;
        el.style.top = `${item.y}%`;
        el.style.fontSize = `${item.tam}px`;
        (item.atras ? partes.cosmeticosAtras : partes.cosmeticos).appendChild(el);
    }
}

socket.on('jogadorVisual', ({ id, visual }) => {
    const jogador = jogadores.get(id);
    if (!jogador) return;
    jogador.dados.visual = visual;
    desenharVisual(jogador.partes, visual);
});

// Provador da loja
const provador = criarCorpo();
lojaPreview.appendChild(provador.corpo);

function desenharProvador(provando) {
    if (!meuPerfil) return;
    aplicarCor(provador.sprite, meusDados ? meusDados.cor : 0);
    const visual = { ...meuPerfil.visual };
    if (provando) visual[provando.slot] = provando.id;
    desenharVisual(provador, visual);
}

function abrirLoja() {
    if (!meuPerfil) return;
    itemConfirmando = null;
    lojaEl.hidden = false;
    lojaDica.textContent = DICA_LOJA;
    renderizarLoja();
}

function fecharLoja() {
    lojaEl.hidden = true;
}

function renderizarLoja() {
    if (!meuPerfil) return;
    lojaSaldo.textContent = `💰 ${meuPerfil.moedas}`;
    desenharProvador(null);

    lojaAbas.replaceChildren(...slotsLoja.map((slot) => {
        const chip = document.createElement('button');
        chip.className = 'chip' + (slot.id === slotLojaAtual ? ' ativo' : '');
        chip.textContent = `${slot.icone} ${slot.nome}`;
        chip.addEventListener('click', () => {
            slotLojaAtual = slot.id;
            itemConfirmando = null;
            renderizarLoja();
        });
        return chip;
    }));

    const equipado = meuPerfil.visual[slotLojaAtual];
    const itens = [...catalogoLoja.values()]
        .filter((item) => item.slot === slotLojaAtual)
        .sort((a, b) => a.preco - b.preco);

    // Primeiro cartão: tirar o item do slot
    const nenhum = criarCartaoLoja('🚫', 'Nenhum', equipado ? 'Tirar' : '✓ Usando', equipado ? 'comprado' : 'equipado');
    nenhum.addEventListener('click', () => { if (equipado) equipar(slotLojaAtual, null); });

    lojaItens.replaceChildren(nenhum, ...itens.map((item) => {
        const temItem = meuPerfil.itens.includes(item.id);
        let acao, classe;
        if (equipado === item.id) { acao = '✓ Usando'; classe = 'equipado'; }
        else if (temItem) { acao = 'Usar'; classe = 'comprado'; }
        else if (itemConfirmando === item.id) { acao = 'Confirmar?'; classe = 'confirmando'; }
        else { acao = `💰 ${item.preco}`; classe = meuPerfil.moedas < item.preco ? 'caro' : ''; }

        const cartao = criarCartaoLoja(item.emoji, item.nome, acao, classe);
        cartao.addEventListener('mouseenter', () => {
            desenharProvador(item);
            lojaDica.textContent = temItem ? `${item.nome}` : `${item.nome} · 💰 ${item.preco}`;
        });
        cartao.addEventListener('mouseleave', () => {
            desenharProvador(null);
            lojaDica.textContent = DICA_LOJA;
        });
        cartao.addEventListener('click', () => clicarItem(item));
        return cartao;
    }));
}

function criarCartaoLoja(emoji, nome, acao, classe) {
    const cartao = document.createElement('button');
    cartao.className = 'item-loja' + (classe ? ` ${classe}` : '');
    const elEmoji = document.createElement('span');
    elEmoji.className = 'emoji';
    elEmoji.textContent = emoji;
    const elNome = document.createElement('span');
    elNome.className = 'nome';
    elNome.textContent = nome;
    const elAcao = document.createElement('span');
    elAcao.className = 'acao';
    elAcao.textContent = acao;
    cartao.append(elEmoji, elNome, elAcao);
    return cartao;
}

function clicarItem(item) {
    if (meuPerfil.visual[item.slot] === item.id) return;
    if (meuPerfil.itens.includes(item.id)) return equipar(item.slot, item.id);

    if (meuPerfil.moedas < item.preco) {
        mostrarToast(`Faltam ${item.preco - meuPerfil.moedas} 💰 para comprar ${item.nome}. Jogue os minigames!`);
        return;
    }
    // Compra em dois cliques, para não gastar moedas sem querer
    if (itemConfirmando !== item.id) {
        itemConfirmando = item.id;
        clearTimeout(timerConfirmar);
        timerConfirmar = setTimeout(() => { itemConfirmando = null; if (!lojaEl.hidden) renderizarLoja(); }, 3000);
        renderizarLoja();
        return;
    }
    itemConfirmando = null;
    socket.emit('comprar', item.id, (resposta) => {
        if (!resposta.ok) return mostrarToast(resposta.erro || 'Não foi possível comprar.');
        mostrarToast(`Você comprou ${item.emoji} ${item.nome}! 🎉`);
    });
}

function equipar(slot, itemId) {
    socket.emit('equipar', { slot, itemId }, (resposta) => {
        if (!resposta.ok && resposta.erro) mostrarToast(resposta.erro);
    });
}

$('btn-loja').addEventListener('click', abrirLoja);
$('loja-fechar').addEventListener('click', fecharLoja);
lojaEl.addEventListener('click', (e) => { if (e.target === lojaEl) fecharLoja(); });
window.addEventListener('keydown', (e) => {
    if (lojaEl.hidden || e.key !== 'Escape') return;
    fecharLoja();
    e.preventDefault();
    e.stopImmediatePropagation();
}, true);

// ==========================================
// 5. CHAT (BALÃO + HISTÓRICO)
// ==========================================
let digitandoAtivo = false;
let timerDigitando;

chatInput.addEventListener('input', () => {
    if (!digitandoAtivo && chatInput.value.trim() && !chatInput.value.startsWith('/')) {
        digitandoAtivo = true;
        socket.emit('digitando', true);
    }
    clearTimeout(timerDigitando);
    timerDigitando = setTimeout(pararDeDigitar, TEMPO_DIGITANDO_MS);
});

chatInput.addEventListener('blur', pararDeDigitar);

function pararDeDigitar() {
    clearTimeout(timerDigitando);
    if (!digitandoAtivo) return;
    digitandoAtivo = false;
    socket.emit('digitando', false);
}

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        chatInput.blur();
        return;
    }
    if (e.key !== 'Enter') return;

    const mensagem = chatInput.value.trim();
    chatInput.value = '';
    pararDeDigitar();
    if (!mensagem) {
        chatInput.blur();
        return;
    }

    if (mensagem.startsWith('/')) executarComando(mensagem);
    else socket.emit('chat', mensagem);
});

// Enter em qualquer lugar foca o chat
document.addEventListener('keydown', (e) => {
    if (!salaAtual || e.key !== 'Enter' || document.activeElement === chatInput) return;
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    e.preventDefault();
    chatInput.focus();
});

function executarComando(texto) {
    const [comando] = texto.slice(1).toLowerCase().split(/\s+/);
    if (EMOJI_EMOTES[comando]) {
        socket.emit('emote', comando);
    } else if (comando === 'portas') {
        const ligado = jogoContainer.classList.toggle('debug-portas');
        mostrarToast(ligado ? 'Mostrando as áreas das portas' : 'Áreas das portas escondidas');
    } else if (comando === 'quiz') {
        chamarQuiz();
    } else if (comando === 'loja') {
        abrirLoja();
    } else if (comando === 'ranking') {
        abrirPainel('ranking');
    } else if (comando === 'limpar') {
        listaMensagens.replaceChildren();
    } else if (comando === 'ajuda') {
        adicionarMensagemLog({
            tipo: 'sistema',
            hora: Date.now(),
            texto: `Comandos: ${Object.keys(EMOJI_EMOTES).map((c) => '/' + c).join(', ')}, /loja, /quiz, /ranking, /limpar, /portas, /ajuda. ` +
                'Clique no chão para andar, ande até as saídas para trocar de sala e use Enter para falar. ' +
                'Bola de neve: botão direito do mouse, ou ❄️ / tecla B para mirar. ' +
                'Minigames: 🎣 pescaria na Praia, ☕ garçom na Cafeteria, 🧠 quiz no Centro e guerra de bolas de neve. ' +
                'Tudo dá moedas 💰: veja o ranking clicando nas suas moedas e gaste na 🛍️ Loja de cosméticos.',
        });
        abrirPainel('chat');
    } else {
        mostrarToast(`Comando desconhecido: /${comando}. Digite /ajuda`);
    }
}

function falar(jogador, texto) {
    const { balao } = jogador;
    balao.textContent = texto;
    balao.classList.remove('visivel');
    void balao.offsetWidth;
    balao.classList.add('visivel');
    jogador.digitando.classList.remove('visivel');

    clearTimeout(jogador.timers.balao);
    jogador.timers.balao = setTimeout(() => balao.classList.remove('visivel'), TEMPO_BALAO_MS);
}

socket.on('mensagem', (item) => {
    adicionarMensagemLog(item);
    if (item.tipo === 'chat' && painel.hidden) {
        naoLidas++;
        atualizarBadge();
    }
    if (item.tipo === 'chat') {
        const jogador = jogadores.get(item.id);
        if (jogador) falar(jogador, item.texto);
    }
});

socket.on('digitando', ({ id, digitando }) => {
    const jogador = jogadores.get(id);
    if (!jogador) return;
    jogador.digitando.classList.toggle('visivel', digitando);
    clearTimeout(jogador.timers.digitando);
    if (digitando) {
        // Segurança: some sozinho se o "parou de digitar" se perder
        jogador.timers.digitando = setTimeout(() => jogador.digitando.classList.remove('visivel'), 10000);
    }
});

socket.on('aviso', mostrarToast);

function adicionarMensagemLog(item) {
    const li = document.createElement('li');
    li.className = `msg msg-${item.tipo}`;

    const hora = document.createElement('time');
    hora.textContent = formatarHora(item.hora);
    li.appendChild(hora);

    if (item.tipo === 'chat') {
        const nick = document.createElement('strong');
        nick.textContent = item.nick;
        nick.style.color = corDoNick(item.cor);
        li.append(nick, document.createTextNode(': ' + item.texto));
        if (item.id === meuId) li.classList.add('minha');
    } else {
        li.appendChild(document.createTextNode(item.texto));
    }

    const estavaNoFim = listaMensagens.scrollHeight - listaMensagens.scrollTop - listaMensagens.clientHeight < 40;
    listaMensagens.appendChild(li);
    while (listaMensagens.children.length > MAX_MENSAGENS_LOG) listaMensagens.firstChild.remove();
    if (estavaNoFim) listaMensagens.scrollTop = listaMensagens.scrollHeight;
}

// ==========================================
// 6. EMOTES E COR
// ==========================================
document.querySelectorAll('#emotes [data-emote]').forEach((btn) => {
    btn.addEventListener('click', () => socket.emit('emote', btn.dataset.emote));
});

socket.on('emote', ({ id, emote }) => {
    const jogador = jogadores.get(id);
    if (!jogador) return;

    const { el, emote: elEmote } = jogador;
    Object.keys(EMOJI_EMOTES).forEach((nome) => el.classList.remove(`emote-${nome}`));
    void el.offsetWidth;
    el.classList.add(`emote-${emote}`);

    elEmote.textContent = EMOJI_EMOTES[emote];
    elEmote.classList.remove('visivel');
    void elEmote.offsetWidth;
    elEmote.classList.add('visivel');

    const duracao = emote === 'dormir' ? 6000 : emote === 'mortal' ? 900 : 2200;
    clearTimeout(jogador.timers.emote);
    jogador.timers.emote = setTimeout(() => {
        el.classList.remove(`emote-${emote}`);
        elEmote.classList.remove('visivel');
    }, duracao);
});

let timerCor;
inputCorJogo.addEventListener('input', () => {
    const cor = Number(inputCorJogo.value);
    const eu = jogadores.get(meuId);
    if (eu) aplicarCor(eu.sprite, cor);

    // Só avisa o servidor quando o usuário para de arrastar
    clearTimeout(timerCor);
    timerCor = setTimeout(() => {
        socket.emit('mudarCor', cor);
        localStorage.setItem('capivara:cor', cor);
        if (meusDados) meusDados.cor = cor;
    }, 200);
});

// ==========================================
// 7. PAINEL (CHAT / ONLINE)
// ==========================================
document.querySelectorAll('.aba').forEach((aba) => {
    aba.addEventListener('click', () => abrirPainel(aba.dataset.aba));
});

let naoLidas = 0;
function atualizarBadge() {
    badgeNaoLidas.textContent = naoLidas > 99 ? '99+' : naoLidas;
    badgeNaoLidas.hidden = naoLidas === 0;
}

function fecharPainel(lembrar = true) {
    painel.hidden = true;
    btnAbrirPainel.hidden = false;
    if (lembrar) localStorage.setItem('capivara:painel', 'fechado');
}

function abrirPainel(aba) {
    painel.hidden = false;
    btnAbrirPainel.hidden = true;
    naoLidas = 0;
    atualizarBadge();
    localStorage.setItem('capivara:painel', 'aberto');
    document.querySelectorAll('.aba').forEach((a) => a.classList.toggle('ativa', a.dataset.aba === aba));
    listaMensagens.hidden = aba !== 'chat';
    listaOnline.hidden = aba !== 'online';
    painelRanking.hidden = aba !== 'ranking';
    if (aba === 'chat') listaMensagens.scrollTop = listaMensagens.scrollHeight;
    if (aba === 'ranking') {
        renderizarRanking();
        pedirRanking();
    }
}

btnFecharPainel.addEventListener('click', () => fecharPainel());
btnAbrirPainel.addEventListener('click', () => abrirPainel('chat'));

function renderizarListaOnline() {
    const lista = [...jogadores.values()]
        .map((j) => j.dados)
        .sort((a, b) => (a.id === meuId ? -1 : b.id === meuId ? 1 : a.nick.localeCompare(b.nick)));

    contadorOnline.textContent = lista.length;
    listaOnline.replaceChildren(...lista.map((d) => {
        const li = document.createElement('li');
        const bolinha = document.createElement('span');
        bolinha.className = 'bolinha';
        bolinha.style.background = corDoNick(d.cor);
        li.append(bolinha, document.createTextNode(d.nick + (d.id === meuId ? ' (você)' : '')));
        return li;
    }));
}

// ==========================================
// 8. CONEXÃO / RECONEXÃO
// ==========================================
socket.on('disconnect', () => {
    if (meusDados) statusConexao.hidden = false;
});

socket.on('connect', () => {
    if (!meusDados) return;
    // Voltou a conexão: entra de novo com os mesmos dados
    socket.emit('entrar', meusDados, (resposta) => {
        if (!resposta.ok) {
            statusConexao.textContent = 'Não foi possível reconectar. Recarregue a página.';
            return;
        }
        statusConexao.hidden = true;
        meusDados.nick = resposta.eu.nick;
        configurarLoja(resposta.loja);
        atualizarPerfil(resposta.perfil);
        carregarSala(resposta);
        mostrarToast('Reconectado!');
    });
});
