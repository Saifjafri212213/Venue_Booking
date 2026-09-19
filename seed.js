/**
 * Comprehensive Database Seeder
 * Event & Venue Booking Management System
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Venue = require('./models/Venue');
const Booking = require('./models/Booking');
const MaintenanceBlock = require('./models/MaintenanceBlock');
const PaymentSetting = require('./models/PaymentSetting');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/event_venue_booking_db';
    console.log(`Connecting to MongoDB at: ${mongoUri.split('@')[1] || mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log(' Connected to MongoDB.');

    // Clear existing collections
    await Promise.all([
      User.deleteMany({}),
      Venue.deleteMany({}),
      Booking.deleteMany({}),
      MaintenanceBlock.deleteMany({}),
      PaymentSetting.deleteMany({})
    ]);
    console.log(' Cleared old collections.');

    // 1. Create Users
    const users = await User.create([
      {
        name: 'Dr. Eleanor Vance',
        email: 'admin@campus.edu',
        password: 'admin123',
        role: 'admin',
        department: 'Campus Facilities & Venue Management',
        organization: 'University Central Administration',
        phone: '+1 (555) 892-1049',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80'
      },
      {
        name: 'Alex Rivera',
        email: 'techclub@campus.edu',
        password: 'password123',
        role: 'organiser',
        department: 'Computer Science & Engineering',
        organization: 'Campus ACM & Tech Innovators Club',
        phone: '+1 (555) 234-5678',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
      },
      {
        name: 'Maya Chen',
        email: 'cultural@campus.edu',
        password: 'password123',
        role: 'organiser',
        department: 'Fine Arts & Performing Media',
        organization: 'Campus Cultural Affairs Committee',
        phone: '+1 (555) 456-7890',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80'
      }
    ]);
    console.log(` Created ${users.length} users (1 Admin, 2 Organisers).`);

    const adminUser = users[0];
    const techOrganiser = users[1];
    const culturalOrganiser = users[2];

    // 2. Create Venues
    const venues = await Venue.create([
      {
        name: 'Grand Auditorium Hall',
        code: 'AUD-01',
        category: 'Auditorium',
        capacity: 850,
        location: 'Central Campus Complex, Gate 1',
        building: 'Sir C.V. Raman Academic Block',
        floor: 'Ground & 1st Tier',
        hourlyRate: 150,
        operatingHours: { openTime: '08:00', closeTime: '23:00' },
        facilities: [
          'Projector & Screen',
          'Surround Sound Audio',
          'Stage Lighting',
          'Central AC',
          'High-Speed Wi-Fi',
          'Podiums & Microphones',
          'VIP Green Room',
          'Wheelchair Accessible',
          'Parking Access'
        ],
        featuredImage: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
        description: 'Flagship university auditorium featuring dual 4K laser projection, theatre-grade Dolby surround acoustics, stage lighting rigging, and tiered cushioned seating for major convocations and fests.',
        rules: [
          'Strictly no open flames or hazardous chemical displays.',
          'Audio equipment operator must be present for decibel regulation.',
          'Return green room keys to security desk within 30 minutes of event wrap-up.'
        ],
        featured: true,
        status: 'active'
      },
      {
        name: 'Emerald Conference Center',
        code: 'CONF-A',
        category: 'Conference Hall',
        capacity: 220,
        location: 'North Campus Quadrangle',
        building: 'Management & Executive Tower',
        floor: '3rd Floor',
        hourlyRate: 90,
        operatingHours: { openTime: '08:00', closeTime: '21:00' },
        facilities: [
          'Projector & Screen',
          'Video Conferencing',
          'Surround Sound Audio',
          'Central AC',
          'High-Speed Wi-Fi',
          'Podiums & Microphones',
          'Catering Pantry'
        ],
        featuredImage: 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&w=1200&q=80',
        description: 'State-of-the-art corporate and academic symposium venue equipped with PTZ camera video conferencing, interactive digital whiteboards, and ergonomic conference seating.',
        featured: true,
        status: 'active'
      },
      {
        name: 'Open-Air Amphitheatre',
        code: 'AMPHI-01',
        category: 'Amphitheatre',
        capacity: 1200,
        location: 'South Campus Gardens',
        building: 'Lakeside Recreational Grounds',
        floor: 'Outdoor Pavilion',
        hourlyRate: 110,
        operatingHours: { openTime: '10:00', closeTime: '22:00' },
        facilities: [
          'Stage Lighting',
          'Surround Sound Audio',
          'High-Speed Wi-Fi',
          'Parking Access',
          'Wheelchair Accessible'
        ],
        featuredImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
        description: 'Vibrant outdoor amphitheatre overlooking the campus lake. Ideal for cultural evenings, musical concerts, drama festivals, and large-scale open community gatherings.',
        featured: true,
        status: 'active'
      },
      {
        name: 'Innovation Seminar Room 102',
        code: 'SEM-102',
        category: 'Seminar Room',
        capacity: 75,
        location: 'East Wing Academic Complex',
        building: 'Alan Turing Computing Center',
        floor: '1st Floor',
        hourlyRate: 45,
        operatingHours: { openTime: '08:30', closeTime: '20:30' },
        facilities: [
          'Projector & Screen',
          'Central AC',
          'High-Speed Wi-Fi',
          'Podiums & Microphones',
          'Wheelchair Accessible'
        ],
        featuredImage: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80',
        description: 'A cozy, tech-enabled seminar room designed for club workshops, guest lectures, department thesis defences, and interactive training sessions.',
        featured: false,
        status: 'active'
      },
      {
        name: 'Executive Boardroom Suite',
        code: 'BR-301',
        category: 'Meeting Room',
        capacity: 30,
        location: 'Administrative Block',
        building: 'Vice-Chancellor Pavilion',
        floor: '3rd Floor',
        hourlyRate: 60,
        operatingHours: { openTime: '09:00', closeTime: '19:00' },
        facilities: [
          'Video Conferencing',
          'Central AC',
          'High-Speed Wi-Fi',
          'Catering Pantry'
        ],
        featuredImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
        description: 'Premium boardroom setting with mahogany conference table, omnidirectional audio conference pickup, and private coffee lounge.',
        featured: false,
        status: 'active'
      },
      {
        name: 'Robotics & Maker Workshop Lab',
        code: 'LAB-204',
        category: 'Workshop Lab',
        capacity: 60,
        location: 'Engineering Hub',
        building: 'Nikola Tesla Innovation Complex',
        floor: '2nd Floor',
        hourlyRate: 55,
        operatingHours: { openTime: '08:00', closeTime: '22:00' },
        facilities: [
          'High-Speed Wi-Fi',
          'Central AC',
          'Projector & Screen',
          'Podiums & Microphones'
        ],
        featuredImage: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
        description: 'Modular workshop space equipped with anti-static workstations, 3D printing equipment, hardware prototyping benches, and presentation screens.',
        featured: true,
        status: 'active'
      },
      {
        name: 'Campus Community Lounge & Banquet',
        code: 'BANQ-01',
        category: 'Banquet Hall',
        capacity: 350,
        location: 'Student Activity Complex',
        building: 'Student Union Hub',
        floor: 'Ground Floor',
        hourlyRate: 120,
        operatingHours: { openTime: '09:00', closeTime: '23:00' },
        facilities: [
          'Catering Pantry',
          'Central AC',
          'Surround Sound Audio',
          'Stage Lighting',
          'High-Speed Wi-Fi',
          'Parking Access'
        ],
        featuredImage: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
        description: 'Spacious banquet hall designed for alumni dinners, festival celebrations, award galas, and social community networking banquets.',
        featured: false,
        status: 'active'
      },
      {
        name: 'Indoor Sports Complex Arena',
        code: 'SPORT-01',
        category: 'Sports Arena',
        capacity: 600,
        location: 'Athletic Zone, Gate 4',
        building: 'University Gymnasium & Sports Pavilion',
        floor: 'Ground Arena',
        hourlyRate: 85,
        operatingHours: { openTime: '06:00', closeTime: '22:00' },
        facilities: [
          'Surround Sound Audio',
          'Stage Lighting',
          'Parking Access',
          'Wheelchair Accessible'
        ],
        featuredImage: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
        description: 'Multi-court indoor arena suitable for inter-college badminton, basketball tournaments, yoga bootcamps, and physical wellness expos.',
        featured: false,
        status: 'active'
      }
    ]);
    console.log(` Created ${venues.length} realistic campus venues.`);

    // 3. Create Active Payment Setting
    const paymentSetting = await PaymentSetting.create({
      accountHolderName: 'Campus Facilities & Venue Administration',
      bankName: 'State Bank of India',
      accountNumber: '40928172901',
      ifscCode: 'SBIN0001234',
      branchName: 'University Main Campus Branch',
      upiId: 'campusfacilities@sbi',
      instructions: 'Please transfer the exact booking fee and submit your 12-digit UTR/UPI transaction reference for swift administrative verification.',
      isActive: true,
      updatedBy: adminUser._id
    });
    console.log(` Created active PaymentSetting (${paymentSetting.upiId}).`);
    console.log(` Database initialized with 0 bookings and 0 maintenance blocks (Clean State).`);

    console.log('\n=================================================');
    console.log(' DATABASE INITIALIZATION COMPLETED SUCCESSFULLY!');
    console.log('=================================================');
    console.log(' LOGIN CREDENTIALS:');
    console.log(' 1. Venue Manager / Admin: admin@campus.edu | password: admin123');
    console.log(' 2. Event Organiser (Tech): techclub@campus.edu | password: password123');
    console.log(' 3. Event Organiser (Cultural): cultural@campus.edu | password: password123');
    console.log('=================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(' Seeding error:', error);
    process.exit(1);
  }
};

seedData();

