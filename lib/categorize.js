/**
 * Keyword-based email categorizer — fallback when AI is unavailable.
 *
 * Core principle: INTENT beats REASON
 *   - "Broken item, want replacement" → replacement (not damage)
 *   - "Damaged product, want refund"  → refund (not damage)
 *   - "Broken item" (no intent)       → damage
 *
 * Two-layer logic:
 *   1. Score every category by keyword hits
 *   2. On tie → intent categories beat reason categories
 *      Priority: refund > replacement > returns > damage > delivery > general
 */

// Intent categories — what the customer WANTS
const INTENT_PRIORITY = ['refund', 'replacement', 'returns', 'damage', 'delivery', 'general'];

const RULES = {
  refund: [
    'refund', 'reimbursement', 'reimburse', 'compensate', 'compensation',
    'money back', 'get my money', 'want my money', 'pay me back',
     'charge back', 'full refund', 'partial refund', 'refund my amount', 'give my money back',
    // Dutch
    'terugbetaling', 'compensatie', 'vergoeding', 'mijn geld terug',
    'geld terugkrijgen', 'schadevergoeding', 'volledig terugbetalen',
  ],
  replacement: [
    'replacement', 'replace', 'exchange', 'swap', 'new one',
    'send another', 'send me a new', 'want a new', 'get a new', 'substitute', 'give me compensation',
    // Dutch
    'vervanging', 'vervangen', 'omruilen', 'ruilen',
    'nieuw sturen', 'ander exemplaar', 'wil een nieuw', 'vervangend',
  ],
  returns: [
    'return', 'send back', 'give back', 'send it back',
    'cancel order', 'cancel my order', 'want to return', 'want to send back', 'returning',
    // Dutch
    'retour', 'terugsturen', 'annuleren', 'bestelling annuleren',
    'wil retourneren', 'terugvorderen',
  ],
  damage: [
    'damaged', 'damage', 'broken', 'cracked', 'defective', 'faulty',
    'scratched', 'bent', 'shattered', 'destroyed', 'not working', 'burned', 'fell apart',
    'doesnt work', 'stopped working', 'fell apart', 'arrived broken', 'arrived damaged',
    // Dutch
    'kapot', 'beschadigd', 'gebroken', 'defect', 'beschadiging',
    'gekrast', 'vervormd', 'stuk', 'werkt niet',
  ],
  delivery: [
    'not delivered', 'not received', 'where is my', "haven't received",
    'late delivery', 'delayed', 'tracking', 'missing package', 'lost package',
    'never arrived', 'still waiting', 'when will', 'not arrived',
    // Dutch
    'niet bezorgd', 'niet ontvangen', 'waar is', 'vertraagd',
    'volgen', 'pakket kwijt', 'nog niet ontvangen', 'wanneer komt', 'bezorging',
  ],
};

export function categorizeEmail(subject, body) {
  const text = subject.toLowerCase(); // subject only — prevents false positives from email body

  // Score every category
  const scores = {};
  for (const [category, keywords] of Object.entries(RULES)) {
    scores[category] = keywords.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'general';

  // All categories that share the top score
  const tied = INTENT_PRIORITY.filter(cat => scores[cat] === maxScore);

  // First in priority order wins the tie
  return tied[0];
}
