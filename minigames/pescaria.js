// ==========================================
// MINIGAME: PESCARIA (Praia)
// ==========================================
// Como funciona:
// 1. O jogador perto da água pede para pescar ('pescar').
// 2. Depois de um tempo aleatório o peixe morde ('mordeu').
// 3. O jogador tem JANELA_MS para puxar ('puxar'). Cedo demais ou tarde demais = o peixe escapa.
// Todo o tempo é controlado aqui no servidor, então não dá para trapacear pelo navegador.

const SALA = 'praia';
// Área perto da água, em % da tela (ponto das patas da capivara)
const AREA = { xMin: 35, yMin: 60 };

const ESPERA_MIN_MS = 2000;
const ESPERA_MAX_MS = 7000;
const JANELA_MS = 1000;      // tempo para puxar depois da mordida
const TOLERANCIA_MS = 350;   // folga para o atraso da internet

// peso = chance relativa; valor = quanto vale (vira moedas depois); raro = avisa a sala toda
const PEIXES = [
    { id: 'bota',      emoji: '👢', nome: 'Bota velha',     peso: 8,  valor: 0 },
    { id: 'peixe',     emoji: '🐟', nome: 'Peixe',          peso: 40, valor: 3 },
    { id: 'camarao',   emoji: '🦐', nome: 'Camarão',        peso: 15, valor: 4 },
    { id: 'caranguejo', emoji: '🦀', nome: 'Caranguejo',    peso: 14, valor: 5 },
    { id: 'tropical',  emoji: '🐠', nome: 'Peixe tropical', peso: 12, valor: 6 },
    { id: 'baiacu',    emoji: '🐡', nome: 'Baiacu',         peso: 7,  valor: 8 },
    { id: 'lula',      emoji: '🦑', nome: 'Lula',           peso: 3,  valor: 12, raro: true },
    { id: 'polvo',     emoji: '🐙', nome: 'Polvo',          peso: 2,  valor: 15, raro: true },
    { id: 'tubarao',   emoji: '🦈', nome: 'Tubarão',        peso: 1,  valor: 25, raro: true },
];
const PESO_TOTAL = PEIXES.reduce((soma, p) => soma + p.peso, 0);

function sortearPeixe() {
    let sorteio = Math.random() * PESO_TOTAL;
    for (const peixe of PEIXES) {
        sorteio -= peixe.peso;
        if (sorteio < 0) return peixe;
    }
    return PEIXES[0];
}

function publicoPeixe(p) {
    return { id: p.id, emoji: p.emoji, nome: p.nome, valor: p.valor, raro: Boolean(p.raro) };
}

/**
 * @param {object} ctx
 * @param {import('socket.io').Server} ctx.io
 * @param {Map<string, object>} ctx.jogadores
 * @param {(salaId: string, texto: string) => void} ctx.mensagemSistema
 * @param {(jogador: object) => boolean} ctx.estaCongelado
 * @param {(jogador: object, peixe: object) => void} [ctx.aoPescar] chamado a cada peixe pescado
 */
module.exports = function criarPescaria({ io, jogadores, mensagemSistema, estaCongelado, aoPescar }) {
    const sessoes = new Map(); // jogadorId -> { fase, timer, mordeuEm }

    function terminar(jogador, resultado) {
        const sessao = sessoes.get(jogador.id);
        if (!sessao) return;
        clearTimeout(sessao.timer);
        sessoes.delete(jogador.id);
        io.to(jogador.sala).emit('pescaFim', { id: jogador.id, ...resultado });
    }

    function morder(jogador) {
        const sessao = sessoes.get(jogador.id);
        if (!sessao) return;
        sessao.fase = 'mordeu';
        sessao.mordeuEm = Date.now();
        io.to(jogador.sala).emit('mordeu', { id: jogador.id });
        sessao.timer = setTimeout(() => terminar(jogador, { motivo: 'tarde' }), JANELA_MS + TOLERANCIA_MS);
    }

    function registrar(socket) {
        socket.on('pescar', (responder) => {
            if (typeof responder !== 'function') return;
            const jogador = jogadores.get(socket.id);
            if (!jogador) return responder({ ok: false });
            if (jogador.sala !== SALA) return responder({ ok: false, erro: 'Só dá para pescar na Praia! 🏖️' });
            if (sessoes.has(jogador.id)) return responder({ ok: false, erro: 'Você já está pescando!' });
            if (estaCongelado(jogador)) return responder({ ok: false, erro: 'Você está congelado! ❄️' });
            if (jogador.x < AREA.xMin || jogador.y < AREA.yMin) {
                return responder({ ok: false, erro: 'Chegue mais perto da água para pescar 🌊' });
            }

            const espera = ESPERA_MIN_MS + Math.random() * (ESPERA_MAX_MS - ESPERA_MIN_MS);
            sessoes.set(jogador.id, { fase: 'esperando', timer: setTimeout(() => morder(jogador), espera) });
            io.to(jogador.sala).emit('pescando', { id: jogador.id });
            responder({ ok: true });
        });

        socket.on('puxar', () => {
            const jogador = jogadores.get(socket.id);
            const sessao = jogador && sessoes.get(jogador.id);
            if (!sessao) return;

            if (sessao.fase === 'esperando') return terminar(jogador, { motivo: 'cedo' });
            if (Date.now() - sessao.mordeuEm > JANELA_MS + TOLERANCIA_MS) return terminar(jogador, { motivo: 'tarde' });

            const peixe = sortearPeixe();
            terminar(jogador, { peixe: publicoPeixe(peixe) });
            if (peixe.raro) mensagemSistema(jogador.sala, `🎣 ${jogador.nick} pescou um(a) ${peixe.emoji} ${peixe.nome}!`);
            if (aoPescar) aoPescar(jogador, peixe);
        });
    }

    return {
        SALA,
        AREA,
        registrar,
        // Andar, trocar de sala, ser congelado ou sair do jogo cancela a pescaria
        interromper: (jogador) => terminar(jogador, { motivo: 'cancelada' }),
        estaPescando: (jogador) => sessoes.has(jogador.id),
    };
};
