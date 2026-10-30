import test from 'node:test';
import assert from 'node:assert/strict';
import {googleAuthErrorMessage} from '../src/utils/googleAuthErrors.ts';
test('domain rejection identifies the actual host and does not promise manual-email authorization',()=>{
 const message=googleAuthErrorMessage({code:'auth/unauthorized-domain'},'localhost');
 assert.match(message,/localhost/); assert.match(message,/Authorized domains/); assert.match(message,/tidak menghubungkan Google Drive/);
});
test('popup cancellation and network failure give distinct recovery instructions',()=>{
 assert.match(googleAuthErrorMessage({code:'auth/popup-blocked'}),/Izinkan popup/);
 assert.match(googleAuthErrorMessage({code:'auth/popup-closed-by-user'}),/dibatalkan/);
 assert.match(googleAuthErrorMessage({code:'auth/network-request-failed'}),/internet/);
});
test('unknown errors do not leak raw credential-bearing messages',()=>{
 assert.doesNotMatch(googleAuthErrorMessage(new Error('secret-token=example')),/secret-token/);
});
