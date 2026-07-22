// POST /api/athlete-mark-done  { token, dayIndex }
// Registra que el alumno ha completado el día indicado hoy.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { token, dayIndex } = req.body || {};
  if (!token || dayIndex === undefined) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  try {
    const athleteRes = await fetch(
      `${supabaseUrl}/rest/v1/athletes?token=eq.${encodeURIComponent(token)}&select=id`,
      { headers }
    );
    const athletes = await athleteRes.json();
    if (!Array.isArray(athletes) || athletes.length === 0) {
      return res.status(404).json({ error: 'Enlace no válido' });
    }

    await fetch(`${supabaseUrl}/rest/v1/logs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ athlete_id: athletes[0].id, day_index: dayIndex }),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
}
