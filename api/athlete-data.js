// GET /api/athlete-data?token=XXXX
// Devuelve el perfil, el plan y el historial de "hecho" de un alumno,
// validando su token único. No requiere contraseña: el enlace ES la llave.
module.exports = async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Falta el token' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  try {
    const athleteRes = await fetch(
      `${supabaseUrl}/rest/v1/athletes?token=eq.${encodeURIComponent(token)}&select=id,name,sport,objective,plan`,
      { headers }
    );
    const athletes = await athleteRes.json();
    if (!Array.isArray(athletes) || athletes.length === 0) {
      return res.status(404).json({ error: 'Enlace no válido' });
    }
    const athlete = athletes[0];

    const logsRes = await fetch(
      `${supabaseUrl}/rest/v1/logs?athlete_id=eq.${athlete.id}&select=day_index,done_at&order=done_at.desc`,
      { headers }
    );
    const logs = await logsRes.json();

    res.status(200).json({
      athlete: {
        name: athlete.name,
        sport: athlete.sport,
        objective: athlete.objective,
        plan: athlete.plan,
      },
      logs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
}
