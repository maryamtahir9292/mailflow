import express from 'express';
import { body, validationResult } from 'express-validator';
import { callGroq } from '../lib/groq.js';
import { requireTokens } from '../lib/middleware.js';

// Shared validation error handler
function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

const router = express.Router();

// All reply routes require OAuth tokens
router.use(requireTokens);

// POST /api/reply/generate
// Generates a reply in English — team verifies before sending
router.post('/generate',
  body('emailBody').isString().trim().isLength({ min: 1, max: 10000 }).withMessage('emailBody is required (max 10,000 chars)'),
  body('emailSubject').optional().isString().isLength({ max: 500 }),
  body('category').optional().isString(),
  body('fromEmail').optional().isString(),
  async (req, res) => {
  if (!validate(req, res)) return;

  const { emailSubject, emailBody, category, fromEmail } = req.body;

  const context = {
    damage:      'The customer received a damaged or broken product.',
    returns:     'The customer wants to return a product.',
    refund:      'The customer wants their money back.',
    replacement: 'The customer is requesting a replacement product.',
    delivery:    'The customer has a delivery issue — package not received, delayed, or lost.',
    general:     'This is a general customer inquiry.',
  };

  const prompt = `You are a professional customer support agent for a Shopify e-commerce company shipping to the Netherlands.

Customer email:
- From: ${fromEmail || 'customer'}
- Subject: ${emailSubject || '(no subject)'}
- Issue: ${context[category] || context.general}
- Message: ${emailBody.slice(0, 2000)}

Write a reply in ENGLISH only (3–5 sentences). Be warm, empathetic, and give a clear next step.
Output only the email body. No subject line.`;

  try {
    const reply = await callGroq(prompt);
    res.json({ reply });
  } catch (err) {
    console.error('Reply generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate reply.' });
  }
});

// POST /api/reply/translate
// Detects customer email language and translates to English (for reading)
router.post('/translate', async (req, res) => {

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const prompt = `Detect the language of this email and respond with JSON only.

If English: {"language":"English","alreadyEnglish":true}
If other:   {"language":"<language>","alreadyEnglish":false,"translation":"<full English translation>"}

Email:
${text.slice(0, 3000)}

JSON only. No explanation.`;

  try {
    const raw = await callGroq(prompt);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.json({ language: 'Unknown', alreadyEnglish: false, translation: raw });
    res.json(JSON.parse(match[0]));
  } catch (err) {
    console.error('Translate error:', err.message);
    res.status(500).json({ error: 'Translation failed.' });
  }
});

// POST /api/reply/translate-outgoing
// Detects customer's language then translates the agent's English reply into it
router.post('/translate-outgoing', async (req, res) => {

  const { replyText, customerText } = req.body;
  if (!replyText) return res.status(400).json({ error: 'replyText is required' });

  // Step 1 — detect the customer's language
  const detectPrompt = `What language is this email written in? Reply with ONLY the language name in English (e.g. "Dutch", "French", "German", "English").

Email:
${(customerText || '').slice(0, 800)}`;

  try {
    const detectedLang = (await callGroq(detectPrompt, { maxTokens: 10 })).trim();
    const isEnglish = /^english$/i.test(detectedLang);

    if (isEnglish) {
      return res.json({ language: 'English', wasTranslated: false, translatedReply: replyText });
    }

    // Step 2 — translate the reply into the detected language
    const translatePrompt = `Translate the following customer support email reply into ${detectedLang}.
Keep the tone professional and warm. Preserve paragraph breaks exactly.
Output ONLY the translated text — no explanation, no quotes, no prefix.

English reply to translate:
${replyText.slice(0, 2000)}`;

    const translatedReply = await callGroq(translatePrompt, { maxTokens: 1024, temperature: 0.3 });
    res.json({ language: detectedLang, wasTranslated: true, translatedReply: translatedReply.trim() });

  } catch (err) {
    console.error('Translate-outgoing error:', err.message);
    res.status(500).json({ error: 'Translation failed.' });
  }
});

// POST /api/reply/verify-category
// Uses full email body to verify the current category is correct.
// Returns a suggestion if a better category is found.
router.post('/verify-category', async (req, res) => {

  const { subject, body, currentCategory } = req.body;
  if (!body && !subject) return res.status(400).json({ error: 'body or subject is required' });

  const prompt = `You are a customer support classifier for a Shopify e-commerce company shipping to the Netherlands.

Classify this customer email into EXACTLY one of these categories:
- damage      → product arrived damaged, broken, defective, not working (no specific next step requested)
- returns     → customer wants to physically send the product back
- refund      → customer wants their money back, compensation, reimbursement
- replacement → customer wants a new/replacement product sent
- delivery    → package not arrived, delayed, lost, wrong address, tracking issues
- general     → everything else (questions, compliments, other)

Priority rules (when multiple apply, pick the customer's PRIMARY goal):
- "damaged + want replacement" → replacement
- "damaged + want refund" → refund
- "return + want refund" → refund
- "return only" → returns
- "damaged only" → damage

Subject: ${(subject || '').slice(0, 120)}
Email body: ${(body || '').slice(0, 2000)}

Current category assigned: ${currentCategory}

Respond with JSON only:
{"category":"<one of the 6 categories>","confidence":"high|medium|low","reason":"<one short sentence why>"}`;

  try {
    const raw = await callGroq(prompt, { maxTokens: 80, temperature: 0.1 });
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    const result = JSON.parse(match[0]);

    const VALID = new Set(['damage', 'returns', 'refund', 'replacement', 'delivery', 'general']);
    if (!VALID.has(result.category)) throw new Error('Invalid category in response');

    res.json({
      suggestedCategory: result.category,
      confidence:        result.confidence || 'medium',
      reason:            result.reason || '',
      isMiscategorized:  result.category !== currentCategory && result.confidence !== 'low',
    });
  } catch (err) {
    console.error('Verify-category error:', err.message);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

export default router;
