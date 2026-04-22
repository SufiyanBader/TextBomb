require('dotenv').config();
const { sequelize, Conversation, OrgSettings, Message } = require('./models');

async function syncDb() {
  try {
    await sequelize.authenticate();
    console.log('Postgres connected, running alter sync...');
    
    // Explicitly sync the new tables
    await OrgSettings.sync({ alter: true });
    await Conversation.sync({ alter: true });
    await Message.sync({ alter: true });
    
    console.log('Sync complete!');
  } catch (err) {
    console.error('Sync failed:', err);
  } finally {
    process.exit();
  }
}

syncDb();
