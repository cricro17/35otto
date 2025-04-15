// ✅ app.js completo e fixato
const socket = io("https://three5otto.onrender.com"
);
let playerHand = [];
let selectedIndexes = [];
let currentPhase = null;
let isMyTurn = false;
let localPlayerIndex = null;
let isHost = false;
let playerName = '';
let firstDeal = true;
const playerNames = {};
let discardMap = [];

const statusEl = document.getElementById('status');
const createBtn = document.getElementById('create');
const joinBtn = document.getElementById('join');
const startBtn = document.getElementById('startGame');
const roomInput = document.getElementById('roomCode');
const nameInput = document.getElementById('playerName');
const playersList = document.getElementById('playersList');
const autoBtn = document.getElementById('autoDiscardBtn');
const dealSound = new Audio('deal.mp3');
const style = document.createElement('style');
const playerStats = {};
style.innerHTML = `
#winnerOverlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  overflow: hidden;
}
.winner-message {
  font-size: 3rem;
  color: gold;
  font-weight: bold;
  text-shadow: 2px 2px 5px #000;
  z-index: 2;
}
.coin {
  position: absolute;
  top: -50px;
  font-size: 2rem;
  animation: dropCoin linear forwards;
  color: gold;
  z-index: 1;
}
@keyframes dropCoin {
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(100vh); opacity: 0; }
}`;
document.head.appendChild(style);

function updateStatus(msg) {
  statusEl.innerText = '';
  void statusEl.offsetHeight;
  statusEl.innerText = msg;
}

function updateScoreTable(scores) {
  if (!Array.isArray(scores)) return;

  const balanceTable = document.getElementById('balanceScoreTable');
  if (balanceTable) {
    const tbody = balanceTable.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = '';
      scores.forEach(({ name, balance }) => {
        if (name && balance !== undefined) {
          const row = document.createElement('tr');
          row.innerHTML = `<td>${name}</td><td>${balance.toFixed(2)}€</td>`;
          tbody.appendChild(row);
        }
      });
    }
    balanceTable.style.display = 'table';
  }
}

