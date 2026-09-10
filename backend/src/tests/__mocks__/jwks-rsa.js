/**
 * __mocks__/jwks-rsa.js
 *
 * Manual Jest mock for jwks-rsa.
 *
 * jwks-rsa depends on 'jose' which is an ESM-only package.
 * Jest runs in CommonJS mode and cannot load ESM modules natively.
 *
 * This mock replaces jwks-rsa with a CommonJS-compatible stub that:
 * - Returns a jwksClient factory function
 * - The stub's getSigningKey always calls back with an error so that
 *   Microsoft SSO tests correctly fail (as expected — no live JWKS in tests)
 *
 * This DOES NOT weaken any security control. The real jwks-rsa is used
 * in production. This mock only exists to allow the Jest suite to load
 * the module graph without crashing on the ESM boundary.
 *
 * Microsoft SSO verification is separately tested via integration tests
 * that use the real jwks-rsa against a live JWKS endpoint (classified tests).
 */

function jwksClient(options) {
  return {
    getSigningKey: function(kid, callback) {
      // In tests, Microsoft SSO is not available.
      // Calls to verifyMicrosoftToken() are either:
      //   (a) not invoked (tests use email/password or JWT Bearer auth)
      //   (b) expected to fail with a controlled error
      const err = new Error('[jwks-rsa mock] JWKS not available in test environment');
      err.name = 'JwksRsaError';
      callback(err, null);
    }
  };
}

// Mimic the CommonJS export shape of jwks-rsa
jwksClient.JwksClient = function() {};

module.exports = jwksClient;
module.exports.default = jwksClient;
