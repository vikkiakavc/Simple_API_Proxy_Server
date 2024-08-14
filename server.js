const express = require('express');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const morgan = require('morgan');
const dotenv = require('dotenv').config();
const fetch = require('node-fetch');

const app = express();

const PORT = process.env.PORT || 3000;

app.use(morgan('combined'));

const rateLimitMax = process.env.RATE_LIMIT_MAX || 5;
const cacheTTL = process.env.CACHE_TTL || 300; // caching for 5 minutes
const authenticate = process.env.AUTH || 'false';

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,  // per minute
    max: rateLimitMax,
    message: 'Too many requests atm, please try again later.',
    headers: true,
});

const cache = new NodeCache({ stdTTL: cacheTTL, useClones: true });

// middleware for authentication, authenticating against the login/password set in the env
app.use('/api', limiter, (req, res, next) => {
    const auth = { login: process.env.API_USER || '', password: process.env.API_PASS || '' };

    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

    if (login && password && login === auth.login && password === auth.password) {
        return next();
    }

    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Authentication is required!');
});

const publicAPI = "https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m"

app.get('/api', limiter, async (req, res) => {
    const cacheKey = 'apiData';
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        return res.json(cachedData);
    }

    try {
        const response = await fetch(publicAPI);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        cache.set(cacheKey, data);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching data from external API' });
    }
});

app.get('/', function (req, res) {
    res.send('HELLO WORLD!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
