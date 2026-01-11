import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseJava,
  extractJavaImports,
  extractUsedIdentifiers,
  removeUnusedImports,
  cleanupJavaFile
} from '../src/importCleaner.js';

describe('Java Import Cleanup', () => {
  describe('extractJavaImports', () => {
    it('should extract regular imports', () => {
      const code = `
package com.example;

import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;

public class Test {
}
`;
      const tree = parseJava(code);
      const imports = extractJavaImports(tree, code);

      expect(imports).toHaveLength(3);
      expect(imports[0].symbols).toEqual(['List']);
      expect(imports[1].symbols).toEqual(['ArrayList']);
      expect(imports[2].symbols).toEqual(['HashMap']);
      expect(imports[0].isWildcard).toBe(false);
      expect(imports[0].isStatic).toBe(false);
    });

    it('should extract static imports', () => {
      const code = `
package com.example;

import static java.lang.Math.PI;
import static java.lang.Math.E;

public class Test {
}
`;
      const tree = parseJava(code);
      const imports = extractJavaImports(tree, code);

      expect(imports).toHaveLength(2);
      expect(imports[0].symbols).toEqual(['PI']);
      expect(imports[1].symbols).toEqual(['E']);
      expect(imports[0].isStatic).toBe(true);
      expect(imports[1].isStatic).toBe(true);
    });

    it('should detect wildcard imports', () => {
      const code = `
package com.example;

import java.util.*;
import java.io.*;

public class Test {
}
`;
      const tree = parseJava(code);
      const imports = extractJavaImports(tree, code);

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
package com.example;

import java.util.List;
import java.util.ArrayList;

public class Test {
    private List<String> items = new ArrayList<>();
}
`;
      const tree = parseJava(code);
      const usedIds = extractUsedIdentifiers(tree, code, 'java');

      expect(usedIds.has('List')).toBe(true);
      expect(usedIds.has('ArrayList')).toBe(true);
      expect(usedIds.has('String')).toBe(true);
      expect(usedIds.has('items')).toBe(true);
    });

    it('should not include identifiers from imports', () => {
      const code = `
package com.example;

import java.util.HashMap;

public class Test {
    private String name;
}
`;
      const tree = parseJava(code);
      const usedIds = extractUsedIdentifiers(tree, code, 'java');

      expect(usedIds.has('HashMap')).toBe(false); // HashMap is only in import, not used
      expect(usedIds.has('String')).toBe(true);
    });
  });

  describe('removeUnusedImports', () => {
    it('should remove unused imports', () => {
      const code = `package com.example;

import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;

public class Test {
    private List<String> items = new ArrayList<>();
}
`;
      const tree = parseJava(code);
      const imports = extractJavaImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'java');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      expect(cleaned).not.toContain('import java.util.HashMap');
      expect(cleaned).toContain('import java.util.List');
      expect(cleaned).toContain('import java.util.ArrayList');
    });

    it('should keep wildcard imports', () => {
      const code = `package com.example;

import java.util.*;
import java.io.*;

public class Test {
    private List<String> items = new ArrayList<>();
}
`;
      const tree = parseJava(code);
      const imports = extractJavaImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'java');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      expect(cleaned).toContain('import java.util.*');
      expect(cleaned).toContain('import java.io.*');
    });

    it('should remove unused static imports', () => {
      const code = `package com.example;

import static java.lang.Math.PI;
import static java.lang.Math.E;

public class Test {
    public double getCircle() {
        return PI * 2;
    }
}
`;
      const tree = parseJava(code);
      const imports = extractJavaImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'java');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      expect(cleaned).not.toContain('import static java.lang.Math.E');
      expect(cleaned).toContain('import static java.lang.Math.PI');
    });

    it('should keep all imports if all are used', () => {
      const code = `package com.example;

import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;

public class Test {
    private List<String> items = new ArrayList<>();
    private Map<String, String> config = new HashMap<>();
}
`;
      const tree = parseJava(code);
      const imports = extractJavaImports(tree, code);
      const usedIds = extractUsedIdentifiers(tree, code, 'java');
      const cleaned = removeUnusedImports(code, imports, usedIds);

      expect(cleaned).toContain('import java.util.List');
      expect(cleaned).toContain('import java.util.ArrayList');
      expect(cleaned).toContain('import java.util.Map');
      expect(cleaned).toContain('import java.util.HashMap');
    });
  });

  describe('cleanupJavaFile', () => {
    const testDir = path.join(process.cwd(), '__tests__', 'temp');
    const testFile = path.join(testDir, 'Test.java');

    beforeEach(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
    });

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should clean up file with unused imports', () => {
      const code = `package com.example;

import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Set;

public class Test {
    private List<String> items = new ArrayList<>();
}
`;
      fs.writeFileSync(testFile, code, 'utf-8');

      const result = cleanupJavaFile(testFile);
      expect(result).toBe(true);

      const cleaned = fs.readFileSync(testFile, 'utf-8');
      expect(cleaned).not.toContain('import java.util.HashMap');
      expect(cleaned).not.toContain('import java.util.Set');
      expect(cleaned).toContain('import java.util.List');
      expect(cleaned).toContain('import java.util.ArrayList');
    });

    it('should handle files with no unused imports', () => {
      const code = `package com.example;

import java.util.List;
import java.util.ArrayList;

public class Test {
    private List<String> items = new ArrayList<>();
}
`;
      fs.writeFileSync(testFile, code, 'utf-8');

      const result = cleanupJavaFile(testFile);
      expect(result).toBe(true);

      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe(code); // Should be unchanged
    });

    it('should return false for files with syntax errors', () => {
      const code = `package com.example;

import java.util.List

public class Test {
    private List<String> items
}
`;
      fs.writeFileSync(testFile, code, 'utf-8');

      const result = cleanupJavaFile(testFile);
      expect(result).toBe(false);
    });
  });

  describe('Integration tests with fixtures', () => {
    it('should clean up UnusedImports.java fixture', () => {
      const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'java', 'UnusedImports.java');
      const originalCode = fs.readFileSync(fixturePath, 'utf-8');

      // Create a temp copy with unique name to avoid parallel test conflicts
      const tempPath = path.join(process.cwd(), '__tests__', 'temp', `UnusedImportsTest-${Date.now()}.java`);
      if (!fs.existsSync(path.dirname(tempPath))) {
        fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      }
      fs.writeFileSync(tempPath, originalCode, 'utf-8');

      cleanupJavaFile(tempPath);
      const cleaned = fs.readFileSync(tempPath, 'utf-8');

      // Should keep List and ArrayList (used)
      expect(cleaned).toContain('import java.util.List');
      expect(cleaned).toContain('import java.util.ArrayList');

      // Should remove HashMap, Set, and IOException (unused)
      expect(cleaned).not.toContain('import java.util.HashMap');
      expect(cleaned).not.toContain('import java.util.Set');
      expect(cleaned).not.toContain('import java.io.IOException');

      // Cleanup
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    });
  });
});
