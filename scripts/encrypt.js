'use strict';
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Call staticrypt's crypto lib directly — the CLI is broken on Node 24 due to a yargs API removal.
const STATICRYPT_ROOT = path.join(__dirname, '..', 'node_modules', 'staticrypt');
const cryptoEngine = require(path.join(STATICRYPT_ROOT, 'lib', 'cryptoEngine', 'cryptojsEngine'));
const { encode } = require(path.join(STATICRYPT_ROOT, 'lib', 'codec-sync')).init(cryptoEngine);
const { renderTemplate } = require(path.join(STATICRYPT_ROOT, 'lib', 'formater'));
const PASSWORD_TEMPLATE_PATH = path.join(STATICRYPT_ROOT, 'lib', 'password_template.html');

const CRYPTOJS_CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.min.js" integrity="sha384-lp4k1VRKPU9eBnPePjnJ9M2RF3i7PC30gXs70+elCVfgwLwx1tv5+ctxdtwxqZa7" crossorigin="anonymous"></script>';

const ROOT = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'public-encrypted', 'clients');
const OUTPUT_DIR = path.join(ROOT, 'public', 'clients');

function envVarName(clientName) {
  return `CLIENT_${clientName.toUpperCase().replace(/-/g, '_')}_PASSWORD`;
}

function getClientPassword(clientName, env = process.env) {
  const varName = envVarName(clientName);
  const password = env[varName];
  if (!password) {
    throw new Error(`Missing env var: ${varName} (required for client "${clientName}")`);
  }
  return password;
}

function convertCommonJSToBrowserJS(moduleRelPath) {
  const resolvedPath = path.join(STATICRYPT_ROOT, ...moduleRelPath.split('/')) + '.js';
  const moduleText = fs.readFileSync(resolvedPath, 'utf8').replace(/^.*\brequire\(.*$\n/gm, '');
  return `((function(){\n  const exports = {};\n  ${moduleText}\n  return exports;\n})())`.trim();
}

function encryptFile(inputFile, outputFile, password) {
  const contents = fs.readFileSync(inputFile, 'utf8');
  const salt = cryptoEngine.generateRandomSalt();
  const encryptedMessage = encode(contents, password, salt);

  const codecString = convertCommonJSToBrowserJS('lib/codec-sync').replace('##SALT##', salt);
  const cryptoEngineString = convertCommonJSToBrowserJS('lib/cryptoEngine/cryptojsEngine');

  const data = {
    crypto_tag: CRYPTOJS_CDN,
    decrypt_button: 'DECRYPT',
    embed: false,
    encrypted: encryptedMessage,
    instructions: '',
    is_remember_enabled: 'true',
    js_codec: codecString,
    js_crypto_engine: cryptoEngineString,
    label_error: 'Bad passphrase!',
    passphrase_placeholder: 'Passphrase',
    remember_duration_in_days: 0,
    remember_me: 'Remember me',
    salt: salt,
    title: '',
  };

  const template = fs.readFileSync(PASSWORD_TEMPLATE_PATH, 'utf8');
  fs.writeFileSync(outputFile, renderTemplate(template, data));
}

function encryptClient(clientName) {
  const password = getClientPassword(clientName);
  const sourceDir = path.join(SOURCE_DIR, clientName);
  const outputDir = path.join(OUTPUT_DIR, clientName);

  fs.mkdirSync(outputDir, { recursive: true });

  const htmlFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.html'));

  for (const file of htmlFiles) {
    encryptFile(path.join(sourceDir, file), path.join(outputDir, file), password);
    console.log(`  + ${file}`);
  }
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.log('No public-encrypted/clients/ directory — nothing to encrypt.');
    return;
  }

  const clients = fs.readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  if (clients.length === 0) {
    console.log('No client directories found.');
    return;
  }

  for (const client of clients) {
    console.log(`Encrypting ${client}...`);
    encryptClient(client);
  }

  console.log('Done.');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { envVarName, getClientPassword };
