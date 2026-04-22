const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Message', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    conversation_id: { type: DataTypes.UUID, allowNull: false },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    contact_id: { type: DataTypes.UUID },
    sent_by_user_id: { type: DataTypes.UUID },
    direction: { type: DataTypes.ENUM('inbound', 'outbound'), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    meta_message_id: { type: DataTypes.STRING },
    status: { type: DataTypes.ENUM('sent', 'delivered', 'read', 'failed'), defaultValue: 'sent' },
    sent_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { 
    tableName: 'messages', 
    underscored: true,
    updatedAt: false // Only created_at logic makes sense for simple message logs
  });
};
