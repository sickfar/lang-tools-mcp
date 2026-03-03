import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseJava,
  parseKotlin,
  extractJavaImports,
  extractKotlinImports,
  sortImportsInSource,
  cleanupJavaFile,
  cleanupKotlinFile,
} from '../src/importCleaner.js';

describe('sortImportsInSource', () => {
  describe('Java', () => {
    function sortJava(code: string): string {
      const tree = parseJava(code);
      const imports = extractJavaImports(tree, code);
      return sortImportsInSource(code, imports, 'java');
    }

    it('returns unchanged when no imports', () => {
      const code = `package com.example;

public class Test {
}
`;
      expect(sortJava(code)).toBe(code);
    });

    it('returns unchanged for single import', () => {
      const code = `package com.example;

import java.util.List;

public class Test {
}
`;
      expect(sortJava(code)).toBe(code);
    });

    it('returns unchanged when already sorted', () => {
      const code = `package com.example;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class Test {
}
`;
      expect(sortJava(code)).toBe(code);
    });

    it('sorts unsorted non-static imports lexicographically', () => {
      const code = `package com.example;

import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;

public class Test {
}
`;
      const expected = `package com.example;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class Test {
}
`;
      expect(sortJava(code)).toBe(expected);
    });

    it('groups non-static first then static, each sorted, separated by blank line', () => {
      const code = `package com.example;

import static java.lang.Math.PI;
import java.util.List;
import static java.lang.Math.E;
import java.util.ArrayList;

public class Test {
}
`;
      const expected = `package com.example;

import java.util.ArrayList;
import java.util.List;

import static java.lang.Math.E;
import static java.lang.Math.PI;

public class Test {
}
`;
      expect(sortJava(code)).toBe(expected);
    });

    it('sorts only static imports without blank separator', () => {
      const code = `package com.example;

import static java.lang.Math.PI;
import static java.lang.Math.E;
import static java.lang.Math.abs;

public class Test {
}
`;
      const expected = `package com.example;

import static java.lang.Math.E;
import static java.lang.Math.PI;
import static java.lang.Math.abs;

public class Test {
}
`;
      expect(sortJava(code)).toBe(expected);
    });

    it('includes wildcard imports in sort order', () => {
      const code = `package com.example;

import java.util.List;
import java.io.*;
import java.util.ArrayList;

public class Test {
}
`;
      const expected = `package com.example;

import java.io.*;
import java.util.ArrayList;
import java.util.List;

public class Test {
}
`;
      expect(sortJava(code)).toBe(expected);
    });

    it('preserves package declaration and class body', () => {
      const code = `package com.example;

import java.util.Map;
import java.util.List;

public class Test {
    private List<String> items;
    private Map<String, Integer> counts;
}
`;
      const expected = `package com.example;

import java.util.List;
import java.util.Map;

public class Test {
    private List<String> items;
    private Map<String, Integer> counts;
}
`;
      expect(sortJava(code)).toBe(expected);
    });
  });

  describe('Kotlin', () => {
    function sortKotlin(code: string): string {
      const tree = parseKotlin(code);
      const imports = extractKotlinImports(tree, code);
      return sortImportsInSource(code, imports, 'kotlin');
    }

    it('returns unchanged when already sorted', () => {
      const code = `package com.example

import java.util.ArrayList
import java.util.HashMap
import java.util.List

class Test
`;
      expect(sortKotlin(code)).toBe(code);
    });

    it('sorts unsorted imports lexicographically', () => {
      const code = `package com.example

import java.util.List
import java.util.ArrayList
import java.util.HashMap

class Test
`;
      const expected = `package com.example

import java.util.ArrayList
import java.util.HashMap
import java.util.List

class Test
`;
      expect(sortKotlin(code)).toBe(expected);
    });

    it('sorts aliased imports by full import text', () => {
      const code = `package com.example

import java.util.List
import z.B as Foo
import a.C as Bar

class Test
`;
      const expected = `package com.example

import a.C as Bar
import java.util.List
import z.B as Foo

class Test
`;
      expect(sortKotlin(code)).toBe(expected);
    });

    it('includes wildcard imports in sort order', () => {
      const code = `package com.example

import java.util.List
import java.io.*
import java.util.ArrayList

class Test
`;
      const expected = `package com.example

import java.io.*
import java.util.ArrayList
import java.util.List

class Test
`;
      expect(sortKotlin(code)).toBe(expected);
    });

    it('preserves package header and class body', () => {
      const code = `package com.example

import java.util.Map
import java.util.List

class Test {
    val items: List<String> = emptyList()
    val counts: Map<String, Int> = emptyMap()
}
`;
      const expected = `package com.example

import java.util.List
import java.util.Map

class Test {
    val items: List<String> = emptyList()
    val counts: Map<String, Int> = emptyMap()
}
`;
      expect(sortKotlin(code)).toBe(expected);
    });
  });

  describe('Integration: cleanupJavaFile with sortImports', () => {
    const testDir = path.join(process.cwd(), '__tests__', 'temp');
    let testFile: string;

    beforeEach(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      testFile = path.join(testDir, `SortTest-${Date.now()}-${Math.random().toString(36).slice(2)}.java`);
    });

    afterEach(() => {
      if (testFile && fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('removes unused AND sorts when sortImports is true', () => {
      const code = `package com.example;

import java.util.Map;
import java.util.List;
import java.util.HashMap;
import java.util.Set;

public class Test {
    private List<String> items;
    private Map<String, Integer> counts;
}
`;
      fs.writeFileSync(testFile, code, 'utf-8');

      cleanupJavaFile(testFile, { sortImports: true });
      const result = fs.readFileSync(testFile, 'utf-8');

      // Unused removed
      expect(result).not.toContain('import java.util.HashMap');
      expect(result).not.toContain('import java.util.Set');
      // Remaining sorted
      expect(result).toContain('import java.util.List;\nimport java.util.Map;');
    });

    it('removes unused only when sortImports is false', () => {
      const code = `package com.example;

import java.util.Map;
import java.util.List;
import java.util.Set;

public class Test {
    private List<String> items;
    private Map<String, Integer> counts;
}
`;
      fs.writeFileSync(testFile, code, 'utf-8');

      cleanupJavaFile(testFile, { sortImports: false });
      const result = fs.readFileSync(testFile, 'utf-8');

      // Unused removed
      expect(result).not.toContain('import java.util.Set');
      // Order preserved (Map before List)
      expect(result).toContain('import java.util.Map;\nimport java.util.List;');
    });

    it('sorts-only when no unused imports but out of order', () => {
      const code = `package com.example;

import java.util.Map;
import java.util.List;

public class Test {
    private List<String> items;
    private Map<String, Integer> counts;
}
`;
      fs.writeFileSync(testFile, code, 'utf-8');

      cleanupJavaFile(testFile, { sortImports: true });
      const result = fs.readFileSync(testFile, 'utf-8');

      expect(result).toContain('import java.util.List;\nimport java.util.Map;');
    });
  });

  describe('Integration: cleanupKotlinFile with sortImports', () => {
    const testDir = path.join(process.cwd(), '__tests__', 'temp');
    let testFile: string;

    beforeEach(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      testFile = path.join(testDir, `SortTest-${Date.now()}-${Math.random().toString(36).slice(2)}.kt`);
    });

    afterEach(() => {
      if (testFile && fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('removes unused AND sorts when sortImports is true', () => {
      const code = `package com.example

import java.util.Map
import java.util.List
import java.util.HashMap
import java.util.Set

class Test {
    val items: List<String> = emptyList()
    val counts: Map<String, Int> = emptyMap()
}
`;
      fs.writeFileSync(testFile, code, 'utf-8');

      cleanupKotlinFile(testFile, { sortImports: true });
      const result = fs.readFileSync(testFile, 'utf-8');

      expect(result).not.toContain('import java.util.HashMap');
      expect(result).not.toContain('import java.util.Set');
      expect(result).toContain('import java.util.List\nimport java.util.Map');
    });

    it('removes unused only when sortImports is false', () => {
      const code = `package com.example

import java.util.Map
import java.util.List
import java.util.Set

class Test {
    val items: List<String> = emptyList()
    val counts: Map<String, Int> = emptyMap()
}
`;
      fs.writeFileSync(testFile, code, 'utf-8');

      cleanupKotlinFile(testFile, { sortImports: false });
      const result = fs.readFileSync(testFile, 'utf-8');

      expect(result).not.toContain('import java.util.Set');
      // Order preserved (Map before List)
      expect(result).toContain('import java.util.Map\nimport java.util.List');
    });
  });
});
