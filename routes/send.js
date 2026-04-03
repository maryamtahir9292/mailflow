import express from 'express';
import { google } from 'googleapis';
import { body, validationResult } from 'express-validator';
import { createAuthenticatedClient } from '../lib/oauth.js';
import { requireTokens } from '../lib/middleware.js';

const router = express.Router();

// All send routes require OAuth tokens
router.use(requireTokens);

// POST /api/send — send reply via Gmail API
router.post('/',
  // Input validation
  body('to').isEmail().withMessage('Valid email address is required'),
  body('body').isString().trim().isLength({ min: 1, max: 50000 }).withMessage('Message body is required (max 50,000 chars)'),
  body('subject').optional().isString().isLength({ max: 500 }).withMessage('Subject must be under 500 chars'),
  body('threadId').optional().isString(),
  body('messageId').optional().isString(),

  async (req, res) => {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { to, subject, body: emailBody, threadId, messageId } = req.body;

    console.log(`📤 Send request → to: ${to}, subject: ${subject}, threadId: ${threadId || 'none'}`);

    try {
      const oauth2Client = createAuthenticatedClient(req);
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Only add Re: prefix for replies (when threadId is present)
      const replySubject = threadId
        ? (subject?.startsWith('Re:') ? subject : `Re: ${subject || ''}`)
        : (subject || '(no subject)');

      // Build RFC 2822 headers
      const headerLines = [
        `To: ${to}`,
        `Subject: ${replySubject}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
      ];

      // Add threading headers if available
      if (messageId) {
        headerLines.push(`In-Reply-To: ${messageId}`);
        headerLines.push(`References: ${messageId}`);
      }

      const rawMessage = [...headerLines, '', emailBody].join('\r\n');
      const encoded = Buffer.from(rawMessage).toString('base64url');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encoded,
          ...(threadId && { threadId }),
        },
      });

      console.log(`✅ Email sent successfully to: ${to}`);
      res.json({ success: true });
    } catch (err) {
      console.error('Send error:', err.message);
      res.status(500).json({ error: 'Failed to send email' });
    }
  }
);

export default router;
