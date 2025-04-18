// ✅ index.js - BACKEND COMPLETO con log debug per startGame
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const { createDeck, dealHands, evaluateHand } = require('./game');

const app = express();
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = {};

function layoutFan(container) {
  const cards = container.querySelectorAll('.card');
  const total = cards.length;
  const spread = 40; // distanza tra le carte
  const angle = 12; // massimo angolo totale

  cards.forEach((card, i) => {
    const offset = (i - (total - 1) / 2); // centra le carte
    const rotation = offset * (angle / total);
    const x = offset * spread;

    card.style.left = `calc(50% + ${x}px)`;
    card.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
    card.style.zIndex = i; // layering corretto
  });
}




io.on('connection', (socket) => {
  console.log('✅ Connesso:', socket.id);

  socket.on('createRoom', (name, maxPlayers, callback) => {
    console.log(`[SERVER] ${name} ha creato una stanza con max ${maxPlayers}`);
    const code = uuidv4().slice(0, 6).toUpperCase();
    rooms[code] = {
      players: [{ id: socket.id, name }],
      maxPlayers,
      hostId: socket.id,
    };
    socket.join(code);
    callback(code, rooms[code].players);
    io.to(code).emit('playerListUpdate', rooms[code].players);
  });

  socket.on('joinRoom', (name, code, callback) => {
    const room = rooms[code];
    if (room && room.players.length < room.maxPlayers) {
      room.players.push({ id: socket.id, name });
      socket.join(code);
      callback({ status: 'ok', players: room.players });
      io.to(code).emit('playerListUpdate', room.players);
    } else {
      if (typeof callback === 'function') {
        callback({ status: 'error', message: 'Errore nel join' });
      }
    }
  });

  socket.on('startGame', () => {
    const code = findPlayerRoom(socket.id);
    const room = rooms[code];
    console.log(`[SERVER] ${socket.id} ha cliccato startGame`);
    console.log("ROOM FOUND?", !!room);
    console.log("È HOST?", room?.hostId === socket.id);
    console.log("Giocatori in stanza:", room?.players.length);

    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 3) return;
    startGame(code);
  });

  socket.on('drawCard', () => {
    const code = findPlayerRoom(socket.id);
    const room = rooms[code];
    if (!room || room.phase !== 'draw' || getCurrentPlayer(room) !== socket.id) return;

    const card = room.deck.shift();
    room.hands[socket.id].push(card);
    room.phase = 'discard';
    io.to(socket.id).emit('cardDrawn', card);
  });

  socket.on('discardCard', (cards) => {
    const code = findPlayerRoom(socket.id);
    const room = rooms[code];
    if (!room || room.phase !== 'discard' || getCurrentPlayer(room) !== socket.id) return;
  
    const hand = room.hands[socket.id];
    const cardList = Array.isArray(cards) ? cards : [cards];
  
    cardList.forEach(c => {
      const i = hand.findIndex(h => h.value === c.value && h.suit === c.suit);
      if (i !== -1) hand.splice(i, 1);
    });
  
    io.to(code).emit('updateOpponentHand', {
      playerId: socket.id,
      cardsLeft: hand.length
    });
  
    room.lastDiscarded = { value: cardList[0].value };

    if (!room.lastDiscardedKCounts) room.lastDiscardedKCounts = {};

const kingCount = cardList.filter(c => c.value === 'K').length;
room.lastDiscardedKCounts[socket.id] = (room.lastDiscardedKCounts[socket.id] || 0) + kingCount;

  
    io.to(socket.id).emit('cardDiscarded', cardList);
    room.players.forEach(p => {
      if (p.id !== socket.id) {
        io.to(p.id).emit('cardDiscardedByOther', {
          from: socket.id,
          cards: cardList
        });
      }
    });
  
    // ✅ LOGICA TURNO SUCCESSIVO
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    const next = getCurrentPlayer(room);
    const nextHand = room.hands[next];
    room.phase = 'draw';
  
    room.players.forEach(p => {
      if (p.id === next) {
        io.to(p.id).emit('yourTurn');
      } else {
        const nextPlayer = room.players.find(pl => pl.id === next);
        io.to(p.id).emit('someoneTurn', {
          id: nextPlayer.id,
          name: nextPlayer.name
        });
      }
    });
  
    const match = nextHand.find(c => c.value === room.lastDiscarded.value);
    if (match) {
      room.phase = 'discard';
      io.to(next).emit('canAutoDiscard', match);
    }
  });
  
  // Aggiornamento funzione gameEnded nel backend
  socket.on('kang', () => {
    console.log(`[SERVER] ${socket.id} ha chiamato kang`);
    const roomCode = findPlayerRoom(socket.id);
    const room = rooms[roomCode];
    if (!room || !room.hands) return;
  
    const winnerId = socket.id;
    const winnerHand = room.hands[winnerId];
    const discardedKings = room.lastDiscardedKCounts?.[winnerId] || 0;
    const acesInHand = winnerHand.filter(c => c.value === 'A').length;
    const totalOpponents = room.players.length - 1;
    const base = 1;
    const gainPerOpponent = (base + acesInHand + discardedKings);
    const totalWinnings = gainPerOpponent * totalOpponents;
  
    const winnerName = room.players.find(p => p.id === winnerId)?.name || "Qualcuno";
  
    const finalScores = room.players.map(p => {
      const isWinner = p.id === winnerId;
      return {
        name: p.name,
        balance: isWinner ? totalWinnings : -gainPerOpponent
      };
    });
    
    room.players.forEach(p => {
      const hand = room.hands[p.id];
      const score = calculatePoints(hand);
      const isWinner = p.id === winnerId;
    
      io.to(p.id).emit('gameEnded', {
        winner: winnerId,
        winnerName,
        reason: isWinner
          ? `ha vinto con ${score} punti! (+${acesInHand} A, +${discardedKings} K scartati, x${totalOpponents} avversari)`
          : `ha perso con ${score} punti.`,
        totalWinnings: isWinner ? totalWinnings : -gainPerOpponent,
        aces: acesInHand,
        kings: discardedKings,
        finalScores
      });
    });
    
  });

socket.on('newRound', () => {
  const code = findPlayerRoom(socket.id);
  const room = rooms[code];
  if (!room || room.hostId !== socket.id) return;

  // Reset parziali per nuova mano
  room.deck = createDeck();
  const hands = dealHands(room.deck, room.maxPlayers);
  room.turnIndex = 0;
  room.phase = 'draw';
  room.lastDiscarded = null;
  room.lastDiscardedKCounts = {};

  room.players.forEach((p, i) => {
    const hand = hands[i];
    const result = evaluateHand(hand);
    room.hands[p.id] = hand;

    io.to(p.id).emit('initialHand', {
      hand,
      special: result,
      playerIndex: i,
      totalPlayers: room.players.length,
      allPlayers: room.players.map(pl => pl.id)
    });

    if (result) {
      room.players.forEach(pp => {
        io.to(pp.id).emit('gameEnded', {
          winner: p.id,
          reason: `ha una combinazione speciale: ${result.combination}`
        });
      });
    }
  });

  // Avvia turno solo se nessuno ha vinto subito
  const winnerFound = room.players.some((p, i) =>
    evaluateHand(hands[i]) !== null
  );

  if (!winnerFound) {
    const next = getCurrentPlayer(room);
    room.players.forEach(p => {
      if (p.id === next) {
        io.to(p.id).emit('yourTurn');
      } else {
        const nextPlayer = room.players.find(pl => pl.id === next);
        io.to(p.id).emit('someoneTurn', {
          id: nextPlayer.id,
          name: nextPlayer.name
        });
      }
    });
  }
});
})

