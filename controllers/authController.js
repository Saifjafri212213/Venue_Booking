/**
 * Auth Controller
 * Handles registration, login, demo accounts, and logout.
 */
const User = require('../models/User');

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

    req.flash('success_msg', 'Registration successful! Welcome to the platform.');
    if (newUser.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else {
      return res.redirect('/organiser/dashboard');
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.render('auth/register', {
      title: 'Create Account - Venue & Event Management System',
      formData: req.body,
      error_msg: 'Registration failed due to a server error. Please verify your details.'
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
