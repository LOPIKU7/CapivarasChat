const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const perfis = require('./perfis');
const loja = require('./loja');
const criarPescaria = require('./minigames/pescaria');
const criarGarcom = require('./minigames/garcom');
const criarQuiz = require('./minigames/quiz');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' } // Evita problemas de conexão no Render
});

// Define que a pasta 'public' é o frontend do jogo
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// CONFIGURAÇÕES
// ==========================================
const PORTA = process.env.PORT || 3000;
const MAX_NICK = 35;
const MAX_MENSAGEM = 60;
const HISTORICO_POR_SALA = 30;
const INTERVALO_MIN_CHAT_MS = 700; // anti-spam: 1 mensagem a cada 0,7s
const TEMPO_CONGELADO_MS = 3000;   // quanto tempo fica congelado ao levar uma bola de neve
const RECARGA_BOLA_MS = 800;       // intervalo mínimo entre duas bolas do mesmo jogador
const MOEDAS_POR_ACERTO = 2;       // bola de neve
const ESPERA_MOEDAS_MESMO_ALVO_MS = 30000; // acertar a mesma capivara de novo só dá moedas depois disso
const MOEDAS_POR_PEDIDO = 3;       // garçom
const MOEDAS_QUIZ = 10;
const EMOTES = ['mortal', 'acenar', 'dancar', 'pular', 'coracao', 'risada', 'dormir'];

// Salas disponíveis. Posições são em % da tela, no ponto das patas da capivara.
// minY = até onde a capivara pode subir; spawn = onde ela aparece ao chegar pela barra de salas;
// bolaDeNeve = se dá para jogar bola de neve na sala; pesca/garcom/quiz = minigame da sala.
const SALAS = {
    centro:    { id: 'centro',    nome: 'Centro',    minY: 12, spawn: { x: 50, y: 75 }, bolaDeNeve: true, quiz: true },
    parque:    { id: 'parque',    nome: 'Parque',    minY: 12, spawn: { x: 50, y: 75 }, bolaDeNeve: true },
    praia:     { id: 'praia',     nome: 'Praia',     minY: 12, spawn: { x: 50, y: 75 }, bolaDeNeve: true, pesca: true },
    cafeteria: { id: 'cafeteria', nome: 'Cafeteria', minY: 12, spawn: { x: 50, y: 75 }, bolaDeNeve: false, garcom: true },
};
const SALA_INICIAL = 'centro';

// ==========================================
// ESTADO DO SERVIDOR
// ==========================================
const jogadores = new Map(); // socket.id -> jogador
const bolas = new Map(); // bolaId -> bola de neve no ar (ou que acabou de cair)
let proximaBolaId = 1;
const historico = Object.fromEntries(Object.keys(SALAS).map((id) => [id, []]));

function limitar(valor, min, max) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

