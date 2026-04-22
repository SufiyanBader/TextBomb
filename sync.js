require('dotenv').config();
const { sequelize } = require('./server/models');

async function syncDb() {
  try {
    await sequelize.authenticate();
    console.log('Postgres connected, running alter sync...');
    await sequelize.sync({ alter: true });
    console.log('Sync complete!');
  } catch (err) {
    console.error('Sync failed:', err);
  } finally {
    process.exit();
  }
}

syncDb();
