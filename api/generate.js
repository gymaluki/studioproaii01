export const config = { maxDuration: 60 };

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
      generationConfig: { responseModalities: ['IMAGE','TEXT'], temperature: 1.0 }
    };

    // Try models in order until one works
    const models = [
      'gemini-2.0-flash-preview-image-generation',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash'
    ];

    let lastError = null;
    for (const model of models) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }
      );
      const data = await r.json();
      if (data.error) {
        const m = data.error.message || '';
        if (m.includes('not found') || m.includes('not supported')) { lastError = m; continue; }
        if (m.includes('API_KEY_INVALID') || m.includes('invalid')) return res.status(400).json({ error: 'API Key inválida. Verifique se copiou corretamente.' });
        if (m.includes('quota') || m.includes('QUOTA')) return res.status(400).json({ error: 'Limite de uso atingido. Tente amanhã.' });
        if (m.includes('SAFETY')) return res.status(400).json({ error: 'Conteúdo bloqueado pelos filtros de segurança.' });
        return res.status(400).json({ error: m });
      }
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find(p => p.inlineData?.data);
      if (!imgPart) {
        const reason = data.candidates?.[0]?.finishReason;
        if (reason === 'SAFETY') return res.status(400).json({ error: 'Imagem bloqueada por filtros de segurança.' });
        lastError = 'Modelo não gerou imagem'; continue;
      }
      return res.status(200).json({ success:true, image:`data:${imgPart.inlineData.mimeType||'image/png'};base64,${imgPart.inlineData.data}` });
    }
    return res.status(400).json({ error: 'Nenhum modelo disponível gerou imagem. Tente novamente. Detalhe: ' + lastError });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
}
