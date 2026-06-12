const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Evita problemas de conexão no Render
});

app.use(express.static(path.join(__dirname, 'public')));

// Objeto para guardar todas as capivaras conectadas
let jogadores = {};

io.on('connection', (socket) => {
    console.log(`Capivara conectou: ${socket.id}`);

    // 1. Quando o jogador faz login e entra no jogo
    socket.on('entrarNoJogo', (dados) => {
        // Guarda os dados dele no servidor
        jogadores[socket.id] = {
            id: socket.id,
            nickname: dados.nickname,
            x: '50%',
            y: '50%',
            // 🛠️ MUDANÇA AQUI: Pega a sala enviada pelo cliente, ou usa 'centro' como padrão
            sala: dados.sala || 'centro' 
        };

        // Envia a lista de jogadores atuais para quem acabou de entrar
        socket.emit('jogadoresAtuais', jogadores);

        // Avisa todos os outros jogadores que uma nova capivara entrou
        socket.broadcast.emit('novoJogador', jogadores[socket.id]);
    }); 

    // 2. Quando um jogador clica para andar
    socket.on('movimentoJogador', (dados) => {
        if (jogadores[socket.id]) {
            jogadores[socket.id].x = dados.x;
            jogadores[socket.id].y = dados.y;
            jogadores[socket.id].sala = dados.sala;

            // Avisa todo mundo para onde essa capivara foi e o tempo da animação
            socket.broadcast.emit('jogadorMoveu', {
                id: socket.id,
                x: dados.x,
                y: dados.y,
                tempo: dados.tempo, // Importante para a velocidade constante no multiplayer
                sala: dados.sala
            });
        }
    });

    // 3. Quando o jogador bate na borda e muda de cenário
    socket.on('mudarSala', (dados) => {
        if (jogadores[socket.id]) {
            jogadores[socket.id].sala = dados.sala;
            jogadores[socket.id].x = dados.x;
            jogadores[socket.id].y = dados.y;
            
            // Avisa todo mundo para atualizar o local dessa capivara
            io.emit('atualizarSala', jogadores[socket.id]); 
        }
    });

    // 4. Quando um jogador envia uma mensagem de chat
    socket.on('enviarMensagem', (mensagem) => {
        // Transmite a mensagem para todo mundo, junto com o ID de quem falou
        io.emit('mensagemRecebida', {
            id: socket.id,
            texto: mensagem
        });
    });

    // 5. Quando o jogador fecha o site / desconecta
    socket.on('disconnect', () => {
        console.log(`Capivara desconectou: ${socket.id}`);
        // Remove da lista
        delete jogadores[socket.id];
        // Avisa todo mundo para remover esse boneco da tela
        io.emit('jogadorDesconectou', socket.id);
    });
});

const PORTA = process.env.PORT || 3000;
server.listen(PORTA, () => {
    console.log(`Servidor rodando na porta ${PORTA}`);
});
