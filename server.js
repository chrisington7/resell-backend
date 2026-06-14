const express = require('express');
const app = express();
app.use(express.json({ limit: '20mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.post('/analyze', async (req, res) => {
  try {
    const { images, notes } = req.body;

    const parts = [];
    for (const img of images) {
      parts.push({
        inline_data: {
          mime_type: img.type,
          data: img.data
        }
      });
    }

    parts.push({
      text: `You are a resale pricing expert. Analyze the item shown${notes ? ` with notes: "${notes}"` : ''}.
Respond ONLY with valid JSON, no markdown:
{
  "item_name": "short name",
  "brand": "brand or null",
  "condition": "Like New|Good|Fair|Poor",
  "condition_notes": "one sentence",
  "prices": {
    "offerup": { "low": 0, "mid": 0, "high": 0 },
    "facebook": { "low": 0, "mid": 0, "high": 0 },
    "ebay": { "low": 0, "mid": 0, "high": 0 },
    "ebay_auction": { "low": 0, "mid": 0, "high": 0 }
  },
  "best_platform": "offerup|facebook|ebay",
  "best_platform_reason": "one sentence",
  "tips": ["tip1","tip2","tip3"],
  "title_suggestion": "listing title",
  "description_suggestion": "2-3 sentence description"
}`
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    try {
      res.json(JSON.parse(clean));
    } catch(parseErr) {
      res.status(500).json({ error: 'Parse failed', raw: text, gemini: data });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.send('Resell backend is running.'));
app.listen(process.env.PORT || 3000);
