const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:rileyoldmixon@gmail.com',
  'BMjz9yGa9Fwby3NdTMC_dTF8ovk4wth0xRlyoJYgz5ngt9Gp3OG2UJ42C0dFAYWk9Fz-UmfmguVKpvu6-XYlVJk',
  'TXlxK0ICkp11Z8wgsQAJp7pUk6UcJFb71aUg__-iQmk'
);

const SUPABASE_URL = 'https://zhzgddeyffadrrvpvfbu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoemdkZGV5ZmZhZHJydnB2ZmJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTczNjksImV4cCI6MjA5MDM5MzM2OX0.KigjYCOb4-ib69ui9g6reuz4nKKsEyNj5pxMHqYUVAw';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { taggedNames, senderName, message, type } = JSON.parse(event.body);

    if (!taggedNames || !taggedNames.length) {
      return { statusCode: 200, body: JSON.stringify({ sent: 0 }) };
    }

    // Fetch subscriptions for tagged people
    const nameFilter = taggedNames.map(n => `name=eq.${encodeURIComponent(n)}`).join('&');
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?or=(${taggedNames.map(n => `name.eq.${n}`).join(',')})&select=endpoint,p256dh,auth,name`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!res.ok) throw new Error('Failed to fetch subscriptions');
    const subs = await res.json();

    if (!subs.length) {
      return { statusCode: 200, body: JSON.stringify({ sent: 0, message: 'No subscriptions found' }) };
    }

    const typeLabel = type === 'reply' ? 'replied to a thread' : 'mentioned you';
    let sent = 0;
    const results = await Promise.allSettled(
      subs.map(sub => {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        };
        const payload = JSON.stringify({
          title: `${senderName} tagged you 🏖️`,
          body: message.length > 80 ? message.slice(0, 80) + '…' : message,
          icon: '/icon-192.png',
          badge: '/icon-192.png'
        });
        return webpush.sendNotification(pushSub, payload);
      })
    );

    results.forEach(r => { if (r.status === 'fulfilled') sent++; });

    return {
      statusCode: 200,
      body: JSON.stringify({ sent, total: subs.length })
    };
  } catch (err) {
    console.error('Push error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
