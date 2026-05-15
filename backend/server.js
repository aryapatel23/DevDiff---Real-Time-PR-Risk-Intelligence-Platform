const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const authRouter = require('./routes/auth');
const projectsRouter = require('./routes/projects');
const { router: analyzeRouter, jobs } = require('./routes/analyze');
const analyticsRouter = require('./routes/analytics');
const developerRouter = require('./routes/developer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/developer', developerRouter);

wss.on('connection', (ws, req) => {
  const match = req.url.match(/\/ws\/findings\/([^/?]+)/);
  if (!match) return ws.close();

  const job = jobs.get(match[1]);
  if (!job) return ws.close();

  job.clients.add(ws);
  for (const findingEvent of job.findings) {
    if (ws.readyState === 1) ws.send(JSON.stringify(findingEvent));
  }

  if (job.status === 'complete') {
    ws.send(JSON.stringify({ event: 'complete', data: job.summary }));
  }

  ws.on('close', () => job.clients.delete(ws));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`DevDiff backend on port ${PORT}`);
});
