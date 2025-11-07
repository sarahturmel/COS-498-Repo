const express = require('express');
const session = require('express-session');
const app = express();
const path = require('path');
const hbs = require('hbs');
const PORT = process.env.PORT || 3000;

// List of users
let users = []

// List of comments
let comments = []

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

// Remove static file serving - nginx will handle this
// app.use(express.static('public')); // Remove this line

// API Routes
// Note: We don't include '/api' in our routes because nginx strips it when formatting
// Home page - now reads session data
app.get('/', (req, res) => {
    let user = {  // We keep the Guest object to act as a default if there is no session
        name: "Guest",
        isLoggedIn: false,
        loginTime: null,
        visitCount: 0
    };
    
    // Check if user is logged in via session
    if (req.session.isLoggedIn) {
        user = {
            name: req.session.username,
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
app.post('/register', (req, res) => {
	const username = req.body.username;
    const password = req.body.password;
	if (users.some(u => u.username === username) == false) {
		users.splice(users.length, 0, { 'username': username, 'password': password });
		res.redirect('/login');
	}
	else { res.render('register', {error : "Please enter a unique username and password" }); }
});

// Login page
app.get('/login', (req, res) => {
    res.render('login');
});

// Handle login form submission - sets session data
app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    
    // Simple authentication (in production, use proper password hashing)
    if (username && password) {
	if (users.some(u => u.username === username && u.password === password)) {
        // Set session data
        req.session.isLoggedIn = true;
        req.session.username = username;
        req.session.loginTime = new Date().toISOString();
        req.session.visitCount = 0;
        
        console.log(`User ${username} logged in at ${req.session.loginTime}`);
        res.redirect('/');
	} else { res.render('login', { error: "Please enter a registered username and password" }); }
    } else { res.render('login', { error: 'Invalid username or password.' }); }
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
	const user = {
        name: req.session.username,
	loggedIn: req.session.isLoggedIn,
        loginTime: req.session.loginTime,
        visitCount: req.session.visitCount || 0
    };
	res.render('comments', {
  comments: JSON.stringify(comments), // convert to JSON string
  user: user
});
});

// New comment form
app.get('/comment/new', (req, res) => {
	if (!req.session.isLoggedIn) {
	res.render('login', { error: "Must be logged in to make a comment" });
        return res.redirect('/login');
    }
	const user = {
        name: req.session.username,
        loginTime: req.session.loginTime,
        visitCount: req.session.visitCount || 0
    };
    
    res.render('newcommentform', { user: user });
});

// Store new comment
app.post('/comment', (req, res) => {
	const text = req.body.text;
	if (!text) {
		res.render('newcommentform', { error: "Please enter a valid comment" });
		return res.redirect('/comment/new'); }
	comments.splice(comments.length, 0, {'author': req.session.username, 'text': text, 'createdAt': new Date() });
	res.redirect('/comments');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

