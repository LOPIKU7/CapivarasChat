// ==========================================
// MINIGAME: QUIZ NO CHAT (Centro)
// ==========================================
// De tempos em tempos (se tiver alguém no Centro) o servidor faz uma pergunta no chat.
// Quem responder certo primeiro ganha. Também dá para chamar um quiz com /quiz ou pelo botão.

const SALA = 'centro';
const DURACAO_MS = 30000;          // tempo para responder
const INTERVALO_MS = 90000;        // tempo entre um quiz automático e outro
const PRIMEIRO_QUIZ_MS = 30000;    // primeiro quiz depois que o servidor liga
const ESPERA_MANUAL_MS = 15000;    // intervalo mínimo para chamar um quiz na mão

// Respostas aceitas: sem acento, sem diferença de maiúscula/minúscula
const PERGUNTAS = [
    { p: 'Qual é o maior roedor do mundo?', r: ['capivara', 'a capivara'] },
    { p: 'Capivaras são herbívoras ou carnívoras?', r: ['herbivoras', 'herbivora', 'herbivoro', 'herbivoros'] },
    { p: 'Qual bioma alagado do Brasil é famoso pelas capivaras e jacarés?', r: ['pantanal', 'o pantanal'] },
    { p: 'Quantas patas tem uma capivara?', r: ['4', 'quatro'] },
    { p: 'Qual é a capital do Brasil?', r: ['brasilia'] },
    { p: 'Quanto é 7 x 8?', r: ['56', 'cinquenta e seis'] },
    { p: 'Qual planeta é conhecido como Planeta Vermelho?', r: ['marte'] },
    { p: 'Quantos dias tem um ano bissexto?', r: ['366'] },
    { p: 'Qual é o maior oceano do mundo?', r: ['pacifico', 'oceano pacifico', 'o pacifico'] },
    { p: 'Qual ave é símbolo da sabedoria?', r: ['coruja', 'a coruja'] },
    { p: 'Que cor se forma misturando azul e amarelo?', r: ['verde'] },
    { p: 'Quanto é 12 + 15?', r: ['27', 'vinte e sete'] },
    { p: 'Em que continente fica o Brasil?', r: ['america do sul', 'america'] },
    { p: 'Qual é o maior rio do Brasil?', r: ['amazonas', 'rio amazonas', 'o amazonas'] },
    { p: 'Quantos minutos tem uma hora?', r: ['60', 'sessenta'] },
    { p: 'Qual é o satélite natural da Terra?', r: ['lua', 'a lua'] },
    { p: 'Qual animal é chamado de rei da selva?', r: ['leao', 'o leao'] },
    { p: 'Quanto é 100 dividido por 4?', r: ['25', 'vinte e cinco'] },
    { p: 'Quantas cores tem o arco-íris?', r: ['7', 'sete'] },
    { p: 'Qual é a língua oficial do Brasil?', r: ['portugues', 'lingua portuguesa'] },
    { p: 'Qual é o animal terrestre mais rápido?', r: ['guepardo', 'chita', 'o guepardo'] },
    { p: 'Qual fruta amarela os macacos adoram?', r: ['banana', 'a banana'] },
    { p: 'Quanto é 9 x 9?', r: ['81', 'oitenta e um'] },
    { p: 'Quantos lados tem um hexágono?', r: ['6', 'seis'] },
    { p: 'Qual é o maior país da América do Sul?', r: ['brasil', 'o brasil'] },
    { p: 'Qual planeta tem os anéis mais famosos?', r: ['saturno'] },
    { p: 'Quantos segundos tem um minuto?', r: ['60', 'sessenta'] },
    { p: 'Que gás a gente precisa respirar para viver?', r: ['oxigenio', 'o oxigenio'] },
    { p: 'Água congelada vira o quê?', r: ['gelo', 'o gelo'] },
    { p: 'Qual é o mamífero mais pesado do mundo?', r: ['baleia azul', 'a baleia azul', 'baleia'] },
];

function normalizar(texto) {
    return String(texto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')   // tira acentos
        .replace(/[^a-z0-9 ]/g, ' ')       // tira pontuação
        .replace(/\s+/g, ' ')
        .trim();
}

function embaralhar(lista) {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

/**
 * @param {object} ctx
 * @param {import('socket.io').Server} ctx.io
 * @param {Map<string, object>} ctx.jogadores
 * @param {(salaId: string, texto: string, tipo?: string) => void} ctx.mensagemSistema
 * @param {(jogador: object) => number} ctx.aoAcertar  recompensa o vencedor e devolve as moedas ganhas
 */
module.exports = function criarQuiz({ io, jogadores, mensagemSistema, aoAcertar }) {
    let baralho = [];
    let atual = null; // { pergunta, respostas, respostaMostrada, fim, timer }
    let proximoEm = Date.now() + PRIMEIRO_QUIZ_MS;
    let ultimoFim = 0;

    const temGenteNaSala = () => [...jogadores.values()].some((j) => j.sala === SALA);

    function iniciar() {
        if (baralho.length === 0) baralho = embaralhar(PERGUNTAS);
        const { p, r } = baralho.pop();
        atual = {
            pergunta: p,
            respostas: r.map(normalizar),
            respostaMostrada: r[0],
            fim: Date.now() + DURACAO_MS,
            timer: setTimeout(() => encerrar(null), DURACAO_MS),
        };
        mensagemSistema(SALA, `🧠 QUIZ: ${p} (responda no chat!)`, 'quiz');
        io.to(SALA).emit('quiz', estado());
    }

    function encerrar(vencedor) {
        if (!atual) return;
        clearTimeout(atual.timer);
        const resposta = atual.respostaMostrada;
        atual = null;
        ultimoFim = Date.now();
        proximoEm = ultimoFim + INTERVALO_MS;

        if (vencedor) {
            const moedas = aoAcertar(vencedor);
            mensagemSistema(SALA, `🏆 ${vencedor.nick} acertou! Resposta: ${resposta} (+${moedas} 💰)`, 'quiz');
        } else {
            mensagemSistema(SALA, `⏰ Tempo esgotado! A resposta era: ${resposta}`, 'quiz');
        }
        io.to(SALA).emit('quizFim', { vencedor: vencedor ? vencedor.nick : null, resposta });
    }

    function estado() {
        return atual ? { pergunta: atual.pergunta, restante: Math.max(0, atual.fim - Date.now()), duracao: DURACAO_MS } : null;
    }

    // Quiz automático
    setInterval(() => {
        if (!atual && Date.now() >= proximoEm && temGenteNaSala()) iniciar();
    }, 5000).unref();

    function registrar(socket) {
        socket.on('quizAgora', (responder) => {
            if (typeof responder !== 'function') return;
            const jogador = jogadores.get(socket.id);
            if (!jogador) return responder({ ok: false });
            if (jogador.sala !== SALA) return responder({ ok: false, erro: 'O quiz acontece no Centro! 🧠' });
            if (atual) return responder({ ok: false, erro: 'Já tem uma pergunta valendo! Responda no chat.' });
            const falta = ultimoFim + ESPERA_MANUAL_MS - Date.now();
            if (falta > 0) return responder({ ok: false, erro: `Espere ${Math.ceil(falta / 1000)}s para o próximo quiz.` });
            iniciar();
            responder({ ok: true });
        });
    }

    // Chamado para toda mensagem de chat (depois de ela aparecer para todos)
    function aoChat(jogador, texto) {
        if (atual && jogador.sala === SALA && atual.respostas.includes(normalizar(texto))) encerrar(jogador);
    }

    return { SALA, registrar, aoChat, estado };
};
