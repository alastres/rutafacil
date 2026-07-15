const fs = require('fs');
const path = require('path');

// En serverless, /tmp es el único directorio con permisos de escritura garantizados
const DB_PATH = path.join('/tmp', 'rutafacil_db.json');

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      // Estado inicial mock con usuarios PRO y FREE registrados para demostración
      const initial = {
        users: {
          'pro@rutafacil.com': { email: 'pro@rutafacil.com', tier: 'pro', active: true },
          'free@rutafacil.com': { email: 'free@rutafacil.com', tier: 'free', active: false }
        },
        otps: {}
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { users: {}, otps: {} };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error de escritura en DB mock:", err);
  }
}

module.exports = {
  getUser: (email) => {
    const db = readDb();
    return db.users[email.toLowerCase()] || null;
  },
  setUserPro: (email, active = true) => {
    const db = readDb();
    db.users[email.toLowerCase()] = { email: email.toLowerCase(), tier: active ? 'pro' : 'free', active };
    writeDb(db);
  },
  saveOtp: (email, otp) => {
    const db = readDb();
    db.otps[email.toLowerCase()] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };
    writeDb(db);
  },
  verifyOtp: (email, otp) => {
    const db = readDb();
    const entry = db.otps[email.toLowerCase()];
    if (!entry) return false;
    if (entry.otp === otp && Date.now() < entry.expiresAt) {
      delete db.otps[email.toLowerCase()];
      writeDb(db);
      return true;
    }
    return false;
  }
};
