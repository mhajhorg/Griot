import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { registryRouter } from './routes/registry.js';
import { readRouter } from './routes/read.js';
import { payRouter } from './routes/pay.js';
import { fetchRouter } from './routes/fetch.js';
import { agentRouter } from './routes/agent.js';
import { creatorRouter } from './routes/creator.js';
import { articlesRouter } from './routes/articles.js';
import { readerRouter } from './routes/reader.js';
import { statsRouter } from './routes/stats.js';
import { startActivityBot } from './lib/activity-bot.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/registry', registryRouter);
app.use('/api', readRouter);       // /api/read/:slug, /api/verify (kept as-is, not in the frontend's 9-endpoint list)
app.use('/api', payRouter);        // /api/pay (internal — used by the agent)
app.use('/api', fetchRouter);      // /api/fetch-content
app.use('/api', agentRouter);      // /api/agent
app.use('/api/creator', creatorRouter); // /api/creator/withdraw
app.use('/api', articlesRouter);   // /api/articles/:slug
app.use('/api/reader', readerRouter); // /api/reader/session, /:id/balance, /:id/approve
app.use('/api', statsRouter);       // /api/stats

// Health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'griot-api' });
});

app.listen(PORT, () => {
  console.log(`[griot] API running on port ${PORT}`);
  console.log(`[griot] Arc RPC: ${process.env.ARC_RPC_URL}`);

  if (process.env.ENABLE_ACTIVITY_BOT === 'true') {
    startActivityBot();
  }
});
