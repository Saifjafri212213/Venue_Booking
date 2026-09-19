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

    // 3. Create Dates for Today, Upcoming, and Past Bookings
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 6);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const pastWeek = new Date(today);
    pastWeek.setDate(pastWeek.getDate() - 7);

    // 4. Create Bookings
    const bookings = await Booking.create([
      // --- TODAY'S EVENTS (For Live Dashboard Schedule) ---
      {
        bookingReference: 'EVT-2026-1001',
        venue: venues[0]._id, // Grand Auditorium
        organiser: techOrganiser._id,
        eventTitle: 'National AI & Cloud Computing Summit 2026',
        eventType: 'Tech Fest',
        description: 'Full day summit exploring Agentic AI systems, scalable infrastructure, and industry keynotes.',
        expectedAttendees: 650,
        bookingDate: today,
        startTime: '09:00',
        endTime: '17:00',
        durationHours: 8,
        hourlyRate: venues[0].hourlyRate,
        totalCost: 8 * venues[0].hourlyRate,
        paymentAmount: 8 * venues[0].hourlyRate,
        paymentStatus: 'paid',
        utrNumber: 'SBI892019283019',
        paymentSubmittedAt: new Date(Date.now() - 24 * 3600 * 1000),
        paymentVerifiedAt: new Date(),
        paymentVerifiedBy: adminUser._id,
        specialFacilities: ['Projector & Screen', 'Surround Sound Audio', 'Stage Lighting', 'Central AC'],
        status: 'Approved',
        approvedAt: new Date(),
        approvedBy: adminUser._id,
        adminRemarks: 'Approved. AV technician team assigned to sound desk.'
      },
      {
        bookingReference: 'EVT-2026-1002',
        venue: venues[1]._id, // Emerald Conference Center
        organiser: culturalOrganiser._id,
        eventTitle: 'Campus Literary Society Debate Finale',
        eventType: 'Academic',
        description: 'Inter-university debate championship semi-finals and grand prize ceremony.',
        expectedAttendees: 180,
        bookingDate: today,
        startTime: '14:00',
        endTime: '18:00',
        durationHours: 4,
        hourlyRate: venues[1].hourlyRate,
        totalCost: 4 * venues[1].hourlyRate,
        paymentAmount: 4 * venues[1].hourlyRate,
        paymentStatus: 'paid',
        utrNumber: 'HDFC90192837465',
        paymentSubmittedAt: new Date(Date.now() - 12 * 3600 * 1000),
        paymentVerifiedAt: new Date(),
        paymentVerifiedBy: adminUser._id,
        specialFacilities: ['Video Conferencing', 'Podiums & Microphones', 'Central AC'],
        status: 'Approved',
        approvedAt: new Date(),
        approvedBy: adminUser._id,
        adminRemarks: 'Approved. Podium microphones will be set up by 1:30 PM.'
      },

      // --- UPCOMING APPROVED EVENTS ---
      {
        bookingReference: 'EVT-2026-1003',
        venue: venues[2]._id, // Open-Air Amphitheatre
        organiser: culturalOrganiser._id,
        eventTitle: 'Spring Symphony: Sunset Classical Concert',
        eventType: 'Cultural',
        description: 'Annual outdoor classical fusion concert featuring campus orchestra and guest vocalists.',
        expectedAttendees: 950,
        bookingDate: tomorrow,
        startTime: '17:30',
        endTime: '21:30',
        durationHours: 4,
        hourlyRate: venues[2].hourlyRate,
        totalCost: 4 * venues[2].hourlyRate,
        paymentAmount: 4 * venues[2].hourlyRate,
        paymentStatus: 'paid',
        utrNumber: 'ICIC83920194820',
        paymentSubmittedAt: new Date(Date.now() - 6 * 3600 * 1000),
        paymentVerifiedAt: new Date(),
        paymentVerifiedBy: adminUser._id,
        specialFacilities: ['Stage Lighting', 'Surround Sound Audio', 'Parking Access'],
        status: 'Approved',
        approvedAt: new Date(),
        approvedBy: adminUser._id,
        adminRemarks: 'Approved with lake pavilion sound permit.'
      },
      {
        bookingReference: 'EVT-2026-1004',
        venue: venues[3]._id, // Seminar Room 102
        organiser: techOrganiser._id,
        eventTitle: 'Full-Stack Web Development Bootcamp',
        eventType: 'Workshop',
        description: 'Hands-on training session on Node.js, React, and MongoDB database architecture.',
        expectedAttendees: 60,
        bookingDate: tomorrow,
        startTime: '10:00',
        endTime: '13:00',
        durationHours: 3,
        hourlyRate: venues[3].hourlyRate,
        totalCost: 3 * venues[3].hourlyRate,
        paymentAmount: 3 * venues[3].hourlyRate,
        paymentStatus: 'paid',
        utrNumber: 'UPI940291048201',
        paymentSubmittedAt: new Date(Date.now() - 5 * 3600 * 1000),
        paymentVerifiedAt: new Date(),
        paymentVerifiedBy: adminUser._id,
        specialFacilities: ['Projector & Screen', 'High-Speed Wi-Fi', 'Central AC'],
        status: 'Approved',
        approvedAt: new Date(),
        approvedBy: adminUser._id,
        adminRemarks: 'Approved. High-speed guest Wi-Fi credentials allocated.'
      },
      {
        bookingReference: 'EVT-2026-1005',
        venue: venues[5]._id, // Robotics Lab
        organiser: techOrganiser._id,
        eventTitle: 'Autonomous Robotics Hackathon: Line Follower Challenge',
        eventType: 'Tech Fest',
        description: '24-hour hardware engineering sprint building autonomous obstacle-avoiding rovers.',
        expectedAttendees: 50,
        bookingDate: dayAfterTomorrow,
        startTime: '09:00',
        endTime: '18:00',
        durationHours: 9,
        hourlyRate: venues[5].hourlyRate,
        totalCost: 9 * venues[5].hourlyRate,
        paymentAmount: 9 * venues[5].hourlyRate,
        paymentStatus: 'paid',
        utrNumber: 'AXIS74920194820',
        paymentSubmittedAt: new Date(Date.now() - 4 * 3600 * 1000),
        paymentVerifiedAt: new Date(),
        paymentVerifiedBy: adminUser._id,
        specialFacilities: ['High-Speed Wi-Fi', 'Central AC'],
        status: 'Approved',
        approvedAt: new Date(),
        approvedBy: adminUser._id
      },
      {
        bookingReference: 'EVT-2026-1006',
        venue: venues[6]._id, // Banquet Hall
        organiser: culturalOrganiser._id,
        eventTitle: 'Annual Alumni Excellence Awards Dinner',
        eventType: 'Celebration',
        description: 'Formal dinner honoring distinguished alumni with keynote reflections.',
        expectedAttendees: 280,
        bookingDate: nextWeek,
        startTime: '18:00',
        endTime: '22:00',
        durationHours: 4,
        hourlyRate: venues[6].hourlyRate,
        totalCost: 4 * venues[6].hourlyRate,
        paymentAmount: 4 * venues[6].hourlyRate,
        paymentStatus: 'paid',
        utrNumber: 'SBI739201948201',
        paymentSubmittedAt: new Date(Date.now() - 3 * 3600 * 1000),
        paymentVerifiedAt: new Date(),
        paymentVerifiedBy: adminUser._id,
        specialFacilities: ['Catering Pantry', 'Central AC', 'Stage Lighting'],
        status: 'Approved',
        approvedAt: new Date(),
        approvedBy: adminUser._id
      },

      // --- PENDING APPROVAL & VERIFICATION REQUESTS ---
      {
        bookingReference: 'EVT-2026-1007',
        venue: venues[1]._id, // Emerald Conference Center
        organiser: techOrganiser._id,
        eventTitle: 'Cybersecurity & Ethical Hacking Symposium',
        eventType: 'Seminar',
        description: 'Industry guest lecture on threat intelligence and zero-trust architectures.',
        expectedAttendees: 150,
        bookingDate: dayAfterTomorrow,
        startTime: '10:00',
        endTime: '13:00',
        durationHours: 3,
        hourlyRate: venues[1].hourlyRate,
        totalCost: 3 * venues[1].hourlyRate,
        paymentAmount: 3 * venues[1].hourlyRate,
        paymentStatus: 'pending_verification',
        utrNumber: 'PAYTM83920194829',
        paymentSubmittedAt: new Date(),
        specialFacilities: ['Projector & Screen', 'Video Conferencing'],
        status: 'Pending'
      },
      {
        bookingReference: 'EVT-2026-1008',
        venue: venues[0]._id, // Grand Auditorium
        organiser: culturalOrganiser._id,
        eventTitle: 'Inter-College Drama & Theatre Extravaganza',
        eventType: 'Cultural',
        description: 'Stage plays, street theatre, and musical monologue performances.',
        expectedAttendees: 700,
        bookingDate: nextWeek,
        startTime: '14:00',
        endTime: '19:00',
        durationHours: 5,
        hourlyRate: venues[0].hourlyRate,
        totalCost: 5 * venues[0].hourlyRate,
        paymentAmount: 5 * venues[0].hourlyRate,
        paymentStatus: 'pending_verification',
        utrNumber: 'GPAY92019482019',
        paymentSubmittedAt: new Date(),
        specialFacilities: ['Stage Lighting', 'Surround Sound Audio', 'VIP Green Room'],
        status: 'Pending'
      },

      // --- COMPLETED PAST EVENTS ---
      {
        bookingReference: 'EVT-2026-1009',
        venue: venues[0]._id,
        organiser: techOrganiser._id,
        eventTitle: 'Freshmen Induction & Dean Welcome Address',
        eventType: 'Academic',
        description: 'Orientation for incoming undergraduate and postgraduate engineering batches.',
        expectedAttendees: 800,
        bookingDate: pastWeek,
        startTime: '10:00',
        endTime: '13:00',
        durationHours: 3,
        hourlyRate: venues[0].hourlyRate,
        totalCost: 3 * venues[0].hourlyRate,
        paymentAmount: 3 * venues[0].hourlyRate,
        paymentStatus: 'paid',
        utrNumber: 'SBI19203948572',
        specialFacilities: ['Projector & Screen', 'Surround Sound Audio'],
        status: 'Completed',
        approvedAt: pastWeek,
        approvedBy: adminUser._id
      },
      {
        bookingReference: 'EVT-2026-1010',
        venue: venues[4]._id, // Executive Boardroom
        organiser: techOrganiser._id,
        eventTitle: 'Campus Industry Advisory Board Quarterly Meeting',
        eventType: 'Corporate',
        description: 'Curriculum review session with external corporate leaders and department heads.',
        expectedAttendees: 22,
        bookingDate: yesterday,
        startTime: '11:00',
        endTime: '14:00',
        durationHours: 3,
        hourlyRate: venues[4].hourlyRate,
        totalCost: 3 * venues[4].hourlyRate,
        paymentAmount: 3 * venues[4].hourlyRate,
        paymentStatus: 'paid',
        utrNumber: 'ICIC93847291048',
        specialFacilities: ['Video Conferencing', 'Central AC'],
        status: 'Completed',
        approvedAt: yesterday,
        approvedBy: adminUser._id
      },

      // --- REJECTED & CANCELLED EVENTS ---
      {
        bookingReference: 'EVT-2026-1011',
        venue: venues[0]._id,
        organiser: culturalOrganiser._id,
        eventTitle: 'Late Night Electronic Music Rave',
        eventType: 'Cultural',
        description: 'Late evening DJ performance.',
        expectedAttendees: 500,
        bookingDate: nextWeek,
        startTime: '21:00',
        endTime: '01:00',
        durationHours: 4,
        hourlyRate: venues[0].hourlyRate,
        totalCost: 4 * venues[0].hourlyRate,
        paymentAmount: 4 * venues[0].hourlyRate,
        paymentStatus: 'rejected',
        utrNumber: 'INVALID_UTR_000',
        status: 'Rejected',
        rejectedAt: new Date(),
        rejectedBy: adminUser._id,
        rejectionReason: 'Exceeds campus noise curfew and operates outside authorized building hours (after 11:00 PM).'
      }
    ]);
    console.log(` Created ${bookings.length} realistic booking records across various lifecycle states.`);

    // 5. Create Maintenance Blocks
    const maintenance = await MaintenanceBlock.create([
      {
        venue: venues[0]._id, // Grand Auditorium
        title: 'Stage Lighting Rigging & Sound Acoustic Calibration',
        reason: 'Semi-annual calibration of overhead beam light arrays and DSP surround processors.',
        blockDate: dayAfterTomorrow,
        startTime: '08:00',
        endTime: '14:00',
        blockedBy: adminUser._id,
        status: 'Active'
      },
      {
        venue: venues[4]._id, // Executive Boardroom
        title: 'Central HVAC Deep Cleaning & Filter Replacement',
        reason: 'Scheduled maintenance of air conditioning compressors and ventilation ducts.',
        blockDate: tomorrow,
        startTime: '13:00',
        endTime: '19:00',
        blockedBy: adminUser._id,
        status: 'Active'
      }
    ]);
    console.log(` Created ${maintenance.length} active maintenance blackout blocks.`);

    // 6. Create Active Payment Setting
    const paymentSetting = await PaymentSetting.create({
      accountHolderName: 'Campus Facilities & Venue Administration',
      bankName: 'State Bank of India',
      accountNumber: '40928172901',
      ifscCode: 'SBIN0001234',
      branchName: 'University Main Campus Branch',
      upiId: 'campusfacilities@sbi',
      instructions: 'Please transfer the exact booking fee and submit your 12-digit UTR/UPI transaction reference.',
      isActive: true,
      updatedBy: adminUser._id
    });
    console.log(` Created default active PaymentSetting (${paymentSetting.upiId}).`);

    console.log('\n=================================================');
    console.log(' DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('=================================================');
    console.log(' DEMO LOGIN CREDENTIALS:');
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
