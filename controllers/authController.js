/**
 * Auth Controller
 * Handles registration, login, demo accounts, and logout.
 */
const User = require('../models/User');
const Booking = require('../models/Booking');

// Helper: If user has a pending draft booking in session, instantiate it and redirect to payment
const handlePendingBooking = async (req, user) => {
  if (req.session && req.session.pendingBooking) {
    try {
      const draft = req.session.pendingBooking;
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const bookingReference = `EVT-${new Date().getFullYear()}-${randomSuffix}`;
      const paymentExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const newBooking = new Booking({
        bookingReference,
        venue: draft.venueId,
        organiser: user._id || user.id,
        eventTitle: draft.eventTitle,
        eventType: draft.eventType,
        description: draft.description || '',
        expectedAttendees: Number(draft.expectedAttendees) || 1,
        bookingDate: new Date(draft.bookingDate),
        startTime: draft.startTime,
        endTime: draft.endTime,
        durationHours: draft.durationHours,
        hourlyRate: draft.hourlyRate,
        totalCost: draft.totalCost,
        paymentAmount: draft.totalCost,
        paymentStatus: 'unpaid',
        paymentExpiresAt,
        specialFacilities: draft.specialFacilities || [],
        specialRequests: draft.specialRequests || '',
        status: 'Pending'
      });

      await newBooking.save();
      delete req.session.pendingBooking;
      return newBooking;
    } catch (err) {
      console.error('Error instantiating pending booking:', err);
    }
  }
  return null;
};

// Render Login Page
exports.getLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Sign In - Venue & Event Management System',
    email: '',
    role: 'organiser'
  });
};

// Handle User Login
exports.postLogin = async (req, res) => {
  const { email, password, role } = req.body;

  try {
    if (!email || !password) {
      return res.render('auth/login', {
        title: 'Sign In - Venue & Event Management System',
        email,
        role: role || 'organiser',
        error_msg: 'Please provide both email and password'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.render('auth/login', {
        title: 'Sign In - Venue & Event Management System',
        email,
        role: role || 'organiser',
        error_msg: 'Invalid credentials. User not found with this email.'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Sign In - Venue & Event Management System',
        email,
        role: role || 'organiser',
        error_msg: 'Invalid credentials. Incorrect password entered.'
      });
    }

    // Set User Session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      organization: user.organization,
      avatar: user.avatar,
      phone: user.phone
    };

    // Check for pending booking from guest checkout
    const createdBooking = await handlePendingBooking(req, user);
    if (createdBooking) {
      req.flash('success_msg', `Welcome, ${user.name}! Your slot for "${createdBooking.eventTitle}" is held for 15 minutes. Please complete payment.`);
      return res.redirect(`/bookings/${createdBooking._id}/payment`);
    }

    req.flash('success_msg', `Welcome back, ${user.name}!`);

    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else {
      return res.redirect('/organiser/dashboard');
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.render('auth/login', {
      title: 'Sign In - Venue & Event Management System',
      email,
      role: role || 'organiser',
      error_msg: 'An unexpected error occurred during login. Please try again.'
    });
  }
};

// Render Register Page
exports.getRegister = (req, res) => {
  res.render('auth/register', {
    title: 'Create Account - Venue & Event Management System',
    formData: {}
  });
};

// Handle User Registration
exports.postRegister = async (req, res) => {
  const { name, email, password, confirmPassword, role, department, organization, phone } = req.body;

  try {
    if (!name || !email || !password || !confirmPassword) {
      return res.render('auth/register', {
        title: 'Create Account - Venue & Event Management System',
        formData: req.body,
        error_msg: 'Please fill in all required fields marked with an asterisk (*).'
      });
    }

    if (password !== confirmPassword) {
      return res.render('auth/register', {
        title: 'Create Account - Venue & Event Management System',
        formData: req.body,
        error_msg: 'Passwords do not match. Please verify both passwords and try again.',
        passwordMismatch: true
      });
    }

    if (password.length < 6) {
      return res.render('auth/register', {
        title: 'Create Account - Venue & Event Management System',
        formData: req.body,
        error_msg: 'Password must be at least 6 characters long.',
        passwordTooShort: true
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Create Account - Venue & Event Management System',
        formData: req.body,
        error_msg: 'An account with this email address already exists. Please sign in.'
      });
    }

    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role === 'admin' ? 'admin' : 'organiser',
      department: department || 'General',
      organization: organization || 'Campus Community',
      phone: phone || '+1 (555) 019-2834'
    });

    await newUser.save();

    // Auto login after registration
    req.session.user = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      department: newUser.department,
      organization: newUser.organization,
      avatar: newUser.avatar,
      phone: newUser.phone
    };

    // Check for pending booking from guest checkout
    const createdBooking = await handlePendingBooking(req, newUser);
    if (createdBooking) {
      req.flash('success_msg', `Account created! Your slot for "${createdBooking.eventTitle}" is held for 15 minutes. Please complete payment.`);
      return res.redirect(`/bookings/${createdBooking._id}/payment`);
    }

    req.flash('success_msg', 'Registration successful! Welcome to the platform.');
    if (newUser.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else {
      return res.redirect('/organiser/dashboard');
    }
  } catch (error) {
    console.error('Registration error:', error);
    let errorMessage = 'Registration failed. Please verify your details.';
    if (error.code === 11000) {
      errorMessage = 'An account with this email address already exists. Please sign in.';
    } else if (error.name === 'ValidationError') {
      errorMessage = Object.values(error.errors).map((e) => e.message).join(', ');
    } else if (error.message && (error.message.includes('buffering timed out') || error.message.includes('ECONNREFUSED') || error.name === 'MongooseServerSelectionError')) {
      errorMessage = 'Database connection error. Please ensure the MONGO_URI environment variable is configured in Vercel settings.';
    } else if (error.message) {
      errorMessage = `Registration error: ${error.message}`;
    }

    res.render('auth/register', {
      title: 'Create Account - Venue & Event Management System',
      formData: req.body,
      error_msg: errorMessage
    });
  }
};

// Handle Logout
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/auth/login');
  });
};
