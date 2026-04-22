const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('OrgSettings', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    
    // Meta / WhatsApp
    meta_app_id: { type: DataTypes.STRING },
    meta_app_secret_encrypted: { type: DataTypes.TEXT },
    meta_webhook_verify_token: { type: DataTypes.STRING },
    meta_graph_api_version: { type: DataTypes.STRING, defaultValue: 'v18.0' },
    
    // Sending config
    default_batch_size: { type: DataTypes.INTEGER, defaultValue: 25 },
    default_delay_min: { type: DataTypes.INTEGER, defaultValue: 2 },
    default_delay_max: { type: DataTypes.INTEGER, defaultValue: 8 },
    default_reply_to: { type: DataTypes.STRING },
    
    // Spam filter
    spam_words: { type: DataTypes.TEXT, defaultValue: 'FREE,WINNER,URGENT,CLICK NOW' },
    
    // Unsubscribe page
    unsub_company: { type: DataTypes.STRING },
    unsub_color: { type: DataTypes.STRING, defaultValue: '#22d3ee' }, // Updated to match Neon Cyan
    unsub_message: { type: DataTypes.TEXT },
    
    // Notifications
    notify_on_completion: { type: DataTypes.BOOLEAN, defaultValue: true },
    notify_on_failure: { type: DataTypes.BOOLEAN, defaultValue: true },
    notify_threshold_pct: { type: DataTypes.INTEGER, defaultValue: 80 },
  }, { 
    tableName: 'org_settings', 
    underscored: true 
  });
};
