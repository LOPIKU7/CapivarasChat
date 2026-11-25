// ==========================================
// PERFIS: moedas e estatísticas de cada nick
// ==========================================
// Ficam em memória e são salvos em data/perfis.json (alguns segundos depois de mudar).
// Atenção: em hospedagens grátis como o Render o disco é apagado a cada deploy/reinício,
// então o ranking recomeça do zero nesses casos.

const fs = require('fs');
const path = require('path');

const ARQUIVO = process.env.ARQUIVO_PERFIS || path.join(__dirname, 'data', 'perfis.json');
const ATRASO_SALVAR_MS = 2000;

// Categorias do ranking (campo do perfil -> usado no cliente para mostrar)
const CATEGORIAS = ['moedas', 'acertos', 'peixes', 'pedidos', 'quiz'];

let perfis = {};
try {
    perfis = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
    console.log(`Perfis carregados: ${Object.keys(perfis).length}`);
} catch {
    perfis = {};
}

function perfilVazio(nick) {
    return { nick, moedas: 0, acertos: 0, peixes: 0, pedidos: 0, quiz: 0, recordeGarcom: 0 };
}

function obter(nick) {
    const chave = nick.toLowerCase();
    if (!perfis[chave]) perfis[chave] = perfilVazio(nick);
    // Completa campos novos em perfis antigos
    perfis[chave] = { ...perfilVazio(nick), ...perfis[chave], nick };
    return perfis[chave];
}

function salvarAgora() {
    try {
        fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
        const temporario = ARQUIVO + '.tmp';
        fs.writeFileSync(temporario, JSON.stringify(perfis));
        fs.renameSync(temporario, ARQUIVO);
    } catch (erro) {
        console.error('Não foi possível salvar os perfis:', erro.message);
    }
}

let timerSalvar = null;
function salvar() {
    if (timerSalvar) return;
    timerSalvar = setTimeout(() => {
        timerSalvar = null;
        salvarAgora();
    }, ATRASO_SALVAR_MS);
}

function ranking(limite = 10) {
    const lista = Object.values(perfis);
    return Object.fromEntries(CATEGORIAS.map((campo) => [
        campo,
        lista
            .filter((p) => p[campo] > 0)
            .sort((a, b) => b[campo] - a[campo])
            .slice(0, limite)
            .map((p) => ({ nick: p.nick, valor: p[campo] })),
    ]));
}

module.exports = { obter, salvar, salvarAgora, ranking, CATEGORIAS };
