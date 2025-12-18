// This file is the main controller of all the routes

const express = require('express');
const session = require('express-session');
const app = express();
const path = require('path');
const hbs = require('hbs');
const PORT = process.env.PORT || 3000;
const db = require('./modules/database');
const pw = require('./modules/password-utils');
const loginTracker = require('./modules/login-tracker');
const { checkLoginLockout, getClientIP } = require('./modules/auth-middleware');
const { Server } = require('socket.io');
const http = require('http');
const server = http.createServer(app);


// Set view engine and views directory
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Register partials directory
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

// Session middleware configuration
const sessionMiddleware = session({
    secret: 'my-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});

app.use(sessionMiddleware);

// API Routes

// Home page - reads session data
app.get('/', (req, res) => {
    let user = {  // Guest object to act as a default if there is no session
        name: "Guest",
        isLoggedIn: false,
        loginTime: null,
        visitCount: 0
    };
    // Check if user is logged in via session
    if (req.session.isLoggedIn) {
	const matchingUser = db.prepare('SELECT * from users WHERE username = ?').get(req.session.username);
        user = {
            name: matchingUser.displayname,
            isLoggedIn: true,
            loginTime: req.session.loginTime,
            visitCount: req.session.visitCount || 0
        };
        // Increment visit count
        req.session.visitCount = (req.session.visitCount || 0) + 1;
    }
    res.render('home', { user: user });
});

// Render registration
app.get('/register', (req, res) => {
	res.render('register');
});

// Create account
app.post('/register', async (req, res) => {
    try {
    	const { username, email, password, displayname } = req.body;
	const validation = await pw.validatePassword(password);
	if (!validation.valid) {
		res.status(401).json({ error: `Errors: ${validation.errors}`});
	} else {
	const hash = await pw.hashPassword(password);
	const stmt = db.prepare('INSERT INTO users (username, email, password, displayname, namecolor, bio) VALUES (?, ?, ?, ?, ?, ?)');
    	const result = stmt.run(username, email, hash, displayname, '#000000', 'No bio');
   	res.redirect('./login');
	}
    } catch (error) {
      	if (error.message.includes('UNIQUE constraint')) {
      		res.status(400).json({ error: 'Email or username already in use' });
    	} else {
      		res.status(500).json({ error: error.message });
    	}
    }
});

// Login page
app.get('/login', (req, res) => {
    res.render('login');
});

// Handle login form submission - sets session data
app.post('/login', checkLoginLockout, async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const ipAddress = getClientIP(req);

    // Validate input
    if (!username || !password) {
      // Record failed attempt if username is provided
      if (username) {
        loginTracker.recordAttempt(ipAddress, username, false);
      }
      return res.status(400).json({error: 'Username and password are required'});
    }
    // Simple authentication with hashed password
    try {
	// Find the user
    	const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
	if (!user) {
      		// Record failed attempt (user doesn't exist)
      		loginTracker.recordAttempt(ipAddress, username, false);
      		return res.status(401).json({ error: 'Invalid username or password'});
        }
    	if (user) {
      		 // Compare entered password with stored hash
	        const passwordMatch = await pw.comparePassword(password, user.password);
		if (!passwordMatch) {
			// Record failed attempt (wrong password)
      			loginTracker.recordAttempt(ipAddress, username, false);
      			return res.status(401).json({ error: 'Invalid username or password' });
		} else {
			// Successful login
			loginTracker.recordAttempt(ipAddress, username, true);

    			// Update last login time
    			db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE username = ?').run(user.username);

			// Set session data
        		req.session.isLoggedIn = true;
        		req.session.username = username;
        		req.session.loginTime = new Date().toISOString();
        		req.session.visitCount = 0;
			const stmt = db.prepare('INSERT INTO sessions (username, starttime) VALUES (?, ?)');
    			const result = stmt.run(username, req.session.loginTime);
    			res.redirect('/');
		}
	} else {
      	res.status(404).json({ error: 'User not found' });
    	}
    } catch (error) {
    	res.status(500).json({ error: error.message });
    }
});

// Logout route
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log('Error destroying session:', err);
        }
        res.redirect('/');
    });
});

