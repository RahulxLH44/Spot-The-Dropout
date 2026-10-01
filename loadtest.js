// Usage: HOST_KEY=xxx URL=http://localhost:3000 N=100 ROUNDS=4 node tools/loadtest.js
// WARNING: resets the running game. Run against a fresh/local server.
const { io } = require('socket.io-client');
const URL = process.env.URL || 'http://localhost:3000', KEY = process.env.HOST_KEY, N = +process.env.N || 100, ROUNDS = +process.env.ROUNDS || 4;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mk = () => io(URL, { transports: ['websocket'], reconnection: false });
const lat = []; let fails = 0, dupAccepted = 0;
const bots = [];
(async () => {
  const host = mk(); await new Promise(r => host.on('connect', r));
  await new Promise(r => host.emit('host_auth', KEY, a => { if (!a || !a.ok) { console.error('Bad HOST_KEY'); process.exit(1); } r(); }));
  const act = (type, value) => new Promise(r => host.emit('host_action', { type, value }, r));
  await act('reset');
  const t0 = Date.now();
  await Promise.all(Array.from({ length: N }, (_, i) => new Promise(res => {
    const s = mk(), b = { s, started: 0, revealed: 0, lb: 0, joined: false }; bots.push(b);
    s.on('connect', () => s.emit('join_game', { name: 'bot' + i }, a => { if (a && a.ok) b.joined = true; else fails++; res(); }));
    s.on('connect_error', () => { fails++; res(); });
    s.on('question_started', st => {
      b.started++;
      setTimeout(() => {
        const send = cb => s.emit('submit_answer', { questionId: st.q.id, answer: 'ABCD'[(Math.random() * 4) | 0] }, cb), t1 = Date.now();
        send(a => { lat.push(Date.now() - t1); if (!a || !a.ok) fails++; });
        send(a => { if (a && a.ok && !a.dup) dupAccepted++; }); // deliberate duplicate
      }, Math.random() * 3000);
    });
    s.on('show_answer', () => b.revealed++);
    s.on('leaderboard_update', () => b.lb++);
  })));
  const ok = bots.filter(b => b.joined).length;
  console.log(`Joined: ${ok}/${N} in ${Date.now() - t0} ms`);
  await act('next'); // start Q1
  for (let r = 0; r < ROUNDS; r++) {
    await sleep(4500); await act('next');            // reveal
    await sleep(600); await act('leaderboard');       // leaderboard
    await sleep(600); if (r < ROUNDS - 1) await act('next'); // next question
  }
  const missed = bots.filter(b => b.joined && (b.started < ROUNDS || b.revealed < ROUNDS)).length;
  lat.sort((a, b) => a - b);
  const avg = lat.reduce((a, b) => a + b, 0) / (lat.length || 1);
  let srv = {}; try { srv = await (await fetch(URL + '/healthz')).json(); } catch {}
  console.log(`Connection success: ${((ok / N) * 100).toFixed(1)}%`);
  console.log(`Answer ack latency: avg ${avg.toFixed(0)} ms, p95 ${lat[Math.floor(lat.length * 0.95)] || 0} ms (${lat.length} acks)`);
  console.log(`Failed acks/joins: ${fails} | Clients missing events: ${missed} | Duplicate answers accepted: ${dupAccepted}`);
  console.log(`Server RSS: ${srv.rss} MB | Test client RSS: ${Math.round(process.memoryUsage().rss / 1e6)} MB`);
  await act('reset'); process.exit(0);
})();
