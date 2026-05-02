const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set in environment variables' });

  const { imageData } = req.body;
  if (!imageData) return res.status(400).json({ error: 'No image data provided' });

  const prompt = `You are an expert AI that analyzes hand-drawn images and identifies what single character was drawn.
The drawing may be a digit (0-9), uppercase letter (A-Z), lowercase letter (a-z), or symbol (@,#,$,%,&,!,?,+,=,*,~ etc).
Respond ONLY with a valid JSON object, no markdown, no backticks:
{"character":"the single character","type":"Digit | Uppercase Letter | Lowercase Letter | Symbol","confidence":0.0,"alternatives":["up to 3 others"],"description":"one sentence"}`;

  const body = JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: imageData } }
      ]
    }]
  });

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  return new Promise((resolve) => {
    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            res.status(500).json({ error: parsed.error.message });
          } else {
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            res.status(200).json({ text });
          }
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse response: ' + data });
        }
        resolve();
      });
    });
    apiReq.on('error', (err) => { res.status(500).json({ error: err.message }); resolve(); });
    apiReq.write(body);
    apiReq.end();
  });
};
