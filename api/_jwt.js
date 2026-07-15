const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'rutafacil-secret-local-development-only-2026';

function sign(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${base64Header}.${base64Payload}`)
    .digest('base64url');
    
  return `${base64Header}.${base64Payload}.${signature}`;
}

function verify(token) {
  try {
    const [base64Header, base64Payload, signature] = token.split('.');
    const computedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${base64Header}.${base64Payload}`)
      .digest('base64url');
      
    if (signature !== computedSignature) return null;
    
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp * 1000) return null; // exp is in seconds in standard JWT
    
    return payload;
  } catch {
    return null;
  }
}

module.exports = { sign, verify };
