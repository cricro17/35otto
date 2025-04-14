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
function evaluateHand(hand) {
  const valuesOnly = hand.map(c => c.value);
  const suitsOnly = hand.map(c => c.suit);

  const valueCount = {};
  const suitCount = {};
  for (const v of valuesOnly) valueCount[v] = (valueCount[v] || 0) + 1;
  for (const s of suitsOnly) suitCount[s] = (suitCount[s] || 0) + 1;

  const uniqueValues = [...new Set(valuesOnly)];
  const uniqueSuits = [...new Set(suitsOnly)];

  // Converti le carte in valori numerici per controllare scale
  const valueOrder = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const numericValues = valuesOnly.map(v => valueOrder.indexOf(v)).sort((a, b) => a - b);

  const isSequence = numericValues.every((v, i, arr) => i === 0 || v === arr[i - 1] + 1);
  const isSameSuit = uniqueSuits.length === 1;

  // Combinazioni speciali (ordine di priorità)
  if (valuesOnly.every(v => ['3', '5', '8'].includes(v))) {
    return { combination: '358', multiplier: 16 };
  }

  if (isSequence && isSameSuit && valuesOnly.includes('10') && valuesOnly.includes('A')) {
    return { combination: 'Scala Reale', multiplier: 15 };
  }

  if (isSequence && isSameSuit) {
    return { combination: 'Scala Colore', multiplier: 10 };
  }

  if (Object.values(valueCount).includes(4)) {
    return { combination: 'Poker', multiplier: 10 };
  }

  if (isSameSuit) {
    return { combination: 'Colore', multiplier: 5 };
  }

  if (isSequence) {
    return { combination: 'Scala', multiplier: 5 };
  }

  if (valuesOnly.every(v => ['A', 'K', 'Q', 'J', '10'].includes(v))) {
    return { combination: '50', multiplier: 5 };
  }

  if (Object.values(valueCount).includes(3)) {
    return { combination: 'Tris', multiplier: 3 };
  }

  return null; // Nessuna combinazione speciale
}

module.exports = {
  createDeck,
  dealHands,
  evaluateHand
};