function limparTexto(texto, max) {
    if (typeof texto !== 'string') return '';
    // Remove caracteres de controle e espaços repetidos
    return texto.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function nickEmUso(nick) {
    const alvo = nick.toLowerCase();
    for (const j of jogadores.values()) {
        if (j.nick.toLowerCase() === alvo) return true;
    }
    return false;
}

function nickDisponivel(nickBase) {
    if (!nickEmUso(nickBase)) return nickBase;
    for (let i = 2; i < 1000; i++) {
        const sufixo = String(i);
        const tentativa = nickBase.slice(0, MAX_NICK - sufixo.length) + sufixo;
        if (!nickEmUso(tentativa)) return tentativa;
    }
    return null;
}

function posicaoNaSala(salaId, pedida) {
    const sala = SALAS[salaId];
    // Quem passa por uma porta chega no ponto de spawn daquela porta;
    // quem usa a barra de salas aparece perto do spawn padrão (um pouco espalhado).
    if (pedida && Number.isFinite(Number(pedida.x)) && Number.isFinite(Number(pedida.y))) {
        return { x: limitar(pedida.x, 2, 98), y: limitar(pedida.y, sala.minY, 99) };
    }
    return {
        x: limitar(sala.spawn.x + (Math.random() - 0.5) * 20, 2, 98),
        y: limitar(sala.spawn.y + (Math.random() - 0.5) * 8, sala.minY, 99),
    };
}

function jogadoresDaSala(salaId) {
    return [...jogadores.values()].filter((j) => j.sala === salaId);
}

function contagemSalas() {
    const contagem = Object.fromEntries(Object.keys(SALAS).map((id) => [id, 0]));
    for (const j of jogadores.values()) contagem[j.sala]++;
    return contagem;
}

function enviarContagemSalas() {
    io.emit('contagemSalas', { contagem: contagemSalas(), total: jogadores.size });
}

function estaCongelado(j) {
    return j.congeladoAte > Date.now();
}

function publico(j) {
    return {
        id: j.id, nick: j.nick, cor: j.cor, x: j.x, y: j.y, direcao: j.direcao,
        congelado: Math.max(0, j.congeladoAte - Date.now()), // ms que ainda faltam
        pescando: pescaria.estaPescando(j),
        atividade: garcom.estaJogando(j) ? '🍽️' : null,
        visual: j.perfil.visual,
    };
}

function perfilPublico(p) {
    const { nick, moedas, acertos, peixes, pedidos, quiz, recordeGarcom, itens, visual } = p;
    return { nick, moedas, acertos, peixes, pedidos, quiz, recordeGarcom, itens, visual };
}

/**
 * Dá moedas e/ou soma uma estatística no perfil do jogador.
 * @param {object} jogador
 * @param {{ moedas?: number, campo?: string, qtd?: number }} premio
 */
function recompensar(jogador, { moedas = 0, campo = null, qtd = 1 }) {
    const perfil = jogador.perfil;
    perfil.moedas += moedas;
    if (campo) perfil[campo] += qtd;
    perfis.salvar();

    const socket = io.sockets.sockets.get(jogador.id);
    if (socket) socket.emit('perfil', perfilPublico(perfil));
    if (moedas > 0) io.to(jogador.sala).emit('ganhouMoedas', { id: jogador.id, qtd: moedas });
}

function registrarNoHistorico(salaId, item) {
    const lista = historico[salaId];
    lista.push(item);
    if (lista.length > HISTORICO_POR_SALA) lista.shift();
}

function mensagemSistema(salaId, texto, tipo = 'sistema') {
    const item = { tipo, texto, hora: Date.now() };
    registrarNoHistorico(salaId, item);
    io.to(salaId).emit('mensagem', item);
}

// ==========================================
// MINIGAMES
// ==========================================
const pescaria = criarPescaria({
    io, jogadores, mensagemSistema, estaCongelado,
    aoPescar: (jogador, peixe) => recompensar(jogador, {
        moedas: peixe.valor,
        campo: peixe.id === 'bota' ? null : 'peixes', // bota velha não conta como peixe 😅
    }),
});

const garcom = criarGarcom({
    io, jogadores, mensagemSistema,
    aoTerminar: (jogador, entregues) => {
        const moedas = entregues * MOEDAS_POR_PEDIDO;
        jogador.perfil.recordeGarcom = Math.max(jogador.perfil.recordeGarcom, entregues);
        recompensar(jogador, { moedas, campo: 'pedidos', qtd: entregues });
        return { moedas, recorde: jogador.perfil.recordeGarcom };
    },
});

const quiz = criarQuiz({
    io, jogadores, mensagemSistema,
    aoAcertar: (jogador) => {
        recompensar(jogador, { moedas: MOEDAS_QUIZ, campo: 'quiz' });
        return MOEDAS_QUIZ;
    },
});

// Andar/trocar de sala/sair cancela o que o jogador estiver fazendo
function interromperMinigames(jogador, { garcomTambem = true } = {}) {
    pescaria.interromper(jogador);
    if (garcomTambem) garcom.interromper(jogador);
}

function colocarNaSala(socket, jogador, salaId, posicaoPedida) {
    const pos = posicaoNaSala(salaId, posicaoPedida);
    jogador.sala = salaId;
    jogador.x = pos.x;
    jogador.y = pos.y;
    socket.join(salaId);
    socket.to(salaId).emit('jogadorEntrou', publico(jogador));
    mensagemSistema(salaId, `${jogador.nick} entrou na sala`);

    return {
        sala: SALAS[salaId],
        jogadores: jogadoresDaSala(salaId).map(publico),
        historico: historico[salaId],
        quiz: salaId === quiz.SALA ? quiz.estado() : null,
    };
}

function tirarDaSala(socket, jogador, avisoTexto) {
    const salaId = jogador.sala;
    socket.leave(salaId);
    socket.to(salaId).emit('jogadorSaiu', jogador.id);
    mensagemSistema(salaId, avisoTexto);
}

// ==========================================
// MULTIPLAYER
// ==========================================
io.on('connection', (socket) => {
    console.log(`Uma capivara se conectou! ID: ${socket.id}`);

    // Lista de salas para a tela de login
    socket.emit('salas', { salas: Object.values(SALAS), contagem: contagemSalas() });

    pescaria.registrar(socket);
    garcom.registrar(socket);
    quiz.registrar(socket);

    // ==========================================
    // LOJA DE COSMÉTICOS
    // ==========================================
    function avisarVisual(jogador) {
        io.to(jogador.sala).emit('jogadorVisual', { id: jogador.id, visual: jogador.perfil.visual });
        socket.emit('perfil', perfilPublico(jogador.perfil));
        perfis.salvar();
    }

    socket.on('comprar', (itemId, responder) => {
        const jogador = jogadores.get(socket.id);
        const item = loja.item(itemId);
        if (typeof responder !== 'function' || !jogador) return;
        if (!item) return responder({ ok: false, erro: 'Esse item não existe.' });

        const perfil = jogador.perfil;
        if (perfil.itens.includes(item.id)) return responder({ ok: false, erro: 'Você já tem esse item!' });
        if (perfil.moedas < item.preco) {
            return responder({ ok: false, erro: `Faltam ${item.preco - perfil.moedas} 💰 para comprar ${item.nome}.` });
        }

        perfil.moedas -= item.preco;
        perfil.itens.push(item.id);
        perfil.visual[item.slot] = item.id; // já sai usando
        avisarVisual(jogador);
        responder({ ok: true });
    });

    // dados = { slot, itemId } (itemId null tira o item do slot)
    socket.on('equipar', (dados, responder) => {
        const jogador = jogadores.get(socket.id);
        if (typeof responder !== 'function' || !jogador) return;
        const slot = dados?.slot;
        if (!loja.SLOTS.some((s) => s.id === slot)) return responder({ ok: false });

        const itemId = dados.itemId ?? null;
        if (itemId !== null) {
            const item = loja.item(itemId);
            if (!item || item.slot !== slot || !jogador.perfil.itens.includes(itemId)) {
                return responder({ ok: false, erro: 'Você não tem esse item.' });
            }
        }

        jogador.perfil.visual[slot] = itemId;
        avisarVisual(jogador);
        responder({ ok: true });
    });

    socket.on('pedirRanking', (responder) => {
        const jogador = jogadores.get(socket.id);
        if (typeof responder !== 'function' || !jogador) return;
        responder({ categorias: perfis.ranking(10), eu: perfilPublico(jogador.perfil) });
    });

    socket.on('entrar', (dados, responder) => {
        if (typeof responder !== 'function') return;
        if (jogadores.has(socket.id)) return responder({ ok: false, erro: 'Você já está no jogo.' });

        const nickBase = limparTexto(dados?.nick, MAX_NICK);
        if (!nickBase) return responder({ ok: false, erro: 'Digite um nickname.' });

        const nick = nickDisponivel(nickBase);
        if (!nick) return responder({ ok: false, erro: 'Esse nickname já está em uso.' });

        const salaId = SALAS[dados?.sala] ? dados.sala : SALA_INICIAL;
        const jogador = {
            id: socket.id,
            nick,
            cor: Math.round(limitar(dados?.cor, 0, 360)),
            direcao: 1,
            sala: salaId,
            x: 50,
            y: 70,
            ultimoChat: 0,
            ultimaBola: 0,
            congeladoAte: 0,
            moedasPorAlvo: new Map(), // nick do alvo -> última vez que ganhou moedas acertando ele
            perfil: perfis.obter(nick),
        };
        jogadores.set(socket.id, jogador);

        const estado = colocarNaSala(socket, jogador, salaId, dados?.posicao);
        responder({
            ok: true, eu: publico(jogador), salas: Object.values(SALAS),
            perfil: perfilPublico(jogador.perfil),
            loja: { slots: loja.SLOTS, catalogo: loja.CATALOGO },
            ...estado,
        });
        enviarContagemSalas();
        console.log(`${nick} entrou em ${salaId}`);
    });

    socket.on('mover', (dados) => {
        const jogador = jogadores.get(socket.id);
        if (!jogador || estaCongelado(jogador)) return;

        const sala = SALAS[jogador.sala];
        const x = limitar(dados?.x, 2, 98);
        const y = limitar(dados?.y, sala.minY, 99);
        if (x !== jogador.x) jogador.direcao = x > jogador.x ? 1 : -1;
        jogador.x = x;
        jogador.y = y;
        interromperMinigames(jogador, { garcomTambem: false });

        socket.to(jogador.sala).emit('jogadorMoveu', { id: jogador.id, x, y, direcao: jogador.direcao });
    });

    socket.on('chat', (texto) => {
        const jogador = jogadores.get(socket.id);
        if (!jogador) return;

        const agora = Date.now();
        if (agora - jogador.ultimoChat < INTERVALO_MIN_CHAT_MS) {
            socket.emit('aviso', 'Calma! Você está mandando mensagens rápido demais.');
            return;
        }

        const mensagem = limparTexto(texto, MAX_MENSAGEM);
        if (!mensagem) return;
        jogador.ultimoChat = agora;

        const item = { tipo: 'chat', id: jogador.id, nick: jogador.nick, cor: jogador.cor, texto: mensagem, hora: agora };
        registrarNoHistorico(jogador.sala, item);
        io.to(jogador.sala).emit('mensagem', item);
        quiz.aoChat(jogador, mensagem);
    });

    socket.on('digitando', (estaDigitando) => {
        const jogador = jogadores.get(socket.id);
        if (!jogador) return;
        socket.to(jogador.sala).emit('digitando', { id: jogador.id, digitando: Boolean(estaDigitando) });
    });

    socket.on('emote', (nome) => {
        const jogador = jogadores.get(socket.id);
        if (!jogador || !EMOTES.includes(nome) || estaCongelado(jogador)) return;
        io.to(jogador.sala).emit('emote', { id: jogador.id, emote: nome });
    });

    socket.on('mudarCor', (cor) => {
        const jogador = jogadores.get(socket.id);
        if (!jogador) return;
        jogador.cor = Math.round(limitar(cor, 0, 360));
        io.to(jogador.sala).emit('jogadorMudouCor', { id: jogador.id, cor: jogador.cor });
    });

    // dados = { sala, posicao? } — posicao vem quando a capivara entra por uma porta
    socket.on('trocarSala', (dados, responder) => {
        const jogador = jogadores.get(socket.id);
        const salaId = dados?.sala;
        if (typeof responder !== 'function') return;
        if (!jogador || !SALAS[salaId] || salaId === jogador.sala) return responder({ ok: false });
        if (estaCongelado(jogador)) return responder({ ok: false, erro: 'Você está congelado! ❄️' });

        interromperMinigames(jogador);
        tirarDaSala(socket, jogador, `${jogador.nick} foi para ${SALAS[salaId].nome}`);
        const estado = colocarNaSala(socket, jogador, salaId, dados.posicao);
        responder({ ok: true, eu: publico(jogador), ...estado });
        enviarContagemSalas();
    });

    // ==========================================
    // BOLA DE NEVE
    // ==========================================
    socket.on('jogarBola', (alvo) => {
        const jogador = jogadores.get(socket.id);
        if (!jogador || !SALAS[jogador.sala].bolaDeNeve || estaCongelado(jogador)) return;

        const agora = Date.now();
        if (agora - jogador.ultimaBola < RECARGA_BOLA_MS) return;
        jogador.ultimaBola = agora;

        const x = limitar(alvo?.x, 0, 100);
        const y = limitar(alvo?.y, 0, 100);
        if (x !== jogador.x) jogador.direcao = x > jogador.x ? 1 : -1;

        // Quanto mais longe, mais tempo no ar
        const duracao = Math.round(limitar(250 + Math.hypot(x - jogador.x, y - jogador.y) * 9, 350, 1100));
        const bolaId = proximaBolaId++;
        bolas.set(bolaId, { id: bolaId, de: jogador.id, sala: jogador.sala, x, y, caiEm: agora + duracao, atingidos: new Set() });
        setTimeout(() => bolas.delete(bolaId), duracao + 1500);

        io.to(jogador.sala).emit('bolaJogada', { bolaId, id: jogador.id, x, y, duracao, direcao: jogador.direcao });
    });

    // Quem foi atingido avisa (cada um confere a bola caindo em cima da própria capivara,
    // do jeito que está vendo na tela). O servidor valida e congela.
    socket.on('atingido', (dados) => {
        const jogador = jogadores.get(socket.id);
        const bola = bolas.get(Number(dados?.bolaId));
        if (!jogador || !bola) return;
        if (bola.sala !== jogador.sala || bola.de === jogador.id || bola.atingidos.has(jogador.id)) return;
        if (Date.now() < bola.caiEm - 250 || estaCongelado(jogador)) return;

        // A posição informada precisa estar perto de onde a bola caiu
        const x = limitar(dados.x, 2, 98);
        const y = limitar(dados.y, SALAS[jogador.sala].minY, 99);
        if (Math.hypot(x - bola.x, y - bola.y) > 30) return;

        bola.atingidos.add(jogador.id);
        jogador.x = x;
        jogador.y = y;
        jogador.congeladoAte = Date.now() + TEMPO_CONGELADO_MS;
        pescaria.interromper(jogador);

        const atirador = jogadores.get(bola.de);
        if (atirador) {
            // Placar: todo acerto conta; moedas só se não acertou essa mesma capivara há pouco
            const ultima = atirador.moedasPorAlvo.get(jogador.nick) || 0;
            const ganhaMoedas = Date.now() - ultima >= ESPERA_MOEDAS_MESMO_ALVO_MS;
            if (ganhaMoedas) atirador.moedasPorAlvo.set(jogador.nick, Date.now());
            recompensar(atirador, { moedas: ganhaMoedas ? MOEDAS_POR_ACERTO : 0, campo: 'acertos' });
        }
        io.to(jogador.sala).emit('congelado', {
            id: jogador.id,
            x, y,
            duracao: TEMPO_CONGELADO_MS,
            porId: bola.de,
            porNick: atirador ? atirador.nick : 'alguém',
        });
    });

    socket.on('disconnect', () => {
        const jogador = jogadores.get(socket.id);
        console.log(`Capivara desconectou: ${socket.id}`);
        if (!jogador) return;

        interromperMinigames(jogador);
        jogadores.delete(socket.id);
        tirarDaSala(socket, jogador, `${jogador.nick} saiu do jogo`);
        enviarContagemSalas();
    });
});

// Salva os perfis antes de desligar (o Render manda SIGTERM ao reiniciar)
for (const sinal of ['SIGINT', 'SIGTERM']) {
    process.on(sinal, () => {
        perfis.salvarAgora();
        process.exit(0);
    });
}

server.listen(PORTA, () => {
    console.log(`Servidor do CapivarasChat rodando em http://localhost:${PORTA}`);
});
