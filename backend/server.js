const express = require('express');
const session = require('express-session');
const app = express();
const path = require('path');
const hbs = require('hbs');
const PORT = process.env.PORT || 3000;
const db = require('./database');
const pw = require('./password-utils');

// Set view engine and views directory
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Register partials directory
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

// Session middleware configuration
app.use(session({
    secret: 'my-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

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
	const hash = await pw.hashPassword(req.body.password);
	const stmt = db.prepare('INSERT INTO users (username, email, password, displayname, failedattempts) VALUES (?, ?, ?, ?, ?)');
    	const result = stmt.run(username, email, hash, displayname, 0);
   	res.redirect('./login');
    } catch (error) {
      	if (error.message.includes('UNIQUE constraint')) {
      		res.status(400).json({ error: 'Email already exists' });
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
app.post('/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    // Simple authentication with hashed password
    try {
	// Find the user
    	const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    	if (user) {
      		 // Compare entered password with stored hash
	        const passwordMatch = await pw.comparePassword(password, user.password);
		if (!passwordMatch) {
			res.status(401).json({ error: 'Password does not match' });
		} else {
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
		return res.redirect('/comment/new'); }
	const matchingUser = db.prepare('SELECT * from users WHERE username = ?').get(req.session.username);
	const stmt = db.prepare('INSERT INTO comments (author, body, timeposted) VALUES (?, ?, ?)');
    	const result = stmt.run(matchingUser.displayname, text, new Date().toISOString());
	res.redirect('/comments');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

