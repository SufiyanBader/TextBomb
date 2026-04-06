const { Sequelize, DataTypes } = require('sequelize');

let sequelize;

const dbUri = process.env.DATABASE_URL;
const sslOptions = process.env.RAILWAY_ENVIRONMENT || process.env.PGHOST?.includes('railway.app') 
  ? { require: true, rejectUnauthorized: false }
  : false;

if (dbUri) {
  sequelize = new Sequelize(dbUri, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    ...(process.env.NODE_ENV === 'production' && sslOptions && {
      dialectOptions: { ssl: sslOptions }
    }),
  });
} else if (process.env.PGHOST) {
  // Use individual variables to avoid URL encoding issues with special characters in passwords
  sequelize = new Sequelize(process.env.PGDATABASE, process.env.PGUSER, process.env.PGPASSWORD, {
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    ...(process.env.NODE_ENV === 'production' && {
      dialectOptions: { ssl: sslOptions }
    }),
  });
} else {
  console.error('================================================================');
  console.error('❌ FATAL ERROR: NO DATABASE CONNECTION VARIABLES FOUND! ❌');
  console.error('If you are on Railway, you MUST link the Postgres variables:');
  console.error('1. Go to your TextBomb service in the Railway Dashboard');
  console.error('2. Go to Variables');
  console.error('3. Make sure DATABASE_URL or PGHOST is present.');
  console.error('================================================================');
  throw new Error('MISSING_DATABASE_VARIABLES - Cannot start server without a database link.');
}

// ─── Organization ─────────────────────────────────────────────────────────────
const Organization = sequelize.define('Organization', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  domain: { type: DataTypes.STRING },
  subscription_plan: { type: DataTypes.ENUM('free', 'starter', 'pro', 'enterprise'), defaultValue: 'free' },
  whatsapp_business_account_id: { type: DataTypes.STRING },
  meta_access_token_encrypted: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'inactive', 'suspended'), defaultValue: 'active' },
}, { tableName: 'organizations', underscored: true });

// ─── Department ───────────────────────────────────────────────────────────────
const Department = sequelize.define('Department', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  organization_id: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  created_by: { type: DataTypes.UUID },
}, { tableName: 'departments', underscored: true });

// ─── User ─────────────────────────────────────────────────────────────────────
const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  organization_id: { type: DataTypes.UUID, allowNull: false },
  department_id: { type: DataTypes.UUID },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('super_admin', 'dept_admin', 'member'), defaultValue: 'member' },
  status: { type: DataTypes.ENUM('active', 'inactive', 'invited'), defaultValue: 'active' },
  avatar_url: { type: DataTypes.STRING },
  last_login_at: { type: DataTypes.DATE },
}, { tableName: 'users', underscored: true });

// ─── WhatsApp Account ─────────────────────────────────────────────────────────
const WhatsAppAccount = sequelize.define('WhatsAppAccount', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  organization_id: { type: DataTypes.UUID, allowNull: false },
  department_id: { type: DataTypes.UUID },
  phone_number_id: { type: DataTypes.STRING, allowNull: false },
  phone_number: { type: DataTypes.STRING },
  display_name: { type: DataTypes.STRING, allowNull: false },
  bsp: { type: DataTypes.ENUM('meta_direct', 'twilio', '360dialog', 'gupshup'), defaultValue: 'meta_direct' },
  api_key_encrypted: { type: DataTypes.TEXT },
  waba_id: { type: DataTypes.STRING },
  daily_sent_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  daily_limit: { type: DataTypes.INTEGER, defaultValue: 1000 },
  status: { type: DataTypes.ENUM('active', 'paused', 'disconnected'), defaultValue: 'active' },
  quality_rating: { type: DataTypes.ENUM('GREEN', 'YELLOW', 'RED', 'UNKNOWN'), defaultValue: 'UNKNOWN' },
  // Number Pool fields
  is_pooled: { type: DataTypes.BOOLEAN, defaultValue: false },
  added_by: { type: DataTypes.UUID },
  notes: { type: DataTypes.TEXT },
  monthly_sent_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  monthly_limit: { type: DataTypes.INTEGER, defaultValue: 10000 },
  assigned_department_ids: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
}, { tableName: 'whatsapp_accounts', underscored: true });

