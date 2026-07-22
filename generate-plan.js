// POST /api/generate-plan  (solo admin autenticado)
// Cabecera: Authorization: Bearer <access_token de sesión de Supabase>
// Body: { name, age, sport, objective, level, days, equipment, limitations }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.replace('Bearer ', '').trim();
  if (!jwt) return res.status(401).json({ error: 'No autorizado' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  // Comprobamos que el token pertenece a una sesión válida de Supabase
  // (es decir, que quien llama ha iniciado sesión como admin).
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
  });
  if (!userRes.ok) return res.status(401).json({ error: 'No autorizado' });

  const p = req.body || {};
  if (!p.name || !p.age || !p.sport) {
    return res.status(400).json({ error: 'Rellena al menos nombre, edad y deporte' });
  }

  const sys = `Eres un preparador físico experto en rendimiento deportivo. Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown ni backticks. El JSON debe ser un array de exactamente 4 días de entrenamiento de gimnasio. Cada elemento debe tener este esquema exacto: {"name": string corto (2-4 palabras), "focus": string corto, "priority": "esencial"|"importante"|"complementario"|"opcional", "priorityLabel": etiqueta corta en español acorde a priority (Esencial/Importante/Complementario/Opcional), "exercises": array de 4 a 5 objetos {"name":string, "sets":string tipo "3 x 8", "load":string (kg concretos realistas para la edad y nivel indicados, o "Peso corporal"), "rest":string tipo "90 seg" o "2 min", "equip":string breve, "cue":frase corta de técnica en español}}. Reglas: prioriza fuerza y potencia funcional específica para el deporte indicado; evita hipertrofia excesiva salvo que el objetivo sea "Ganar masa muscular"; ajusta cargas de forma realista según edad y nivel (si la persona es menor de 16 años usa solo peso corporal o cargas muy ligeras); si hay limitaciones o lesiones, evita o adapta ejercicios que las agraven; el día en índice 0 y al menos uno más deben ser "esencial".`;
  const userMsg = `Perfil: nombre ${p.name}, edad ${p.age}, deporte principal ${p.sport}, objetivo ${p.objective || ''}, nivel de experiencia en gimnasio ${p.level || ''}, días de gimnasio disponibles a la semana ${p.days || ''}, equipamiento disponible ${p.equipment || ''}, limitaciones o molestias: ${p.limitations || 'ninguna'}.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: sys,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    const data = await response.json();
    const text = (data.content || []).map((b) => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Respuesta inválida');
    res.status(200).json({ plan: parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo generar el programa' });
  }
}
