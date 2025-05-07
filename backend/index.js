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

  // ⚙️ Server-side - drawCard con gestione tris di mano al primo turno
socket.on('drawCard', () => {
  const code = findPlayerRoom(socket.id);
  const room = rooms[code];
  if (!room || room.phase !== 'draw' || getCurrentPlayer(room) !== socket.id) return;

  const card = room.deck.shift();
  room.hands[socket.id].push(card);
  room.phase = 'discard';

  io.to(socket.id).emit('cardDrawn', card);

  // 🔄 Traccia prima pescata
  if (!room.firstDrawDone) room.firstDrawDone = {};
  if (!room.trisAwarded) room.trisAwarded = {};

  if (!room.firstDrawDone[socket.id]) {
    room.firstDrawDone[socket.id] = true;

    const fullHand = room.hands[socket.id];
    const valueCounts = {};
    for (const c of fullHand) valueCounts[c.value] = (valueCounts[c.value] || 0) + 1;

    const trisValue = Object.entries(valueCounts).find(([val, count]) => count === 3);

    if (trisValue && !room.trisAwarded[socket.id]) {
      const [value] = trisValue;
      const isSpecial = (value === 'A' || value === 'K');
      const multiplier = isSpecial ? 6 : 3;
      const amount = multiplier * (room.players.length - 1);

      room.players.forEach(p => {
        if (!room.balances) room.balances = {};
        if (!room.balances[p.id]) room.balances[p.id] = 0;
      });

      room.players.forEach(p => {
        if (p.id === socket.id) {
          room.balances[p.id] += amount;
        } else {
          room.balances[p.id] -= multiplier;
        }
      });

      room.trisAwarded[socket.id] = true;

      io.to(code).emit('trisDiMano', {
        playerId: socket.id,
        playerName: room.players.find(p => p.id === socket.id)?.name || 'Qualcuno',
        value,
        amount
      });

      // 🟡 Attiva auto-discard
      const autoCard = fullHand.find(c => c.value === value);
      if (autoCard) {
        room.phase = 'discard';
        io.to(socket.id).emit('canAutoDiscard', autoCard);
      }
    }
  }
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

    if (!room.discarded) room.discarded = {};
if (!room.discarded[socket.id]) room.discarded[socket.id] = [];

cardList.forEach(c => {
  room.discarded[socket.id].push(c);
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
 // Inserisci questo blocco nel backend, dentro socket.on('kang') al posto della parte che crea solo finalScores


// ✅ Funzione completa kang con logica corretta vincita/perdita
// Aggiorna la funzione kang nel backend
// CORRETTO: socket.on('kang') con fix nel calcolo
// 📦 Logica corretta per pagamento Kang
// ✅ BLOCCO COMPLETO E CORRETTO
// ✅ Kang logic fix - correct balance for loss after closure with higher score
socket.on('kang', () => {
  const roomCode = findPlayerRoom(socket.id);
  const room = rooms[roomCode];
  if (!room || !room.hands) return;

  const callerId = socket.id;
  const callerHand = room.hands[callerId];
  if (!callerHand) return;

  const finalScores = Object.entries(room.hands).map(([playerId, hand]) => {
    return {
      id: playerId,
      name: (room.players.find(p => p.id === playerId) || {}).name || 'Giocatore',
      hand,
      score: calculatePoints(hand),
      discarded: room.discarded?.[playerId] || [],
      kings: room.lastDiscardedKCounts?.[playerId] || 0,
      balance: 0
    };
  });

  const sorted = [...finalScores].sort((a, b) => a.score - b.score);
  const minScore = sorted[0].score;
  const pari = sorted.filter(p => p.score === minScore);
  const vincitore = pari.find(p => p.id === callerId) || pari[0];
  const vincitoreId = vincitore.id;
  const totalPlayers = room.players.length;

  finalScores.forEach(p => p.balance = 0);

  if (callerId === vincitoreId) {
    // Chiamante ha vinto -> incassa dagli altri
    const assi = vincitore.hand.filter(c => c.value === 'A').length;
    const re = vincitore.discarded.filter(c => c.value === 'K').length;
    const perPlayer = 1 + assi + re;
    const totale = perPlayer * (totalPlayers - 1);

    finalScores.forEach(p => {
      if (p.id === callerId) p.balance += totale;
      else p.balance -= perPlayer;
    });
  } else {
    // Chiamante ha chiuso ma non ha vinto -> paga tutto al vincitore
    const loser = finalScores.find(p => p.id === callerId);
    const assi = vincitore.hand.filter(c => c.value === 'A').length;
    const re = vincitore.discarded.filter(c => c.value === 'K').length;
    const perPlayer = 1 + assi + re;
    const totale = perPlayer * totalPlayers;

    loser.balance -= totale;
    finalScores.find(p => p.id === vincitoreId).balance += totale;
  }

  if (!room.history) room.history = [];
  const handRecord = { mano: room.history.length + 1 };
  finalScores.forEach(p => {
    handRecord[p.name] = p.balance;
  });
  room.history.push(handRecord);

  io.to(roomCode).emit('kang_result', {
    scores: finalScores,
    callerId,
    combination: evaluateHand(callerHand),
    history: room.history
  });
});












  
  
  
socket.on('newRound', () => {
  const code = findPlayerRoom(socket.id);
  const room = rooms[code];
  if (!room || room.hostId !== socket.id) return;

  const deck = createDeck();
  const hands = dealHands(deck, room.maxPlayers);
  room.deck = deck;
  room.hands = {};
  room.turnIndex = 0;
  room.phase = 'draw';
  room.lastDiscarded = null;
  room.lastDiscardedKCounts = {};
  room.discarded = {};
  let winnerFound = false;

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
      winnerFound = true;

      const playerName = p.name || 'Qualcuno';

      io.to(code).emit('specialComboReveal', {
        playerName,
        combination: result.combination,
        value: result.value,
        multiplier: result.multiplier || 5
      });

      // Punteggio e fine partita
      io.to(code).emit('gameEnded', {
        winner: p.id,
        winnerName: playerName,
        totalWinnings: 0,
        reason: `${playerName} ha ${type} (+${result.multiplier * (room.players.length - 1)}€)`,
        finalScores: room.players.map(pl => ({
          id: pl.id,
          name: pl.name,
          hand: room.hands?.[pl.id] || [],
          score: calculatePoints(room.hands?.[pl.id] || []),
          discarded: room.discarded?.[pl.id] || [],
          kings: room.lastDiscardedKCounts?.[pl.id] || 0,
          balance: 0
        }))
      });

      // Aggiorna la tabella anche per le combo speciali
io.to(code).emit('kang_result', {
  scores: room.players.map(pl => ({
    id: pl.id,
    name: pl.name,
    hand: room.hands?.[pl.id] || [],
    score: calculatePoints(room.hands?.[pl.id] || []),
    discarded: room.discarded?.[pl.id] || [],
    kings: room.lastDiscardedKCounts?.[pl.id] || 0,
    balance: 0
  })),
  callerId: p.id,
  combination: result,
  history: room.history || []
});


      // Mostra pulsante Nuova Mano se host
      if (room.hostId === p.id) {
        io.to(p.id).emit('forceNewRoundButton');
      }
    }
  });

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
  room.lastDiscardedKCounts = {};
  room.discarded = {};
  room.firstDrawDone = {}; // 🔁 reset turni
  room.trisAwarded = {};   // 🔁 reset tris di mano

  if (!room.history) room.history = [];

  let winnerFound = false;

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
      winnerFound = true;
      room.phase = 'end';

      const playerName = p.name || 'Qualcuno';
      const winnings = result.multiplier * (room.players.length - 1);

      // Calcola saldi
      const scores = room.players.map(pl => ({
        id: pl.id,
        name: pl.name,
        hand: room.hands[pl.id] || [],
        score: calculatePoints(room.hands[pl.id] || []),
        discarded: room.discarded?.[pl.id] || [],
        kings: room.lastDiscardedKCounts?.[pl.id] || 0,
        balance: pl.id === p.id ? winnings : -result.multiplier
      }));

      // Salva storico
      const handRecord = { mano: room.history.length + 1 };
      scores.forEach(s => handRecord[s.name] = s.balance);
      room.history.push(handRecord);

      // Eventi
      io.to(code).emit('specialComboReveal', {
        playerName,
        combination: result.combination,
        value: result.value,
        winnings
      });

      io.to(code).emit('gameEnded', {
        winner: p.id,
        winnerName: playerName,
        reason: `${playerName} ha ${result.combination} (+${winnings}€)`,
        totalWinnings: winnings,
        finalScores: scores
      });

      if (p.id === room.hostId) {
        io.to(p.id).emit('forceNewRoundButton');
      }
    }
  });

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
