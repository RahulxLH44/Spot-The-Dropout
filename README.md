# Spot The Dropout — IADC IIT(ISM) Dhanbad

Real-time live quiz: ~100 phones + one host/projector. Node + Express + Socket.IO server (all state in memory), React + Vite client.

* Players: `https://YOUR-URL/`  |  Host: `https://YOUR-URL/host` (needs `HOST_KEY`)

## Run locally
```
npm install          # also builds the client (postinstall)
HOST_KEY=secret npm start      # Windows PowerShell: $env:HOST_KEY="secret"; npm start
```
Open http://localhost:3000 (players) and http://localhost:3000/host (host).
UI development: `npm run dev:server` + `npm run dev:client` (Vite proxies sockets to port 3000).

## Deploy (Render / Railway / Fly.io, no Docker)
* Build command: `npm install`   Start command: `npm start`
* Environment variables: `HOST_KEY` (long random string, required), `PORT` (set automatically by the platform).
* **Run exactly ONE instance** (state is in memory). Use an always-on plan: free tiers sleep and would lose the game.
* Health check path: `/healthz`

## Running the event
1. Host opens `/host`, logs in, projects the screen. Players open the URL and enter a name.
2. **Start quiz** → players get Q1. **End timer & reveal / Reveal answer** → answer + explanation. **Next question**. A leaderboard appears after every 4th question (or press *Show leaderboard* after any reveal). After Q24 the final leaderboard (top 10, plus each phone's own rank/score) appears.
3. The host screen is projected, so the correct answer is hidden unless you press *Peek correct answer*.
4. **Q24 has no supplied answer.** The host dashboard asks you to pick it before reveal (also edit `questions.js`).
5. If the server restarts, phones show "Quiz server restarted. Please ask the host to restart the quiz."; the host just logs in again and starts.
6. *Reset game* (confirmation required) zeroes scores but keeps joined players.

## Customising (all server-side; restart afterwards)
* **Duration / participant limit / leaderboard frequency / scoring formula**: `config.js` (`QUESTION_MS`, `MAX_PLAYERS`, `LB_EVERY`, `score()`).
* **Questions**: `questions.js` — `q(id, [4 options], hint, 'exact option text', explanation, image)`. The answer must match an option exactly or the server refuses to start. Explanations were drafted by the developer: please verify them (Q13 is marked VERIFY).
* **Images**: put compressed WebP/JPEG (≈800 px wide, <100 KB; e.g. via squoosh.app) in `client/public/images/`, then set `image: '/images/q11.webp'`. Static files are cached by the browser for 7 days, and only the *next* question's image is preloaded.

## Load test
Start the server locally, then in another terminal:
```
HOST_KEY=secret N=100 ROUNDS=4 npm run loadtest
```
It joins 100 sockets at once, answers each question (sending every answer twice on purpose), reveals, shows leaderboards, and prints connection success, answer latency, missing events, duplicates accepted (must be 0) and memory. It resets the game, so never point it at the live event.

## Design notes
* Server is the only authority: question, timer, correctness, score, rank. Phones never receive the answer before reveal.
* Timer: server stores `startedAt`; answers are valid if `elapsed <= duration` (+500 ms network grace on the lock timer only). Phones show a visual countdown.
* One answer per player per question (first wins; Node's single thread makes the check-and-write atomic). Scores are computed once at reveal from the server-recorded answer time.
* Player answers are never broadcast; the host receives throttled (~4/s) summaries. Broadcasts happen only on phase changes.
* Reconnection: each player gets a server-generated `player_xxxxxx` ID + secret token stored in the phone; score and answers survive disconnects, no refresh needed.
* Host actions are checked server-side against a socket authenticated with `HOST_KEY` (constant-time comparison).
