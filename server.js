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
    return crypto.randomBytes(4).toString('base64url'); // ~6 chars
}

/* --------------------------------
   CREATE SHORT LINK (ENCODED OUTPUT)
--------------------------------- */
app.post('/add-redirect', async (req, res) => {
    const { destination } = req.body;

    if (!destination || !/^https?:\/\//i.test(destination)) {
        return res.status(400).json({ message: 'Invalid destination URL.' });
    }

    const key = generateShortKey();
    await db.addRedirect(key, destination);

    const protocol = req.protocol + '://';
    const host = req.get('host');

    // Encode ONLY the domain (safe + URL-valid)
    const encodedHost = host
        .replace(/\./g, '%2E')
        .replace(/o/g, '%6F')   // optional: mimics your example style
        .replace(/c/g, '%63')
        .replace(/m/g, '%6D');

    const encodedUrl = `${protocol}${encodedHost}/${key}`;

    res.json({
        redirectUrl: encodedUrl
    });
});

/* --------------------------------
   SHORT REDIRECT
--------------------------------- */
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
