import fs from 'fs';
import path from 'path';

async function runPWAVerificationTests() {
  console.log('================================================================');
  console.log('--- STARTING PWA & MOBILE INSTALLABILITY VERIFICATION (PHASE 5) ---');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  };

  const rootDir = path.join(__dirname, '../../../');
  const frontendPublic = path.join(rootDir, 'frontend/public');
  const indexHtmlPath = path.join(rootDir, 'frontend/index.html');

  // TEST 1: Manifest File Exists
  console.log('[TEST 1] Checking manifest.json existence...');
  const manifestPath = path.join(frontendPublic, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'manifest.json file exists in frontend/public');

  // TEST 2: Manifest JSON Parse & Validity
  console.log('\n[TEST 2] Parsing manifest.json...');
  let manifest: any = null;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(raw);
    assert(true, 'manifest.json is valid JSON');
  } catch (err) {
    assert(false, 'manifest.json failed JSON parsing');
  }

  // TEST 3: Required Manifest Fields
  console.log('\n[TEST 3] Validating required manifest properties...');
  if (manifest) {
    assert(manifest.name === 'THEIAKSHI ENTERPRISE HRMS', 'manifest.name matches application title');
    assert(manifest.short_name === 'THEIAKSHI', 'manifest.short_name set correctly');
    assert(manifest.display === 'standalone', 'display is configured to standalone');
    assert(manifest.start_url === '/', 'start_url set to /');
    assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'manifest contains required installable icon definitions');
  }

  // TEST 4: Icon File Resolution on Disk
  console.log('\n[TEST 4] Verifying icon files resolution...');
  const icon192 = path.join(frontendPublic, 'icons/icon-192x192.png');
  const icon512 = path.join(frontendPublic, 'icons/icon-512x512.png');
  const maskable = path.join(frontendPublic, 'icons/maskable-512x512.png');
  assert(fs.existsSync(icon192), 'icon-192x192.png resolves on disk');
  assert(fs.existsSync(icon512), 'icon-512x512.png resolves on disk');
  assert(fs.existsSync(maskable), 'maskable-512x512.png resolves on disk');

  // TEST 5: index.html Manifest Reference & Mobile Meta Tags
  console.log('\n[TEST 5] Validating frontend/index.html PWA tags...');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(indexHtml.includes('rel="manifest" href="/manifest.json"'), 'index.html contains manifest link tag');
  assert(indexHtml.includes('name="theme-color" content="#0f172a"'), 'index.html contains theme-color meta tag');
  assert(indexHtml.includes('apple-mobile-web-app-capable'), 'index.html contains iOS Safari mobile web app meta tags');

  // TEST 6: Service Worker File Existence & Security Rules
  console.log('\n[TEST 6] Inspecting sw.js Service Worker...');
  const swPath = path.join(frontendPublic, 'sw.js');
  assert(fs.existsSync(swPath), 'sw.js service worker file exists in frontend/public');
  const swContent = fs.readFileSync(swPath, 'utf8');
  assert(swContent.includes('/api/'), 'sw.js contains API route bypass filter to prevent caching sensitive HR data');

  // TEST 7: SPA Fallback Configurations
  console.log('\n[TEST 7] Inspecting SPA Fallback Configurations...');
  const redirectsPath = path.join(frontendPublic, '_redirects');
  const fallbackPath = path.join(frontendPublic, '404.html');
  assert(fs.existsSync(redirectsPath) || fs.existsSync(fallbackPath), 'SPA fallback mechanism (_redirects / 404.html) present');

  console.log('\n================================================================');
  console.log(`--- PWA VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runPWAVerificationTests();