// ─── Number Assignment ────────────────────────────────────────────────────────
const NumberAssignment = sequelize.define('NumberAssignment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  organization_id: { type: DataTypes.UUID, allowNull: false },
  whatsapp_account_id: { type: DataTypes.UUID, allowNull: false },
  department_id: { type: DataTypes.UUID },
  assigned_by: { type: DataTypes.UUID },
  unassigned_by: { type: DataTypes.UUID },
  assigned_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  unassigned_at: { type: DataTypes.DATE },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'number_assignments', underscored: true, updatedAt: false });

// ─── Message Template ─────────────────────────────────────────────────────────
const MessageTemplate = sequelize.define('MessageTemplate', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  organization_id: { type: DataTypes.UUID, allowNull: false },
  created_by: { type: DataTypes.UUID, allowNull: false },
  reviewed_by: { type: DataTypes.UUID },
  name: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.ENUM('MARKETING', 'UTILITY', 'AUTHENTICATION'), allowNull: false },
  language: { type: DataTypes.STRING, defaultValue: 'en_US' },
  components_json: { type: DataTypes.JSONB, allowNull: false },
  meta_template_id: { type: DataTypes.STRING },
  approval_status: {
    type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected', 'paused'),
    defaultValue: 'draft',
  },
  rejection_reason: { type: DataTypes.TEXT },
  version: { type: DataTypes.INTEGER, defaultValue: 1 },
  preview_text: { type: DataTypes.TEXT },
}, { tableName: 'message_templates', underscored: true });

// ─── Contact List ─────────────────────────────────────────────────────────────
const ContactList = sequelize.define('ContactList', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  organization_id: { type: DataTypes.UUID, allowNull: false },
  department_id: { type: DataTypes.UUID },
  name: { type: DataTypes.STRING, allowNull: false },
  record_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  valid_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  opted_in_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  tags: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  uploaded_by: { type: DataTypes.UUID },
}, { tableName: 'contact_lists', underscored: true });

// ─── Contact ──────────────────────────────────────────────────────────────────
const Contact = sequelize.define('Contact', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  list_id: { type: DataTypes.UUID, allowNull: false },
  organization_id: { type: DataTypes.UUID, allowNull: false },
  phone_number: { type: DataTypes.STRING, allowNull: false },
  first_name: { type: DataTypes.STRING },
  last_name: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  company: { type: DataTypes.STRING },
  custom_fields: { type: DataTypes.JSONB, defaultValue: {} },
  opt_in_status: { type: DataTypes.BOOLEAN, defaultValue: false },
  opt_in_source: { type: DataTypes.ENUM('form', 'import', 'qr', 'manual', 'api') },
  opt_in_timestamp: { type: DataTypes.DATE },
  opted_out_at: { type: DataTypes.DATE },
  is_suppressed: { type: DataTypes.BOOLEAN, defaultValue: false },
  suppression_reason: { type: DataTypes.STRING },
}, { tableName: 'contacts', underscored: true });

// ─── Campaign ─────────────────────────────────────────────────────────────────
const Campaign = sequelize.define('Campaign', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  organization_id: { type: DataTypes.UUID, allowNull: false },
  department_id: { type: DataTypes.UUID },
  created_by: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  template_id: { type: DataTypes.UUID, allowNull: false },
  list_ids: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
  whatsapp_account_id: { type: DataTypes.UUID },
  use_round_robin: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: {
    type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'completed', 'paused', 'failed'),
    defaultValue: 'draft',
  },
  scheduled_at: { type: DataTypes.DATE },
  started_at: { type: DataTypes.DATE },
  completed_at: { type: DataTypes.DATE },
  total_recipients: { type: DataTypes.INTEGER, defaultValue: 0 },
  sent_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  template_variables: { type: DataTypes.JSONB, defaultValue: {} },
}, { tableName: 'campaigns', underscored: true });

