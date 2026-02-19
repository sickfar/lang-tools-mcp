import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { parseKotlin } from '../src/importCleaner.js';
import {
  detectUnusedParameters,
  detectUnusedLocalVariables,
  detectUnusedFields,
  detectUnusedPrivateMethods,
  KOTLIN_CONFIG,
} from '../src/deadCodeDetector.js';

describe('Kotlin Dead Code Detection', () => {
  describe('detectUnusedParameters', () => {
    it('should detect unused method parameter', () => {
      const code = `
class Test {
    fun process(data: String, unusedParam: Int) {
        println(data)
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('unused_parameter');
      expect(findings[0].name).toBe('unusedParam');
      expect(findings[0].enclosingScope).toContain('process');
    });

    it('should not flag parameters that are used', () => {
      const code = `
class Test {
    fun add(a: Int, b: Int): Int {
        return a + b
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should detect multiple unused parameters', () => {
      const code = `
class Test {
    fun process(used: String, unused1: Int, unused2: Double) {
        println(used)
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(2);
      const names = findings.map(f => f.name);
      expect(names).toContain('unused1');
      expect(names).toContain('unused2');
    });

    it('should skip override methods', () => {
      const code = `
class Test {
    override fun toString(): String {
        return "test"
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should skip _ parameter names', () => {
      const code = `
class Test {
    fun handleEvent(_: String, data: Int) {
        println(data)
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should handle methods with no parameters', () => {
      const code = `
class Test {
    fun noParams() {
        println("hello")
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should detect unused parameters in extension functions', () => {
      const code = `
fun String.process(unusedParam: Int) {
    println(this)
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(1);
      expect(findings[0].name).toBe('unusedParam');
    });

    it('should detect unused parameters in top-level functions', () => {
      const code = `
fun topLevel(used: String, unusedParam: Int) {
    println(used)
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(1);
      expect(findings[0].name).toBe('unusedParam');
    });

    it('should provide correct line numbers', () => {
      const code = `class Test {
    fun process(data: String, unusedParam: Int) {
        println(data)
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBeGreaterThan(0);
      expect(findings[0].column).toBeGreaterThanOrEqual(0);
    });

    it('should work with fixture file', () => {
      const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'kotlin', 'DeadCodeUnusedParams.kt');
      const code = fs.readFileSync(fixturePath, 'utf-8');
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      const names = findings.map(f => f.name);
      // Should detect unused params
      expect(names).toContain('unusedParam');
      expect(names).toContain('unused1');
      expect(names).toContain('unused2');
      expect(names).toContain('unusedExtParam');
      expect(names).toContain('unusedTop');

      // Should NOT detect used params or skipped ones
      expect(names).not.toContain('data');
      expect(names).not.toContain('a');
      expect(names).not.toContain('b');
      expect(names).not.toContain('used');
      expect(names).not.toContain('_');
      // Parameter used only in $greeting string template — should NOT be flagged
      expect(names).not.toContain('greeting');
    });
  });

  describe('detectUnusedLocalVariables', () => {
    it('should detect unused local variable', () => {
      const code = `
class Test {
    fun process() {
        val used = "hello"
        var unused = 42
        println(used)
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedLocalVariables(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('unused_local_variable');
      expect(findings[0].name).toBe('unused');
    });

    it('should not flag used local variables', () => {
      const code = `
class Test {
    fun process() {
        val a = 1
        val b = 2
        println(a + b)
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedLocalVariables(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should not flag class-level properties as local variables', () => {
      const code = `
class Test {
    val classField = "field"
    fun process() {
        println("hello")
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedLocalVariables(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should detect multiple unused locals', () => {
      const code = `
class Test {
    fun process() {
        val used = "hello"
        var unused1 = 1
        val unused2 = 2.0
        println(used)
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedLocalVariables(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(2);
      const names = findings.map(f => f.name);
      expect(names).toContain('unused1');
      expect(names).toContain('unused2');
    });

    it('should not flag for loop variables', () => {
      const code = `
class Test {
    fun process() {
        for (i in 0..10) {
            println(i)
        }
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedLocalVariables(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should work with fixture file', () => {
      const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'kotlin', 'DeadCodeUnusedLocals.kt');
      const code = fs.readFileSync(fixturePath, 'utf-8');
      const tree = parseKotlin(code);
      const findings = detectUnusedLocalVariables(tree, code, KOTLIN_CONFIG);

      const names = findings.map(f => f.name);
      expect(names).toContain('unused');
      expect(names).toContain('unused1');
      expect(names).toContain('unused2');
      expect(names).not.toContain('used');
      expect(names).not.toContain('a');
      expect(names).not.toContain('b');
      expect(names).not.toContain('classField');
      expect(names).not.toContain('i');
    });
  });

  describe('detectUnusedFields', () => {
    it('should detect unused private field', () => {
      const code = `
class Test {
    private val usedField = "hello"
    private var unusedField = 42

    fun process() {
        println(usedField)
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedFields(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('unused_field');
      expect(findings[0].name).toBe('unusedField');
    });

    it('should not flag non-private fields', () => {
      const code = `
class Test {
    val publicField = "pub"
    internal val internalField = "int"
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedFields(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should not flag data class properties', () => {
      const code = `
data class DataTest(val name: String, val age: Int)
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedFields(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should not flag delegated properties', () => {
      const code = `
class Test {
    private val lazyField by lazy { "value" }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedFields(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should work with fixture file', () => {
      const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'kotlin', 'DeadCodeUnusedFields.kt');
      const code = fs.readFileSync(fixturePath, 'utf-8');
      const tree = parseKotlin(code);
      const findings = detectUnusedFields(tree, code, KOTLIN_CONFIG);

      const names = findings.map(f => f.name);
      expect(names).toContain('unusedField');
      expect(names).not.toContain('usedField');
      expect(names).not.toContain('publicField');
      expect(names).not.toContain('name');
      expect(names).not.toContain('age');
      expect(names).not.toContain('lazyField');
    });
  });

  describe('detectUnusedPrivateMethods', () => {
    it('should detect unused private method', () => {
      const code = `
class Test {
    private fun usedMethod() {}
    private fun unusedMethod() {}

    fun process() {
        usedMethod()
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('unused_private_method');
      expect(findings[0].name).toBe('unusedMethod');
    });

    it('should not flag used private methods', () => {
      const code = `
class Test {
    private fun helper() {}

    fun process() {
        helper()
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should not flag non-private methods', () => {
      const code = `
class Test {
    fun publicMethod() {}
    internal fun internalMethod() {}
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should recognize callable references as usage', () => {
      const code = `
class Test {
    private fun referencedMethod() {}

    fun process() {
        val ref = ::referencedMethod
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should work with fixture file', () => {
      const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'kotlin', 'DeadCodeUnusedMethods.kt');
      const code = fs.readFileSync(fixturePath, 'utf-8');
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      const names = findings.map(f => f.name);
      expect(names).toContain('unusedMethod');
      expect(names).not.toContain('usedMethod');
      expect(names).not.toContain('usedViaReference');
      expect(names).not.toContain('publicMethod');
      expect(names).not.toContain('process');
    });

    it('should not count inner class usage as outer class usage', () => {
      const code = `
class Outer {
    private fun outerPrivate() {}

    inner class Inner {
        fun innerProcess() {
            outerPrivate()
        }
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      // outerPrivate called only from Inner - should be flagged as unused in Outer
      const outerFindings = findings.filter(f => f.enclosingScope === 'Outer');
      expect(outerFindings.map(f => f.name)).toContain('outerPrivate');
    });

    it('should detect unused private method called from lambda', () => {
      const code = `
class Test {
    private fun helper() {}

    fun process() {
        listOf(1).forEach { helper() }
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      // helper() is called from lambda inside the class - should be used
      expect(findings).toHaveLength(0);
    });

  });

  describe('anonymous object scope transparency (false positive fixes)', () => {
    it('should not flag private method called from anonymous object method', () => {
      const code = `
class Test {
    val handler = object : Runnable {
        override fun run() { doWork() }
    }
    private fun doWork() {}
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should not flag private method called from anonymous object property getter', () => {
      const code = `
interface Bridge<T> { val value: T }
class Test {
    val bridge = object : Bridge<Int> {
        override val value: Int get() = compute()
    }
    private fun compute(): Int = 42
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should not flag private method called from both class method and anonymous object', () => {
      const code = `
class Test {
    val handler = object : Runnable {
        override fun run() { helper() }
    }
    private fun helper() {}
    fun process() { helper() }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      expect(findings).toHaveLength(0);
    });

    it('should flag truly unused method while not flagging method used in anonymous object', () => {
      const code = `
class Test {
    val handler = object : Runnable {
        override fun run() { doWork() }
    }
    private fun doWork() {}
    private fun neverCalled() {}
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      const names = findings.map(f => f.name);
      expect(names).toContain('neverCalled');
      expect(names).not.toContain('doWork');
    });

    it('should flag private method called only from plain nested class (scope boundary preserved)', () => {
      const code = `
class Outer {
    class Nested {
        fun nestedWork() { outerHelper() }
    }
    private fun outerHelper() {}
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      // outerHelper is called only from Nested (a named class, hard boundary) — should be flagged
      const outerFindings = findings.filter(f => f.enclosingScope === 'Outer');
      expect(outerFindings.map(f => f.name)).toContain('outerHelper');
    });
  });

  describe('scope boundary: unused fields with inner classes', () => {
    it('should flag private field used only in inner class', () => {
      const code = `
class Outer {
    private val outerField = "hello"

    inner class Inner {
        fun process() {
            println(outerField)
        }
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedFields(tree, code, KOTLIN_CONFIG);

      // outerField used only in Inner - should be flagged as unused in Outer
      const outerFindings = findings.filter(f => f.enclosingScope === 'Outer');
      expect(outerFindings.map(f => f.name)).toContain('outerField');
    });

    it('should handle field used in init block', () => {
      const code = `
class Test(name: String) {
    private val initialized: Boolean
    init {
        initialized = true
    }
    fun isReady(): Boolean = initialized
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedFields(tree, code, KOTLIN_CONFIG);

      expect(findings.map(f => f.name)).not.toContain('initialized');
    });

    it('should scope companion object methods correctly', () => {
      const code = `
class Test {
    companion object {
        private fun companionHelper() {}
        fun create() { companionHelper() }
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      // companionHelper is used within companion - should NOT be flagged
      expect(findings.map(f => f.name)).not.toContain('companionHelper');
    });

    it('should flag unused companion object private method', () => {
      const code = `
class Test {
    companion object {
        private fun unusedCompanionHelper() {}
        fun create() {}
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      expect(findings.map(f => f.name)).toContain('unusedCompanionHelper');
    });
  });

  describe('comprehensive real-world scenarios', () => {
    const fixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'kotlin', 'DeadCodeComprehensive.kt');
    let code: string;
    let tree: ReturnType<typeof parseKotlin>;

    beforeAll(() => {
      code = fs.readFileSync(fixturePath, 'utf-8');
      tree = parseKotlin(code);
    });

    // --- Inline edge-case tests ---

    it('should not flag private method called from filter lambda', () => {
      const src = `
class Svc {
    private fun check(v: String): Boolean = v.isNotEmpty()
    fun run(items: List<String>) {
        items.filter { check(it) }
    }
}
`;
      const t = parseKotlin(src);
      const findings = detectUnusedPrivateMethods(t, src, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).not.toContain('check');
    });

    it('should not flag private method used via callable reference', () => {
      const src = `
class Svc {
    private fun transform(v: String): String = v.uppercase()
    fun run(items: List<String>) {
        items.map(::transform)
    }
}
`;
      const t = parseKotlin(src);
      const findings = detectUnusedPrivateMethods(t, src, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).not.toContain('transform');
    });

    it('should not flag private field used in custom getter', () => {
      const src = `
class Svc {
    private var _cache: String? = null
    val cache: String get() = _cache ?: "default"
}
`;
      const t = parseKotlin(src);
      const findings = detectUnusedFields(t, src, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).not.toContain('_cache');
    });

    it('should not flag lambda parameters as unused variables', () => {
      const src = `
class Svc {
    fun run(items: List<String>) {
        items.forEach { item -> println("x") }
    }
}
`;
      const t = parseKotlin(src);
      const localFindings = detectUnusedLocalVariables(t, src, KOTLIN_CONFIG);
      const paramFindings = detectUnusedParameters(t, src, KOTLIN_CONFIG);
      expect(localFindings.map(f => f.name)).not.toContain('item');
      expect(paramFindings.map(f => f.name)).not.toContain('item');
    });

    it('should not flag private field set in init and used in method', () => {
      const src = `
class Svc(name: String) {
    private val ready: Boolean
    init { ready = true }
    fun isReady(): Boolean = ready
}
`;
      const t = parseKotlin(src);
      const findings = detectUnusedFields(t, src, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).not.toContain('ready');
    });

    // --- Fixture integration test ---

    it('should detect all expected dead code in comprehensive fixture', () => {
      const allFindings = [
        ...detectUnusedParameters(tree, code, KOTLIN_CONFIG),
        ...detectUnusedLocalVariables(tree, code, KOTLIN_CONFIG),
        ...detectUnusedFields(tree, code, KOTLIN_CONFIG),
        ...detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG),
      ];

      const names = allFindings.map(f => f.name);

      // --- Should be FLAGGED ---
      expect(names).toContain('unusedConfig');        // unused private field in DataService
      expect(names).toContain('unusedFlag');           // unused parameter in processItems
      expect(names).toContain('unusedCount');          // unused local variable in processItems
      expect(names).toContain('unusedHelper');         // unused private method in DataService
      expect(names).toContain('outerData');            // used only in inner class
      expect(names).toContain('outerPrivateHelper');   // called only from inner class
      expect(names).toContain('unusedInnerProp');      // unused private field in Inner
      expect(names).toContain('unusedCompanionFun');   // unused private method in companion

      // --- Should NOT be flagged ---
      expect(names).not.toContain('logger');           // used in processItems
      expect(names).not.toContain('initialized');      // set in init, used in isReady
      expect(names).not.toContain('_cache');           // used in custom getter
      expect(names).not.toContain('sharedName');       // used in outerMethod
      expect(names).not.toContain('validate');         // called from lambda
      expect(names).not.toContain('transform');        // called via ::transform
      expect(names).not.toContain('create');           // called from companion's build
      expect(names).not.toContain('item');             // lambda param (invisible)
      expect(names).not.toContain('lazyValue');        // delegated property
      expect(names).not.toContain('id');               // data class
      expect(names).not.toContain('username');         // data class
      expect(names).not.toContain('email');            // data class
    });

    it('should work via detectDeadCodeInFile API', async () => {
      const { detectDeadCodeInFile } = await import('../src/deadCodeDetector.js');
      const result = detectDeadCodeInFile(fixturePath, 'kotlin');

      expect(result.error).toBeUndefined();
      expect(result.file).toBe(fixturePath);

      const names = result.findings.map(f => f.name);
      // Spot-check a few
      expect(names).toContain('unusedConfig');
      expect(names).toContain('unusedHelper');
      expect(names).not.toContain('validate');
      expect(names).not.toContain('logger');
    });
  });

  describe('companion object cross-scope access (false positive fixes)', () => {
    it('should NOT flag companion constant used in enclosing class', () => {
      const code = `
class Analytics {
    private val trendMonths = TREND_MONTHS

    companion object {
        private const val TREND_MONTHS = 3
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedFields(tree, code, KOTLIN_CONFIG);

      // TREND_MONTHS is used in enclosing class - should NOT be flagged
      expect(findings.map(f => f.name)).not.toContain('TREND_MONTHS');
    });

    it('should NOT flag companion method called from enclosing class', () => {
      const code = `
class Factory {
    fun build() = create()

    companion object {
        private fun create(): Factory = Factory()
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      // create() is called from enclosing class - should NOT be flagged
      expect(findings.map(f => f.name)).not.toContain('create');
    });

    it('should still flag truly unused companion members', () => {
      const code = `
class Service {
    companion object {
        private const val UNUSED_CONSTANT = 10
        private fun unusedHelper() {}
        fun publicFactory() {}
    }
}
`;
      const tree = parseKotlin(code);
      const fieldFindings = detectUnusedFields(tree, code, KOTLIN_CONFIG);
      const methodFindings = detectUnusedPrivateMethods(tree, code, KOTLIN_CONFIG);

      // Unused members SHOULD be flagged
      expect(fieldFindings.map(f => f.name)).toContain('UNUSED_CONSTANT');
      expect(methodFindings.map(f => f.name)).toContain('unusedHelper');
      // Public methods should NOT be flagged (not private)
      expect(methodFindings.map(f => f.name)).not.toContain('publicFactory');
    });

    it('should maintain nested class scope boundaries', () => {
      const code = `
class Outer {
    private val outerField = "test"

    class Inner {
        private val innerField = "inner"
        fun useInner() {
            println(innerField)
        }
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedFields(tree, code, KOTLIN_CONFIG);

      // outerField is only declared, never used - SHOULD be flagged
      expect(findings.map(f => f.name)).toContain('outerField');
      // innerField is used within Inner - should NOT be flagged
      expect(findings.map(f => f.name)).not.toContain('innerField');
    });
  });

  describe('function type parameters (false positive fixes)', () => {
    it('should ignore named parameters in function type signatures', () => {
      const code = `
class Aggregator {
    fun aggregate(
        aggregations: Map<String, (classIds: List<String>, date: String) -> Int>
    ) {
        println(aggregations)
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      // classIds and date are NOT method parameters, they're type annotation parameters
      // They should be IGNORED, not flagged as unused
      expect(findings.map(f => f.name)).not.toContain('classIds');
      expect(findings.map(f => f.name)).not.toContain('date');
      // aggregations is a real parameter and is used - should NOT be flagged
      expect(findings.map(f => f.name)).not.toContain('aggregations');
    });

    it('should still flag actual unused parameters', () => {
      const code = `
class Service {
    fun process(
        mapper: (String) -> Int,
        unusedFlag: Boolean
    ) {
        val result = mapper("test")
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      // mapper is used - should NOT be flagged
      expect(findings.map(f => f.name)).not.toContain('mapper');
      // unusedFlag is a real unused parameter - SHOULD be flagged
      expect(findings.map(f => f.name)).toContain('unusedFlag');
    });

    it('should handle nested function types', () => {
      const code = `
class Complex {
    fun transform(
        transformer: (List<String>) -> (name: String, count: Int) -> String
    ) {
        println(transformer)
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      // name and count are in nested function type - should be IGNORED
      expect(findings.map(f => f.name)).not.toContain('name');
      expect(findings.map(f => f.name)).not.toContain('count');
      // transformer is used - should NOT be flagged
      expect(findings.map(f => f.name)).not.toContain('transformer');
    });

    it('should distinguish formal params from function type params with same name (false positive fix)', () => {
      const code = `
class Tricky {
    fun process(
        date: String,
        mapper: (date: String) -> String
    ) {
        println(mapper)
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);

      // The formal parameter 'date' is unused - SHOULD be flagged
      expect(findings.map(f => f.name)).toContain('date');
      // mapper is used - should NOT be flagged
      expect(findings.map(f => f.name)).not.toContain('mapper');
      // Should only flag 'date' once (the formal parameter, not the type annotation one)
      expect(findings.filter(f => f.name === 'date')).toHaveLength(1);
    });
  });

  describe('false positives: override properties', () => {
    it('should not flag override val in anonymous object as unused local variable', () => {
      const code = `
interface Foo { val state: String }
class Test {
    fun method(): Foo {
        return object : Foo {
            override val state: String = "hello"
        }
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedLocalVariables(tree, code, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).not.toContain('state');
    });

    it('should not flag override var in anonymous object as unused local variable', () => {
      const code = `
interface Counter { var count: Int }
class Test {
    fun makeCounter(): Counter {
        return object : Counter {
            override var count: Int = 0
        }
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedLocalVariables(tree, code, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).not.toContain('count');
    });

    it('should not flag private override val at class level as unused field', () => {
      const code = `
interface Base { val state: String }
class Impl : Base {
    private override val state: String = "hello"
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedFields(tree, code, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).not.toContain('state');
    });

    it('should still flag non-override unused private fields', () => {
      const code = `
class Test {
    private val unused = "dead"
    fun doSomething() {}
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedFields(tree, code, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).toContain('unused');
    });
  });

  describe('false positives: string template $identifier usage', () => {
    it('should not flag parameter used only in simple $param string template', () => {
      const code = `
class Test {
    fun greet(name: String) {
        println("Hello \$name")
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).not.toContain('name');
    });

    it('should not flag local variable used only in simple $var string template', () => {
      const code = `
class Test {
    fun greet() {
        val name = "World"
        println("Hello \$name")
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedLocalVariables(tree, code, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).not.toContain('name');
    });

    it('should not flag private field used only in simple $field string template', () => {
      const code = `
class Test {
    private val greeting = "Hello"
    fun greet(name: String) {
        println("\$greeting \$name")
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedFields(tree, code, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).not.toContain('greeting');
    });

    it('should still flag parameters not used in any form', () => {
      const code = `
class Test {
    fun process(used: String, unused: Int) {
        println("Value: \$used")
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).not.toContain('used');
      expect(findings.map(f => f.name)).toContain('unused');
    });

    it('should recognize both $name and ${name} forms as usage', () => {
      const code = `
class Test {
    fun greet(firstName: String, lastName: String) {
        println("Hello \$firstName \${lastName}!")
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).not.toContain('firstName');
      expect(findings.map(f => f.name)).not.toContain('lastName');
    });

    it('should detect $identifier in multiline string literal (triple-quoted)', () => {
      const code = `
class Test {
    fun buildQuery(table: String) {
        val sql = """
            SELECT * FROM \$table
        """.trimIndent()
        println(sql)
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedParameters(tree, code, KOTLIN_CONFIG);
      expect(findings.map(f => f.name)).not.toContain('table');
    });

    it('should still flag non-override local in same method as override property', () => {
      // Verifies that hasOverrideModifier check is targeted:
      // only the override property is skipped, not other locals in the same method
      const code = `
interface Foo { val state: String }
class Test {
    fun method(): Foo {
        val unused = 42
        return object : Foo {
            override val state: String = "hello"
        }
    }
}
`;
      const tree = parseKotlin(code);
      const findings = detectUnusedLocalVariables(tree, code, KOTLIN_CONFIG);
      // 'unused' is genuinely unused - should be flagged
      expect(findings.map(f => f.name)).toContain('unused');
      // 'state' in the anonymous object has override - should NOT be flagged
      expect(findings.map(f => f.name)).not.toContain('state');
    });
  });
});
