require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'interest-cohort=()');
    res.setHeader('Cache-Control', 'no-store');
    next();
});

function generateShortKey() {
    return crypto.randomBytes(4).toString('base64url');
}

app.post('/add-redirect', async (req, res) => {
    try {
        const { destination } = req.body;
        if (!destination || !/^https?:\/\//i.test(destination)) {
            return res.status(400).json({ message: 'Invalid destination URL' });
        }

        const key = generateShortKey();
        await db.addRedirect(key, destination);

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        res.json({ redirectUrl: `${baseUrl}/${key}` });
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/:key', async (req, res) => {
    const ua = req.headers['user-agent'] || '';
    if (/curl|wget|scanner|python|headless/i.test(ua)) {
        return res.status(404).send('Not found');
    }

    const row = await db.getRedirect(req.params.key);
    if (!row) return res.status(404).send('Not found');

    res.redirect(302, row.destination);
});

app.use((req, res) => res.status(404).send('Not found'));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});