// ─── Campaign Job ─────────────────────────────────────────────────────────────
const CampaignJob = sequelize.define('CampaignJob', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  campaign_id: { type: DataTypes.UUID, allowNull: false },
  contact_id: { type: DataTypes.UUID, allowNull: false },
  whatsapp_account_id: { type: DataTypes.UUID },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'skipped'),
    defaultValue: 'pending',
  },
  sent_at: { type: DataTypes.DATE },
  delivered_at: { type: DataTypes.DATE },
  read_at: { type: DataTypes.DATE },
  fail_reason: { type: DataTypes.TEXT },
  meta_message_id: { type: DataTypes.STRING },
}, { tableName: 'campaign_jobs', underscored: true });

// ─── Tracking Event ───────────────────────────────────────────────────────────
const TrackingEvent = sequelize.define('TrackingEvent', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  campaign_id: { type: DataTypes.UUID, allowNull: false },
  contact_id: { type: DataTypes.UUID },
  meta_message_id: { type: DataTypes.STRING },
  event_type: {
    type: DataTypes.ENUM('sent', 'delivered', 'read', 'replied', 'failed', 'opted_out', 'clicked'),
    allowNull: false,
  },
  metadata: { type: DataTypes.JSONB, defaultValue: {} },
}, { tableName: 'tracking_events', underscored: true, updatedAt: false });

// ─── Audit Log ────────────────────────────────────────────────────────────────
const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  organization_id: { type: DataTypes.UUID, allowNull: false },
  user_id: { type: DataTypes.UUID },
  action: { type: DataTypes.STRING, allowNull: false },
  entity_type: { type: DataTypes.STRING },
  entity_id: { type: DataTypes.UUID },
  ip_address: { type: DataTypes.STRING },
  user_agent: { type: DataTypes.STRING },
  metadata: { type: DataTypes.JSONB, defaultValue: {} },
}, { tableName: 'audit_logs', underscored: true, updatedAt: false });

// ─── Notification ─────────────────────────────────────────────────────────────
const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  organization_id: { type: DataTypes.UUID, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT },
  is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
  metadata: { type: DataTypes.JSONB, defaultValue: {} },
}, { tableName: 'notifications', underscored: true, updatedAt: false });

// ─── Associations ─────────────────────────────────────────────────────────────
Organization.hasMany(Department, { foreignKey: 'organization_id' });
Organization.hasMany(User, { foreignKey: 'organization_id' });
Organization.hasMany(WhatsAppAccount, { foreignKey: 'organization_id' });
Organization.hasMany(Campaign, { foreignKey: 'organization_id' });
Organization.hasMany(ContactList, { foreignKey: 'organization_id' });

Department.belongsTo(Organization, { foreignKey: 'organization_id' });
Department.hasMany(User, { foreignKey: 'department_id' });

User.belongsTo(Organization, { foreignKey: 'organization_id' });
User.belongsTo(Department, { foreignKey: 'department_id' });

WhatsAppAccount.belongsTo(Organization, { foreignKey: 'organization_id' });

NumberAssignment.belongsTo(Department, { foreignKey: 'department_id' });
NumberAssignment.belongsTo(User, { as: 'assigner', foreignKey: 'assigned_by' });
NumberAssignment.belongsTo(WhatsAppAccount, { foreignKey: 'whatsapp_account_id' });

MessageTemplate.belongsTo(Organization, { foreignKey: 'organization_id' });
MessageTemplate.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });

ContactList.belongsTo(Organization, { foreignKey: 'organization_id' });
ContactList.hasMany(Contact, { foreignKey: 'list_id' });

Contact.belongsTo(ContactList, { foreignKey: 'list_id' });

Campaign.belongsTo(Organization, { foreignKey: 'organization_id' });
Campaign.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });
Campaign.belongsTo(MessageTemplate, { foreignKey: 'template_id' });
Campaign.hasMany(CampaignJob, { foreignKey: 'campaign_id' });

CampaignJob.belongsTo(Campaign, { foreignKey: 'campaign_id' });
CampaignJob.belongsTo(Contact, { foreignKey: 'contact_id' });

module.exports = {
  sequelize,
  Organization,
  Department,
  User,
  WhatsAppAccount,
  MessageTemplate,
  ContactList,
  Contact,
  Campaign,
  CampaignJob,
  TrackingEvent,
  AuditLog,
  Notification,
  NumberAssignment,
};
