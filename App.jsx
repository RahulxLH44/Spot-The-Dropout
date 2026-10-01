import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 3000 });
const EV = ['question_started', 'question_ended', 'show_answer', 'leaderboard_update', 'game_finished', 'game_reset'];
const L = 'ABCD', medal = ['🥇', '🥈', '🥉'];
const creds = () => { try { return JSON.parse(localStorage.getItem('sd_player')); } catch { return null; } };

// Visual countdown only: the server decides when the question really ends.
function useClock(g) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!g || g.phase !== 'question') return setT(0);
    const off = g.now - Date.now();
    const tick = () => setT(Math.max(0, Math.ceil((g.duration - (Date.now() + off - g.startedAt)) / 1000)));
    tick(); const id = setInterval(tick, 250); return () => clearInterval(id);
  }, [g && g.phase, g && g.startedAt]);
  return t;
}
// Preload only the NEXT question's image.
function usePreload(g) { useEffect(() => { if (g && g.nextImage) new Image().src = g.nextImage; }, [g && g.nextImage]); }

const Opts = ({ q, onPick, mine, ans, big }) => (
  <div className={'opts' + (big ? ' big' : '')}>
    {q.options.map((o, i) => { const l = L[i]; return (
      <button key={l} disabled={!onPick} onClick={() => onPick && onPick(l)}
        className={'opt' + (mine === l ? ' mine' : '') + (ans === l ? ' right' : '') + (ans && ans !== l ? ' dim' : '')}>
        <b>{l}</b><span>{o}</span>
      </button>); })}
  </div>
);
const Board = ({ rows, me, big }) => (
  <ol className={'board' + (big ? ' big' : '')}>
    {rows.map((r, i) => <li key={i} className={me && me.rank === i + 1 ? 'me' : ''}><span>{medal[i] || i + 1 + '.'}</span><span>{r.name}</span><b>{r.score.toLocaleString()}</b></li>)}
  </ol>
);
const Header = ({ right }) => (<><div className="bar"><div>SPOT THE DROPOUT<small>IADC IIT(ISM) Dhanbad</small></div>{right}</div><div className="stripe" /></>);

