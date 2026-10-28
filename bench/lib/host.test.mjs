import assert from 'node:assert/strict';
import test from 'node:test';
import { isWsl } from './host.mjs';

test('a WSL kernel is not eligible for decision numbers', () => {
	assert.equal(isWsl('Linux version 6.6.87.2-microsoft-standard-WSL2'), true);
	assert.equal(isWsl('Linux version 6.8.0-45-generic'), false);
});
