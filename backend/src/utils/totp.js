const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function generatePlainCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        // 8-character alphanumeric groups (e.g. AB12-CD34)
        const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
        const code = raw.slice(0,4) + '-' + raw.slice(4,8);
        codes.push(code);
    }
    return codes;
}

async function createRecoveryCodes(count = 10) {
    const plain = generatePlainCodes(count);
    const hashed = await Promise.all(plain.map(p => bcrypt.hash(p, 12)));
    const now = new Date();
    const entries = hashed.map(h => ({ codeHash: h, createdAt: now, usedAt: null }));
    return { plain, entries };
}

async function verifyRecoveryCode(code, storedEntries) {
    if (!storedEntries || storedEntries.length === 0) return { ok: false, index: -1 };
    for (let i = 0; i < storedEntries.length; i++) {
        const e = storedEntries[i];
        if (e.usedAt) continue;
        const match = await bcrypt.compare(code, e.codeHash);
        if (match) return { ok: true, index: i };
    }
    return { ok: false, index: -1 };
}

module.exports = { createRecoveryCodes, verifyRecoveryCode };
