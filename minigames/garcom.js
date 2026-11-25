// ==========================================
// MINIGAME: GARÇOM DA CAFETERIA
// ==========================================
// O jogador tem DURACAO_MS para atender o máximo de pedidos.
// Cada pedido é uma lista de itens do cardápio; os pedidos crescem conforme ele acerta.
// O servidor sorteia os pedidos, confere as entregas e controla o tempo.

const SALA = 'cafeteria';
const DURACAO_MS = 60000;
const CARDAPIO = ['cafe', 'suco', 'bolo', 'croissant', 'biscoito', 'cha'];
const CLIENTES = ['🐹', '🐻', '🐰', '🦊', '🐼', '🐨', '🐸', '🐧', '🐶', '🐱'];
const MAX_ITENS_PEDIDO = 5;

function sortear(lista) {
    return lista[Math.floor(Math.random() * lista.length)];
}

function novoPedido(entregues) {
    // 1 item no começo, +1 a cada 2 pedidos entregues
    const tamanho = Math.min(MAX_ITENS_PEDIDO, 1 + Math.floor(entregues / 2));
    return {
        cliente: sortear(CLIENTES),
        itens: Array.from({ length: tamanho }, () => sortear(CARDAPIO)),
    };
}

function mesmosItens(a, b) {
    if (a.length !== b.length) return false;
    const x = [...a].sort();
    const y = [...b].sort();
    return x.every((item, i) => item === y[i]);
}

/**
 * @param {object} ctx
 * @param {import('socket.io').Server} ctx.io
 * @param {Map<string, object>} ctx.jogadores
 * @param {(salaId: string, texto: string) => void} ctx.mensagemSistema
 * @param {(jogador: object, entregues: number) => { moedas: number, recorde: number }} ctx.aoTerminar
 */
module.exports = function criarGarcom({ io, jogadores, mensagemSistema, aoTerminar }) {
    const sessoes = new Map(); // jogadorId -> { socket, entregues, pedido, timer }

    function terminar(jogador) {
        const sessao = sessoes.get(jogador.id);
        if (!sessao) return;
        clearTimeout(sessao.timer);
        sessoes.delete(jogador.id);

        const { moedas, recorde } = aoTerminar(jogador, sessao.entregues);
        sessao.socket.emit('garcomFim', { entregues: sessao.entregues, moedas, recorde });
        io.to(jogador.sala).emit('atividade', { id: jogador.id, icone: null });
        if (sessao.entregues > 0) {
            const plural = sessao.entregues === 1 ? 'pedido' : 'pedidos';
            mensagemSistema(jogador.sala, `☕ ${jogador.nick} atendeu ${sessao.entregues} ${plural} como garçom!`);
        }
    }

    function registrar(socket) {
        socket.on('garcomIniciar', (responder) => {
            if (typeof responder !== 'function') return;
            const jogador = jogadores.get(socket.id);
            if (!jogador) return responder({ ok: false });
            if (jogador.sala !== SALA) return responder({ ok: false, erro: 'Só dá para ser garçom na Cafeteria! ☕' });
            if (sessoes.has(jogador.id)) return responder({ ok: false, erro: 'Você já está trabalhando!' });

            const sessao = { socket, entregues: 0, pedido: novoPedido(0) };
            sessao.timer = setTimeout(() => terminar(jogador), DURACAO_MS);
            sessoes.set(jogador.id, sessao);

            io.to(jogador.sala).emit('atividade', { id: jogador.id, icone: '🍽️' });
            responder({ ok: true, duracao: DURACAO_MS, cardapio: CARDAPIO, pedido: sessao.pedido });
        });

        socket.on('garcomEntregar', (itens, responder) => {
            if (typeof responder !== 'function') return;
            const sessao = sessoes.get(socket.id);
            if (!sessao) return responder({ ok: false });
            if (!Array.isArray(itens) || itens.length > MAX_ITENS_PEDIDO + 1) return responder({ ok: true, certo: false });

            if (!mesmosItens(itens.map(String), sessao.pedido.itens)) return responder({ ok: true, certo: false });

            sessao.entregues++;
            sessao.pedido = novoPedido(sessao.entregues);
            responder({ ok: true, certo: true, entregues: sessao.entregues, pedido: sessao.pedido });
        });

        socket.on('garcomSair', () => {
            const jogador = jogadores.get(socket.id);
            if (jogador) terminar(jogador);
        });
    }

    return {
        SALA,
        registrar,
        // Trocar de sala ou sair do jogo encerra o turno (as moedas do que já foi feito valem)
        interromper: terminar,
        estaJogando: (jogador) => sessoes.has(jogador.id),
    };
};