function Player() {
  const [g, setG] = useState(null), [me, setMe] = useState(null), [on, setOn] = useState(socket.connected);
  const [name, setName] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [mine, setMine] = useState({}), [dead, setDead] = useState(false);
  const joinFn = useRef(), t = useClock(g); usePreload(g);

  useEffect(() => {
    joinFn.current = d => socket.emit('join_game', d, a => {
      setBusy(false);
      if (!a || a.err) {
        if (a && a.err === 'restarted') { localStorage.removeItem('sd_player'); setDead(true); setG(null); }
        else setErr(a && a.err === 'full' ? 'Game is full. Maximum 100 participants allowed.' : a && a.err === 'name' ? 'Enter your name to join.' : 'Unable to join. Please try again.');
        return;
      }
      localStorage.setItem('sd_player', JSON.stringify({ pid: a.pid, token: a.token }));
      setG(a.state); setMe(a.me); setErr(''); setDead(false);
    });
    const resume = () => { setOn(true); const c = creds(); if (c) joinFn.current(c); };
    const off = () => setOn(false);
    socket.on('connect', resume); socket.on('disconnect', off);
    EV.forEach(e => socket.on(e, setG)); socket.on('me', setMe);
    if (socket.connected) resume();
    return () => { socket.off('connect', resume); socket.off('disconnect', off); EV.forEach(e => socket.off(e, setG)); socket.off('me', setMe); };
  }, []);

  const q = g && g.q;
  const my = q ? mine[q.id] || (me && me.qi === g.qi ? me.answered : null) : null;
  const pick = l => {
    const qid = g.q.id; if (mine[qid]) return;
    setMine(m => ({ ...m, [qid]: l }));
    socket.emit('submit_answer', { questionId: qid, answer: l }, a => {
      if (a && a.ok) { setErr(''); if (a.locked) setMine(m => ({ ...m, [qid]: a.locked })); return; }
      if (a && (a.err === 'late' || a.err === 'closed')) return setErr("Time's up. Answer not counted.");
      setMine(m => { const c = { ...m }; delete c[qid]; return c; });
      setErr('Unable to submit answer. Please try again.');
    });
  };

  let body;
  if (dead) body = <div className="card"><h2>Quiz server restarted.</h2><p>Please ask the host to restart the quiz.</p><button className="btn" onClick={() => setDead(false)}>Join again</button></div>;
  else if (!g) body = (
    <form className="card" onSubmit={e => { e.preventDefault(); setBusy(true); setErr(''); joinFn.current({ name }); }}>
      <h2>Enter your name</h2>
      <input maxLength={20} autoComplete="off" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
      <button className="btn" disabled={busy || !on}>Join quiz</button>
      {err && <p className="err">{err}</p>}
    </form>);
  else if (g.phase === 'lobby') body = <div className="card"><h2>You're in{me ? ', ' + me.name : ''}</h2><p>Waiting for the host to start the quiz.</p></div>;
  else if (g.phase === 'question') body = (<>
    <div className="qhead"><span>Question {g.qi + 1} of {g.total}</span><span className="timer">{t}</span></div>
    <h2>Which one is different?</h2>
    {q.image && <img className="qimg" src={q.image} alt="" decoding="async" />}
    <p className="hint">{q.hint}</p>
    <Opts q={q} mine={my} onPick={my ? null : pick} />
    {my && <p className="lock">Answer locked ✓ Waiting for results...</p>}
    {err && <p className="err">{err}</p>}
  </>);
  else if (g.phase === 'locked') body = <div className="card"><h2>Time's up</h2><p>{my ? 'You answered ' + my + '.' : 'No answer submitted.'}</p><p>Waiting for the host to reveal the answer...</p></div>;
  else if (g.phase === 'reveal') body = (<>
    <h2>Correct answer: {g.answer}</h2>
    <Opts q={q} mine={my} ans={g.answer} />
    <p>{g.explanation}</p>
    {me && <div className={'res ' + (me.ok ? 'good' : 'bad')}>{me.ok ? 'Correct! +' + me.gain + ' points' : my ? 'Not this time. +0 points' : 'No answer. +0 points'}</div>}
    {me && <p>Your score: {me.score.toLocaleString()} (rank {me.rank} of {me.of})</p>}
  </>);
  else body = (<>
    <h2>{g.phase === 'final' ? '🏆 Final leaderboard' : '🏆 Leaderboard'}</h2>
    <Board rows={g.phase === 'final' ? g.top : g.top.slice(0, 5)} me={me} />
    {me && <div className="card"><b>Your rank: {me.rank} / {me.of}</b><br />Your score: {me.score.toLocaleString()}</div>}
  </>);

  return (<>
    <Header right={<span className={on ? 'ok' : 'warn'}>{on ? '● Connected' : '○ Reconnecting...'}</span>} />
    <div className="wrap">{!on && g && <p className="warn">Connection lost. Reconnecting...</p>}{body}</div>
  </>);
}

