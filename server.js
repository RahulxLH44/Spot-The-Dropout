const path = require('path'), http = require('http'), crypto = require('crypto');
const express = require('express'), { Server } = require('socket.io');
const C = require('./config'), Q = require('./questions');
const PORT = process.env.PORT || 3000, HOST_KEY = process.env.HOST_KEY || '';
if (!HOST_KEY) console.warn('[warn] HOST_KEY is not set: host login is disabled.');

const LET = 'ABCD', players = {};
let n = 0, ranks = null, hostT = null;
const fresh = () => ({ phase: 'lobby', qi: -1, startedAt: 0, answers: new Map(), dist: { A: 0, B: 0, C: 0, D: 0 }, scored: false, lbAt: -1, override: {}, timer: null });
let S = fresh(); // phases: lobby | question | locked | reveal | leaderboard | final

const app = express(), server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 25000, perMessageDeflate: false, maxHttpBufferSize: 2000 });
const dist = path.join(__dirname, 'dist');
app.disable('x-powered-by');
app.get('/healthz', (_, r) => r.json({ ok: true, players: n, rss: Math.round(process.memoryUsage().rss / 1e6) }));
app.use(express.static(dist, { maxAge: '7d', setHeaders: (res, f) => { if (f.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.get('*', (_, r) => r.sendFile(path.join(dist, 'index.html')));

// ---------- helpers ----------
const cur = () => Q[S.qi];
const correct = q => q && (S.override[q.id] || q.letter);
const rand = b => crypto.randomBytes(b).toString('hex');
const hash = s => crypto.createHash('sha256').update(s).digest();
const safeEq = (a, b) => crypto.timingSafeEqual(hash(a), hash(b));
const on = (s, ev, fn) => s.on(ev, (d, ack) => {
  ack = typeof ack === 'function' ? ack : () => {};
  try { fn(d, ack); } catch (e) { console.error('[error]', ev, e); ack({ err: 'server' }); }
});
function getRanks() {
  if (!ranks) {
    const list = Object.values(players).sort((a, b) => b.score - a.score || a.joined - b.joined), pos = {};
    list.forEach((p, i) => (pos[p.id] = i + 1));
    ranks = { list, pos };
  }
  return ranks;
}
const top = k => getRanks().list.slice(0, k).map(p => ({ name: p.name, score: p.score }));
const connected = () => Object.values(players).filter(p => p.on).length;

// Minimal payload, identical for every player (never contains the answer before reveal).
function pub() {
  const q = cur(), b = { phase: S.phase, qi: S.qi, total: Q.length, now: Date.now() };
  if (q && ['question', 'locked', 'reveal'].includes(S.phase)) {
    b.q = { id: q.id, options: q.options, hint: q.hint, image: q.image };
    b.startedAt = S.startedAt; b.duration = C.QUESTION_MS;
    b.nextImage = (Q[S.qi + 1] || {}).image || null;
    if (S.phase === 'reveal') { b.answer = correct(q); b.explanation = q.explanation; }
  } else if (S.phase === 'lobby') b.nextImage = Q[0].image;
  if (S.phase === 'leaderboard' || S.phase === 'final') b.top = top(10);
  return b;
}
function meOf(p) {
  const a = S.answers.get(p.id);
  return { name: p.name, score: p.score, rank: getRanks().pos[p.id], of: n, qi: S.qi, answered: a ? a.ans : null, gain: p.gain, ok: p.ok };
}
function sendHost() {
  if (!io.sockets.adapter.rooms.get('h')) return;
  const q = cur(), c = correct(q);
  io.to('h').emit('host_state', {
    ...pub(), q: q ? { id: q.id, options: q.options, hint: q.hint, image: q.image } : null,
    joined: n, max: C.MAX_PLAYERS, connected: connected(), answered: S.answers.size, dist: S.dist,
    correct: c || null, needsAnswer: !!q && !c, explanation: q ? q.explanation : null,
    top: top(10), startedAt: S.startedAt, duration: C.QUESTION_MS,
  });
}
// Host updates are throttled (max ~4/s) so 100 answers never mean 100 host emits.
function pushHost(now) {
  if (now) { clearTimeout(hostT); hostT = null; return sendHost(); }
  if (!hostT) hostT = setTimeout(() => { hostT = null; sendHost(); }, 250);
}
function pushAll(ev) {
  io.to('p').emit(ev, pub());
  for (const p of Object.values(players)) if (p.on) io.to(p.sid).emit('me', meOf(p));
  pushHost(true);
}

// ---------- game flow ----------
function startQ(i) {
  if (i >= Q.length) return finish();
  clearTimeout(S.timer);
  S.qi = i; S.phase = 'question'; S.startedAt = Date.now();
  S.answers = new Map(); S.dist = { A: 0, B: 0, C: 0, D: 0 }; S.scored = false;
  for (const p of Object.values(players)) { p.gain = 0; p.ok = null; }
  S.timer = setTimeout(lock, C.QUESTION_MS + C.GRACE_MS);
  pushAll('question_started');
}
function endTimer() { clearTimeout(S.timer); S.timer = null; S.phase = 'locked'; }
function lock() { if (S.phase !== 'question') return; endTimer(); pushAll('question_ended'); }
function reveal() {
  if (S.phase !== 'question' && S.phase !== 'locked' && S.phase !== 'reveal') return 'Not available now.';
  const q = cur(), c = correct(q);
  if (!c) { lock(); return 'Set the correct answer first (panel on the host screen).'; }
  if (S.phase === 'question') endTimer();
  if (!S.scored) { // scoring happens once, server-side, using the time recorded at submission
    S.scored = true;
    for (const [pid, a] of S.answers) {
      const p = players[pid]; if (!p) continue;
      p.ok = a.ans === c; p.gain = p.ok ? C.score(a.rem, C.QUESTION_MS) : 0; p.score += p.gain;
    }
    ranks = null;
  }
  S.phase = 'reveal'; pushAll('show_answer'); return null;
}
function showLB() { S.phase = 'leaderboard'; S.lbAt = S.qi; pushAll('leaderboard_update'); }
function finish() { clearTimeout(S.timer); S.phase = 'final'; ranks = null; pushAll('game_finished'); }
function reset() {
  clearTimeout(S.timer); S = fresh(); ranks = null;
  for (const p of Object.values(players)) { p.score = 0; p.gain = 0; p.ok = null; p.hist = {}; }
  pushAll('game_reset');
}

// ---------- sockets ----------
io.on('connection', sock => {
  on(sock, 'join_game', (d, ack) => {
    d = d || {}; let p;
    if (d.pid) { // reconnect: keeps id, score, answers
      p = players[d.pid];
      if (!p || typeof d.token !== 'string' || p.token !== d.token) return ack({ err: 'restarted' });
    } else {
      const name = String(d.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
      if (!name) return ack({ err: 'name' });
      if (n >= C.MAX_PLAYERS) return ack({ err: 'full' });
      p = { id: 'player_' + rand(3), token: rand(16), name, score: 0, gain: 0, ok: null, hist: {}, joined: Date.now() };
      players[p.id] = p; n++; ranks = null;
    }
    const old = p.sid && p.sid !== sock.id && io.sockets.sockets.get(p.sid);
    p.sid = sock.id; p.on = true; sock.data.pid = p.id; sock.join('p');
    if (old) old.disconnect(true);
    ack({ ok: true, pid: p.id, token: p.token, state: pub(), me: meOf(p) });
    pushHost();
  });

  on(sock, 'submit_answer', (d, ack) => {
    const p = players[sock.data.pid];
    if (!p) return ack({ err: 'not_joined' });
    if (S.phase !== 'question') return ack({ err: 'closed' });
    const q = cur(), l = d && String(d.answer), i = l ? LET.indexOf(l) : -1;
    if (!d || d.questionId !== q.id) return ack({ err: 'stale' });
    if (l.length !== 1 || i < 0 || i >= q.options.length) return ack({ err: 'bad' });
    const prev = S.answers.get(p.id);
    if (prev) return ack({ ok: true, dup: true, locked: prev.ans }); // first answer wins
    const el = Date.now() - S.startedAt;
    if (el > C.QUESTION_MS) return ack({ err: 'late' });
    S.answers.set(p.id, { ans: l, rem: C.QUESTION_MS - el });
    p.hist[q.id] = l; S.dist[l]++;
    pushHost(); ack({ ok: true });
  });

  on(sock, 'host_auth', (key, ack) => {
    if (!HOST_KEY || !safeEq(String(key || ''), HOST_KEY)) return setTimeout(() => ack({ err: 'denied' }), 500);
    sock.data.host = true; sock.join('h'); ack({ ok: true }); sendHost();
  });

  on(sock, 'host_action', (d, ack) => {
    if (!sock.data.host) return ack({ err: 'forbidden' });
    const t = d && d.type, last = S.qi >= Q.length - 1; let err = null;
    if (t === 'next') {
      if (S.phase === 'lobby') startQ(0);
      else if (S.phase === 'question' || S.phase === 'locked') err = reveal();
      else if (S.phase === 'reveal') {
        if (last) finish(); else if ((S.qi + 1) % C.LB_EVERY === 0 && S.lbAt !== S.qi) showLB(); else startQ(S.qi + 1);
      } else if (S.phase === 'leaderboard') { if (last) finish(); else startQ(S.qi + 1); }
    } else if (t === 'reveal') err = reveal();
    else if (t === 'leaderboard') { if (S.phase === 'reveal') showLB(); }
    else if (t === 'end') finish();
    else if (t === 'reset') reset();
    else if (t === 'set_answer') {
      const q = cur();
      if (q && (S.phase === 'question' || S.phase === 'locked') && LET.indexOf(d.value) >= 0 && LET.indexOf(d.value) < q.options.length) { S.override[q.id] = d.value; pushHost(true); }
    }
    ack(err ? { err } : { ok: true });
  });

  sock.on('disconnect', () => {
    const p = players[sock.data.pid];
    if (p && p.sid === sock.id) { p.on = false; pushHost(); } // player data is kept for reconnection
  });
});

server.listen(PORT, () => console.log('Spot The Dropout listening on ' + PORT));
process.on('SIGTERM', () => { io.close(); server.close(() => process.exit(0)); });
