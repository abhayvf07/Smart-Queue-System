require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const Service = require('./src/models/Service');

const seedData = async () => {
  try {
    // Safety check — prevent accidental data wipe in production
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Cannot run seed in production environment!');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Service.deleteMany({});
    // Also clear counters so token numbering restarts from 1
    await mongoose.connection.collection('counters').deleteMany({});

    // Create admin user
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@smartqueue.com',
      password: 'admin123',
      role: 'admin',
    });
    console.log(`✅ Admin created: admin@smartqueue.com / admin123`);

    // Create demo user
    const user = await User.create({
      name: 'John Doe',
      email: 'user@smartqueue.com',
      password: 'user123',
      role: 'user',
    });
    console.log(`✅ User created: user@smartqueue.com / user123`);

    // Create services
    const services = await Service.insertMany([
      {
        name: 'General OPD',
        description: 'General outpatient department for routine checkups and consultations',
        prefix: 'A',
        capacityPerHour: 20,
        active: true,
      },
      {
        name: 'Billing Counter',
        description: 'Payment and billing services',
        prefix: 'B',
        capacityPerHour: 30,
        active: true,
      },
      {
        name: 'Pharmacy',
        description: 'Prescription medicines and medical supplies',
        prefix: 'C',
        capacityPerHour: 25,
        active: true,
      },
      {
        name: 'Lab Testing',
        description: 'Blood tests, X-rays, and diagnostic services',
        prefix: 'D',
        capacityPerHour: 15,
        active: true,
      },
      {
        name: 'Dental Care',
        description: 'Dental checkups and treatments',
        prefix: 'E',
        capacityPerHour: 10,
        active: true,
      },
    ]);

    console.log(`✅ ${services.length} services created:`);
    services.forEach((s) => console.log(`   - ${s.name} (${s.prefix})`));

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('   Admin: admin@smartqueue.com / admin123');
    console.log('   User:  user@smartqueue.com / user123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seedData();
