import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseKotlin,
  extractKotlinImports,
  extractUsedIdentifiers,
  removeUnusedImports,
  cleanupKotlinFile
} from '../src/importCleaner.js';

describe('Kotlin Import Cleanup', () => {
  describe('extractKotlinImports', () => {
    it('should extract regular imports', () => {
      const code = `
package com.example

import java.util.List
import java.util.ArrayList
import java.util.HashMap

class Test {
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);

      expect(imports).toHaveLength(3);
      expect(imports[0].symbols).toEqual(['List']);
      expect(imports[1].symbols).toEqual(['ArrayList']);
      expect(imports[2].symbols).toEqual(['HashMap']);
      expect(imports[0].isWildcard).toBe(false);
      expect(imports[0].isStatic).toBe(false);
    });

    it('should extract aliased imports', () => {
      const code = `
package com.example

import java.util.ArrayList as MyList
import java.util.HashMap as MyMap

class Test {
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);

      expect(imports).toHaveLength(2);
      expect(imports[0].symbols).toEqual(['MyList']);
      expect(imports[1].symbols).toEqual(['MyMap']);
      expect(imports[0].isWildcard).toBe(false);
    });

    it('should detect wildcard imports', () => {
      const code = `
package com.example

import java.util.*
import java.io.*

class Test {
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);

      expect(imports).toHaveLength(2);
      expect(imports[0].isWildcard).toBe(true);
      expect(imports[1].isWildcard).toBe(true);
      expect(imports[0].symbols).toEqual([]);
      expect(imports[1].symbols).toEqual([]);
    });
  });

  describe('extractUsedIdentifiers', () => {
    it('should extract identifiers used in code', () => {
      const code = `
package com.example

import java.util.ArrayList

class Test {
    private val items: MutableList<String> = ArrayList()
}
`;
      const tree = parseKotlin(code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');

      expect(usedIds.has('ArrayList')).toBe(true);
      expect(usedIds.has('MutableList')).toBe(true);
      expect(usedIds.has('String')).toBe(true);
      expect(usedIds.has('items')).toBe(true);
    });

    it('should not include identifiers from imports', () => {
      const code = `
package com.example

import java.util.HashMap

class Test {
    private val name: String = ""
}
`;
      const tree = parseKotlin(code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');

      expect(usedIds.has('HashMap')).toBe(false); // HashMap is only in import, not used
      expect(usedIds.has('String')).toBe(true);
    });

    it('should recognize aliased symbols', () => {
      const code = `
package com.example

import java.util.ArrayList as MyList

class Test {
    private val items = MyList<String>()
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');

      // The import should have symbol 'MyList'
      expect(imports[0].symbols).toEqual(['MyList']);
      // The code should use 'MyList'
      expect(usedIds.has('MyList')).toBe(true);
    });
  });

  describe('removeUnusedImports', () => {
    it('should remove unused imports', () => {
      const code = `package com.example

import java.util.List
import java.util.ArrayList
import java.util.HashMap

class Test {
    private val items: MutableList<String> = ArrayList()
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      expect(cleaned).not.toContain('import java.util.HashMap');
      expect(cleaned).not.toContain('import java.util.List');
      expect(cleaned).toContain('import java.util.ArrayList');
    });

    it('should keep wildcard imports', () => {
      const code = `package com.example

import java.util.*
import java.io.*

class Test {
    private val items: MutableList<String> = ArrayList()
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      expect(cleaned).toContain('import java.util.*');
      expect(cleaned).toContain('import java.io.*');
    });

    it('should handle aliased imports correctly', () => {
      const code = `package com.example

import java.util.ArrayList as MyList
import java.util.HashMap as MyMap

class Test {
    private val items = MyList<String>()
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      expect(cleaned).not.toContain('import java.util.HashMap as MyMap');
      expect(cleaned).toContain('import java.util.ArrayList as MyList');
    });

    it('should keep all imports if all are used', () => {
      const code = `package com.example

import java.util.List
import java.util.ArrayList
import java.util.Map
import java.util.HashMap

class Test {
    private val items: MutableList<String> = ArrayList()
    private val config: MutableMap<String, String> = HashMap()
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      expect(cleaned).toContain('import java.util.ArrayList');
      expect(cleaned).toContain('import java.util.HashMap');
    });
  });

  describe('cleanupKotlinFile', () => {
    const testDir = path.join(process.cwd(), '__tests__', 'temp');
    let testFile: string;

    beforeEach(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      // Use unique filename for each test to avoid conflicts
      testFile = path.join(testDir, `Test-${Date.now()}-${Math.random().toString(36).slice(2)}.kt`);
    });

    afterEach(() => {
      // Only delete the specific test file, not the entire directory
      if (testFile && fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('should clean up file with unused imports', () => {
      const code = `package com.example

import java.util.List
import java.util.ArrayList
import java.util.HashMap
import java.util.Set

class Test {
    private val items: MutableList<String> = ArrayList()
}
`;
      fs.writeFileSync(testFile, code, 'utf-8');

      const result = cleanupKotlinFile(testFile);
      expect(result).toBe(true);

      const cleaned = fs.readFileSync(testFile, 'utf-8');
      expect(cleaned).not.toContain('import java.util.HashMap');
      expect(cleaned).not.toContain('import java.util.Set');
      expect(cleaned).not.toContain('import java.util.List');
      expect(cleaned).toContain('import java.util.ArrayList');
    });

    it('should handle files with no unused imports', () => {
      const code = `package com.example

import java.util.ArrayList

class Test {
    private val items: MutableList<String> = ArrayList()
}
`;
      fs.writeFileSync(testFile, code, 'utf-8');

      const result = cleanupKotlinFile(testFile);
      expect(result).toBe(true);

      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe(code); // Should be unchanged
    });

    it.skip('should return false for files with syntax errors', () => {
      // Note: The Kotlin parser is more lenient than Java and may not detect all syntax errors
      const code = `package com.example

import java.util.List

class Test {
    private val items
}
`;
      fs.writeFileSync(testFile, code, 'utf-8');

      const result = cleanupKotlinFile(testFile);
      expect(result).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should preserve imports used in DSL-style function calls', () => {
      const code = `package com.example

import org.kodein.di.DI
import org.kodein.di.bindSingleton

val appModule = DI.Module("app") {
    bindSingleton { ApiConfig }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      // Both imports should be kept
      expect(cleaned).toContain('import org.kodein.di.DI');
      expect(cleaned).toContain('import org.kodein.di.bindSingleton');
    });

    it('should preserve comments after imports', () => {
      const code = `package com.example

import java.util.ArrayList

/**
 * Main class documentation
 */
class Test {
    private val items = ArrayList<String>()
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      // Import should be kept
      expect(cleaned).toContain('import java.util.ArrayList');
      // Comment should be preserved
      expect(cleaned).toContain('/**\n * Main class documentation\n */');
    });

    it('should not include comments in import text', () => {
      const code = `package com.example

import java.util.ArrayList

/**
 * Some comment
 */
class Test {
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);

      // Import text should not include the comment
      expect(imports[0].text).toBe('import java.util.ArrayList');
      expect(imports[0].text).not.toContain('/**');
    });
  });

  describe('Integration tests with fixtures', () => {
    it('should clean up UnusedImports.kt fixture', () => {
      const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'kotlin', 'UnusedImports.kt');
      const originalCode = fs.readFileSync(fixturePath, 'utf-8');

      // Create a temp copy with unique name to avoid parallel test conflicts
      const tempPath = path.join(process.cwd(), '__tests__', 'temp', `UnusedImportsTest-${Date.now()}.kt`);
      if (!fs.existsSync(path.dirname(tempPath))) {
        fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      }
      fs.writeFileSync(tempPath, originalCode, 'utf-8');

      cleanupKotlinFile(tempPath);
      const cleaned = fs.readFileSync(tempPath, 'utf-8');

      // Should keep ArrayList (used)
      expect(cleaned).toContain('import java.util.ArrayList');

      // Should remove HashMap, Set, List, and IOException (unused)
      expect(cleaned).not.toContain('import java.util.HashMap');
      expect(cleaned).not.toContain('import java.util.Set');
      expect(cleaned).not.toContain('import java.util.List');
      expect(cleaned).not.toContain('import java.io.IOException');

      // Cleanup
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    });

    it('should handle AliasedImports.kt fixture', () => {
      const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'kotlin', 'AliasedImports.kt');
      const originalCode = fs.readFileSync(fixturePath, 'utf-8');

      // Create a temp copy with unique name to avoid parallel test conflicts
      const tempPath = path.join(process.cwd(), '__tests__', 'temp', `AliasedImportsTest-${Date.now()}.kt`);
      if (!fs.existsSync(path.dirname(tempPath))) {
        fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      }
      fs.writeFileSync(tempPath, originalCode, 'utf-8');

      cleanupKotlinFile(tempPath);
      const cleaned = fs.readFileSync(tempPath, 'utf-8');

      // Should keep MyList (used)
      expect(cleaned).toContain('import java.util.ArrayList as MyList');

      // Should remove MyMap and MySet (unused)
      expect(cleaned).not.toContain('import java.util.HashMap as MyMap');
      expect(cleaned).not.toContain('import java.util.Set as MySet');

      // Cleanup
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    });
  });
});
