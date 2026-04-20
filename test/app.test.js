const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('Environment and Configuration Tests', async (t) => {
    
    await t.test('Server file exists and is accessible', () => {
        const serverPath = path.join(__dirname, '../server.js');
        const exists = fs.existsSync(serverPath);
        assert.strictEqual(exists, true, 'server.js must exist in the root directory');
    });

    await t.test('Package.json defines required dependencies', () => {
        const pkgPath = path.join(__dirname, '../package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        
        assert.ok(pkg.dependencies.express, 'Express must be installed for backend proxying');
        assert.strictEqual(pkg.main, 'server.js', 'Main entry point must be server.js');
    });

    await t.test('PWA Manifest is correctly formatted', () => {
        const manifestPath = path.join(__dirname, '../manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        assert.strictEqual(manifest.name, 'VenueIQ');
        assert.strictEqual(manifest.display, 'standalone');
        assert.ok(manifest.icons.length > 0, 'Icons must be defined for PWA installation');
    });
});

test('Frontend AI Prompt Engine Tests', async (t) => {
    
    await t.test('Gemini client module isolates context variables', () => {
        const geminiJS = fs.readFileSync(path.join(__dirname, '../js/gemini.js'), 'utf8');
        
        assert.ok(geminiJS.includes('systemPrompt:'), 'Must transmit system prompt to backend');
        assert.ok(geminiJS.includes('/api/chat'), 'Must route via secure node.js proxy, not directly to Google');
    });

});
