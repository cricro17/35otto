// ✅ app.js completo e fixato
const socket = io("http://localhost:3002"
);
let playerHand = [];
let selectedIndexes = [];
let currentPhase = null;
let isMyTurn = false;
let localPlayerIndex = null;
let isHost = false;
let firstDeal = true;
let roundNumber = 1;
let discardMap = [];
let pendingTrisValue = null;
let pendingTrisChecked = false;
let hasDrawnOnce = false; // definiscila globale in alto

let balanceHistory = [];
let currentTotals = {};
let currentHand = 1;
let playerNames = [];

function initBalanceTable(players) {
  playerNames = players;
  currentTotals = {};
  players.forEach(name => currentTotals[name] = 0);

  const headerRow = document.querySelector("#balanceTable thead tr");
  const totalRow = document.querySelector("#totalRow");
  players.forEach(name => {
    const th = document.createElement("th");
    th.textContent = name;
    headerRow.appendChild(th);

    const td = document.createElement("td");
    td.id = `total-${name}`;
    td.textContent = "+0";
    totalRow.appendChild(td);
  });
}

function updateBalanceTable(scoreData) {
  const row = document.createElement("tr");
  const manoCell = document.createElement("td");
  manoCell.textContent = currentHand++;
  row.appendChild(manoCell);

  playerNames.forEach(name => {
    const player = scoreData.find(p => p.name === name);
    const td = document.createElement("td");
    const diff = player.balance;
    td.textContent = diff > 0 ? `+${diff}` : diff;
    td.className = diff > 0 ? "positive" : (diff < 0 ? "negative" : "");
    row.appendChild(td);

    currentTotals[name] += diff;
    const totalCell = document.getElementById(`total-${name}`);
    totalCell.textContent = currentTotals[name] > 0 ? `+${currentTotals[name]}` : currentTotals[name];
    totalCell.className = currentTotals[name] > 0 ? "positive" : (currentTotals[name] < 0 ? "negative" : "");
  });

  document.querySelector("#balanceTable tbody").appendChild(row);
}



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
  background: radial-gradient(circle, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  overflow: hidden;
  animation: fadeIn 0.5s ease-in-out;
}

.winner-message {
  font-size: 3.5rem;
  color: gold;
  font-weight: 900;
  text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
  z-index: 2;
  letter-spacing: 1.5px;
  animation: glowPulse 1.5s ease-in-out infinite;
}

.coin {
  position: absolute;
  top: -50px;
  font-size: 2rem;
  animation: dropCoin linear forwards;
  color: gold;
  z-index: 1;
}

.penalty-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
  padding: 20px;
  animation: fadeIn 0.3s ease;
}

.penalty-message {
  background: #911;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 0 10px #f00;
}

@keyframes dropCoin {
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(100vh); opacity: 0; }
}