function updateSummaryTable() {
  const table = document.getElementById('summaryTable');
  if (!table) return;

  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';

  Object.entries(playerStats).forEach(([name, { total, hands }]) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${name}</td>
      <td>${total.toFixed(2)}€</td>
      <td>${hands}</td>
    `;
    tbody.appendChild(row);
  });
}


// ⚠️ FIX ANIMATION BUG
function renderHandAnimated(cards, containerId, withSound = false) {
  const container = document.getElementById(containerId);
  const center = document.querySelector('.table').getBoundingClientRect();
  container.innerHTML = '';

  cards.forEach((card, i) => {
    const btn = document.createElement('button');
    btn.className = `card ${getSuitName(card.suit)}`;
    btn.innerText = `${card.value}${card.suit}`;
    btn.onclick = () => toggleCardSelection(i, btn);

    btn.style.opacity = '0';
    btn.style.position = 'absolute';
    btn.style.left = `${center.width / 2}px`;
    btn.style.top = `${center.height / 2}px`;
    btn.style.transition = 'all 0.4s ease';

    setTimeout(() => {
      btn.style.opacity = '1';
      btn.style.position = 'relative';
      btn.style.left = '0';
      btn.style.top = '0';
      if (withSound) dealSound.cloneNode(true).play();
    }, i * 250);

    container.appendChild(btn); // 🛠️ FIXED: was 'container.Child(btn);'
  });
}

function renderPlayersList(players) {
  playersList.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name + (p.id === socket.id ? ' (Tu)' : '');
    playersList.appendChild(li);
    playerNames[p.id] = p.name;
  });
  renderTableNames(players);
  startBtn.style.display = (isHost && players.length >= 3) ? 'inline-block' : 'none';
}

function renderTableNames(players) {
  const me = players.findIndex(p => p.id === socket.id);
  players.forEach((p, i) => {
    const pos = discardMap[(i - me + players.length) % players.length];
    const el = document.querySelector(`.player.${pos} .name`);
    if (el) el.textContent = p.id === socket.id ? 'Tu' : p.name;
  });
}

function getSuitName(symbol) {
  switch (symbol) {
    case '♥': return 'hearts';
    case '♦': return 'diamonds';
    case '♣': return 'clubs';
    case '♠': return 'spades';
    default: return '';
  }
}

function sortHandByValueDesc(hand) {
  const order = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'];
  return hand.sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value));
}


function renderHand(highlightCard = null) {
  const handDiv = document.getElementById('bottom-hand');
  if (!handDiv) return;
  handDiv.innerHTML = '';

  playerHand.forEach((card, index) => {
    const btn = document.createElement('button');
    btn.className = `card ${getSuitName(card.suit)}`;
    btn.innerText = `${card.value}${card.suit}`;
    btn.onclick = () => toggleCardSelection(index, btn);

    if (selectedIndexes.includes(index)) {
      btn.classList.add('selected');
    }

    if (highlightCard && card.value === highlightCard.value) {
      btn.style.border = '3px solid red';
      btn.title = 'Puoi scartarla automaticamente';
    }

    handDiv.appendChild(btn);
  });
}

function toggleCardSelection(index, button) {
  const selectedValue = playerHand[index].value;
  selectedIndexes = playerHand
    .map((c, i) => (c.value === selectedValue ? i : null))
    .filter(i => i !== null);
  renderHand(); // re-render to update visual
}

function renderHandAnimated(cards, containerId, withSound = false) {
  const container = document.getElementById(containerId);
  const center = document.querySelector('.table').getBoundingClientRect();
  container.innerHTML = '';

  cards.forEach((card, i) => {
    const btn = document.createElement('button');
    btn.className = `card ${getSuitName(card.suit)}`;
    btn.innerText = `${card.value}${card.suit}`;

    btn.onclick = () => toggleCardSelection(i, btn);

    btn.style.opacity = '0';
    btn.style.position = 'absolute';
    btn.style.left = `${center.width / 2}px`;
    btn.style.top = `${center.height / 2}px`;
    btn.style.transition = 'all 0.4s ease';

    setTimeout(() => {
      btn.style.opacity = '1';
      btn.style.position = 'relative';
      btn.style.left = '0';
      btn.style.top = '0';
      if (withSound) dealSound.cloneNode(true).play();
    }, i * 250);

    container.appendChild(btn);
  });
}

function renderBacksAnimated(containerId, count, playerId = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (playerId) container.dataset.playerId = playerId;

  for (let i = 0; i < count; i++) {
    const div = document.createElement('div');
    div.className = 'card-back';
    container.appendChild(div);
  }
}


function updateButtons() {
  document.getElementById('drawBtn').disabled = !(isMyTurn && currentPhase === 'draw');
  document.getElementById('discardBtn').disabled = !(isMyTurn && currentPhase === 'discard');
  document.getElementById('kangBtn').disabled = !isMyTurn;
}

function updateKingPile(pileId, card, count) {
  const pile = document.getElementById(pileId);
  if (!pile) return;

  pile.innerHTML = ''; // reset

  const span = document.createElement('span');
  span.className = `card ${getSuitName(card.suit)}`;
  span.innerText = `${card.value}${card.suit}`;
  span.classList.add('king-animate');
  pile.appendChild(span);

  if (count > 1) {
    const badge = document.createElement('div');
    badge.className = 'king-counter';
    badge.innerText = `+${count}`;
    pile.appendChild(badge);
  }
}

function updateScoreTable(scores) {
  if (!Array.isArray(scores)) return;

  const balanceTable = document.getElementById('balanceScoreTable');
  if (balanceTable) {
    const tbody = balanceTable.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = '';
      scores.forEach(({ name, balance }) => {
        if (name && balance !== undefined) {
          const row = document.createElement('tr');
          row.innerHTML = `<td>${name}</td><td>${balance.toFixed(2)}€</td>`;
          tbody.appendChild(row);
        }
      });
    }
    balanceTable.style.display = 'table';
  }
}


// Socket Events
socket.on('playerListUpdate', renderPlayersList);

socket.on('initialHand', ({ hand, special, playerIndex, totalPlayers, allPlayers }) => {
  discardMap = totalPlayers === 3
  ? ["bottom", "right", "left"] // mostra due avversari a dx e sx
  : ["bottom", "right", "top", "left"];

  const topEl = document.querySelector('.player.top');
   if (topEl) {
  topEl.classList.toggle('hidden', totalPlayers === 3);
  }

  playerHand = hand;
  localPlayerIndex = playerIndex;

  if (firstDeal) {
    playerHand = sortHandByValueDesc(hand);
    renderHandAnimated(playerHand, 'bottom-hand', true);
    firstDeal = false;
  } else {
    renderHand();
  }

  allPlayers.forEach((pid, i) => {
    const relIndex = (i - playerIndex + totalPlayers) % totalPlayers;
    const position = discardMap[relIndex];
  
    if (pid !== socket.id) {
      renderBacksAnimated(`${position}-hand`, hand.length, pid);
    }
  
    // ✅ Mostra il nome corretto del giocatore
    const name = playerNames[pid] || `Giocatore ${i + 1}`;
    const el = document.querySelector(`.player.${position} .name`);
    if (el) el.textContent = pid === socket.id ? 'Tu' : name;
  });
  

  if (special) {
    updateStatus(`✨ Hai una combinazione speciale: ${special.combination} (x${special.multiplier})`);
  }
});

socket.on('yourTurn', () => {
  isMyTurn = true;
  currentPhase = 'draw';
  updateStatus('🎯 È il tuo turno!');
  document.getElementById('actions').style.display = 'block';
  autoBtn.style.display = 'none';
  updateButtons();
});

socket.on('someoneTurn', ({ name }) => {
  updateStatus(`⏳ È il turno di ${name}`);
  isMyTurn = false;
  currentPhase = null;
  document.getElementById('actions').style.display = 'none';
  updateButtons();
});

socket.on('cardDrawn', (card) => {
  playerHand.push(card);
  playerHand = sortHandByValueDesc(playerHand);
  currentPhase = 'discard';

  renderHand();

  // 👉 Anima l'ultima carta aggiunta
  const handDiv = document.getElementById('bottom-hand');
  const cardEls = handDiv.querySelectorAll('.card');
  const lastCard = cardEls[cardEls.length - 1];
  if (lastCard) {
    lastCard.classList.add('draw-animate');
    lastCard.addEventListener('animationend', () => {
      lastCard.classList.remove('draw-animate');
    });
  }

  updateButtons();
});


socket.on('cardDiscarded', (cards) => { 
  cards.forEach(card => {
    const index = playerHand.findIndex(c =>
      c.value === card.value && c.suit === card.suit
    );
    if (index !== -1) playerHand.splice(index, 1);

    if (card.value === 'K') {
      const pileK = document.getElementById('bottom-pile-k');
      const current = parseInt(pileK.dataset.count || '0');
      const newCount = current + 1;
      pileK.dataset.count = newCount;
    
      pileK.innerHTML = '';
    
      const span = document.createElement('span');
      span.className = `card ${getSuitName(card.suit)} king-animate`;
      span.innerText = `${card.value}${card.suit}`;
      pileK.appendChild(span);
    
      span.addEventListener('animationend', () => {
        span.classList.remove('king-animate');
      });
    
      if (newCount > 1) {
        const badge = document.createElement('div');
        badge.className = 'king-counter';
        badge.innerText = `+${newCount}`;
        pileK.appendChild(badge);
      }
    }
    else {
      const pile = document.getElementById('bottom-pile');
      const span = document.createElement('span');
      span.className = 'card';
      span.innerText = `${card.value}${card.suit}`;
      span.classList.add('discard-animate');
      span.addEventListener('animationend', () => {
        span.classList.remove('discard-animate');
      });
      pile.innerHTML = '';
      pile.appendChild(span)


      pile.dataset.fullstack = (pile.dataset.fullstack ? pile.dataset.fullstack + ', ' : '') + `${card.value}${card.suit}`;
      span.setAttribute('data-fullstack', pile.dataset.fullstack);
    }
  }); // ✅ questa parentesi chiude il forEach!

  selectedIndexes = [];
  playerHand = sortHandByValueDesc(playerHand);
  renderHand();
  updateButtons();
});


socket.on('cardDiscardedByOther', ({ from, cards }) => {
  const allIds = Object.keys(playerNames);
  const total = allIds.length;
  const index = allIds.indexOf(from);
  const relIndex = (index - localPlayerIndex + total) % total;
  const pos = discardMap[relIndex];

  const pileK = document.getElementById(`${pos}-pile-k`);
  const pile = document.getElementById(`${pos}-pile`);
  if (!pile || !pileK) return;

  cards.forEach(card => {
    const text = `${card.value}${card.suit}`;

    if (card.value === 'K') {
      const current = parseInt(pileK.dataset.count || '0');
      const newCount = current + 1;
      pileK.dataset.count = newCount;
    
      pileK.innerHTML = ''; // pulisce per mostrare solo l'ultima
    
      const span = document.createElement('span');
      span.className = `card ${getSuitName(card.suit)} king-animate`;
      span.innerText = `${card.value}${card.suit}`;
      pileK.appendChild(span);
    
      span.addEventListener('animationend', () => {
        span.classList.remove('king-animate');
      });
    
      if (newCount > 1) {
        const badge = document.createElement('div');
        badge.className = 'king-counter';
        badge.innerText = `+${newCount}`;
        pileK.appendChild(badge);
      }
    }
     else {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerText = text;
      div.classList.add('discard-animate');
      div.addEventListener('animationend', () => {
        div.classList.remove('discard-animate');
      });

      pile.innerHTML = '';
      pile.appendChild(div);

      pile.dataset.fullstack = (pile.dataset.fullstack ? pile.dataset.fullstack + ', ' : '') + text;
      div.setAttribute('data-fullstack', pile.dataset.fullstack);
    }
  });
});




socket.on('canAutoDiscard', (card) => {
  isMyTurn = true;
  currentPhase = 'discard';
  updateStatus(`🔁 Puoi scartare ${card.value} subito`);
  document.getElementById('actions').style.display = 'block';

  selectedIndexes = [];
  playerHand.forEach((c, i) => {
    if (c.value === card.value) selectedIndexes.push(i);
  });

  renderHand(card);
  updateButtons();
});

socket.on('notYourTurn', () => {
  isMyTurn = false;
  currentPhase = null;
  selectedIndexes = [];
  document.getElementById('actions').style.display = 'none';
  updateButtons();
});

socket.on('gameEnded', ({ winner, winnerName, totalWinnings, reason, finalScores }) => {
  const name = winnerName || playerNames[winner] || 'Qualcuno';
  const isMe = winner === socket.id;

  updateStatus(isMe ? `🏆 Hai vinto! ${reason}` : `💀 ${name} ${reason}`);
  document.getElementById('actions').style.display = 'none';
  
  // Mostra sempre il bottone per nuova mano all'host
  const newRoundBtn = document.getElementById('newRoundBtn');
  if (newRoundBtn) {
    newRoundBtn.style.display = isHost ? 'inline-block' : 'none';
  }

  // 🎬 Mostra overlay con combinazione speciale se presente
  const comboMatch = reason.match(/combinazione speciale: (.+)/i);
  if (comboMatch) {
    const overlay = document.getElementById('specialOverlay');
    if (overlay) {
      const comboTitle = overlay.querySelector('.combo-title');
      const comboPlayer = overlay.querySelector('.combo-player');

      if (comboTitle) comboTitle.textContent = comboMatch[1].toUpperCase();
      if (comboPlayer) comboPlayer.textContent = `di ${name}`;
      overlay.classList.remove('hidden');

      const drumroll = new Audio('drumroll.mp3');
      drumroll.play();

      if (isMe) {
        const cards = document.querySelectorAll('#bottom-hand .card');
        cards.forEach(c => c.classList.add('special-animate'));
        setTimeout(() => cards.forEach(c => c.classList.remove('special-animate')), 4000);
      }

      setTimeout(() => overlay.classList.add('hidden'), 4000);
    }
  }

  // 💰 Overlay animazione vincita
  const winOverlay = document.createElement('div');
  winOverlay.id = 'winnerOverlay';
  winOverlay.innerHTML = `
    <div class="winner-message pulse">
      🎉 ${name} ha vinto <span id="countUp">0</span>€
    </div>
  `;
  document.body.appendChild(winOverlay);

  // Coin animation
  for (let i = 0; i < 40; i++) {
    const coin = document.createElement('div');
    coin.className = 'coin';
    coin.innerText = '💰';
    coin.style.left = Math.random() * 100 + 'vw';
    coin.style.animationDuration = (1 + Math.random() * 1.5) + 's';
    coin.style.fontSize = Math.random() * 1 + 1.4 + 'rem';
    coin.style.opacity = Math.random();
    coin.style.transform = `rotate(${Math.random() * 360}deg)`;
    winOverlay.appendChild(coin);
  }

  // Contatore dinamico
  const counter = winOverlay.querySelector('#countUp');
  let current = 0;
  const duration = 2000;
  const increment = Math.ceil(totalWinnings / (duration / 50));

  const interval = setInterval(() => {
    current += increment;
    if (current >= totalWinnings) {
      current = totalWinnings;
      clearInterval(interval);
    }
    counter.textContent = current;
  }, 50);

  setTimeout(() => winOverlay.remove(), 4000);
  if (Array.isArray(finalScores)) updateScoreTable(finalScores);

  if (Array.isArray(finalScores)) {
    updateScoreTable(finalScores);
  
    finalScores.forEach(({ name, balance }) => {
      if (!playerStats[name]) {
        playerStats[name] = { total: 0, hands: 0 };
      }
      playerStats[name].total += balance;
      playerStats[name].hands += 1;
    });
  
    updateSummaryTable();
  }
});


socket.on('updateOpponentHand', ({ playerId, cardsLeft }) => {
  const allPositions = ['bottom', 'right', 'top', 'left'];

  allPositions.forEach(pos => {
    const el = document.getElementById(`${pos}-hand`);
    if (el && el.dataset.playerId === playerId) {
      el.innerHTML = '';
      for (let i = 0; i < cardsLeft; i++) {
        const div = document.createElement('div');
        div.className = 'card-back';
        el.appendChild(div);
      }
    }
  });
});


// UI Handlers
createBtn.onclick = () => {
  playerName = nameInput.value.trim();
  if (!playerName) return alert("Inserisci un nome");
  const maxPlayers = parseInt(document.getElementById('maxPlayers').value);
  socket.emit('createRoom', playerName, maxPlayers, (roomCode, players) => {
    isHost = true;
    roomInput.value = roomCode;
    updateStatus(`Partita creata! Codice: ${roomCode}`);
    renderPlayersList(players);
  });
};

joinBtn.onclick = () => {
  playerName = nameInput.value.trim();
  const roomCode = roomInput.value.trim();
  if (!playerName || !roomCode) return alert("Inserisci nome e codice stanza");
  socket.emit('joinRoom', playerName, roomCode, (res) => {
    if (res.status === 'ok') {
      updateStatus(`Entrato nella stanza ${roomCode}`);
      renderPlayersList(res.players);
    } else updateStatus(res.message);
  });
};

startBtn.onclick = () => socket.emit('startGame');
roomInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinBtn.click(); });

document.getElementById('drawBtn').onclick = () => socket.emit('drawCard');

document.getElementById('discardBtn').onclick = () => {
  if (selectedIndexes.length < 1 || selectedIndexes.length > 4) {
    alert('Puoi scartare da 1 a 4 carte dello stesso valore.');
    return;
  }
  const selectedCards = selectedIndexes.map(i => playerHand[i]);
  const allSameValue = selectedCards.every(c => c.value === selectedCards[0].value);
  if (!allSameValue) return alert('Le carte devono essere tutte uguali!');
  socket.emit('discardCard', selectedCards);
  selectedIndexes = [];
  document.getElementById('actions').style.display = 'none';
};

autoBtn.onclick = () => {
  const cardsToDiscard = selectedIndexes.map(i => playerHand[i]);
  if (cardsToDiscard.length === 0) return alert('Seleziona la carta da scartare');
  socket.emit('discardCard', cardsToDiscard);
  autoBtn.style.display = 'none';
  document.getElementById('actions').style.display = 'none';
  isMyTurn = false;
  currentPhase = null;
  selectedIndexes = [];
  updateButtons();
};

document.getElementById('kangBtn').onclick = () => {
  if (!isMyTurn) return;
  socket.emit('kang');
};

document.getElementById('newRoundBtn').onclick = () => {
  socket.emit('newRound');
  document.getElementById('newRoundBtn').style.display = 'none';
  updateStatus('🔄 Inizio nuova mano...');
};

