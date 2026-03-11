export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { apiKey } = req.body;
    if (!apiKey || !apiKey.startsWith('AIza')) return res.status(200).json({ valid:false, error:'Formato inválido. A chave deve começar com "AIza".' });

    const models = [
      'gemini-2.0-flash-preview-image-generation',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash'
    ];

    for (const model of models) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ contents:[{parts:[{text:'Say OK'}]}] }) }
      );
      const data = await r.json();
      if (data.error) {
        const m = data.error.message || '';
        if (m.includes('not found') || m.includes('not supported')) continue;
        if (m.includes('quota')) return res.status(200).json({ valid:true });
        if (m.includes('invalid') || m.includes('API_KEY_INVALID')) return res.status(200).json({ valid:false, error:'API Key inválida. Confira se copiou corretamente.' });
        return res.status(200).json({ valid:false, error: 'Erro: ' + m });
      }
      return res.status(200).json({ valid:true });
    }
    return res.status(200).json({ valid:false, error:'Nenhum modelo disponível. Verifique sua API Key.' });
  } catch(e) {
    return res.status(500).json({ valid:false, error:'Erro de conexão: '+e.message });
  }
}
