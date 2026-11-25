// ==========================================
// LOJA DE COSMÉTICOS
// ==========================================
// Cada item vai num "slot" da capivara (só um item por slot).
// x/y = centro do emoji em % do quadrado da capivara (olhando para a ESQUERDA, como na imagem original);
// tam = tamanho do emoji em px; atras = desenhado atrás da capivara.
// O cliente recebe este catálogo do servidor, então para criar um item novo basta adicionar aqui.

const SLOTS = [
    { id: 'cabeca', nome: 'Chapéus', icone: '🎩' },
    { id: 'rosto', nome: 'Rosto', icone: '🕶️' },
    { id: 'pescoco', nome: 'Pescoço', icone: '🧣' },
    { id: 'extra', nome: 'Extras', icone: '🎈' },
    { id: 'efeito', nome: 'Efeitos', icone: '✨' },
];

const CATALOGO = [
    // Chapéus
    { id: 'flor',         slot: 'cabeca',  nome: 'Flor',             emoji: '🌸', preco: 10,  x: 50, y: 26, tam: 20 },
    { id: 'laco',         slot: 'cabeca',  nome: 'Laço',             emoji: '🎀', preco: 15,  x: 50, y: 25, tam: 24 },
    { id: 'bone',         slot: 'cabeca',  nome: 'Boné',             emoji: '🧢', preco: 25,  x: 40, y: 24, tam: 30 },
    { id: 'chapeu-praia', slot: 'cabeca',  nome: 'Chapéu de praia',  emoji: '👒', preco: 35,  x: 40, y: 20, tam: 34 },
    { id: 'cartola',      slot: 'cabeca',  nome: 'Cartola',          emoji: '🎩', preco: 50,  x: 40, y: 16, tam: 32 },
    { id: 'capelo',       slot: 'cabeca',  nome: 'Capelo',           emoji: '🎓', preco: 60,  x: 40, y: 20, tam: 32 },
    { id: 'coroa',        slot: 'cabeca',  nome: 'Coroa',            emoji: '👑', preco: 250, x: 40, y: 20, tam: 30 },

    // Rosto
    { id: 'oculos',       slot: 'rosto',   nome: 'Óculos',           emoji: '👓', preco: 25,  x: 36, y: 38, tam: 22 },
    { id: 'oculos-sol',   slot: 'rosto',   nome: 'Óculos escuros',   emoji: '🕶️', preco: 40,  x: 36, y: 38, tam: 22 },
    { id: 'mergulho',     slot: 'rosto',   nome: 'Óculos de mergulho', emoji: '🥽', preco: 60, x: 36, y: 38, tam: 24 },

    // Pescoço
    { id: 'cachecol',     slot: 'pescoco', nome: 'Cachecol',         emoji: '🧣', preco: 30,  x: 44, y: 60, tam: 24 },
    { id: 'gravata',      slot: 'pescoco', nome: 'Gravata',          emoji: '👔', preco: 35,  x: 44, y: 62, tam: 22 },
    { id: 'colar',        slot: 'pescoco', nome: 'Colar',            emoji: '📿', preco: 45,  x: 44, y: 60, tam: 22 },
    { id: 'medalha',      slot: 'pescoco', nome: 'Medalha de ouro',  emoji: '🏅', preco: 100, x: 44, y: 64, tam: 22 },

    // Extras
    { id: 'balao',        slot: 'extra',   nome: 'Balão',            emoji: '🎈', preco: 30,  x: 86, y: 8,  tam: 30 },
    { id: 'guarda-chuva', slot: 'extra',   nome: 'Guarda-chuva',     emoji: '🌂', preco: 40,  x: 82, y: 14, tam: 34 },
    { id: 'skate',        slot: 'extra',   nome: 'Skate',            emoji: '🛹', preco: 80,  x: 56, y: 94, tam: 50, atras: true },

    // Efeitos (partículas em volta da capivara)
    { id: 'brilhos',      slot: 'efeito',  nome: 'Brilhos',          emoji: '✨', preco: 100 },
    { id: 'coracoes',     slot: 'efeito',  nome: 'Corações',         emoji: '💖', preco: 120 },
    { id: 'estrelas',     slot: 'efeito',  nome: 'Estrelas',         emoji: '⭐', preco: 150 },
    { id: 'fogo',         slot: 'efeito',  nome: 'Fogo',             emoji: '🔥', preco: 200 },
];

const POR_ID = new Map(CATALOGO.map((item) => [item.id, item]));

function visualVazio() {
    return Object.fromEntries(SLOTS.map((s) => [s.id, null]));
}

module.exports = { SLOTS, CATALOGO, visualVazio, item: (id) => POR_ID.get(id) };
