# Client Portal Encryption — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up StatiCrypt-based per-client HTML encryption with a pre-commit hook that automatically encrypts files in `public-encrypted/` and stages output in `public/`.

**Architecture:** Source HTML lives in `public-encrypted/clients/[name]/` (gitignored, local-only). `scripts/encrypt.js` reads per-client passwords from `.env`, calls StatiCrypt on each `.html` file, and writes self-decrypting HTML to `public/clients/[name]/`. A git pre-commit hook runs the script automatically before every commit and stages the encrypted output.

**Tech Stack:** Node.js 18+, staticrypt@^2.3.3, dotenv@^16.4.5, node:test (built-in)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Create | Node project config and dependencies |
| `.gitignore` | Create | Ignore `.env`, `public-encrypted/`, `node_modules/` |
| `.env.example` | Create | Template showing how to populate `.env` |
| `scripts/encrypt.js` | Create | Reads `.env`, encrypts all client HTML, exits non-zero on failure |
| `tests/encrypt.test.js` | Create | Unit tests for the two pure helper functions |
| `.git/hooks/pre-commit` | Create | Runs encrypt.js and stages `public/` before every commit |

`.env` is generated locally and never committed.

---

### Task 1: Initialize Node project and install dependencies

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "mark-smart-traffic-github-io",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "encrypt": "node scripts/encrypt.js",
    "test": "node --test tests/encrypt.test.js"
  },
  "devDependencies": {
    "dotenv": "^16.4.5",
    "staticrypt": "^2.3.3"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 3: Verify staticrypt is available**

Run: `node node_modules/.bin/staticrypt --help`

Expected: Usage output starting with `Usage: staticrypt [options] <filename> <passphrase>` (v2 CLI signature).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: initialize Node project with staticrypt and dotenv"
```

---

### Task 2: Set up .gitignore, .env.example, and folder structure

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `public-encrypted/clients/` (directory, not committed)
- Create: `public/clients/.gitkeep`

- [ ] **Step 1: Create .gitignore**

```
node_modules/
.env
public-encrypted/
```

- [ ] **Step 2: Create .env.example**

```bash
# Generate MASTER_SECRET: node -e "require('crypto').randomBytes(32).toString('hex')"
MASTER_SECRET=replace_with_64_char_hex

# One entry per client. Folder name uppercased, hyphens become underscores.
# Generate a password: node -e "require('crypto').randomBytes(16).toString('hex')"
CLIENT_ACME_PASSWORD=replace_with_32_char_hex
```

- [ ] **Step 3: Create the folder structure**

```bash
mkdir -p public-encrypted/clients
mkdir -p public/clients
```

- [ ] **Step 4: Create a .gitkeep so public/clients/ is committed**

Create `public/clients/.gitkeep` as an empty file.

- [ ] **Step 5: Verify public-encrypted/ is ignored**

Run: `git status`

Expected: `public-encrypted/` does NOT appear in the output. `public/clients/.gitkeep` and `.env.example` DO appear as untracked.

- [ ] **Step 6: Commit**

```bash
git add .gitignore .env.example public/clients/.gitkeep
git commit -m "chore: add gitignore, env example, and folder structure"
```

---

### Task 3: Generate secrets and create .env

**Files:**
- Create: `.env` (local only, never committed)

- [ ] **Step 1: Generate MASTER_SECRET**

Run:
```bash
node -e "console.log('MASTER_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output line.

- [ ] **Step 2: Generate CLIENT_ACME_PASSWORD**

Run:
```bash
node -e "console.log('CLIENT_ACME_PASSWORD=' + require('crypto').randomBytes(16).toString('hex'))"
```

Copy the output line.

- [ ] **Step 3: Write .env**

Create `.env` at the project root with the two copied values:

```bash
MASTER_SECRET=<paste 64-char hex from Step 1>

CLIENT_ACME_PASSWORD=<paste 32-char hex from Step 2>
```

- [ ] **Step 4: Verify .env is gitignored**

Run: `git status`

Expected: `.env` does NOT appear in any output section.

---

### Task 4: Write failing tests for encrypt.js helpers

**Files:**
- Create: `tests/encrypt.test.js`

The two functions under test are pure and dependency-injectable:
- `envVarName(clientName)` — converts a folder name to the expected env var name
- `getClientPassword(clientName, env)` — looks up the password or throws a descriptive error

- [ ] **Step 1: Create the test file**

Create `tests/encrypt.test.js`:

```javascript
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { envVarName, getClientPassword } = require('../scripts/encrypt');

test('envVarName converts simple name', () => {
  assert.equal(envVarName('acme'), 'CLIENT_ACME_PASSWORD');
});

test('envVarName uppercases and appends suffix', () => {
  assert.equal(envVarName('globex'), 'CLIENT_GLOBEX_PASSWORD');
});

test('envVarName converts hyphens to underscores', () => {
  assert.equal(envVarName('big-client'), 'CLIENT_BIG_CLIENT_PASSWORD');
});

test('getClientPassword returns password when env var is set', () => {
  const env = { CLIENT_ACME_PASSWORD: 'secret123' };
  assert.equal(getClientPassword('acme', env), 'secret123');
});

test('getClientPassword throws with descriptive message when env var is missing', () => {
  assert.throws(
    () => getClientPassword('acme', {}),
    { message: 'Missing env var: CLIENT_ACME_PASSWORD (required for client "acme")' }
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: All 5 tests fail with `Error: Cannot find module '../scripts/encrypt'` (the file doesn't exist yet).

---

### Task 5: Implement encrypt.js to make tests pass

**Files:**
- Create: `scripts/encrypt.js`

- [ ] **Step 1: Create the scripts/ directory**

```bash
mkdir -p scripts
```

- [ ] **Step 2: Create scripts/encrypt.js**

```javascript
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

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

function encryptClient(clientName) {
  const password = getClientPassword(clientName);
  const sourceDir = path.join(SOURCE_DIR, clientName);
  const outputDir = path.join(OUTPUT_DIR, clientName);

  fs.mkdirSync(outputDir, { recursive: true });

  const htmlFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.html'));

  for (const file of htmlFiles) {
    const inputFile = path.join(sourceDir, file);
    const outputFile = path.join(outputDir, file);
    execFileSync(process.execPath, [
      require.resolve('staticrypt'),
      inputFile,
      password,
      '-o', outputFile
    ], { stdio: 'inherit' });
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
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test`

Expected output:
```
✓ envVarName converts simple name
✓ envVarName uppercases and appends suffix
✓ envVarName converts hyphens to underscores
✓ getClientPassword returns password when env var is set
✓ getClientPassword throws with descriptive message when env var is missing
```

All 5 tests must pass before continuing.

- [ ] **Step 4: Commit**

```bash
git add scripts/encrypt.js tests/encrypt.test.js
git commit -m "feat: add encryption script and unit tests"
```

---

### Task 6: Install the pre-commit hook

**Files:**
- Create: `.git/hooks/pre-commit`

The hook must have LF line endings and be executable. Git for Windows uses its bundled bash to run hooks, so CRLF will break the shebang line.

- [ ] **Step 1: Write the hook file with correct line endings**

Run this Node one-liner (writes LF endings regardless of OS):

```bash
node -e "require('fs').writeFileSync('.git/hooks/pre-commit', '#!/bin/sh\nnode scripts/encrypt.js || exit 1\ngit add public/\n')"
```

- [ ] **Step 2: Make the hook executable**

Run: `git update-index --chmod=+x .git/hooks/pre-commit`

(This tells Git the file is executable without changing the working-tree file — relevant on Windows where `chmod` has no effect on NTFS.)

- [ ] **Step 3: Verify the hook content**

Run: `node -e "console.log(require('fs').readFileSync('.git/hooks/pre-commit', 'utf8'))"`

Expected (no `\r` characters):
```
#!/bin/sh
node scripts/encrypt.js || exit 1
git add public/
```

---

### Task 7: End-to-end smoke test

Verify the full pipeline: source file → pre-commit hook → encrypted output staged automatically.

- [ ] **Step 1: Create a sample source page for the acme client**

Create `public-encrypted/clients/acme/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Acme Client Portal</title>
</head>
<body>
  <h1>Acme — Confidential Report</h1>
  <p>This content is encrypted.</p>
</body>
</html>
```

- [ ] **Step 2: Run the encryption script directly to verify it works**

Run: `npm run encrypt`

Expected output:
```
Encrypting acme...
  + index.html
Done.
```

Verify the output file exists:

Run: `node -e "console.log(require('fs').existsSync('public/clients/acme/index.html'))"`

Expected: `true`

- [ ] **Step 3: Verify the output is a StatiCrypt-wrapped page (not plain HTML)**

Run: `node -e "const f=require('fs').readFileSync('public/clients/acme/index.html','utf8');console.log(f.includes('staticrypt'))"`

Expected: `true`

- [ ] **Step 4: Test the pre-commit hook end-to-end**

Delete the generated output to simulate a clean state, then use an empty commit to trigger the hook:

```bash
node -e "require('fs').unlinkSync('public/clients/acme/index.html')"
git commit --allow-empty -m "feat: add acme client encrypted portal"
```

Expected: The hook fires, re-encrypts `public-encrypted/clients/acme/index.html`, stages the result, and the commit succeeds. The commit should include `public/clients/acme/index.html` as a new file.

Verify:

Run: `git show --name-only HEAD`

Expected to include `public/clients/acme/index.html` in the changed files.

---

## Adding a New Client (Reference)

1. Create `public-encrypted/clients/[name]/` and add `.html` files.
2. Generate a password: `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`
3. Add `CLIENT_[NAME]_PASSWORD=<generated>` to `.env` (uppercase name, hyphens → underscores).
4. Run `git commit` — the hook encrypts, stages, and includes the output automatically.
