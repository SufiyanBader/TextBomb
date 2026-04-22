const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Conversation', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    department_id: { type: DataTypes.UUID },
    contact_id: { type: DataTypes.UUID, allowNull: false },
    campaign_id: { type: DataTypes.UUID },
    whatsapp_account_id: { type: DataTypes.UUID },
    status: { type: DataTypes.ENUM('open', 'resolved', 'pending'), defaultValue: 'open' },
    last_message_at: { type: DataTypes.DATE },
    unread_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    assigned_to: { type: DataTypes.UUID },
  }, { 
    tableName: 'conversations', 
    underscored: true 
  });
};