// Show all comments and authors
app.get('/comments', (req, res) => {
	try {
		let user = {  // Guest object to act as a default if there is no session
			name: "Guest",
			isLoggedIn: false
		};
		// Check if user is logged in via session
		if (req.session.isLoggedIn) {
		const matchingUser = db.prepare('SELECT * from users WHERE username = ?').get(req.session.username);
			user = {
				name: matchingUser.displayname,
				isLoggedIn: true,
			};
		}
    	const comments = db.prepare('SELECT * FROM comments').all();
    	res.render('comments', { comments: JSON.stringify(comments), user: user });
  	} catch (error) {
    		res.status(500).json({ error: error.message });
  	}
});

// New comment form
app.get('/comment/new', (req, res) => {
	if (!req.session.isLoggedIn) {
		res.render('login', { error: "Must be logged in to make a comment" });
        return res.redirect('/login');
    }
	let user = {  // Guest object to act as a default if there is no session
                name: "Guest", isLoggedIn: false };
	// Check if user is logged in via session
	if (req.session.isLoggedIn) {
		const matchingUser = db.prepare('SELECT * from users WHERE username = ?').get(req.session.username);
		user = {
			name: matchingUser.displayname,
			isLoggedIn: true,
		};
	}
    	res.render('newcommentform', { user: user });
});

// Store new comment
app.post('/comment', (req, res) => {
	const text = req.body.text;
	if (!text) {
		res.render('newcommentform', { error: "Please enter a valid comment" });
		return res.redirect('/comment/new');
	}
	const matchingUser = db.prepare('SELECT * from users WHERE username = ?').get(req.session.username);
	const stmt = db.prepare('INSERT INTO comments (author, body, timeposted, color) VALUES (?, ?, ?, ?)');
    const result = stmt.run(matchingUser.displayname, text, new Date().toISOString(), matchingUser.namecolor);
	res.redirect('/comments');
});

// Visit your profile page
app.get('/profile', (req, res) => {
	if (req.session.isLoggedIn) {
		const matchingUser = db.prepare('SELECT * from users WHERE username = ?').get(req.session.username);
		res.render('profile', { user: matchingUser });
	} else {
		res.render('login', { error: "Must be logged in to view profile." });
        return res.redirect('/login');
	}
});

// Save changes to profile
app.post('/profile', (req, res) => {
	const { displayname, bio, namecolor } = req.body;
	db.prepare('UPDATE users SET displayname = ?, bio = ?, namecolor = ? WHERE username = ?').run(displayname, bio, namecolor, req.session.username);
	res.redirect('/profile');
});

// Visit chat
app.get('/chat', (req, res) => {
	if (!req.session.isLoggedIn) {
        return res.render('login', { error: "Must be logged in to view chat." });
    }
    const matchingUser = db.prepare('SELECT * from users WHERE username = ?').get(req.session.username);
    res.render('chat', { user: matchingUser });
});

// Create Socket.IO server
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Share session with Socket.IO (official method)
io.engine.use(sessionMiddleware);

// Now session is available in socket.request.session
io.on('connection', (socket) => {
	const req = socket.request;
    const session = socket.request.session;
    const username = session.username;
    const isLoggedIn = session.isLoggedIn;

	// Periodically reload session to check expiration
    const timer = setInterval(() => {
        req.session.reload((err) => {
            if (err) {
                // Session expired or error - force reconnect
                socket.conn.close();
                clearInterval(timer);
            }
        });
    }, 30 * 1000);
    
    // Authentication check
    if (!isLoggedIn) {
        socket.emit('error', { message: 'Authentication required' });
        socket.disconnect();
        return;
    }
	console.log('Client connected:', socket.id);
    console.log('User:', username);
	const matchingUser = db.prepare('SELECT * from users WHERE username = ?').get(username);
    
    // Send welcome message
    socket.emit('connected', {
        message: `Welcome ${matchingUser.displayname}!`,
        loginTime: session.loginTime
    });
    
    // Listen for authenticated requests
    socket.on('getUserInfo', () => {
        socket.emit('userInfo', { matchingUser });
    });
    
    socket.on('sendMessage', (data) => {
        // Broadcast message with user info
        io.emit('message', {
            displayname: matchingUser.displayname,
            namecolor: matchingUser.namecolor,
            message: data.message,
            timestamp: new Date().toISOString()
        });
    });
    
    socket.on('disconnect', () => {
        clearInterval(timer);
    });

	socket.on('updateCount', () => {
        // Reload session to get latest data
        req.session.reload((err) => {
            if (err) {
                return socket.disconnect();
            }
            
            // Modify session
            req.session.count = (req.session.count || 0) + 1;
            
            // Save session
            req.session.save();
            
            // Emit updated count
            socket.emit('countUpdated', { count: req.session.count });
        });
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
