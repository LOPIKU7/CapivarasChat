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

    const sprite = document.createElement('div');
    sprite.className = 'capivara-sprite';

    const nome = document.createElement('div');
    nome.className = 'nome-jogador';
    nome.textContent = dados.nick;

    el.append(balao, digitando, emote, sprite, nome);
    camadaJogadores.appendChild(el);

    const jogador = { dados: { ...dados }, el, sprite, balao, digitando, emote, timers: {} };
    jogadores.set(dados.id, jogador);

    aplicarCor(sprite, dados.cor);
    posicionar(jogador, dados.x, dados.y, false);
    virar(jogador, dados.direcao);
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
jogoContainer.addEventListener('click', (e) => {
    const eu = jogadores.get(meuId);
    if (!eu) return;

    const rect = jogoContainer.getBoundingClientRect();
    const x = Math.min(98, Math.max(2, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(99, Math.max(salaAtual.minY, ((e.clientY - rect.top) / rect.height) * 100));

    marcadorDestino.style.left = `${x}%`;
    marcadorDestino.style.top = `${y}%`;
    marcadorDestino.classList.remove('visivel');
    void marcadorDestino.offsetWidth; // reinicia a animação
    marcadorDestino.classList.add('visivel');

    moverJogador(eu, x, y);
    socket.emit('mover', { x, y });
});

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
    } else if (comando === 'limpar') {
        listaMensagens.replaceChildren();
    } else if (comando === 'ajuda') {
        adicionarMensagemLog({
            tipo: 'sistema',
            hora: Date.now(),
            texto: `Comandos: ${Object.keys(EMOJI_EMOTES).map((c) => '/' + c).join(', ')}, /limpar, /portas, /ajuda. ` +
                'Clique no chão para andar, ande até as saídas para trocar de sala e use Enter para falar.',
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
    if (aba === 'chat') listaMensagens.scrollTop = listaMensagens.scrollHeight;
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
        carregarSala(resposta);
        mostrarToast('Reconectado!');
    });
});
