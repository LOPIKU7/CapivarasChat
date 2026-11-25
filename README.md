# CapivarasChat 🐾

Chat multiplayer em tempo real onde cada pessoa é uma capivara andando por salas.
Feito com **Node.js**, **Express** e **Socket.IO**.

## Como rodar

```bash
npm install
npm start        # ou: npm run dev (reinicia sozinho ao salvar o server.js)
```

Abra <http://localhost:3000> em duas abas (ou em dois computadores da mesma rede) para ver o multiplayer.
A porta pode ser trocada com a variável de ambiente `PORT`.

## Funcionalidades

- **Multiplayer em tempo real**: todo mundo na mesma sala vê as outras capivaras andando, falando e fazendo emotes.
- **4 salas**: Centro, Parque, Praia e Cafeteria. Dá para trocar de sala **andando até as saídas** (portas)
  ou pela barra no topo, que também mostra quantas capivaras há em cada sala.
- **Movimento por clique** com velocidade constante, capivara virando para o lado em que anda e profundidade
  (quem está mais embaixo fica na frente).
- **Balão de fala** em cima da cabeça (15 s) e indicador de **"digitando..."**.
- **Histórico do chat** com horário, entradas/saídas e as últimas 30 mensagens de cada sala para quem chega.
- **Lista de quem está online** na sala.
### Minigames 🎮

Todos dão **moedas 💰**, que aparecem no canto da tela. Clicando nelas abre o **ranking** 🏆
(moedas, acertos de bola de neve, peixes, pedidos e quiz). Moedas e números ficam salvos por nick.

- **Guerra de bolas de neve** ❄️: botão direito do mouse joga uma bola (ou ❄️ / tecla `B` para entrar no modo mira).
  Quem for atingido fica **congelado por 3 segundos** dentro de um bloco de gelo, sem poder andar nem jogar.
  Funciona em todas as salas menos na Cafeteria. Cada acerto conta no ranking e dá +2 💰
  (acertar a mesma capivara de novo só dá moedas depois de 30 s).
- **Pescaria** 🎣 (Praia): chegue perto da água e clique em **Pescar**. Quando a boia afundar (❗), clique em
  **PUXAR!** (ou aperte Espaço) em até 1 segundo. Puxar cedo ou tarde demais faz o peixe fugir. Tem 9 tipos de
  peixe, dos comuns aos raros 🦑🐙🦈 (peixes raros são anunciados no chat da sala). Cada peixe vale de 3 a 25 💰.
- **Garçom** ☕ (Cafeteria): clique em **Ser garçom** e atenda o máximo de clientes em 60 segundos, montando a
  bandeja com o pedido de cada um (teclas 1–6, Enter entrega). Os pedidos vão ficando maiores. +3 💰 por pedido.
- **Quiz** 🧠 (Centro): de tempos em tempos aparece uma pergunta. Quem responder certo primeiro no chat ganha +10 💰.
  Também dá para chamar uma pergunta com o botão **Chamar quiz** ou `/quiz`.

### Loja de cosméticos 🛍️

Clique em **🛍️ Loja** (ou digite `/loja`) para gastar as moedas em cosméticos para a sua capivara:
chapéus 🎩👑, óculos 🕶️, coisas no pescoço 🧣🏅, extras 🎈🛹 e efeitos com partículas ✨🔥.
Passe o mouse num item para provar antes de comprar; a compra pede confirmação (dois cliques).
Todo mundo na sala vê o que você está usando, e os itens comprados ficam salvos no seu nick.
Para criar itens novos, é só adicionar no `loja.js` (emoji, preço e posição na capivara).

### Outras funcionalidades

- **Emotes**: 🔄 mortal, 👋 acenar, 💃 dançar, ⬆️ pular, ❤️ coração, 😂 risada, 💤 dormir (pelos botões ou digitando `/mortal`, `/dancar`...).
- **Cor da capivara** personalizável no login e durante o jogo.
- **Comandos de chat**: `/ajuda`, `/loja`, `/quiz`, `/ranking`, `/limpar`, `/portas` (mostra as áreas das portas, útil para ajustar as coordenadas) e os emotes.
- Nick, cor e última sala ficam salvos no navegador.
- Reconexão automática se a conexão cair.
- Funciona no celular (toque para andar).

## Segurança e regras do servidor

- Nicks repetidos ganham um número no final (`capivara`, `capivara2`...).
- Mensagens limitadas a 60 caracteres e no máximo 1 a cada 0,7 s (anti-spam).
- Posições, cores e emotes são validados no servidor.
- Todo texto é exibido como texto puro (sem risco de injetar HTML).

## Estrutura

```
server.js          # servidor Express + Socket.IO (salas, jogadores, chat)
perfis.js          # moedas, estatísticas e cosméticos por nick (salvos em data/perfis.json)
loja.js            # catálogo da loja de cosméticos
minigames/
  pescaria.js      # pescaria da Praia (tempo e sorteio dos peixes no servidor)
  garcom.js        # garçom da Cafeteria
  quiz.js          # quiz do Centro (perguntas e respostas ficam aqui)
public/
  index.html       # telas de login e do jogo
  script.js        # lógica do cliente (movimento, chat, emotes, salas)
  style.css        # visual, cenários e animações
  capivara.png     # sprite da capivara
  centro.png, parque.png, praia.png, cafeteria.png   # fundos das salas
```

### Adicionando uma sala nova

1. Coloque a imagem de fundo em `public/`.
2. Em `server.js`, adicione a sala em `SALAS` (o `minY` é até onde a capivara pode subir na tela, em %).
3. Em `public/script.js`, adicione a sala em `CENARIOS` com o `fundo` e as `portas`
   (e uma porta em outra sala apontando para ela). Use `/portas` no chat para ver as áreas e ajustar.

### Sobre o ranking no Render

Os perfis são salvos em `data/perfis.json`. Em hospedagens grátis (como o Render) o disco é apagado quando o
servidor reinicia ou é publicado de novo, então o ranking recomeça do zero nesses momentos.
Para guardar de vez, seria preciso um disco persistente ou um banco de dados.
