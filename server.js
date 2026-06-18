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
    const { images, notes, chat_mode, messages } = req.body;
    if (chat_mode && messages) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: 'You are a helpful resale pricing expert. Answer questions concisely in 1-3 sentences. When asked about trending items respond with only a JSON array of 8 items each having fields name, category, avgPrice, reason.',
          messages: messages
        })
      });
      const data = await response.json();
      const answer = data.content[0].text;
      return res.json({ answer: answer });
    }
    const content = [];
    for (const img of images) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.data }});
    }
    content.push({
      type: 'text',
      text: 'You are a resale pricing expert. Analyze the item shown' + (notes ? ' with notes: ' + notes : '') + '. Respond ONLY with valid JSON, no markdown: {"item_name":"short name","brand":"brand or null","condition":"Like New|Good|Fair|Poor","condition_notes":"one sentence","prices":{"offerup":{"low":0,"mid":0,"high":0},"facebook":{"low":0,"mid":0,"high":0},"ebay":{"low":0,"mid":0,"high":0},"ebay_auction":{"low":0,"mid":0,"high":0},"depop":{"low":0,"mid":0,"high":0},"mercari":{"low":0,"mid":0,"high":0},"poshmark":{"low":0,"mid":0,"high":0}},"best_platform":"offerup|facebook|ebay|depop|mercari|poshmark","best_platform_reason":"one sentence","tips":["tip1","tip2","tip3"],"title_suggestion":"listing title","description_suggestion":"2-3 sentence description"}. Note: depop and poshmark tend to have premium pricing for fashion and clothing items specifically. mercari is similar to offerup but with shipping built in. ebay_auction often starts lower than buy it now. Adjust prices realistically per platform based on typical audience and fees for that platform.'
    });
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1200, messages: [{ role: 'user', content: content }] })
    });
    const data = await response.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    const raw = data.content.map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(clean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/', (req, res) => res.send('Resell backend is running.'));
app.listen(process.env.PORT || 3000);