@keyframes glowPulse {
  0% { text-shadow: 0 0 10px gold; }
  50% { text-shadow: 0 0 30px gold; }
  100% { text-shadow: 0 0 10px gold; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pulseText {
  0% { transform: scale(1); text-shadow: 0 0 5px #fff, 0 0 10px #ffd700; }
  50% { transform: scale(1.1); text-shadow: 0 0 15px #fff, 0 0 35px #ffd700; }
  100% { transform: scale(1); text-shadow: 0 0 5px #fff, 0 0 10px #ffd700; }
}
`;
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

  table.innerHTML = `
    <thead>
      <tr><th>Giocatore</th><th>Bilancio</th><th>Mani giocate</th></tr>
    </thead>
    <tbody>
      ${Object.entries(playerStats).map(([name, stats]) =>
        `<tr>
          <td>${name}</td>
          <td>${stats.total.toFixed(2)}€</td>
          <td>${stats.hands}</td>
        </tr>`
      ).join('')}
    </tbody>
  `;
}


// ⚠️ FIX ANIMATION BUG
function renderHandAnimated(cards, containerId, withSound = false) {
  const container = document.getElementById(containerId);
  const center = document.querySelector('.table').getBoundingClientRect();

  const cardText = (card) => `${card.value}${card.suit}`;
  const currentButtons = Array.from(container.querySelectorAll('.card'));

  const cardMap = new Map();
  currentButtons.forEach(btn => {
    cardMap.set(btn.innerText, btn);
  });

  const alreadyInDom = new Set();

  cards.forEach((card, i) => {
    const text = cardText(card);
    let btn = cardMap.get(text);

    if (!btn) {
      btn = document.createElement('button');
      btn.className = `card ${getSuitName(card.suit)}`;
      btn.innerText = text;
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
        btn.classList.add('draw-animate');
        if (withSound) dealSound.cloneNode(true).play();
      }, 50);
    }

    if (!alreadyInDom.has(text)) {
      container.insertBefore(btn, container.children[i] || null);
      alreadyInDom.add(text);
    }
  });

  // Rimuovi eventuali carte in eccesso non più nella mano
  Array.from(container.children).forEach(btn => {
    if (!cards.some(c => cardText(c) === btn.innerText)) {
      container.removeChild(btn);
    }
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

function dealCardsToPlayers(players, cardsByPlayer, withSound = true) {
  const table = document.querySelector('.table');
  const center = table.getBoundingClientRect();

  let delay = 0;

  // Calcola massimo numero di carte da dare
  const maxCards = Math.max(...players.map(p => cardsByPlayer[p].length));

  for (let i = 0; i < maxCards; i++) {
    players.forEach(pos => {
      const container = document.querySelector(`.player.${pos} .hand`);
      const card = cardsByPlayer[pos][i];
      if (!card) return;

      setTimeout(() => {
        const btn = document.createElement('button');
        btn.className = `card ${getSuitName(card.suit)} draw-animate`;
        btn.innerText = `${card.value}${card.suit}`;
        btn.onclick = () => toggleCardSelection(i, btn);

        const target = container.getBoundingClientRect();
        const offsetX = target.left + target.width / 2 - center.left;
        const offsetY = target.top + target.height / 2 - center.top;

        btn.style.position = 'absolute';
        btn.style.left = `${center.width / 2}px`;
        btn.style.top = `${center.height / 2}px`;
        btn.style.transform = 'translate(-50%, -50%) scale(0.3)';
        btn.style.opacity = '0';
        btn.style.transition = 'all 0.5s ease-out';

        table.appendChild(btn);

        // trigger distribuzione visiva
        setTimeout(() => {
          btn.style.left = `${offsetX}px`;
          btn.style.top = `${offsetY}px`;
          btn.style.opacity = '1';
          btn.style.transform = 'translate(-50%, -50%) scale(1) rotate(3deg)';
        }, 50);

        // sposta realmente la carta nel container
        setTimeout(() => {
          btn.style.position = 'relative';
          btn.style.left = '0';
          btn.style.top = '0';
          btn.style.transform = 'none';
          btn.style.transition = 'none';
          container.appendChild(btn);
        }, 600);

        if (withSound) dealSound.cloneNode(true).play();
      }, delay);

      delay += 200;
    });
  }
}

async function dealCardsRoundRobin(players, cardsByPlayer) {
  document.querySelectorAll('.hand').forEach(h => {
    h.style.overflow = 'hidden';              // nasconde scroll
    h.classList.add('disabling-scroll');      // blocca gesture/scroll
    h.innerHTML = '';                         // svuota DOM mano
  });

  const delay = (ms) => new Promise(res => setTimeout(res, ms));
  const maxCards = Math.max(...players.map(p => cardsByPlayer[p].length));

  for (let i = 0; i < maxCards; i++) {
    for (const pos of players) {
      const card = cardsByPlayer[pos][i];
      if (!card) continue;

      const container = document.getElementById(`${pos}-hand`);
      if (!container) continue;

      const btn = document.createElement('button');
      btn.className = `card ${getSuitName(card.suit)}`;
      btn.innerText = card.value + card.suit;
      btn.style.opacity = '0';
      btn.style.position = 'absolute';

      const table = document.querySelector('.table').getBoundingClientRect();
      btn.style.left = `${table.width / 2}px`;
      btn.style.top = `${table.height / 2}px`;
      btn.style.transition = 'all 0.4s ease';

      container.appendChild(btn);

      await delay(10); // allow DOM to render
      btn.style.opacity = '1';
      btn.style.position = 'relative';
      btn.style.left = '0';
      btn.style.top = '0';
      btn.classList.add('draw-animate');

      if (pos === 'bottom') {
        btn.onclick = () => toggleCardSelection(i, btn);
      }

      await delay(300);
    }
  }

  // ✅ Solo alla fine ripristina scroll e gesture
  document.querySelectorAll('.hand').forEach(h => {
    h.style.overflow = '';
    h.classList.remove('disabling-scroll');
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


function animateDiscard(cardEl, targetEl) {
  const clone = cardEl.cloneNode(true);
  const fromRect = cardEl.getBoundingClientRect();
  const toRect = targetEl.getBoundingClientRect();

  clone.style.position = 'absolute';
  clone.style.left = `${fromRect.left}px`;
  clone.style.top = `${fromRect.top}px`;
  clone.style.width = `${fromRect.width}px`;
  clone.style.height = `${fromRect.height}px`;
  clone.style.zIndex = 1000;
  clone.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
  document.body.appendChild(clone);

  const dx = toRect.left - fromRect.left;
  const dy = toRect.top - fromRect.top;

  requestAnimationFrame(() => {
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.6) rotate(10deg)`;
    clone.style.opacity = '0';
  });

  setTimeout(() => clone.remove(), 500);
}


// Socket Events
socket.on('playerListUpdate', renderPlayersList);

// ✅ Fix distribuzione carte iniziali nella prima mano
socket.on('initialHand', async ({ hand, special, playerIndex, totalPlayers, allPlayers }) => {
  discardMap = totalPlayers === 3
    ? ['bottom', 'right', 'left']
    : ['bottom', 'right', 'top', 'left'];

  const topEl = document.querySelector('.player.top');
  if (topEl) {
    topEl.classList.toggle('hidden', totalPlayers === 3);
  }

   // 🧹 Reset completo
   playerHand = [];
   selectedIndexes = [];
   document.getElementById('bottom-hand').innerHTML = '';

  playerHand = sortHandByValueDesc(hand);
  localPlayerIndex = playerIndex;
  const counts = {};
playerHand.forEach(card => {
  counts[card.value] = (counts[card.value] || 0) + 1;
});
const pairValue = Object.keys(counts).find(k => counts[k] === 2);
if (pairValue) {
  pendingTrisValue = pairValue;
  pendingTrisChecked = false;
}

  // Reset pile scarti
  ['bottom', 'top', 'left', 'right'].forEach(pos => {
    const pile = document.getElementById(`${pos}-pile`);
    const pileK = document.getElementById(`${pos}-pile-k`);
    if (pile) {
      pile.innerHTML = '';
      pile.dataset.fullstack = '';
    }
    if (pileK) {
      pileK.innerHTML = '';
      pileK.dataset.count = 0;
    }
  });

  // Mostra etichetta "Mano n°X"
  const roundLabel = document.getElementById('roundCounter');
  if (roundLabel) {
    roundLabel.textContent = `Mano n°${roundNumber}`;
    roundNumber++;
    roundLabel.classList.remove('hidden');
    roundLabel.style.animation = 'none';
    void roundLabel.offsetHeight;
    roundLabel.style.animation = 'fadeOut 3s ease forwards';
    setTimeout(() => roundLabel.classList.add('hidden'), 3000);
  }

  // Mostra mano animata
const players = discardMap;

const cardsByPlayer = {};
allPlayers.forEach((pid, i) => {
  const relIndex = (i - playerIndex + totalPlayers) % totalPlayers;
  const position = discardMap[relIndex];

  if (pid === socket.id) {
    cardsByPlayer[position] = playerHand;
  } else {
    // mostra solo schiena (verrà gestito da renderBacksAnimated)
    cardsByPlayer[position] = []; // <-- qui cambia
  }
});
await dealCardsRoundRobin(players, cardsByPlayer);

if (special && hand.length === 5) {
  setTimeout(() => {
    const overlay = document.createElement('div');
    overlay.id = 'winnerOverlay';
    overlay.innerHTML = `
      <div class="winner-message pulse">
        🎉 ${playerName.toUpperCase()} HA UNA ${special.combination.toUpperCase()} (x${special.multiplier})
      </div>
    `;
    document.body.appendChild(overlay);

    const drumroll = new Audio('drumroll.mp3');
    drumroll.play();

    setTimeout(() => overlay.remove(), 4000);
  }, 800); // attesa minima
}


  // Mostra carte dietro agli avversari e aggiorna nomi
  allPlayers.forEach((pid, i) => {
    const relIndex = (i - playerIndex + totalPlayers) % totalPlayers;
    const position = discardMap[relIndex];

    if (pid !== socket.id) {
      renderBacksAnimated(`${position}-hand`, hand.length, pid);
    }

    const name = playerNames[pid] || `Giocatore ${i + 1}`;
    const el = document.querySelector(`.player.${position} .name`);
    if (el) el.textContent = pid === socket.id ? 'Tu' : name;
  });

  if (special) {
    updateStatus(`✨ Hai una combinazione speciale: ${special.combination} (x${special.multiplier})`);
  }
});



socket.on('yourTurn', () => {
  // 🔄 Rimuovi evidenza da tutti i nomi
  document.querySelectorAll('.player .name').forEach(n => n.classList.remove('turn-active'));

  isMyTurn = true;
  currentPhase = 'draw';
  updateStatus('🎯 È il tuo turno!');
  document.getElementById('actions').style.display = 'block';
  autoBtn.style.display = 'none';

  // 🔥 Evidenzia solo "Tu"
  const nameEl = document.querySelector('.player.bottom .name');
  if (nameEl) nameEl.classList.add('turn-active');

  updateButtons();
});



socket.on('someoneTurn', ({ name }) => {
  updateStatus(`⏳ È il turno di ${name}`);
  isMyTurn = false;
  currentPhase = null;
  document.getElementById('actions').style.display = 'none';

  // 🔥 Rimuovi highlight da tutti
  document.querySelectorAll('.player .name').forEach(n => n.classList.remove('turn-active'));

  // Trova posizione del nome attivo
  const pos = Object.entries(playerNames).find(([id, n]) => n === name);
  if (pos) {
    const playerIndex = Object.keys(playerNames).indexOf(pos[0]);
    const relIndex = (playerIndex - localPlayerIndex + Object.keys(playerNames).length) % Object.keys(playerNames).length;
    const classPos = discardMap[relIndex];
    const nameEl = document.querySelector(`.player.${classPos} .name`);
    if (nameEl) nameEl.classList.add('turn-active');
  }

  updateButtons();
});


socket.on('yourTurn', () => {
  isMyTurn = true;
  currentPhase = 'draw';
  hasDrawnOnce = false; // ✅ reset ad inizio turno
  updateStatus('🎯 È il tuo turno!');
  document.getElementById('actions').style.display = 'block';
  autoBtn.style.display = 'none';
  updateButtons();
});

socket.on('cardDrawn', (card) => {
  playerHand.push(card);
  playerHand = sortHandByValueDesc(playerHand);
  currentPhase = 'discard';
  isMyTurn = true;

  renderHand();

  const handDiv = document.getElementById('bottom-hand');
  const index = playerHand.findIndex(c => c.value === card.value && c.suit === card.suit);
  const target = handDiv.children[index];
  if (target) {
    target.classList.add('draw-animate');
    target.addEventListener('animationend', () => target.classList.remove('draw-animate'), { once: true });
  }

  handDiv.scrollLeft = 0;
  handDiv.style.overflow = 'hidden';
  setTimeout(() => handDiv.style.overflow = 'auto', 500);

  updateButtons();

  // ✅ TRIS solo alla prima pescata
  if (!hasDrawnOnce) {
    hasDrawnOnce = true;

    if (!pendingTrisChecked && card.value === pendingTrisValue) {
      pendingTrisChecked = true;

      const overlay = document.createElement('div');
      overlay.id = 'winnerOverlay';
      overlay.innerHTML = `
        <div class="winner-message pulse">
          🎉 TRIS DI ${playerName.toUpperCase()}!
        </div>
      `;
      document.body.appendChild(overlay);

      const drumroll = new Audio('drumroll.mp3');
      drumroll.play();

      for (let i = 0; i < 40; i++) {
        const coin = document.createElement('div');
        coin.className = 'coin';
        coin.innerText = '💰';
        coin.style.left = Math.random() * 100 + 'vw';
        coin.style.animationDuration = (1 + Math.random() * 1.5) + 's';
        coin.style.fontSize = Math.random() * 1 + 1.4 + 'rem';
        coin.style.opacity = Math.random();
        coin.style.transform = `rotate(${Math.random() * 360}deg)`;
        overlay.appendChild(coin);
      }

      setTimeout(() => overlay.remove(), 4000);

      const me = Object.values(playerNames).find(name => name === playerName);
      if (me && playerStats[me]) {
        playerStats[me].total += 3 * (discardMap.length - 1);
        playerStats[me].hands += 0;
      }

      updateScoreTable(
        Object.entries(playerStats).map(([name, { total }]) => ({ name, balance: total }))
      );
    }
  }
});




// ✅ FIX LOGICA SCARTO (app.js): sistemiamo logica K e carte normali
// ✅ Fix completo per gestione pile scarti con Re persistenti e normali visibili
// ✅ Fix definitivo: mantieni le pile indipendenti, non azzerare i Re se non necessari
socket.on('cardDiscarded', (cards) => {
  cards.forEach(card => {
    const index = playerHand.findIndex(c => c.value === card.value && c.suit === card.suit);
    if (index !== -1) {
      const handDiv = document.getElementById('bottom-hand');
      const cardEls = handDiv.querySelectorAll('.card');
      const el = cardEls[index];
      if (el) animateDiscard(el, document.getElementById('bottom-pile'));
      playerHand.splice(index, 1);
    }
  });
  

  const pile = document.getElementById('bottom-pile');
  const pileK = document.getElementById('bottom-pile-k');
  if (!pile || !pileK) return;

  // Re: calcolo e visualizzazione
  let kingCount = parseInt(pileK.dataset.count || '0');
  const kingCards = [];
  const normalCards = [];
  cards.forEach(card => {
    const text = `${card.value}${card.suit}`;
    if (card.value === 'K') {
      kingCount++;
      kingCards.push(card);
    } else {
      normalCards.push(text);
    }
  });

  // ✅ Mostra solo ultimo Re, badge se > 1
  if (kingCards.length > 0) {
    const lastK = kingCards[kingCards.length - 1];
    pileK.innerHTML = '';
    const span = document.createElement('span');
    span.className = `card ${getSuitName(lastK.suit)} king-animate`;
    span.innerText = `${lastK.value}${lastK.suit}`;
    pileK.appendChild(span);
    span.addEventListener('animationend', () => {
      span.classList.remove('king-animate');
    });
    if (kingCount > 1) {
      const badge = document.createElement('div');
      badge.className = 'king-counter';
      badge.innerText = `+${kingCount}`;
      pileK.appendChild(badge);
    }
    pileK.dataset.count = kingCount;
  }

  // ✅ Stack persistente per normali
  if (normalCards.length > 0) {
    let fullStack = pile.dataset.fullstack ? pile.dataset.fullstack.split(',') : [];
    fullStack = [...fullStack, ...normalCards];
    pile.dataset.fullstack = fullStack.join(',');

    pile.innerHTML = '';
    const last = fullStack[fullStack.length - 1];

    const span = document.createElement('span');
    span.className = 'card top-card discard-animate';
    span.innerText = last;
    pile.appendChild(span);
    

    span.addEventListener('animationend', () => {
      span.classList.remove('discard-animate');
    });

    const stack = document.createElement('div');
    stack.className = 'discard-stack';
    stack.tabIndex = -1; // ✅ abilita scroll su focus (click)
    stack.addEventListener('click', () => {
      stack.focus(); // attiva scroll
    });

    fullStack.forEach(text => {
      const c = document.createElement('span');
      c.className = 'card mini';
      c.innerText = text;
      stack.appendChild(c);
    });

    pile.appendChild(stack);

    // 🖱️ Abilita scroll solo dopo click su ultima carta
    span.addEventListener('click', () => {
      stack.classList.toggle('show');
      if (stack.classList.contains('show')) {
        stack.scrollTop = stack.scrollHeight;
        stack.focus();
      }
    });
    
    stack.tabIndex = -1;
    
    stack.addEventListener('wheel', (e) => {
      if (stack.classList.contains('show')) {
        e.preventDefault();
        e.stopPropagation();
        stack.scrollTop += e.deltaY;
      }
    }, { passive: false });
    
  }

  selectedIndexes = [];
  playerHand = sortHandByValueDesc(playerHand);
  renderHand();
  updateButtons();
});




// 🔁 VERSIONE AGGIORNATA per gli scarti altrui
// 🔁 Ventaglio reale per le pile degli avversari (senza tooltip)
// 🔁 VERSIONE AGGIORNATA per gli scarti altrui
// 🔁 Stack verticale visibile su click con scroll
socket.on('cardDiscardedByOther', ({ from, cards }) => {
  const allIds = Object.keys(playerNames);
  const total = allIds.length;
  const index = allIds.indexOf(from);
  const relIndex = (index - localPlayerIndex + total) % total;
  const pos = discardMap[relIndex];

  const pileK = document.getElementById(`${pos}-pile-k`);
  const pile = document.getElementById(`${pos}-pile`);
  if (!pile || !pileK) return;

  const fromHand = document.querySelector(`.player.${pos} .hand .card-back`);
if (fromHand) {
  animateDiscard(fromHand, fromHand, pile);
}

  let updatedKingCount = parseInt(pileK.dataset.count || '0');
  const kingCards = [];
  const normalCards = [];

  cards.forEach(card => {
    const text = `${card.value}${card.suit}`;
    if (card.value === 'K') {
      updatedKingCount++;
      kingCards.push(card);
    } else {
      normalCards.push(text);
    }
  });

  if (kingCards.length > 0) {
    pileK.innerHTML = '';
    const lastK = kingCards[kingCards.length - 1];
    const span = document.createElement('span');
    span.className = `card ${getSuitName(lastK.suit)} king-animate`;
    span.innerText = `${lastK.value}${lastK.suit}`;
    pileK.appendChild(span);
    span.addEventListener('animationend', () => {
      span.classList.remove('king-animate');
    });
    if (updatedKingCount > 1) {
      const badge = document.createElement('div');
      badge.className = 'king-counter';
      badge.innerText = `+${updatedKingCount}`;
      pileK.appendChild(badge);
    }
    pileK.dataset.count = updatedKingCount;
  }

  if (normalCards.length > 0) {
    let fullStack = pile.dataset.fullstack ? pile.dataset.fullstack.split(',') : [];
    fullStack = [...fullStack, ...normalCards];
    pile.dataset.fullstack = fullStack.join(',');

    pile.innerHTML = '';
    const last = fullStack[fullStack.length - 1];

    const span = document.createElement('span');
    span.className = 'card top-card discard-animate';
    span.innerText = last;
    pile.appendChild(span);

    const stack = document.createElement('div');
    stack.className = 'discard-stack';
    stack.tabIndex = -1;

    // ✅ Posizione e rotazione
    if (pos === 'left') {
      stack.style.position = 'absolute';
      stack.style.top = '0';
      stack.style.left = 'calc(100% + 12px)';
      stack.style.transform = 'rotate(90deg)';
      stack.style.transformOrigin = 'top left';
    } else if (pos === 'right') {
      stack.style.position = 'absolute';
      stack.style.top = '0';
      stack.style.left = 'calc(100% + 12px)';
      stack.style.transform = 'rotate(-90deg)';
      stack.style.transformOrigin = 'top left';
    }

    span.addEventListener('mouseenter', () => {
      stack.classList.add('show');
      stack.scrollTop = stack.scrollHeight;
      stack.focus();
    });

    span.addEventListener('mouseleave', () => {
      stack.classList.remove('show');
    });

    stack.addEventListener('wheel', (e) => {
      if (stack.classList.contains('show')) {
        e.preventDefault();
        e.stopPropagation();
        stack.scrollTop += e.deltaY;
      }
    }, { passive: false });

    fullStack.forEach(text => {
      const c = document.createElement('span');
      c.className = 'card mini';
      c.innerText = text;
      stack.appendChild(c);
    });

    pile.appendChild(stack);
  }
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
  console.log('🔥 GAME ENDED TRIGGERED:', { winner, winnerName, totalWinnings, reason, finalScores });

  if (!Array.isArray(finalScores)) {
    console.warn('⚠️ Nessun finalScores ricevuto o non è un array', finalScores);
    return;
  }

  const myScore = finalScores.find(p => p.id === socket.id);
  if (!myScore) {
    console.warn('⚠️ Nessun punteggio trovato per il giocatore attuale');
    return;
  }

 
  
  const name = winnerName || playerNames[winner] || 'Qualcuno';
  const isMe = winner === socket.id;

  updateStatus(isMe ? `🏆 Hai vinto! ${reason}` : `💀 ${name} ${reason}`);
  document.getElementById('actions').style.display = 'none';

  // 👉 MOSTRA OVERLAY D'ORO
  const overlay = document.createElement('div');
  overlay.id = 'winnerOverlay';
  overlay.innerHTML = `
    <div class="winner-message">🏆 ${name.toUpperCase()} HA VINTO ${totalWinnings || '1'}€</div>
  `;
  document.body.appendChild(overlay);

  // Monete
  for (let i = 0; i < 40; i++) {
    const coin = document.createElement('div');
    coin.className = 'coin';
    coin.innerText = '💰';
    coin.style.left = `${Math.random() * 100}vw`;
    coin.style.animationDuration = `${1 + Math.random()}s`;
    document.body.appendChild(coin);
    setTimeout(() => coin.remove(), 2000);
  }

  setTimeout(() => overlay.remove(), 4000);

  const newRoundBtn = document.getElementById('newRoundBtn');
  if (newRoundBtn) newRoundBtn.style.display = isHost ? 'inline-block' : 'none';

  finalScores.forEach(({ name, balance }) => {
    if (!playerStats[name]) {
      playerStats[name] = { total: 0, hands: 0 };
    }
    playerStats[name].total += balance;
    playerStats[name].hands += 1;
  });

  // Tabella punteggi
  updateScoreTable(finalScores);
  updateSummaryTable();

});

socket.on('showNewRoundButton', () => {
  const btn = document.getElementById('newRoundBtn');
  if (btn) btn.style.display = 'block';
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

socket.on('kang_result', data => {
  
  console.log("📩 Risultato KANG ricevuto:", data);
  if (!data || !Array.isArray(data.scores)) return;

  const resultsDiv = document.getElementById('results');
  if (!resultsDiv) return;

  const caller = data.scores.find(p => p.id === data.callerId);
  const vincitore = data.scores.find(p => p.balance > 0);
  const guadagno = Math.abs(caller?.balance ?? 0);
  const chiamante = caller?.name?.toUpperCase() || 'QUALCUNO';
  const destinatario = vincitore?.name?.toUpperCase() || 'QUALCUNO';

  const haVinto = vincitore?.id === data.callerId;
  const haPerso = vincitore?.id !== data.callerId;

  const totalPlayers = data.scores.length;
  const assi = vincitore?.hand?.filter(c => c.value === 'A').length || 0;
  const re = vincitore?.discarded?.filter(c => c.value === 'K').length || 0;
  const perPlayer = 1 + assi + re;
  const multiplier = haVinto ? (totalPlayers - 1) : totalPlayers;
  const breakdown = `(${perPlayer}€ = 1€ chiusura + ${assi} assi + ${re} re) × ${multiplier} = ${perPlayer * multiplier}€`;

  let message = '';

  if (haPerso && guadagno > 0) {
    message = `💸 ${chiamante} HA PAGATO ${guadagno}€ A ${destinatario}`;
  } else if (haVinto && guadagno > 0) {
    message = `🎉 ${chiamante} HA VINTO ${guadagno}€ 🎉`;
  } else {
    message = `😐 ${chiamante} NON HA VINTO NÉ PERSO`;
  }

  message += `<br><small>${breakdown}</small>`;

  const overlay = document.createElement('div');
  overlay.id = 'winnerOverlay';
  overlay.innerHTML = `<div class="winner-message pulse">${message}</div>`;
  document.body.appendChild(overlay);

  for (let i = 0; i < 40; i++) {
    const coin = document.createElement('div');
    coin.className = 'coin';
    coin.innerText = '💰';
    coin.style.left = `${Math.random() * 100}vw`;
    coin.style.animationDuration = `${1 + Math.random()}s`;
    coin.style.fontSize = `${1 + Math.random()}rem`;
    coin.style.opacity = Math.random();
    coin.style.transform = `rotate(${Math.random() * 360}deg)`;
    overlay.appendChild(coin);
  }

  new Audio('drumroll.mp3').play();
  setTimeout(() => overlay.remove(), 5000);

  resultsDiv.style.display = 'block';
  resultsDiv.innerHTML = `
    <h3>🃏 Risultati della mano:</h3>
    <p><strong>${caller?.name || 'Qualcuno'}</strong> ha chiamato Kang e ${haPerso ? 'ha perso' : haVinto ? 'ha vinto' : 'non ha guadagnato nulla'} <strong>${guadagno}€</strong></p>
    ${data.scores.map(player => `
      <div>
        <strong>${player.name}</strong>: ${player.score} punti<br/>
        Carte: ${player.hand.map(c => c.value + c.suit).join(', ')}
      </div>
    `).join('')}
    <p>Combinazione: <strong>${data.combination?.combination || 'nessuna'}</strong></p>
  `;

  drawBtn.disabled = true;
  discardBtn.disabled = true;
  kangBtn.disabled = true;

  const newRoundBtn = document.getElementById('newRoundBtn');
  if (newRoundBtn) newRoundBtn.style.display = 'inline-block';

  if (data.scores && Array.isArray(data.scores)) {
    // Solo alla prima volta inizializza la tabella
    if (playerNames.length === 0) {
      initBalanceTable(data.scores.map(p => p.name));
    }
    updateBalanceTable(data.scores);
  }
  
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

  // Invia allo server
  socket.emit('discardCard', selectedCards);

  // Rimuovi esattamente dalle posizioni originali
  selectedIndexes.sort((a, b) => b - a).forEach(i => playerHand.splice(i, 1));

  selectedIndexes = [];
  document.getElementById('actions').style.display = 'none';
  renderHand();
  updateButtons();
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

setTimeout(() => {
  const pile = document.getElementById('right-pile');
  if (!pile) return;

  const stack = pile.querySelector('.discard-stack');
  if (!stack) return;

  stack.classList.add('show');       // forza visibilità
  stack.style.display = 'flex';      // utile per debugging
  stack.scrollTop = stack.scrollHeight;
}, 1000);