function startGame(code) {
  const room = rooms[code];
  const deck = createDeck();
  const hands = dealHands(deck, room.maxPlayers);

  room.hands = {};
  room.turnIndex = 0;
  room.phase = 'draw';
  room.deck = deck;
  room.lastDiscarded = null;

  let winner = false;

  room.players.forEach((p, i) => {
    const hand = hands[i];
    const result = evaluateHand(hand);
    room.hands[p.id] = hand;

    io.to(p.id).emit('initialHand', {
      hand,
      special: result,
      playerIndex: i,
      totalPlayers: room.players.length,
      allPlayers: room.players.map(pl => pl.id)
    });

    if (result) {
      room.players.forEach(pp => {
        io.to(pp.id).emit('gameEnded', {
          winner: p.id,
          reason: `ha una combinazione speciale: ${result.combination}`
        });
      });
      winner = true;
    }
  });

  if (!winner) {
    const next = getCurrentPlayer(room);
    room.players.forEach(p => {
      if (p.id === next) {
        io.to(p.id).emit('yourTurn');
      } else {
        const nextPlayer = room.players.find(pl => pl.id === next);
        io.to(p.id).emit('someoneTurn', {
          id: nextPlayer.id,
          name: nextPlayer.name
        });
      }
    });
  }  
}

function getCurrentPlayer(room) {
  return room.players[room.turnIndex].id;
}

function findPlayerRoom(id) {
  return Object.keys(rooms).find(code => rooms[code].players.some(p => p.id === id));
}

function calculatePoints(hand) {
  const valueMap = { A: 1, J: 11, Q: 12, K: 13 };
  return hand.reduce((sum, card) => {
    const val = isNaN(card.value) ? valueMap[card.value] || 0 : parseInt(card.value);
    return sum + val;
  }, 0);
}

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`🟢 Server online su porta ${PORT}`));
