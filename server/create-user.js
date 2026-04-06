require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User, Organization } = require('./models');

async function createTestUser() {
  try {
    // Check if organization exists
    let org = await Organization.findOne({ where: { name: 'Test Organization' } });
    if (!org) {
      org = await Organization.create({
        name: 'Test Organization',
        domain: 'test.com',
        subscription_plan: 'free',
        status: 'active'
      });
      console.log('Created organization:', org.name);
    }

    // Check if user exists
    let user = await User.findOne({ where: { email: 'admin@test.com' } });
    if (!user) {
      const passwordHash = await bcrypt.hash('password123', 12);
      user = await User.create({
        name: 'Test Admin',
        email: 'admin@test.com',
        password_hash: passwordHash,
        role: 'super_admin',
        status: 'active',
        organization_id: org.id
      });
      console.log('Created user:', user.email);
    } else {
      console.log('User already exists:', user.email);
    }

    console.log('Login credentials:');
    console.log('Email: admin@test.com');
    console.log('Password: password123');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

createTestUser();