function Host() {
  const [auth, setAuth] = useState(false), [key, setKey] = useState(''), [h, setH] = useState(null);
  const [err, setErr] = useState(''), [on, setOn] = useState(socket.connected), [peek, setPeek] = useState(false);
  const t = useClock(h); usePreload(h);
  const login = k => socket.emit('host_auth', k, a => {
    if (a && a.ok) { sessionStorage.setItem('sd_hk', k); setAuth(true); setErr(''); }
    else { sessionStorage.removeItem('sd_hk'); setAuth(false); setErr('Wrong host key.'); }
  });
  useEffect(() => {
    const c = () => { setOn(true); const k = sessionStorage.getItem('sd_hk'); if (k) login(k); };
    const d = () => setOn(false);
    socket.on('connect', c); socket.on('disconnect', d); socket.on('host_state', setH);
    if (socket.connected) c();
    return () => { socket.off('connect', c); socket.off('disconnect', d); socket.off('host_state', setH); };
  }, []);
  const act = (type, value) => socket.emit('host_action', { type, value }, a => setErr(a && a.err ? a.err : ''));

  if (!auth) return (<><Header /><div className="wrap"><form className="card" onSubmit={e => { e.preventDefault(); login(key); }}>
    <h2>Host login</h2><input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Host key" />
    <button className="btn">Log in</button>{err && <p className="err">{err}</p>}</form></div></>);
  if (!h) return <Header right={<span>Loading...</span>} />;

  const ph = h.phase, q = h.q, inQ = ['question', 'locked', 'reveal'].includes(ph), lastQ = h.qi === h.total - 1;
  const label = { lobby: 'Start quiz', question: 'End timer & reveal', locked: 'Reveal answer', reveal: lastQ ? 'Show final results' : 'Next question', leaderboard: lastQ ? 'Show final results' : 'Next question' }[ph];
  const showDist = ph === 'locked' || ph === 'reveal';
  return (
    <div className="host">
      <Header right={<div className="stats">
        <span>Participants <b>{h.joined} / {h.max}</b></span>
        <span>Connected <b>{h.connected}</b></span><span>Disconnected <b>{h.joined - h.connected}</b></span>
        {inQ && <><span>Question <b>{h.qi + 1} / {h.total}</b></span><span>Answers <b>{h.answered} / {h.joined}</b></span>
          <span>Time <b>{ph === 'question' ? t + ' s' : "Time's up"}</b></span></>}
        <span className={on ? 'ok' : 'warn'}>{on ? '● Connected' : '○ Reconnecting...'}</span></div>} />
      <main>
        {ph === 'lobby' && <div style={{ textAlign: 'center' }}>
          <div className="big-title">SPOT THE DROPOUT</div>
          <h2>IADC IIT(ISM) Dhanbad</h2>
          <h2>Join on your phone: {location.host}</h2>
          <div className="big-title">{h.joined} / {h.max}</div><p>participants joined</p></div>}
        {inQ && <>
          <div className="qtitle">Question {h.qi + 1}: Which one is different?</div>
          <p className="hint">{q.hint}</p>
          {q.image && <img className="qimg" src={q.image} alt="" style={{ maxHeight: '30vh' }} />}
          <Opts q={q} big ans={ph === 'reveal' ? h.correct : null} />
          {h.needsAnswer && ph !== 'reveal' && <div className="note">No correct answer was supplied for this question. Choose it before revealing:{' '}
            {q.options.map((_, i) => <button key={i} className="btn alt" style={{ margin: '0 .3em' }} onClick={() => act('set_answer', L[i])}>{L[i]}</button>)}</div>}
          {showDist && <div className="dist">{q.options.map((_, i) => <div key={i} style={{ height: Math.max(8, (h.dist[L[i]] / Math.max(1, h.answered)) * 100) + '%' }}>{L[i]}: {h.dist[L[i]]}</div>)}</div>}
          {ph === 'reveal' && <p style={{ fontSize: '1.5em' }}><b>{h.correct}: {q.options[L.indexOf(h.correct)]}.</b> {h.explanation}</p>}
          {peek && <div className="peek">Correct answer (host only): {h.correct || 'not set'}</div>}
        </>}
        {(ph === 'leaderboard' || ph === 'final') && <div><h1 style={{ textAlign: 'center', fontSize: '3em' }}>🏆 {ph === 'final' ? 'FINAL LEADERBOARD' : 'LEADERBOARD'}</h1><Board big rows={h.top} /></div>}
      </main>
      <footer className="ctl">
        {label && <button className="btn" onClick={() => act('next')}>{label}</button>}
        {ph === 'reveal' && !lastQ && <button className="btn alt" onClick={() => act('leaderboard')}>Show leaderboard</button>}
        {inQ && <button className="btn alt" onClick={() => setPeek(p => !p)}>{peek ? 'Hide' : 'Peek'} correct answer</button>}
        <span className="grow err">{err}</span>
        {ph !== 'lobby' && ph !== 'final' && <button className="btn alt" onClick={() => confirm('End the quiz now and show the final leaderboard?') && act('end')}>End quiz</button>}
        <button className="btn danger" onClick={() => confirm('Are you sure?\nThis will remove all participant scores.') && act('reset')}>Reset game</button>
      </footer>
    </div>
  );
}

export default function App() { return location.pathname.startsWith('/host') ? <Host /> : <Player />; }
