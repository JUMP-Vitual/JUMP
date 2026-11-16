// Recordatorio diario: avisa al celular de cada cliente que tenía entrenamiento hoy
// y todavía no marcó "¿Cómo estuvo el entrenamiento?".
// Lo ejecuta Vercel Cron todos los días (ver vercel.json). Usa Firebase Admin:
// leer Firestore y enviar avisos (FCM) no requiere el plan de pago de Firebase.
const admin = require('firebase-admin');

const APP_URL = process.env.APP_URL || 'https://jump-virtual.vercel.app/';

function getAdmin() {
  if (!admin.apps.length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  return admin;
}

// Fecha de hoy en Costa Rica (AAAA-MM-DD), igual que la usa la app
function todayCR() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.authorization === `Bearer ${secret}`) return true; // llamada de Vercel Cron
  const url = new URL(req.url, 'http://x');
  return url.searchParams.get('clave') === secret; // prueba manual desde el navegador
}

function message(c) {
  const first = String(c.name || '').trim().split(' ')[0];
  return {
    title: '¿Cómo estuvo el entrenamiento?',
    body: `${first ? first + ', t' : 'T'}odavía no registraste tu sesión de hoy. Abrí la app y marcá cómo estuvo para que Jonathan pueda controlar tu carga.`
  };
}

module.exports = async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'No autorizado' });
  const url = new URL(req.url, 'http://x');
  const probar = (url.searchParams.get('probar') || '').trim().toLowerCase(); // correo de un cliente para probar

  try {
    const a = getAdmin();
    const db = a.firestore();
    const t = todayCR();
    const snap = await db.collection('clients').get();
    const resultado = { fecha: t, enviados: 0, sinAvisosActivados: [], tokensBorrados: 0, detalle: [] };

    for (const doc of snap.docs) {
      const c = doc.data() || {};
      const email = String(c.email || '').toLowerCase();
      if (probar) {
        if (email !== probar) continue; // en modo prueba se envía solo a ese cliente, sin revisar condiciones
      } else {
        if (c.archived || c.inactive || c.status !== 'activo') continue;
        if (c.paymentDue && c.paymentDue < t) continue; // mensualidad vencida: no puede entrar a la app
        const plans = Array.isArray(c.plans) ? c.plans : [];
        if (!plans.some(p => p && p.date === t)) continue; // hoy no tenía entrenamiento
        if ((c.completedDates || []).includes(t)) continue; // ya lo registró
      }

      const tokens = Object.keys(c.pushTokens || {});
      if (!tokens.length) { resultado.sinAvisosActivados.push(c.name || email); continue; }

      const r = await a.messaging().sendEachForMulticast({
        tokens,
        notification: message(c),
        data: { tipo: 'registro-sesion', fecha: t },
        webpush: {
          fcmOptions: { link: APP_URL },
          notification: { icon: '/icon-192.png', badge: '/icon-192.png', tag: 'registro-sesion', renotify: true, requireInteraction: true, vibrate: [300, 120, 300, 120, 500] }
        }
      });
      resultado.enviados += r.successCount;
      resultado.detalle.push({ cliente: c.name || email, enviados: r.successCount, fallidos: r.failureCount });

      // Borra los celulares que ya no existen (app desinstalada, avisos desactivados)
      const dead = [];
      r.responses.forEach((x, i) => {
        const code = x.error && x.error.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') dead.push(tokens[i]);
      });
      if (dead.length) {
        const upd = {};
        dead.forEach(tk => { upd[`pushTokens.${tk}`] = admin.firestore.FieldValue.delete(); });
        await doc.ref.update(upd).catch(() => {});
        resultado.tokensBorrados += dead.length;
      }
    }

    return res.status(200).json(resultado);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e && e.message || e) });
  }
};
