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
