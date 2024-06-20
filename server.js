// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;

// Servir les fichiers statiques
app.use(express.static('public'));

// Route pour la page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/create', (req, res) => {
  const gameId = uuidv4();
  games[gameId] = {
    id: gameId,
    players: [],
    choices: {},
    scores: { player1: 0, player2: 0 },
    round: 1
  };
  res.redirect(`/game/${gameId}`);
});

app.get('/game/:gameId', (req, res) => {
  const { gameId } = req.params;
  if (games[gameId]) {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
  } else {
    res.status(404).send('Game not found');
  }
});

let games = {};

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('createGame', (username) => {
    const gameId = uuidv4();
    games[gameId] = {
      id: gameId,
      players: [{ id: socket.id, username }],
      choices: {},
      scores: { player1: 0, player2: 0 },
      round: 1
    };
    socket.join(gameId);
    socket.emit('gameCreated', { gameId });
  });

  socket.on('joinGame', ({ gameId, username }) => {
    const game = games[gameId];
    if (game && game.players.length < 2 && !game.players.find(p => p.username === username)) {
      game.players.push({ id: socket.id, username });
      socket.join(gameId);
      if (game.players.length === 2) {
        io.to(gameId).emit('startGame', { players: game.players });
        startRound(gameId);
      }
    } else {
      socket.emit('error', 'Game is full, does not exist, or username is already taken.');
    }
  });

  socket.on('makeChoice', ({ gameId, choice }) => {
    const game = games[gameId];
    if (game) {
      game.choices[socket.id] = choice;
      if (Object.keys(game.choices).length === 2) {
        const result = calculateResult(game);
        game.scores = updateScores(game.scores, result.winner);
        io.to(gameId).emit('gameResult', {
          result: result.result,
          choices: result.choices,
          scores: game.scores,
          round: game.round
        });

        game.choices = {}; // reset choices for next round
        if (game.round < 10) {
          game.round += 1;
          setTimeout(() => startRound(gameId), 2000); // start next round after 2 seconds
        } else {
          io.to(gameId).emit('endGame', { scores: game.scores });
          delete games[gameId];
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    // Handle player disconnection logic here if necessary
  });
});

const startRound = (gameId) => {
  const game = games[gameId];
  if (game) {
    io.to(gameId).emit('newRound', { round: game.round });
  }
};

const calculateResult = (game) => {
  const [player1, player2] = game.players;
  const choice1 = game.choices[player1.id];
  const choice2 = game.choices[player2.id];

  if (choice1 === choice2) {
    return {
      result: 'draw',
      choices: { [player1.username]: choice1, [player2.username]: choice2 },
      winner: null
    };
  }

  const winMap = {
    pierre: ['ciseaux'],
    papier: ['pierre', 'puit'],
    ciseaux: ['papier'],
    puit: ['pierre', 'ciseaux']
  };

  const winner = winMap[choice1].includes(choice2) ? player1.username : player2.username;
  return {
    result: winner,
    choices: { [player1.username]: choice1, [player2.username]: choice2 },
    winner: winner === player1.username ? 'player1' : 'player2'
  };
};

const updateScores = (scores, winner) => {
  if (winner) {
    scores[winner] += 1;
  }
  return scores;
};

server.listen(port, () => console.log(`Listening on port ${port}`));
