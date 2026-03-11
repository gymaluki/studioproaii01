export const config = { maxDuration: 60 };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function callGemini(apiKey, body, model) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  const data = await r.json();
  return { status: r.status, data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { apiKey, prompt, imageBase64, imageMime } = req.body;
    if (!apiKey || !prompt || !imageBase64) return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    if (!apiKey.startsWith('AIza')) return res.status(400).json({ error: 'API Key inválida. Deve começar com "AIza".' });

    const body = {
      contents: [{ parts: [
        { inline_data: { mime_type: imageMime || 'image/jpeg', data: imageBase64 } },
        { text: prompt }
      ]}],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'], temperature: 1.0 }
    };

    // Models that support image generation - in order of preference
    const models = [
      'gemini-2.0-flash-exp-image-generation',
      'gemini-2.5-flash-preview-05-20',
      'gemini-2.0-flash-preview-image-generation',
    ];

    for (const model of models) {
      // Retry up to 3 times with exponential backoff for rate limits
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { status, data } = await callGemini(apiKey, body, model);

        if (data.error) {
          const m = data.error.message || '';
          const code = data.error.code || status;

          // Key invalid - stop immediately
          if (m.includes('API_KEY_INVALID') || m.includes('invalid') || code === 403) {
            return res.status(400).json({ error: 'API Key inválida. Verifique se copiou corretamente.' });
          }
          // Model not found - try next model
          if (m.includes('not found') || m.includes('not supported') || code === 404) {
            break;
          }
          // Rate limit (429) - wait and retry with backoff
          if (code === 429 || m.includes('quota') || m.includes('QUOTA') || m.includes('rate') || m.includes('RATE')) {
            if (attempt < 3) {
              await sleep(attempt * 3000); // 3s, 6s
              continue;
            }
            // After retries, try next model
            break;
          }
          // Safety block
          if (m.includes('SAFETY')) {
            return res.status(400).json({ error: 'Conteúdo bloqueado pelos filtros de segurança. Tente outro cenário.' });
          }
          // Other error - try next model
          break;
        }

        // Success - extract image
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imgPart = parts.find(p => p.inlineData?.data);

        if (!imgPart) {
          const reason = data.candidates?.[0]?.finishReason;
          if (reason === 'SAFETY') return res.status(400).json({ error: 'Imagem bloqueada por filtros de segurança.' });
          break; // No image, try next model
        }

        return res.status(200).json({
          success: true,
          model_used: model,
          image: `data:${imgPart.inlineData.mimeType || 'image/png'};base64,${imgPart.inlineData.data}`
        });
      }
    }

    return res.status(400).json({
      error: 'Não foi possível gerar a imagem. Possíveis causas: (1) Limite de uso atingido — aguarde alguns minutos e tente novamente. (2) Vincule um cartão no Google Cloud Console para aumentar o limite gratuito. (3) Tente novamente com outra foto.'
    });

  } catch (err) {
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
}
