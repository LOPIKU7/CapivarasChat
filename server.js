const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Define que a pasta 'public' é o frontend do jogo
app.use(express.static(path.join(__dirname, 'public')));
// Sistema do Multiplayer
io.on('connection', (socket) => {
    console.log(`Uma capivara se conectou! ID: ${socket.id}`);

    // Quando o jogador desconecta
    socket.on('disconnect', () => {
        console.log(`Capivara desconectou: ${socket.id}`);
    });
});

// Liga o servidor na porta 3000
const PORTA = 3000;
server.listen(PORTA, () => {
    console.log(`Servidor do CapivarasChat rodando em http://localhost:${PORTA}`);
});
