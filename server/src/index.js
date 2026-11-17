const express = require('express');
const { loadEnv } = require('./config/env');
const { connectDb } = require('./config/db');
const healthRouter = require('./routes/health');

loadEnv();

const app = express();
app.use(healthRouter);

const port = Number(process.env.PORT) || 3001;

connectDb().finally(() => {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
});
