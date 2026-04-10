import express from 'express';
import { google } from 'googleapis';
import { createAuthenticatedClient } from '../lib/oauth.js';
import { extractBody } from '../lib/gmail.js';
import { categorizeEmail } from '../lib/categorize.js';
import { callGroq } from '../lib/groq.js';
import { requireTokens, requireAuth } from '../lib/middleware.js';
import Ticket from '../models/Ticket.js';
import { isDBConnected } from '../lib/db.js';

const router = express.Router();

const PAGE_SIZE   = 500; // safe now — metadata calls are tiny, no body decoding
const DETAIL_BATCH = 100; // concurrent metadata fetches per batch
const VALID_CATEGORIES = new Set(['damage', 'returns', 'refund', 'replacement', 'delivery', 'general']);

const CLASSIFY_PROMPT_HEADER = `You are a customer support classifier for a Shopify e-commerce company that ships to the Netherlands.
Emails may be written in Dutch or English. Read the full content carefully and classify each email.

Categories:
- damage      → product arrived damaged, broken, defective, cracked, not working — and the customer has NOT asked for anything specific yet
- returns     → customer explicitly wants to send the product back / return it
- refund      → customer wants money back, compensation, reimbursement, or mentions chargeback
- replacement → customer wants a new product sent / exchange / swap
- delivery    → package not yet arrived, delayed, lost, wrong address, tracking not updating
- general     → everything else: questions, order status, compliments, general inquiries

Decision rules (always pick the customer's PRIMARY goal):
- damaged + wants new product     → replacement
- damaged + wants money back      → refund
- return + wants refund           → refund
- wants to return (no refund)     → returns
- damaged but no specific request → damage
- tracking / where is my order    → delivery

`;

// ── Auto-ticket upsert ────────────────────────────────────────────────────────

function parseFrom(from = '') {
  const match = from.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
  const email = from.trim().toLowerCase();
  return { name: '', email };
}

async function upsertTicketsFromEmails(emails, sessionUser) {
  if (!isDBConnected() || emails.length === 0) return;

  for (const email of emails) {
    if (!email.threadId) continue;
    const { name: customerName, email: customerEmail } = parseFrom(email.from);
    if (!customerEmail) continue;

    const messageEntry = {
      gmailMessageId: email.id,
      from:      email.from,
      to:        email.to,
      date:      email.date ? new Date(email.date) : new Date(),
      subject:   email.subject,
      body:      email.body,
      snippet:   email.snippet,
      direction: 'inbound',
    };

    const existing = await Ticket.findOne({ threadId: email.threadId });

    if (!existing) {
      // New thread → create ticket
      const ticketNumber = await Ticket.nextNumber();
      await Ticket.create({
        ticketNumber,
        threadId:       email.threadId,
        customerEmail,
        customerName,
        subject:        email.subject,
        category:       email.category || 'general',
        source:         'auto',
        firstMessageAt: messageEntry.date,
        lastMessageAt:  messageEntry.date,
        messages:       [messageEntry],
        activity: [{
          type: 'created',
          to:   'new',
          note: 'Ticket auto-created from email',
          by:   sessionUser?.id || null,
          at:   new Date(),
        }],
      });
    } else {
      // Existing thread → add message if not already stored
      const alreadyStored = existing.messages.some(m => m.gmailMessageId === email.id);
      if (!alreadyStored) {
        existing.messages.push(messageEntry);
        existing.lastMessageAt = messageEntry.date;
        // Reopen ticket if a new message arrives on a resolved/closed ticket
        if (['resolved', 'closed'].includes(existing.status)) {
          existing.activity.push({
            type: 'status_changed',
            from: existing.status,
            to:   'open',
            note: 'Reopened — new reply received',
            by:   null,
            at:   new Date(),
          });
          existing.status = 'open';
        }
        await existing.save();
      }
    }
  }
}

