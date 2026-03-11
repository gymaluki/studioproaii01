export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { apiKey } = req.body;
    if (!apiKey || !apiKey.startsWith('AIza')) return res.status(200).json({ valid:false, error:'Formato inválido. A chave deve começar com "AIza".' });
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ contents:[{parts:[{text:'Say OK'}]}] }) });
    const data = await r.json();
    if (data.error) {
      const m = data.error.message || '';
      if (m.includes('quota')) return res.status(200).json({ valid:true });
      return res.status(200).json({ valid:false, error: m.includes('invalid')?'API Key inválida. Confira se copiou corretamente.':'Erro: '+m });
    }
    return res.status(200).json({ valid:true });
  } catch(e) {
    return res.status(500).json({ valid:false, error:'Erro de conexão: '+e.message });
  }
}
