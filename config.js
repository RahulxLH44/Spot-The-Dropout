// All tunables live here.
module.exports = {
  MAX_PLAYERS: 100,        // participant limit
  QUESTION_MS: 20000,      // time per question (ms)
  GRACE_MS: 500,           // network grace added server-side after the timer
  LB_EVERY: 4,             // leaderboard after every N questions
  // Scoring: edit freely. remMs = time left when the answer arrived.
  score: (remMs, durMs) => Math.round(1000 + (Math.max(0, remMs) / durMs) * 500),
};
