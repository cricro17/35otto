const suits = ['♠', '♥', '♦', '♣'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Genera il mazzo completo
function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value });
    }
  }
  return shuffle(deck);
}

// Mescola le carte
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Distribuisce 5 carte per giocatore
function dealHands(deck, numPlayers) {
  const hands = [];
  for (let i = 0; i < numPlayers; i++) {
    hands.push(deck.splice(0, 5));
  }
  return hands;
}

// Funzione principale per valutare la mano iniziale
// ✅ evaluateHand aggiornato con tris di A o K (x6) e scala corretta
function evaluateHand(hand) {
  const valuesOnly = hand.map(c => c.value);
  const suitsOnly = hand.map(c => c.suit);

  const valueCount = {};
  const suitCount = {};
  for (const v of valuesOnly) valueCount[v] = (valueCount[v] || 0) + 1;
  for (const s of suitsOnly) suitCount[s] = (suitCount[s] || 0) + 1;

  const uniqueValues = [...new Set(valuesOnly)];
  const uniqueSuits = [...new Set(suitsOnly)];

  const faceMap = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5,
    '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13
  };

  const numericValues = valuesOnly
    .map(v => faceMap[v])
    .filter(v => v !== undefined)
    .sort((a, b) => a - b);

  const isConsecutive = numericValues.every((v, i, arr) => i === 0 || v === arr[i - 1] + 1);
  const isSameSuit = uniqueSuits.length === 1;

  // Combinazione speciale 358
  if (valuesOnly.every(v => ['3', '5', '8'].includes(v))) {
    return { combination: '358', multiplier: 16 };
  }

  // Scala reale
  if (isConsecutive && isSameSuit && numericValues.includes(10) && numericValues.includes(1)) {
    return { combination: 'Scala Reale', multiplier: 15 };
  }

  // Scala colore
  if (isConsecutive && isSameSuit) {
    return { combination: 'Scala Colore', multiplier: 10 };
  }

  // Poker
  if (Object.values(valueCount).includes(4)) {
    return { combination: 'Poker', multiplier: 10 };
  }

  // Colore
  if (isSameSuit) {
    return { combination: 'Colore', multiplier: 5 };
  }

  // Scala (solo carte realmente consecutive, NO J-Q-K come 10)
  if (isConsecutive) {
    return { combination: 'Scala', multiplier: 5 };
  }

  // 50 (A, K, Q, J, 10)
  if (valuesOnly.every(v => ['A', 'K', 'Q', 'J', '10'].includes(v))) {
    return { combination: '50', multiplier: 5 };
  }

  // Tris di A o K = x6
  if (valueCount['A'] === 3) {
    return { combination: 'Tris di Assi', multiplier: 6 };
  }
  if (valueCount['K'] === 3) {
    return { combination: 'Tris di Re', multiplier: 6 };
  }

  // Tris normale
  if (Object.values(valueCount).includes(3)) {
    return { combination: 'Tris', multiplier: 3 };
  }

  return null;
}


function calculatePoints(hand) {
  return hand.reduce((sum, card) => {
    const face = ['J', 'Q', 'K'];
    const val = face.includes(card.value) ? 10 :
                card.value === 'A' ? 1 :
                Math.min(parseInt(card.value), 10);
    return sum + val;
  }, 0);
}

function updateSummaryTable() {
  const table = document.getElementById('summaryTable');
  if (!table) return;

  let html = `
    <thead>
      <tr>
        <th>Giocatore</th>
        <th>Totale €</th>
        <th>Mani giocate</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(playerStats).map(([name, stats]) => `
        <tr>
          <td>${name}</td>
          <td>${stats.total.toFixed(2)}€</td>
          <td>${stats.hands}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
  table.innerHTML = html;
}



module.exports = {
  createDeck,
  dealHands,
  evaluateHand
};