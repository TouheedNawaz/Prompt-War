const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Serve all static files from the root directory
// But avoid serving config.js or server.js directly for security
app.use(express.static(__dirname, {
    index: 'index.html',
    setHeaders: (res, path) => {
        if (path.endsWith('config.js') || path.endsWith('server.js')) {
            // Block direct access to config files if they exist locally
            res.status(403).end();
        }
    }
}));

// Provide config securely injected from environment variables if deployed
app.get('/config.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    
    // In local dev, we might have a real config.js, but on Cloud Run we inject via env vars
    const key = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';
    const demo = process.env.DEMO_MODE !== 'false';
    const maps = process.env.GOOGLE_MAPS_API_KEY || '';
    
    res.send(`
        window.CONFIG = {
            GEMINI_API_KEY: 'PROTECTED_ON_SERVER',
            DEMO_MODE: ${demo},
            FIREBASE: {},
            GOOGLE_MAPS_API_KEY: '${maps}',
            EVENT: {
                name:    'IPL 2026 — MI vs CSK',
                venue:   'Wankhede Stadium',
                address: 'Wankhede Stadium, Mumbai, Maharashtra, India',
                kickoff: '19:30 IST',
                sport:   'Cricket',
                teams:   'Mumbai Indians vs Chennai Super Kings',
            }
        };
    `);
});

// The secure AI endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(401).json({ error: 'GEMINI_API_KEY not set on server' });
        }

        const { systemPrompt, history } = req.body;
        
        // Always use standard Pro for reasoning
        const model = 'gemini-2.5-pro';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const requestBody = {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: history,
            generationConfig: {
                temperature: 0.75, topK: 40, topP: 0.95, maxOutputTokens: 512,
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            ],
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: err?.error?.message || 'API Error' });
        }

        const data = await response.json();
        const candidate = data?.candidates?.[0];

        if (!candidate || candidate.finishReason === 'SAFETY') {
            return res.status(400).json({ error: 'Response filtered by safety settings.' });
        }

        const aiText = candidate.content?.parts?.[0]?.text || "I couldn't generate a response.";
        res.json({ text: aiText });

    } catch (error) {
        console.error('[VenueIQ Backend] API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// For Cloud Run Healthchecks and SPA fallback
app.get('/health', (req, res) => res.send('OK'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`[VenueIQ Backend] Server listening on port ${PORT}`);
});
