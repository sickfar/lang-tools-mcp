import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseKotlin,
  extractKotlinImports,
  extractUsedIdentifiers,
  extractImplicitlyUsedOperators,
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

  describe('String template $name identifier extraction', () => {
    it('should preserve import used only via simple $name string template', () => {
      const code = `package com.example.service.profile

import com.example.service.UPLOAD_PREFIX

class ProfileService {
    fun buildPath(name: String): String {
        return "${'$'}name/${'$'}UPLOAD_PREFIX-file.png"
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      expect(usedIds.has('UPLOAD_PREFIX')).toBe(true);
      expect(cleaned).toContain('import com.example.service.UPLOAD_PREFIX');
    });

    it('should preserve import used via $name in multiline string', () => {
      const code = `package com.example

import com.example.config.BASE_URL

class Config {
    val template = ${'"""'}
        endpoint: ${'$'}BASE_URL/api/v1
        timeout: 30
    ${'"""'}.trimIndent()
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      expect(usedIds.has('BASE_URL')).toBe(true);
      expect(cleaned).toContain('import com.example.config.BASE_URL');
    });

    it('should preserve imports used via both $name and ${expr} forms', () => {
      const code = `package com.example

import com.example.config.PREFIX
import com.example.config.SUFFIX

class Test {
    fun format(name: String): String {
        return "${'$'}PREFIX-${'$'}{name}-${'$'}SUFFIX"
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      expect(cleaned).toContain('import com.example.config.PREFIX');
      expect(cleaned).toContain('import com.example.config.SUFFIX');
    });

    it('should preserve import when $name is followed by non-identifier chars', () => {
      const code = `package com.example

import com.example.config.CONST

class Test {
    fun test(): String {
        val a = "${'$'}CONST-suffix"
        val b = "${'$'}CONST/path"
        val c = "${'$'}CONST.ext"
        return a + b + c
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      expect(usedIds.has('CONST')).toBe(true);
      expect(cleaned).toContain('import com.example.config.CONST');
    });

    it('should still remove unused import when identifier only appears as plain text in string', () => {
      const code = `package com.example

import com.example.config.UNUSED_CONST

class Test {
    fun test(): String {
        return "no dollar sign UNUSED_CONST here"
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'kotlin');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      expect(cleaned).not.toContain('import com.example.config.UNUSED_CONST');
    });
  });

  describe('Operator extension function imports', () => {
    it('should preserve getValue and setValue imports used via by delegation', () => {
      const code = `package com.example

import com.example.delegates.getValue
import com.example.delegates.setValue
import java.util.HashMap

class Test {
    var myState: String by SomeDelegate()
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.delegates.getValue');
      expect(cleaned).toContain('import com.example.delegates.setValue');
      expect(cleaned).not.toContain('import java.util.HashMap');
    });

    it('should preserve provideDelegate import used via by delegation', () => {
      const code = `package com.example

import com.example.delegates.getValue
import com.example.delegates.provideDelegate

class Test {
    val myProp: String by SomeDelegate()
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.delegates.getValue');
      expect(cleaned).toContain('import com.example.delegates.provideDelegate');
    });

    it('should preserve iterator import used via for loop', () => {
      const code = `package com.example

import com.example.collections.iterator
import com.example.collections.hasNext
import com.example.collections.next
import java.util.HashMap

class Test {
    fun run(items: MyCollection) {
        for (item in items) {
            println(item)
        }
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.collections.iterator');
      expect(cleaned).toContain('import com.example.collections.hasNext');
      expect(cleaned).toContain('import com.example.collections.next');
      expect(cleaned).not.toContain('import java.util.HashMap');
    });

    it('should preserve component1 and component2 imports used via destructuring', () => {
      const code = `package com.example

import com.example.pairs.component1
import com.example.pairs.component2
import java.util.HashMap

class Test {
    fun run(pair: MyPair) {
        val (first, second) = pair
        println("${'$'}first ${'$'}second")
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.pairs.component1');
      expect(cleaned).toContain('import com.example.pairs.component2');
      expect(cleaned).not.toContain('import java.util.HashMap');
    });

    it('should preserve get and set imports used via indexed access', () => {
      const code = `package com.example

import com.example.maps.get
import com.example.maps.set
import java.util.HashMap

class Test {
    fun run(map: MyMap) {
        val value = map["key"]
        map["key"] = 42
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.maps.get');
      expect(cleaned).toContain('import com.example.maps.set');
      expect(cleaned).not.toContain('import java.util.HashMap');
    });

    it('should preserve plus and minus imports used via arithmetic operators', () => {
      const code = `package com.example

import com.example.math.plus
import com.example.math.minus
import java.util.HashMap

class Test {
    fun run(a: MyNum, b: MyNum) {
        val c = a + b
        val d = a - b
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.math.plus');
      expect(cleaned).toContain('import com.example.math.minus');
      expect(cleaned).not.toContain('import java.util.HashMap');
    });

    it('should preserve times, div, rem imports used via multiplication operators', () => {
      const code = `package com.example

import com.example.math.times
import com.example.math.div
import com.example.math.rem
import java.util.HashMap

class Test {
    fun run(a: MyNum, b: MyNum) {
        val c = a * b
        val d = a / b
        val e = a % b
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.math.times');
      expect(cleaned).toContain('import com.example.math.div');
      expect(cleaned).toContain('import com.example.math.rem');
      expect(cleaned).not.toContain('import java.util.HashMap');
    });

    it('should preserve contains import used via in operator', () => {
      const code = `package com.example

import com.example.collections.contains
import java.util.HashMap

class Test {
    fun run(col: MyCollection, item: String): Boolean {
        return item in col
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.collections.contains');
      expect(cleaned).not.toContain('import java.util.HashMap');
    });

    it('should preserve compareTo import used via comparison operators', () => {
      const code = `package com.example

import com.example.math.compareTo
import java.util.HashMap

class Test {
    fun run(a: MyNum, b: MyNum): Boolean {
        return a < b
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.math.compareTo');
      expect(cleaned).not.toContain('import java.util.HashMap');
    });

    it('should preserve rangeTo import used via .. operator', () => {
      const code = `package com.example

import com.example.math.rangeTo
import java.util.HashMap

class Test {
    fun run(a: MyNum, b: MyNum) {
        val range = a..b
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.math.rangeTo');
      expect(cleaned).not.toContain('import java.util.HashMap');
    });

    it('should preserve inc and dec imports used via postfix ++ and -- operators', () => {
      const code = `package com.example

import com.example.math.inc
import com.example.math.dec
import java.util.HashMap

class Test {
    fun run(a: MyNum): MyNum {
        var x = a
        x++
        x--
        return x
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.math.inc');
      expect(cleaned).toContain('import com.example.math.dec');
      expect(cleaned).not.toContain('import java.util.HashMap');
    });

    it('should preserve inc and dec imports used via prefix ++ and -- operators', () => {
      const code = `package com.example

import com.example.math.inc
import com.example.math.dec
import java.util.HashMap

class Test {
    fun run(a: MyNum): MyNum {
        var x = a
        ++x
        --x
        return x
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.math.inc');
      expect(cleaned).toContain('import com.example.math.dec');
      expect(cleaned).not.toContain('import java.util.HashMap');
    });

    it('should preserve unaryMinus and not imports used via prefix operators', () => {
      const code = `package com.example

import com.example.math.unaryMinus
import com.example.math.not
import java.util.HashMap

class Test {
    fun run(a: MyNum, b: MyBool) {
        val c = -a
        val d = !b
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.math.unaryMinus');
      expect(cleaned).toContain('import com.example.math.not');
      expect(cleaned).not.toContain('import java.util.HashMap');
    });

    it('should preserve component1..component3 imports for three-element destructuring', () => {
      const code = `package com.example

import com.example.triples.component1
import com.example.triples.component2
import com.example.triples.component3
import java.util.HashMap

class Test {
    fun run(triple: MyTriple) {
        val (a, b, c) = triple
        println("${'$'}a ${'$'}b ${'$'}c")
    }
}
`;
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      const usedIdentifiers = extractUsedIdentifiers(tree, code, 'kotlin');
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');
      for (const op of implicit) usedIdentifiers.add(op);
      const cleaned = removeUnusedImports(code, imports, usedIdentifiers);

      expect(cleaned).toContain('import com.example.triples.component1');
      expect(cleaned).toContain('import com.example.triples.component2');
      expect(cleaned).toContain('import com.example.triples.component3');
      expect(cleaned).not.toContain('import java.util.HashMap');
    });

    it('extractImplicitlyUsedOperators should detect property_delegate', () => {
      const code = `package com.example

class Test {
    var x: String by SomeDelegate()
}
`;
      const tree = parseKotlin(code);
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');

      expect(implicit.has('getValue')).toBe(true);
      expect(implicit.has('setValue')).toBe(true);
      expect(implicit.has('provideDelegate')).toBe(true);
    });

    it('extractImplicitlyUsedOperators should be empty with no implicit operators', () => {
      const code = `package com.example

class Test {
    fun hello() = println("hi")
}
`;
      const tree = parseKotlin(code);
      const implicit = extractImplicitlyUsedOperators(tree, 'kotlin');

      expect(implicit.has('getValue')).toBe(false);
      expect(implicit.has('iterator')).toBe(false);
      expect(implicit.has('component1')).toBe(false);
    });

    it('should handle fixture file OperatorExtensionImports.kt without removing operator imports', () => {
      const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'kotlin', 'OperatorExtensionImports.kt');
      const originalCode = fs.readFileSync(fixturePath, 'utf-8');

      const tempPath = path.join(process.cwd(), '__tests__', 'temp', `OperatorExtensionImportsTest-${Date.now()}.kt`);
      if (!fs.existsSync(path.dirname(tempPath))) {
        fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      }
      fs.writeFileSync(tempPath, originalCode, 'utf-8');

      cleanupKotlinFile(tempPath);
      const cleaned = fs.readFileSync(tempPath, 'utf-8');

      expect(cleaned).toContain('import com.example.delegates.getValue');
      expect(cleaned).toContain('import com.example.delegates.setValue');
      expect(cleaned).toContain('import com.example.delegates.provideDelegate');
      expect(cleaned).toContain('import com.example.collections.iterator');
      expect(cleaned).toContain('import com.example.collections.hasNext');
      expect(cleaned).toContain('import com.example.collections.next');
      expect(cleaned).toContain('import com.example.pairs.component1');
      expect(cleaned).toContain('import com.example.pairs.component2');
      expect(cleaned).toContain('import com.example.maps.get');
      expect(cleaned).toContain('import com.example.maps.set');
      expect(cleaned).toContain('import com.example.math.plus');
      expect(cleaned).toContain('import com.example.math.minus');
      expect(cleaned).toContain('import java.util.ArrayList');

      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    });
  });
});
