// POST /api/self-signup
// Body: { accessCode, name, age, sport, objective, level, days, equipment, limitations }
// Cualquiera con el código de acceso puede crear su propio perfil y programa.
// El código evita que desconocidos gasten la cuota de la API de Anthropic.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const p = req.body || {};
  if (!p.accessCode || p.accessCode !== process.env.SIGNUP_CODE) {
    return res.status(401).json({ error: 'Código de acceso incorrecto' });
  }
  if (!p.name || !p.age || !p.sport) {
    return res.status(400).json({ error: 'Rellena al menos nombre, edad y deporte' });
  }

  const sys = `Eres un preparador físico experto en rendimiento deportivo. Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown ni backticks. El JSON debe ser un array de exactamente 4 días de entrenamiento de gimnasio. Cada elemento debe tener este esquema exacto: {"name": string corto (2-4 palabras), "focus": string corto, "priority": "esencial"|"importante"|"complementario"|"opcional", "priorityLabel": etiqueta corta en español acorde a priority (Esencial/Importante/Complementario/Opcional), "exercises": array de 4 a 5 objetos {"name":string, "sets":string tipo "3 x 8", "load":string (kg concretos realistas para la edad y nivel indicados, o "Peso corporal"), "rest":string tipo "90 seg" o "2 min", "equip":string breve, "cue":frase corta de técnica en español}}. Reglas: prioriza fuerza y potencia funcional específica para el deporte indicado; evita hipertrofia excesiva salvo que el objetivo sea "Ganar masa muscular"; ajusta cargas de forma realista según edad y nivel (si la persona es menor de 16 años usa solo peso corporal o cargas muy ligeras); si hay limitaciones o lesiones, evita o adapta ejercicios que las agraven; el día en índice 0 y al menos uno más deben ser "esencial".`;
  const userMsg = `Perfil: nombre ${p.name}, edad ${p.age}, deporte principal ${p.sport}, objetivo ${p.objective || ''}, nivel de experiencia en gimnasio ${p.level || ''}, días de gimnasio disponibles a la semana ${p.days || ''}, equipamiento disponible ${p.equipment || ''}, limitaciones o molestias: ${p.limitations || 'ninguna'}.`;

  try {
    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        system: sys,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    const aiData = await aiResp.json();
    const text = (aiData.content || []).map((b) => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const generated = JSON.parse(clean);
    if (!Array.isArray(generated) || generated.length === 0) throw new Error('Respuesta inválida de la IA');

    const recoveryDay = {
      name: 'Recuperación', focus: 'Movilidad y descanso activo', priority: 'adaptable', priorityLabel: 'Según necesidad', type: 'recovery',
      activities: [
        { name: 'Movilidad general 15 min', detail: 'Cadera, hombro y tobillo — rango completo, sin forzar.' },
        { name: 'Estiramiento suave', detail: '10 min en las zonas más exigidas por el deporte.' },
        { name: 'Caminar o nadar suave (opcional)', detail: '20-30 min a intensidad muy baja si el cuerpo lo pide.' },
      ],
    };
    const fullPlan = [...generated, recoveryDay];

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/athletes`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        name: p.name, age: p.age, sport: p.sport, objective: p.objective,
        level: p.level, days: p.days, equipment: p.equipment, limitations: p.limitations,
        plan: fullPlan,
      }),
    });
    const inserted = await insertRes.json();
    if (!Array.isArray(inserted) || inserted.length === 0) throw new Error('No se pudo guardar el perfil');

    res.status(200).json({ token: inserted[0].token, name: p.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo generar el programa. Inténtalo de nuevo.' });
  }
};