// GET /api/emails?pageToken=xxx
// Requires Gmail OAuth tokens to fetch emails from the Gmail API.
router.get('/', requireTokens, async (req, res) => {
  const { pageToken } = req.query;

  try {
    const oauth2Client = createAuthenticatedClient(req);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // List message IDs for this page
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: PAGE_SIZE,
      labelIds: ['INBOX'],
      ...(pageToken && { pageToken }),
    });

    const messages      = listRes.data.messages || [];
    const nextPageToken = listRes.data.nextPageToken || null;

    // Fetch metadata only (no body) — headers + snippet, very fast
    const emails = [];
    for (let i = 0; i < messages.length; i += DETAIL_BATCH) {
      const batch = messages.slice(i, i + DETAIL_BATCH);
      const batchResults = await Promise.all(
        batch.map(async (msg) => {
          try {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'metadata',
              metadataHeaders: ['Subject', 'From', 'To', 'Date', 'Message-ID'],
            });

            const headers = detail.data.payload?.headers || [];
            const h = (name) =>
              headers.find((hdr) => hdr.name.toLowerCase() === name.toLowerCase())?.value || '';

            const subject   = h('Subject') || '(no subject)';
            const from      = h('From');
            const to        = h('To');
            const date      = h('Date');
            const messageId = h('Message-ID');
            const snippet   = detail.data.snippet || '';

            return {
              id:        msg.id,
              threadId:  detail.data.threadId,
              messageId,
              subject,
              from,
              to,
              date,
              snippet,
              body:      null, // loaded on demand when email is opened
              category:  categorizeEmail(subject, snippet),
              isRead:    !detail.data.labelIds?.includes('UNREAD'),
            };
          } catch (err) {
            console.warn(`Failed to fetch email ${msg.id}:`, err.message);
            return null;
          }
        })
      );
      emails.push(...batchResults.filter(Boolean));
    }

    // Return emails immediately with keyword categories — fast first load
    res.json({ emails, nextPageToken });

    // Background: auto-upsert tickets from fetched emails (non-blocking)
    upsertTicketsFromEmails(emails, req.session.user).catch(err =>
      console.warn('Ticket upsert error:', err.message)
    );
  } catch (err) {
    console.error('Emails error:', err.message);
    const isAuthError =
      err.status === 401 || err.code === 401 ||
      err.status === 400 || err.code === 400 ||
      err.message?.includes('invalid_grant') ||
      err.message?.includes('Token has been expired or revoked') ||
      err.message?.includes('Invalid Credentials') || err.status === 403 || err.code === 403 || err.message?.includes('Insufficient Permission');
    if (isAuthError) {
      req.session.tokens = null;
      return res.status(401).json({ error: 'Session expired — please sign in again' });
    }
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// POST /api/emails/categorize
// Called by the frontend after emails are already shown.
// Takes [{id, subject, body, snippet}] — returns {id: category} map.
// Only requires a logged-in user (not Gmail tokens) since it calls Groq, not Gmail.
router.post('/categorize', requireAuth, async (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails) || emails.length === 0)
    return res.status(400).json({ error: 'emails array is required' });

  if (!process.env.GROQ_API_KEY)
    return res.status(503).json({ error: 'AI categorization not available' });

  const results = {};
  // Batches of 25 — keeps each call ~1,200 tokens, well under 6k/min free limit
  const BATCH = 25;
  for (let start = 0; start < emails.length; start += BATCH) {
    const batch = emails.slice(start, start + BATCH);
    const items = batch.map((e, i) => {
      const subject = (e.subject || '').slice(0, 50);
      const body    = (e.body || e.snippet || '').slice(0, 80);
      return `[${i}] Subject: "${subject}" | Message: "${body}"`;
    }).join('\n');

    const prompt = `${CLASSIFY_PROMPT_HEADER}Classify these emails. Respond ONLY with JSON using array index as key: {"0":"category","1":"category",...}\n\n${items}`;

    const tryBatch = async () => {
      const raw   = await callGroq(prompt, { maxTokens: 150, temperature: 0.1 });
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        batch.forEach((e, i) => {
          const cat = parsed[String(i)];
          if (VALID_CATEGORIES.has(cat)) results[e.id] = cat;
        });
      }
    };

    try {
      await tryBatch();
    } catch (err) {
      if (err.message?.includes('Rate limit')) {
        // Wait 15s and retry once (free tier TPM resets in ~12–15s)
        await new Promise(r => setTimeout(r, 15000));
        try { await tryBatch(); } catch (retryErr) {
          console.warn('Categorize batch retry failed:', retryErr.message);
        }
      } else {
        console.warn('Background categorize batch failed:', err.message);
      }
    }

    // Small gap between batches to stay under token/min limit
    if (start + BATCH < emails.length) await new Promise(r => setTimeout(r, 500));
  }

  res.json({ categories: results });
});

// GET /api/emails/:id
// Fetches the full body of a single email — called only when user opens it.
router.get('/:id', requireTokens, async (req, res) => {
  try {
    const oauth2Client = createAuthenticatedClient(req);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: req.params.id,
      format: 'full',
    });

    const body = extractBody(detail.data.payload);
    res.json({ id: req.params.id, body });
  } catch (err) {
    console.error('Email body fetch error:', err.message);
    const isAuthError =
      err.status === 401 || err.code === 401 ||
      err.status === 400 || err.code === 400 ||
      err.message?.includes('invalid_grant') ||
      err.message?.includes('Token has been expired or revoked') ||
      err.message?.includes('Invalid Credentials') || err.status === 403 || err.code === 403 || err.message?.includes('Insufficient Permission');
    if (isAuthError) {
      return res.status(401).json({ error: 'Session expired — please sign in again' });
    }
    res.status(500).json({ error: 'Failed to fetch email body' });
  }
});

export default router;
