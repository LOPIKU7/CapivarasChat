const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

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
const EMOTES = ['mortal', 'acenar', 'dancar', 'pular', 'coracao', 'risada', 'dormir'];

// Salas disponíveis. Posições são em % da tela, no ponto das patas da capivara.
// minY = até onde a capivara pode subir; spawn = onde ela aparece ao chegar pela barra de salas.
const SALAS = {
    centro:    { id: 'centro',    nome: 'Centro',    minY: 12, spawn: { x: 50, y: 75 } },
    parque:    { id: 'parque',    nome: 'Parque',    minY: 12, spawn: { x: 50, y: 75 } },
    praia:     { id: 'praia',     nome: 'Praia',     minY: 12, spawn: { x: 50, y: 75 } },
    cafeteria: { id: 'cafeteria', nome: 'Cafeteria', minY: 12, spawn: { x: 50, y: 75 } },
};
const SALA_INICIAL = 'centro';

// ==========================================
// ESTADO DO SERVIDOR
// ==========================================
const jogadores = new Map(); // socket.id -> jogador
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

function publico(j) {
    return { id: j.id, nick: j.nick, cor: j.cor, x: j.x, y: j.y, direcao: j.direcao };
}

function registrarNoHistorico(salaId, item) {
    const lista = historico[salaId];
    lista.push(item);
    if (lista.length > HISTORICO_POR_SALA) lista.shift();
}

function mensagemSistema(salaId, texto) {
    const item = { tipo: 'sistema', texto, hora: Date.now() };
    registrarNoHistorico(salaId, item);
    io.to(salaId).emit('mensagem', item);
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
        };
        jogadores.set(socket.id, jogador);

        const estado = colocarNaSala(socket, jogador, salaId, dados?.posicao);
        responder({ ok: true, eu: publico(jogador), salas: Object.values(SALAS), ...estado });
        enviarContagemSalas();
        console.log(`${nick} entrou em ${salaId}`);
    });

    socket.on('mover', (dados) => {
        const jogador = jogadores.get(socket.id);
        if (!jogador) return;

        const sala = SALAS[jogador.sala];
        const x = limitar(dados?.x, 2, 98);
        const y = limitar(dados?.y, sala.minY, 99);
        if (x !== jogador.x) jogador.direcao = x > jogador.x ? 1 : -1;
        jogador.x = x;
        jogador.y = y;

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
    });

    socket.on('digitando', (estaDigitando) => {
        const jogador = jogadores.get(socket.id);
        if (!jogador) return;
        socket.to(jogador.sala).emit('digitando', { id: jogador.id, digitando: Boolean(estaDigitando) });
    });

    socket.on('emote', (nome) => {
        const jogador = jogadores.get(socket.id);
        if (!jogador || !EMOTES.includes(nome)) return;
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

        tirarDaSala(socket, jogador, `${jogador.nick} foi para ${SALAS[salaId].nome}`);
        const estado = colocarNaSala(socket, jogador, salaId, dados.posicao);
        responder({ ok: true, eu: publico(jogador), ...estado });
        enviarContagemSalas();
    });

    socket.on('disconnect', () => {
        const jogador = jogadores.get(socket.id);
        console.log(`Capivara desconectou: ${socket.id}`);
        if (!jogador) return;

        jogadores.delete(socket.id);
        tirarDaSala(socket, jogador, `${jogador.nick} saiu do jogo`);
        enviarContagemSalas();
    });
});

server.listen(PORTA, () => {
    console.log(`Servidor do CapivarasChat rodando em http://localhost:${PORTA}`);
});
