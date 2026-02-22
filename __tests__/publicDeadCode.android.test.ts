/**
 * Android profile integration tests.
 */

import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import { detectPublicDeadCodeInFiles } from '../src/publicDeadCodeDetector.js';
import { resolveProfiles } from '../src/profileConfig.js';
import { resolveFilePaths } from '../src/resolveFilePaths.js';

const KOTLIN_FIXTURE_ROOT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  'fixtures/kotlin/public_dead_code'
);

function getKotlinFiles(subdir: string) {
  const dir = path.join(KOTLIN_FIXTURE_ROOT, subdir);
  return { dir, files: resolveFilePaths([dir], '.kt').resolved };
}

const androidRules = resolveProfiles(['android'], {});

describe('Android profile integration', () => {
  const { dir, files } = getKotlinFiles('android_profile');

  it('onCreate method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', androidRules, [dir], ['android']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('onCreate');
  });

  it('onDestroy method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', androidRules, [dir], ['android']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('onDestroy');
  });

  it('onResume method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', androidRules, [dir], ['android']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('onResume');
  });

  it('all remaining Android lifecycle methods are NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', androidRules, [dir], ['android']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    const lifecycleMethods = [
      'onStart', 'onPause', 'onStop', 'onCreateView', 'onViewCreated',
      'onAttach', 'onDetach', 'onReceive', 'onBind', 'onUnbind', 'onRebind',
      'onSaveInstanceState', 'onRestoreInstanceState', 'onActivityResult',
      'onOptionsItemSelected', 'onCreateOptionsMenu', 'onRequestPermissionsResult',
      'onBackPressed',
    ];
    for (const method of lifecycleMethods) {
      expect(allNames).not.toContain(method);
    }
  });

  it('custom helper method (not an Android lifecycle) IS reported as dead', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', androidRules, [dir], ['android']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('customHelper');
  });
});
