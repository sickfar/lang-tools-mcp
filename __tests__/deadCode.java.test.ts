import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { parseJava } from '../src/importCleaner.js';
import {
  detectUnusedParameters,
  detectUnusedLocalVariables,
  detectUnusedFields,
  detectUnusedPrivateMethods,
  JAVA_CONFIG,
  DeadCodeFinding,
} from '../src/deadCodeDetector.js';

describe('Java Dead Code Detection', () => {
  describe('detectUnusedParameters', () => {
    it('should detect unused method parameter', () => {
      const code = `
public class Test {
    public void process(String data, int unusedParam) {
        System.out.println(data);
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('unused_parameter');
      expect(findings[0].name).toBe('unusedParam');
      expect(findings[0].enclosingScope).toContain('process');
    });

    it('should not flag parameters that are used', () => {
      const code = `
public class Test {
    public int add(int a, int b) {
        return a + b;
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should detect multiple unused parameters', () => {
      const code = `
public class Test {
    public void process(String used, int unused1, double unused2) {
        System.out.println(used);
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(2);
      const names = findings.map(f => f.name);
      expect(names).toContain('unused1');
      expect(names).toContain('unused2');
    });

    it('should skip @Override methods', () => {
      const code = `
public class Test {
    @Override
    public String toString() {
        return "test";
    }

    @Override
    public boolean equals(Object obj) {
        return true;
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should skip main method', () => {
      const code = `
public class Test {
    public static void main(String[] args) {
        System.out.println("main");
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should skip abstract methods (no body)', () => {
      const code = `
public abstract class Test {
    public abstract void process(String data);
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should skip interface methods (no body)', () => {
      const code = `
public interface Test {
    void process(String data);
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should handle methods with no parameters', () => {
      const code = `
public class Test {
    public void noParams() {
        System.out.println("hello");
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should detect unused constructor parameters', () => {
      const code = `
public class Test {
    public Test(String name, int unusedParam) {
        System.out.println(name);
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(1);
      expect(findings[0].name).toBe('unusedParam');
    });

    it('should provide correct line and column numbers', () => {
      const code = `public class Test {
    public void process(String data, int unusedParam) {
        System.out.println(data);
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBeGreaterThan(0);
      expect(findings[0].column).toBeGreaterThanOrEqual(0);
    });

    it('should work with fixture file', () => {
      const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'java', 'DeadCodeUnusedParams.java');
      const code = fs.readFileSync(fixturePath, 'utf-8');
      const tree = parseJava(code);
      const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);

      // Should find: unusedParam in processData, unused1 and unused2 in multipleUnused,
      // unusedConstructorParam in constructor, value in shadowedParam
      const names = findings.map(f => f.name);
      expect(names).toContain('unusedParam');
      expect(names).toContain('unused1');
      expect(names).toContain('unused2');
      expect(names).toContain('unusedConstructorParam');

      // Should NOT find: args (main method), toString params (@Override)
      // Should NOT find: data, a, b, used, name, item (all used)
      expect(names).not.toContain('args');
      expect(names).not.toContain('data');
      expect(names).not.toContain('a');
      expect(names).not.toContain('b');
      expect(names).not.toContain('used');
      expect(names).not.toContain('name');
      expect(names).not.toContain('item');
    });
  });

  describe('detectUnusedLocalVariables', () => {
    it('should detect unused local variable', () => {
      const code = `
public class Test {
    public void process() {
        String used = "hello";
        int unused = 42;
        System.out.println(used);
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedLocalVariables(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('unused_local_variable');
      expect(findings[0].name).toBe('unused');
    });

    it('should not flag used local variables', () => {
      const code = `
public class Test {
    public void process() {
        int a = 1;
        int b = 2;
        System.out.println(a + b);
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedLocalVariables(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should detect multiple unused locals', () => {
      const code = `
public class Test {
    public void process() {
        String used = "hello";
        int unused1 = 1;
        double unused2 = 2.0;
        System.out.println(used);
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedLocalVariables(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(2);
      const names = findings.map(f => f.name);
      expect(names).toContain('unused1');
      expect(names).toContain('unused2');
    });

    it('should not flag for loop variables', () => {
      const code = `
public class Test {
    public void process() {
        for (int i = 0; i < 10; i++) {
            System.out.println(i);
        }
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedLocalVariables(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should not flag enhanced for loop variables', () => {
      const code = `
public class Test {
    public void process() {
        List<String> items = new ArrayList<>();
        for (String item : items) {
            System.out.println(item);
        }
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedLocalVariables(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should handle methods with no local variables', () => {
      const code = `
public class Test {
    public void process() {
        System.out.println("hello");
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedLocalVariables(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should work with fixture file', () => {
      const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'java', 'DeadCodeUnusedLocals.java');
      const code = fs.readFileSync(fixturePath, 'utf-8');
      const tree = parseJava(code);
      const findings = detectUnusedLocalVariables(tree, code, JAVA_CONFIG);

      const names = findings.map(f => f.name);
      expect(names).toContain('unused');
      expect(names).toContain('unused1');
      expect(names).toContain('unused2');
      expect(names).not.toContain('used');
      expect(names).not.toContain('a');
      expect(names).not.toContain('b');
      expect(names).not.toContain('i');
      expect(names).not.toContain('items');
      expect(names).not.toContain('item');
    });
  });

  describe('detectUnusedFields', () => {
    it('should detect unused private field', () => {
      const code = `
public class Test {
    private String usedField = "hello";
    private int unusedField = 42;

    public void process() {
        System.out.println(usedField);
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedFields(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('unused_field');
      expect(findings[0].name).toBe('unusedField');
    });

    it('should not flag used private fields', () => {
      const code = `
public class Test {
    private String name = "hello";

    public void process() {
        System.out.println(name);
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedFields(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should not flag non-private fields', () => {
      const code = `
public class Test {
    public String publicField = "pub";
    protected String protectedField = "prot";
    String packageField = "pkg";
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedFields(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should skip serialVersionUID', () => {
      const code = `
public class Test {
    private static final long serialVersionUID = 1L;
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedFields(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should work with fixture file', () => {
      const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'java', 'DeadCodeUnusedFields.java');
      const code = fs.readFileSync(fixturePath, 'utf-8');
      const tree = parseJava(code);
      const findings = detectUnusedFields(tree, code, JAVA_CONFIG);

      const names = findings.map(f => f.name);
      expect(names).toContain('unusedField');
      expect(names).not.toContain('usedField');
      expect(names).not.toContain('serialVersionUID');
      expect(names).not.toContain('publicField');
    });
  });

  describe('detectUnusedPrivateMethods', () => {
    it('should detect unused private method', () => {
      const code = `
public class Test {
    private void usedMethod() {}
    private void unusedMethod() {}

    public void process() {
        usedMethod();
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedPrivateMethods(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('unused_private_method');
      expect(findings[0].name).toBe('unusedMethod');
    });

    it('should not flag used private methods', () => {
      const code = `
public class Test {
    private void helper() {}

    public void process() {
        helper();
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedPrivateMethods(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should not flag non-private methods', () => {
      const code = `
public class Test {
    public void publicMethod() {}
    protected void protectedMethod() {}
    void packageMethod() {}
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedPrivateMethods(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should recognize method references as usage', () => {
      const code = `
public class Test {
    private void referencedMethod() {}

    public void process() {
        Runnable r = this::referencedMethod;
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedPrivateMethods(tree, code, JAVA_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should work with fixture file', () => {
      const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'java', 'DeadCodeUnusedMethods.java');
      const code = fs.readFileSync(fixturePath, 'utf-8');
      const tree = parseJava(code);
      const findings = detectUnusedPrivateMethods(tree, code, JAVA_CONFIG);

      const names = findings.map(f => f.name);
      expect(names).toContain('unusedMethod');
      expect(names).not.toContain('usedMethod');
      expect(names).not.toContain('usedViaReference');
      expect(names).not.toContain('publicMethod');
      expect(names).not.toContain('protectedMethod');
      expect(names).not.toContain('process');
    });

    it('should not count inner class usage as outer class usage', () => {
      const code = `
public class Outer {
    private void outerPrivate() {}

    class Inner {
        public void innerProcess() {
            outerPrivate();
        }
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedPrivateMethods(tree, code, JAVA_CONFIG);

      // outerPrivate is called only from Inner class - should still be flagged
      // as unused in Outer's scope (inner class is a different scope)
      const outerFindings = findings.filter(f => f.enclosingScope === 'Outer');
      expect(outerFindings.map(f => f.name)).toContain('outerPrivate');
    });

    it('should detect unused private method called from lambda', () => {
      const code = `
public class Test {
    private void helper() {}

    public void process() {
        Runnable r = () -> { helper(); };
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedPrivateMethods(tree, code, JAVA_CONFIG);

      // helper() is called from lambda inside the class - should be used
      expect(findings).toHaveLength(0);
    });
  });

  describe('scope boundary: unused fields with inner classes', () => {
    it('should flag private field used only in inner class', () => {
      const code = `
public class Outer {
    private String outerField = "hello";

    class Inner {
        public void process() {
            System.out.println(outerField);
        }
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedFields(tree, code, JAVA_CONFIG);

      // outerField is used only in Inner - should be flagged as unused in Outer
      const outerFindings = findings.filter(f => f.enclosingScope === 'Outer');
      expect(outerFindings.map(f => f.name)).toContain('outerField');
    });

    it('should not false-negative when inner class uses same-named identifier', () => {
      const code = `
public class Outer {
    private int count = 0;

    class Inner {
        private int count = 0;
        public void process() {
            System.out.println(count);
        }
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedFields(tree, code, JAVA_CONFIG);

      // Outer.count should be flagged (inner class has its own count)
      const outerFindings = findings.filter(f => f.enclosingScope === 'Outer');
      expect(outerFindings.map(f => f.name)).toContain('count');
    });

    it('should handle field used in static initializer', () => {
      const code = `
public class Test {
    private static int count;
    static {
        count = 0;
    }
    public void process() {
        System.out.println(count);
    }
}
`;
      const tree = parseJava(code);
      const findings = detectUnusedFields(tree, code, JAVA_CONFIG);

      expect(findings.map(f => f.name)).not.toContain('count');
    });
  });

  describe('comprehensive real-world scenarios', () => {
    const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'java', 'DeadCodeComprehensive.java');
    let code: string;
    let tree: ReturnType<typeof parseJava>;

    beforeAll(() => {
      code = fs.readFileSync(fixturePath, 'utf-8');
      tree = parseJava(code);
    });

    describe('ServiceProcessor fields', () => {
      it('should not flag logger (used in method)', () => {
        const findings = detectUnusedFields(tree, code, JAVA_CONFIG);
        const sp = findings.filter(f => f.enclosingScope === 'ServiceProcessor');
        expect(sp.map(f => f.name)).not.toContain('logger');
      });

      it('should flag unusedConfig (never used)', () => {
        const findings = detectUnusedFields(tree, code, JAVA_CONFIG);
        const sp = findings.filter(f => f.enclosingScope === 'ServiceProcessor');
        expect(sp.map(f => f.name)).toContain('unusedConfig');
      });

      it('should not flag count (used in static init and method)', () => {
        const findings = detectUnusedFields(tree, code, JAVA_CONFIG);
        const sp = findings.filter(f => f.enclosingScope === 'ServiceProcessor');
        expect(sp.map(f => f.name)).not.toContain('count');
      });
    });

    describe('ServiceProcessor private methods', () => {
      it('should not flag validate (called from lambda body)', () => {
        const findings = detectUnusedPrivateMethods(tree, code, JAVA_CONFIG);
        const sp = findings.filter(f => f.enclosingScope === 'ServiceProcessor');
        expect(sp.map(f => f.name)).not.toContain('validate');
      });

      it('should flag unusedHelper (never called)', () => {
        const findings = detectUnusedPrivateMethods(tree, code, JAVA_CONFIG);
        const sp = findings.filter(f => f.enclosingScope === 'ServiceProcessor');
        expect(sp.map(f => f.name)).toContain('unusedHelper');
      });

      it('should not flag transform (called via method reference)', () => {
        const findings = detectUnusedPrivateMethods(tree, code, JAVA_CONFIG);
        const sp = findings.filter(f => f.enclosingScope === 'ServiceProcessor');
        expect(sp.map(f => f.name)).not.toContain('transform');
      });
    });

    describe('ServiceProcessor parameters', () => {
      it('should flag unusedMode in compute', () => {
        const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);
        expect(findings.map(f => f.name)).toContain('unusedMode');
      });

      it('should not flag data in compute (used)', () => {
        const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);
        expect(findings.map(f => f.name)).not.toContain('data');
      });

      it('should not flag catch parameter e', () => {
        const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);
        expect(findings.map(f => f.name)).not.toContain('e');
      });

      it('should not flag lambda parameter item', () => {
        const findings = detectUnusedParameters(tree, code, JAVA_CONFIG);
        expect(findings.map(f => f.name)).not.toContain('item');
      });
    });

    describe('ServiceProcessor local variables', () => {
      it('should flag unusedLocal', () => {
        const findings = detectUnusedLocalVariables(tree, code, JAVA_CONFIG);
        expect(findings.map(f => f.name)).toContain('unusedLocal');
      });

      it('should flag b in multi-declarator (a is used)', () => {
        const findings = detectUnusedLocalVariables(tree, code, JAVA_CONFIG);
        expect(findings.map(f => f.name)).toContain('b');
        expect(findings.map(f => f.name)).not.toContain('a');
      });
    });

    describe('OuterWithInner scope boundaries', () => {
      it('should flag outerData (used only in InnerWorker)', () => {
        const findings = detectUnusedFields(tree, code, JAVA_CONFIG);
        const outer = findings.filter(f => f.enclosingScope === 'OuterWithInner');
        expect(outer.map(f => f.name)).toContain('outerData');
      });

      it('should not flag sharedName (used in outer method)', () => {
        const findings = detectUnusedFields(tree, code, JAVA_CONFIG);
        const outer = findings.filter(f => f.enclosingScope === 'OuterWithInner');
        expect(outer.map(f => f.name)).not.toContain('sharedName');
      });

      it('should flag innerUnused in InnerWorker', () => {
        const findings = detectUnusedFields(tree, code, JAVA_CONFIG);
        const inner = findings.filter(f => f.enclosingScope === 'InnerWorker');
        expect(inner.map(f => f.name)).toContain('innerUnused');
      });

      it('should flag outerPrivateHelper (used only by inner class)', () => {
        const findings = detectUnusedPrivateMethods(tree, code, JAVA_CONFIG);
        const outer = findings.filter(f => f.enclosingScope === 'OuterWithInner');
        expect(outer.map(f => f.name)).toContain('outerPrivateHelper');
      });
    });

    describe('OverloadedMethods (known limitation)', () => {
      it('should not flag process(int) due to name-based detection', () => {
        const findings = detectUnusedPrivateMethods(tree, code, JAVA_CONFIG);
        const om = findings.filter(f => f.enclosingScope === 'OverloadedMethods');
        // Both overloads share the name "process" which is invoked, so neither is flagged
        expect(om.map(f => f.name)).not.toContain('process');
      });
    });

    describe('integration via detectDeadCodeInFile', () => {
      it('should return all expected findings from fixture', async () => {
        const { detectDeadCodeInFile } = await import('../src/deadCodeDetector.js');
        const result = detectDeadCodeInFile(fixturePath, 'java');
        const names = result.findings.map((f: DeadCodeFinding) => f.name);

        // Should be flagged
        expect(names).toContain('unusedConfig');
        expect(names).toContain('unusedHelper');
        expect(names).toContain('unusedMode');
        expect(names).toContain('mode');
        expect(names).toContain('unusedLocal');
        expect(names).toContain('b');
        expect(names).toContain('outerData');
        expect(names).toContain('innerUnused');
        expect(names).toContain('outerPrivateHelper');

        // Should NOT be flagged
        expect(names).not.toContain('logger');
        expect(names).not.toContain('count');
        expect(names).not.toContain('validate');
        expect(names).not.toContain('transform');
        expect(names).not.toContain('sharedName');
        expect(names).not.toContain('e');
        expect(names).not.toContain('item');
      });
    });
  });
});
