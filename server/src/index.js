const { loadEnv } = require('./config/env');

loadEnv();

const { connectDb } = require('./config/db');
const { app } = require('./app');

const port = Number(process.env.PORT) || 3001;

connectDb().finally(() => {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
});
