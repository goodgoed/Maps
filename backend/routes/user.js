const express = require('express');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

router = express.Router();

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  verificationToken: {
    type: String,
  },
  verified: {
    type: Boolean,
    default: process.env.NODE_ENV === 'production' ? false : true,
  },
});
const User = mongoose.model('User', userSchema);

router.post('/adduser', async (req, res) => {
  console.log('Received /adduser request');

  // Check if username, password, and email are provided
  const { body } = req;
  if (!('username' in body && 'password' in body && 'email' in body)) {
    console.warn('Missing required fields');
    return res.status(200).send({
      status: 'ERROR',
      message: 'Username, password, and email are required',
    });
  }
  const { username, password, email } = req.body;

  // Check if username, password, and email are truthy value
  if (!username || !password || !email) {
    console.warn('Missing required fields');
    return res.status(200).send({
      status: 'ERROR',
      message: 'Username, password, and email are required',
    });
  }

  // Validate email
  const emailRegex = /\S+@\S+\.\S+/;
  if (!emailRegex.test(email)) {
    console.warn('Email is invalid');
    return res.status(200).send({ status: 'ERROR', message: 'Invalid email' });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] }); // Check if the username or email already exists
    if (existingUser) {
      console.warn('User already exists');
      return res
        .status(200)
        .send({ status: 'ERROR', message: 'User already exists' });
    }

    // Create a new user
    const verificationKey = Math.random().toString(36).substring(7); // Generate a random verification key - @todo may need to use crypto.randomBytes
    const newUser = new User({
      username,
      password, // Should be hashed and salted but don't think its required for this assignment
      email,
      verificationToken: verificationKey,
    });
    await newUser.save();

    // Send verification email
    if (process.env.NODE_ENV === 'production') {
      try {
        console.log('Sending verification email');
        const transporter = nodemailer.createTransport({
          port: 25,
          host: 'host.docker.internal',
          secure: false,
          tls: {
            rejectUnauthorized: false,
          },
        });

        const verificationLink = `http://mygroop.cse356.compas.cs.stonybrook.edu/api/verify?email=${encodeURIComponent(email)}&key=${verificationKey}`;
        const mailOptions = {
          from: 'mygroop@cse356.compas.cs.stonybrook.edu',
          to: email,
          subject: 'Account Verification',
          text: `Please click the following link to verify your account: ${verificationLink}`,
        };
        console.debug('Sending verification email: ', verificationLink);
        await transporter.sendMail(mailOptions);
      } catch (error) {
        console.error(error);
        return res.status(500).json({
          status: 'ERROR',
          message:
            'Internal server error. User created but verification email failed to send.',
        });
      }
    }

    res.status(201).send({
      status: 'OK',
      message: 'User created successfully. Check your email for verification.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ status: 'ERROR', message: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  console.log('Received /login request');

  // Check if username or password is provided
  const { body } = req;

  if (!('username' in body && 'password' in body)) {
    console.warn('Missing required fields');
    return res
      .status(200)
      .send({ status: 'ERROR', message: 'Username and password are required' });
  }
  const { username, password } = body;

  // Check if username and password is truthy value
  if (!username || !password) {
    console.warn('Missing required fields');
    return res
      .status(200)
      .send({ status: 'ERROR', message: 'Username and password are required' });
  }

  // Check if user is allowed to login
  const user = await User.findOne({ username });
  if (!user || user.password !== password || !user.verified) {
    console.warn('Invalid username or password');
    return res
      .status(200)
      .send({ status: 'ERROR', message: 'Invalid username or password' });
  }

  // Set session
  console.log('Generating session');
  req.session.regenerate(err => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .send({ status: 'ERROR', message: 'Internal server error' });
    }

    req.session.username = username;
    req.session.save(err => {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .send({ status: 'ERROR', message: 'Internal server error' });
      }

      return res.status(200).send({ status: 'OK', message: 'User logged in' });
    });
  });
});

router.post('/logout', async (req, res) => {
  console.log('Received /logout request');

  // Check if session exists
  if (!('username' in req.session)) {
    console.warn('Missing required fields');
    return res
      .status(200)
      .send({ status: 'ERROR', message: 'User is not logged in' });
  }

  // Clear user-specific data in session
  console.log('Clearing session');
  req.session.username = null;
  // Save the session
  console.log('Saving current session');
  req.session.save(err => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .send({ status: 'ERROR', message: 'Internal server error' });
    }

    // Regenerate the session (invalidate the old one and create a new one)
    console.log('Regenerating session');
    req.session.regenerate(err => {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .send({ status: 'ERROR', message: 'Internal server error' });
      }

      return res.status(200).send({ status: 'OK', message: 'User logged out' });
    });
  });
});

router.post('/user', async (req, res) => {
  console.log('Received /user request');
  if (req.session.username) {
    console.log('User is logged in');
    return res.status(200).send({
      loggedin: true,
      username: req.session.username,
    });
  } else {
    console.log('User is NOT logged in');
    return res.status(200).send({
      loggedin: false,
      username: undefined,
    });
  }
});

router.get('/verify', async (req, res) => {
  console.log('Received /verify request');

  // Check if email and token are provided
  if (!('email' in req.query && 'key' in req.query)) {
    console.warn('Missing required fields');
    return res
      .status(200)
      .send({ status: 'ERROR', message: 'Email and key are required' });
  }
  const { email, key } = req.query;

  // Check if email and token are truthy value
  if (!email || !key) {
    console.warn('Missing required fields');
    return res
      .status(200)
      .send({ status: 'ERROR', message: 'Email and key are required' });
  }

  // Validate email
  const emailRegex = /\S+@\S+\.\S+/;
  if (!emailRegex.test(email)) {
    console.warn('Email is invalid');
    return res.status(200).send({ status: 'ERROR', message: 'Invalid email' });
  }

  //Check if user exists and key is valid
  try {
    const user = await User.findOne({ email, verificationToken: key });
    if (!user) {
      console.warn('Invalid verification link');
      return res
        .status(200)
        .send({ status: 'ERROR', message: 'Invalid verification link' });
    }

    user.verified = true;
    user.verificationToken = '';
    await user.save();
    res
      .status(200)
      .send({ status: 'OK', message: 'User verified successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ status: 'ERROR', message: 'Internal server error' });
  }
});

module.exports = router;
