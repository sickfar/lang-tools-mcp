/**
 * Cross-file public dead code detection for Java and Kotlin.
 * Detection only -- never modifies source files.
 */

import Parser from 'tree-sitter';
import * as fs from 'fs';
import * as path from 'path';
import { parseJava, parseKotlin } from './importCleaner.js';
import {
  JAVA_CONFIG,
  KOTLIN_CONFIG,
  LanguageConfig,
  collectIdentifiers,
  extractKotlinStringTemplateIds,
  hasAnnotation,
  hasOverrideModifier,
} from './deadCodeDetector.js';
import {
  ResolvedRules,
  ResolvedCondition,
  ResolvedEntrypoint,
  annotationMatchesImport,
  interfaceIsFromPackage,
} from './profileConfig.js';

// --- Types ---

export type PublicDeadCodeCategory =
  | 'unused_public_method'
  | 'unused_public_field'
  | 'unused_public_class'
  | 'unused_protected_method'
  | 'unused_protected_field';

export interface PublicDeadCodeFinding {
  category: PublicDeadCodeCategory;
  name: string;
  line: number;
  column: number;
  enclosingScope: string;
  message: string;
}

export interface PublicDeadCodeFileResult {
  file: string;
  findings: PublicDeadCodeFinding[];
  error?: string;
}

export interface PublicDeadCodeResult {
  status: 'OK';
  sourceRoots: string[];
  filesAnalyzed: number;
  activeProfiles: string[];
  totalFindings: number;
  files: PublicDeadCodeFileResult[];
}

// Internal declaration type
type Visibility = 'public' | 'protected' | 'internal';
type DeclCategory = 'class' | 'method' | 'field';

interface Declaration {
  name: string;
  file: string;
  line: number;
  column: number;
  declCategory: DeclCategory;
  visibility: Visibility;
  enclosingClass: string;
  isAbstract: boolean;
  isOverride: boolean;
  annotationNames: string[];
  implementedInterfaces: string[];
  isDataClassMember: boolean;
  isEnumConstant: boolean;
  isMainMethod: boolean;
  node: Parser.SyntaxNode;
  sourceCode: string;
  filePackage: string;
  fileImports: string[];
}

// --- File package and import extraction -------------------------------------

/**
 * Extracts the package name from a Java file's AST.
 * Returns empty string if there is no package declaration.
 */
export function extractFilePackageJava(rootNode: Parser.SyntaxNode, sourceCode: string): string {
  for (let i = 0; i < rootNode.childCount; i++) {
    const child = rootNode.child(i)!;
    if (child.type === 'package_declaration') {
      // package_declaration: "package" scoped_identifier ";"
      // The scoped_identifier is the package name
      const nameNode = child.childForFieldName('name') ?? child.descendantsOfType('scoped_identifier')[0];
      if (nameNode) return sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
      // Fallback: collect identifier nodes
      const ids = child.descendantsOfType('identifier');
      if (ids.length > 0) {
        // Reconstruct from the full child text minus "package" keyword and ";"
        const text = sourceCode.substring(child.startIndex, child.endIndex);
        return text.replace(/^\s*package\s+/, '').replace(/\s*;\s*$/, '').trim();
      }
      return '';
    }
  }
  return '';
}

/**
 * Extracts import FQNs from a Java file's AST.
 * Static imports are skipped. Wildcard imports are preserved as-is (e.g. org.springframework.*).
 */
export function extractFileImportsJava(rootNode: Parser.SyntaxNode, sourceCode: string): string[] {
  const imports: string[] = [];
  for (let i = 0; i < rootNode.childCount; i++) {
    const child = rootNode.child(i)!;
    if (child.type === 'import_declaration') {
      const text = sourceCode.substring(child.startIndex, child.endIndex);
      // Skip static imports
      if (text.includes('static')) continue;
      // Extract the FQN: remove "import " prefix and ";" suffix, trim whitespace
      const fqn = text.replace(/^\s*import\s+/, '').replace(/\s*;\s*$/, '').trim();
      if (fqn) imports.push(fqn);
    }
  }
  return imports;
}

/**
 * Extracts the package name from a Kotlin file's AST.
 * Returns empty string if there is no package header.
 */
export function extractFilePackageKotlin(rootNode: Parser.SyntaxNode, sourceCode: string): string {
  // Try 'package_header' first, then 'package' as fallback
  const pkgNodes = rootNode.descendantsOfType('package_header');
  const pkgNode = pkgNodes.length > 0 ? pkgNodes[0] : rootNode.descendantsOfType('package')[0];
  if (!pkgNode) return '';
  const text = sourceCode.substring(pkgNode.startIndex, pkgNode.endIndex);
  // Strip "package" keyword and trim, ignoring trailing newline content
  const firstNewline = text.indexOf('\n');
  const line = firstNewline !== -1 ? text.substring(0, firstNewline) : text;
  return line.replace(/^\s*package\s+/, '').trim();
}

/**
 * Extracts import FQNs from a Kotlin file's AST.
 * Aliased imports (import Foo as Bar) are stored as the original FQN (alias stripped).
 * Wildcard imports are preserved as-is.
 *
 * Note: tree-sitter-kotlin uses node type 'import' (not 'import_header').
 * Nodes with childCount === 0 are keyword leaf nodes and must be skipped.
 */
export function extractFileImportsKotlin(rootNode: Parser.SyntaxNode, sourceCode: string): string[] {
  const imports: string[] = [];
  // Use descendantsOfType to handle both 'import' and 'import_header' variants
  const importNodes = [
    ...rootNode.descendantsOfType('import').filter(n => n.childCount > 0),
    ...rootNode.descendantsOfType('import_header').filter(n => n.childCount > 0),
  ];
  for (const importNode of importNodes) {
    let text = sourceCode.substring(importNode.startIndex, importNode.endIndex);
    // Trim to first newline (node may include trailing whitespace/comments)
    const firstNewline = text.indexOf('\n');
    if (firstNewline !== -1) text = text.substring(0, firstNewline);
    // Remove "import " prefix
    let fqn = text.replace(/^\s*import\s+/, '').trim();
    // Strip alias: "org.example.Foo as Bar" -> "org.example.Foo"
    const asMatch = fqn.match(/^(.+?)\s+as\s+\w+$/);
    if (asMatch) {
      fqn = asMatch[1].trim();
    }
    if (fqn) imports.push(fqn);
  }
  return imports;
}

// --- Helpers ---

function getSourceText(node: Parser.SyntaxNode, sourceCode: string): string {
  return sourceCode.substring(node.startIndex, node.endIndex);
}

function findNameNode(node: Parser.SyntaxNode, config: LanguageConfig): Parser.SyntaxNode | null {
  const fieldName = node.childForFieldName('name');
  if (fieldName) return fieldName;
  // Kotlin property_declaration: name is always inside variable_declaration -> identifier.
  // IMPORTANT: Do NOT check direct named children first for property_declaration,
  // because the initializer expression (e.g. 'val y = usedTopProp') also has identifier children.
  if (config.language === 'kotlin' && node.type === 'property_declaration') {
    const varDecls = node.descendantsOfType('variable_declaration');
    if (varDecls.length > 0) {
      const ids = varDecls[0].descendantsOfType('identifier');
      if (ids.length > 0) return ids[0];
    }
    return null;
  }
  // Direct named identifier child (handles Kotlin function_declaration, class_declaration, etc.)
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child && child.type === 'identifier') return child;
  }
  // Generic Kotlin fallback: first identifier inside variable_declaration
  if (config.language === 'kotlin') {
    const varDecls = node.descendantsOfType('variable_declaration');
    if (varDecls.length > 0) {
      const ids = varDecls[0].descendantsOfType('identifier');
      if (ids.length > 0) return ids[0];
    }
  }
  return null;
}

/**
 * Collect "reference" identifiers from a file -- identifiers that appear
 * as uses/references, NOT as the defining name in a declaration.
 * This prevents declaration names from polluting the global "used names" set.
 */
function collectReferenceIdentifiers(
  rootNode: Parser.SyntaxNode,
  sourceCode: string,
  config: LanguageConfig,
): Set<string> {
  const ids = new Set<string>();

  // Node types that define a name -- we need to mark their name-identifier positions
  const JAVA_DECL_TYPES = [
    'method_declaration', 'class_declaration', 'enum_declaration',
    'interface_declaration', 'annotation_type_declaration',
    'variable_declarator', 'enum_constant', 'constructor_declaration',
  ];
  const KOTLIN_DECL_TYPES = [
    'function_declaration', 'class_declaration', 'property_declaration',
    'enum_entry', 'object_declaration', 'companion_object',
  ];
  const declTypes = config.language === 'java' ? JAVA_DECL_TYPES : KOTLIN_DECL_TYPES;

  // Collect start positions of identifier nodes that ARE definition names
  const defPositions = new Set<number>();

  for (const declType of declTypes) {
    const declNodes = rootNode.descendantsOfType(declType);
    for (const dn of declNodes) {
      // Try the 'name' field first (works for Java methods/classes, Kotlin functions/classes)
      const nameNode = dn.childForFieldName('name');
      if (nameNode && config.identifierTypes.includes(nameNode.type)) {
        defPositions.add(nameNode.startIndex);
      } else {
        // Use findNameNode which handles Kotlin property_declaration
        // by going through variable_declaration -> identifier
        const found = findNameNode(dn, config);
        if (found) defPositions.add(found.startIndex);
      }
    }
  }

  // Kotlin: variable_declaration nodes wrap the property name.
  // Mark the first identifier inside each variable_declaration as a definition.
  if (config.language === 'kotlin') {
    const varDecls = rootNode.descendantsOfType('variable_declaration');
    for (const vd of varDecls) {
      const idNodes = vd.descendantsOfType('identifier');
      if (idNodes.length > 0) {
        defPositions.add(idNodes[0].startIndex);
      }
    }

    // class_parameter with val/var -- the parameter name is a definition
    const classParams = rootNode.descendantsOfType('class_parameter');
    for (const cp of classParams) {
      const cpText = sourceCode.substring(cp.startIndex, cp.endIndex);
      if (cpText.includes('val') || cpText.includes('var')) {
        const nameNode = cp.childForFieldName('name');
        if (nameNode) defPositions.add(nameNode.startIndex);
        else {
          const found = findNameNode(cp, config);
          if (found) defPositions.add(found.startIndex);
        }
      }
    }
  }

  // Collect all identifier nodes, skipping definition positions
  for (const idType of config.identifierTypes) {
    const nodes = rootNode.descendantsOfType(idType);
    for (const n of nodes) {
      if (!defPositions.has(n.startIndex)) {
        ids.add(sourceCode.substring(n.startIndex, n.endIndex));
      }
    }
  }

  // Kotlin: also collect $identifier form from string templates
  if (config.language === 'kotlin') {
    for (const id of extractKotlinStringTemplateIds(rootNode, sourceCode)) {
      ids.add(id);
    }
  }

  return ids;
}


// Java: modifiers can be unnamed children (raw keyword tokens), so use childCount/child.
function getJavaVisibility(node: Parser.SyntaxNode, sourceCode: string): Visibility | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === 'modifiers') {
      const text = getSourceText(child, sourceCode);
      if (text.includes('private')) return null;
      if (text.includes('public')) return 'public';
      if (text.includes('protected')) return 'protected';
      return null; // package-private
    }
  }
  return null; // no modifiers = package-private
}

// Kotlin: modifiers is always a named child (AST node), so namedChildCount/namedChild is correct.
function getKotlinVisibility(node: Parser.SyntaxNode, sourceCode: string): Visibility | null {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)!;
    if (child.type === 'modifiers') {
      const text = getSourceText(child, sourceCode);
      if (text.includes('private')) return null;
      if (text.includes('protected')) return 'protected';
      if (text.includes('internal')) return 'internal';
      return 'public'; // explicit public or no visibility modifier = public
    }
  }
  return 'public'; // no modifiers at all = public in Kotlin
}

function getAnnotationNamesJava(node: Parser.SyntaxNode, sourceCode: string): string[] {
  const names: string[] = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === 'modifiers') {
      const markers = child.descendantsOfType('marker_annotation');
      const annotations = child.descendantsOfType('annotation');
      for (const ann of [...markers, ...annotations]) {
        const nameNode = ann.childForFieldName('name') ?? ann.descendantsOfType('identifier')[0];
        if (nameNode) names.push(getSourceText(nameNode, sourceCode));
      }
    }
  }
  return names;
}

function getAnnotationNamesKotlin(node: Parser.SyntaxNode, sourceCode: string): string[] {
  const names: string[] = [];
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)!;
    if (child.type === 'modifiers') {
      const annotations = child.descendantsOfType('user_type');
      for (const ann of annotations) {
        names.push(getSourceText(ann, sourceCode));
      }
    }
  }
  return names;
}

function getImplementedInterfacesJava(classNode: Parser.SyntaxNode, sourceCode: string): string[] {
  const names: string[] = [];
  for (let i = 0; i < classNode.childCount; i++) {
    const child = classNode.child(i)!;
    if (child.type === 'super_interfaces' || child.type === 'implements') {
      const typeList = child.descendantsOfType('type_identifier');
      for (const t of typeList) names.push(getSourceText(t, sourceCode));
    }
    // Also handle extends (for abstract class hierarchy)
    if (child.type === 'superclass') {
      const typeList = child.descendantsOfType('type_identifier');
      for (const t of typeList) names.push(getSourceText(t, sourceCode));
    }
  }
  return names;
}

function getImplementedInterfacesKotlin(classNode: Parser.SyntaxNode, sourceCode: string): string[] {
  const names: string[] = [];
  // delegation_specifier list in Kotlin
  const delegationSpecifiers = classNode.descendantsOfType('delegation_specifier');
  for (const ds of delegationSpecifiers) {
    const typeRefs = ds.descendantsOfType('user_type');
    for (const t of typeRefs) {
      // Kotlin uses 'identifier' (not 'type_identifier') inside user_type
      const simpleName = t.descendantsOfType('identifier')[0];
      if (simpleName) names.push(getSourceText(simpleName, sourceCode));
    }
  }
  return names;
}

function isAbstractDecl(node: Parser.SyntaxNode, sourceCode: string): boolean {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)!;
    if (child.type === 'modifiers') {
      const text = getSourceText(child, sourceCode);
      if (text.includes('abstract')) return true;
    }
  }
  // Java: check child nodes too (modifiers as unnamed children)
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === 'modifiers') {
      const text = getSourceText(child, sourceCode);
      if (text.includes('abstract')) return true;
    }
  }
  return false;
}

function isMainMethodDecl(node: Parser.SyntaxNode, sourceCode: string, config: LanguageConfig): boolean {
  if (config.language !== 'java') return false;
  const nameNode = findNameNode(node, config);
  if (!nameNode || getSourceText(nameNode, sourceCode) !== 'main') return false;
  const text = getSourceText(node, sourceCode);
  return text.includes('static') && text.includes('String[]');
}

function isDataClassNode(classNode: Parser.SyntaxNode, sourceCode: string): boolean {
  for (let i = 0; i < classNode.namedChildCount; i++) {
    const child = classNode.namedChild(i)!;
    if (child.type === 'modifiers') {
      const text = getSourceText(child, sourceCode);
      if (text.includes('data')) return true;
    }
  }
  return false;
}

const DATA_CLASS_GENERATED = new Set(['copy', 'equals', 'hashCode', 'toString']);
const COMPONENT_PATTERN = /^component\d+$/;

function isDataClassGeneratedMember(name: string): boolean {
  return DATA_CLASS_GENERATED.has(name) || COMPONENT_PATTERN.test(name);
}

// --- Entrypoint matching ---

/**
 * Checks a single condition against a declaration using full import resolution.
 * - annotatedBy: simple name must match AND file must import the FQN (exact or wildcard)
 * - implementsInterfaceFromPackage / extendsFromPackage: interface resolved via file imports
 * - overridesMethodFromInterface: isOverride AND interface from package
 * - namePattern / packagePattern: regex match against name / file package
 * - interfaces: simple name match against implementedInterfaces (no import resolution)
 * - serviceDiscovery: name found in META-INF/services
 */
function matchesCondition(
  decl: Declaration,
  cond: ResolvedCondition,
  serviceNames: Set<string>,
): boolean {
  switch (cond.type) {
    case 'annotatedBy': {
      const lastDot = cond.fqn.lastIndexOf('.');
      const simpleName = lastDot === -1 ? cond.fqn : cond.fqn.substring(lastDot + 1);
      if (!decl.annotationNames.includes(simpleName)) return false;
      return decl.fileImports.some(imp => annotationMatchesImport(cond.fqn, imp));
    }
    case 'implementsInterfaceFromPackage':
      return decl.implementedInterfaces.some(i =>
        interfaceIsFromPackage(i, cond.pattern, decl.fileImports)
      );
    case 'extendsFromPackage':
      return decl.implementedInterfaces.some(i =>
        interfaceIsFromPackage(i, cond.pattern, decl.fileImports)
      );
    case 'overridesMethodFromInterface':
      if (!decl.isOverride) return false;
      return decl.implementedInterfaces.some(i =>
        interfaceIsFromPackage(i, cond.pattern, decl.fileImports)
      );
    case 'namePattern':
      return cond.regex.test(decl.name);
    case 'packagePattern':
      return cond.regex.test(decl.filePackage);
    case 'interfaces':
      return decl.implementedInterfaces.includes(cond.name);
    case 'serviceDiscovery':
      return serviceNames.has(decl.name) || serviceNames.has(decl.enclosingClass);
  }
}

function matchesEntrypoint(
  decl: Declaration,
  ep: ResolvedEntrypoint,
  serviceNames: Set<string>,
): boolean {
  return ep.conditions.every(c => matchesCondition(decl, c, serviceNames));
}

function isAliveByAnyEntrypoint(
  decl: Declaration,
  rules: ResolvedRules,
  serviceNames: Set<string>,
): boolean {
  return rules.entrypoints.some(ep => matchesEntrypoint(decl, ep, serviceNames));
}

// --- Service Discovery ---

function loadServiceDiscoveryNames(sourceRoots: string[]): Set<string> {
  const names = new Set<string>();
  for (const root of sourceRoots) {
    const metaInf = path.join(root, 'META-INF', 'services');
    if (!fs.existsSync(metaInf)) continue;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(metaInf, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const file of entries) {
      if (!file.isFile()) continue;
      let content: string;
      try {
        content = fs.readFileSync(path.join(metaInf, file.name), 'utf-8');
      } catch {
        continue;
      }
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split('.');
          names.add(parts[parts.length - 1]);
        }
      }
    }
  }
  return names;
}

// --- Pass 1: Declaration Collection ---

function collectDeclarationsJava(
  filePath: string,
  rootNode: Parser.SyntaxNode,
  sourceCode: string,
): Declaration[] {
  const decls: Declaration[] = [];
  const config = JAVA_CONFIG;
  const filePackage = extractFilePackageJava(rootNode, sourceCode);
  const fileImports = extractFileImportsJava(rootNode, sourceCode);

  function processClass(classNode: Parser.SyntaxNode, parentInterfaces: string[]) {
    const classNameNode = findNameNode(classNode, config);
    if (!classNameNode) return;
    const className = getSourceText(classNameNode, sourceCode);

    // Collect interfaces/supertypes for this class
    const classInterfaces = getImplementedInterfacesJava(classNode, sourceCode);

    // Report the class itself if public/protected
    const classVisibility = getJavaVisibility(classNode, sourceCode);
    if (classVisibility !== null) {
      decls.push({
        name: className,
        file: filePath,
        line: classNode.startPosition.row + 1,
        column: classNode.startPosition.column,
        declCategory: 'class',
        visibility: classVisibility,
        enclosingClass: className,
        isAbstract: isAbstractDecl(classNode, sourceCode),
        isOverride: false,
        annotationNames: getAnnotationNamesJava(classNode, sourceCode),
        implementedInterfaces: classInterfaces,
        isDataClassMember: false,
        isEnumConstant: false,
        isMainMethod: false,
        node: classNode,
        sourceCode,
        filePackage,
        fileImports,
      });
    }

    // Find the class body
    let classBody: Parser.SyntaxNode | null = null;
    for (let i = 0; i < classNode.childCount; i++) {
      const child = classNode.child(i)!;
      if (child.type === 'class_body' || child.type === 'enum_body') {
        classBody = child;
        break;
      }
    }
    if (!classBody) return;

    const isEnum = classNode.type === 'enum_declaration';

    // Collect children of classBody AND enum_body_declarations (for Java enums)
    const bodyChildren: Parser.SyntaxNode[] = [];
    for (let bi = 0; bi < classBody.childCount; bi++) {
      const bc = classBody.child(bi);
      if (bc && bc.type === 'enum_body_declarations') {
        for (let bj = 0; bj < bc.childCount; bj++) {
          const ec = bc.child(bj);
          if (ec) bodyChildren.push(ec);
        }
      } else if (bc) {
        bodyChildren.push(bc);
      }
    }
    for (const child of bodyChildren) {

      // Nested classes
      if (child.type === 'class_declaration' || child.type === 'enum_declaration' || child.type === 'interface_declaration') {
        processClass(child, classInterfaces);
        continue;
      }

      // Enum constants
      if (child.type === 'enum_constant') {
        const nameNode = findNameNode(child, config);
        if (nameNode) {
          decls.push({
            name: getSourceText(nameNode, sourceCode),
            file: filePath,
            line: child.startPosition.row + 1,
            column: child.startPosition.column,
            declCategory: 'field',
            visibility: 'public',
            enclosingClass: className,
            isAbstract: false,
            isOverride: false,
            annotationNames: [],
            implementedInterfaces: classInterfaces,
            isDataClassMember: false,
            isEnumConstant: true,
            isMainMethod: false,
            node: child,
            sourceCode,
            filePackage,
            fileImports,
          });
        }
        continue;
      }

      // Methods
      if (child.type === 'method_declaration') {
        const visibility = getJavaVisibility(child, sourceCode);
        if (visibility === null) continue;
        const nameNode = findNameNode(child, config);
        if (!nameNode) continue;
        const name = getSourceText(nameNode, sourceCode);
        const isMain = isMainMethodDecl(child, sourceCode, config);
        const isOverride = hasAnnotation(child, 'Override', sourceCode, config);
        decls.push({
          name,
          file: filePath,
          line: child.startPosition.row + 1,
          column: child.startPosition.column,
          declCategory: 'method',
          visibility,
          enclosingClass: className,
          isAbstract: isAbstractDecl(child, sourceCode),
          isOverride,
          annotationNames: getAnnotationNamesJava(child, sourceCode),
          implementedInterfaces: classInterfaces,
          isDataClassMember: false,
          isEnumConstant: false,
          isMainMethod: isMain,
          node: child,
          sourceCode,
          filePackage,
          fileImports,
        });
        continue;
      }

      // Fields
      if (child.type === 'field_declaration') {
        const visibility = getJavaVisibility(child, sourceCode);
        if (visibility === null) continue;
        // Multiple declarators possible: int a, b;
        const declarators = child.descendantsOfType('variable_declarator');
        for (const decl of declarators) {
          const nameNode = findNameNode(decl, config);
          if (!nameNode) continue;
          const name = getSourceText(nameNode, sourceCode);
          decls.push({
            name,
            file: filePath,
            line: decl.startPosition.row + 1,
            column: decl.startPosition.column,
            declCategory: 'field',
            visibility,
            enclosingClass: className,
            isAbstract: false,
            isOverride: false,
            annotationNames: getAnnotationNamesJava(child, sourceCode),
            implementedInterfaces: classInterfaces,
            isDataClassMember: false,
            isEnumConstant: isEnum,
            isMainMethod: false,
            node: decl,
            sourceCode,
            filePackage,
            fileImports,
          });
        }
        continue;
      }
    }
  }

  // Process top-level classes
  for (let i = 0; i < rootNode.childCount; i++) {
    const child = rootNode.child(i)!;
    if (child.type === 'class_declaration' || child.type === 'enum_declaration' || child.type === 'interface_declaration') {
      processClass(child, []);
    }
  }

  return decls;
}

function collectDeclarationsKotlin(
  filePath: string,
  rootNode: Parser.SyntaxNode,
  sourceCode: string,
): Declaration[] {
  const decls: Declaration[] = [];
  const config = KOTLIN_CONFIG;
  const filePackage = extractFilePackageKotlin(rootNode, sourceCode);
  const fileImports = extractFileImportsKotlin(rootNode, sourceCode);

  function processClass(classNode: Parser.SyntaxNode) {
    const classNameNode = findNameNode(classNode, config);
    if (!classNameNode) return;
    const className = getSourceText(classNameNode, sourceCode);

    const classInterfaces = getImplementedInterfacesKotlin(classNode, sourceCode);
    const isData = isDataClassNode(classNode, sourceCode);

    // Report the class itself
    const classVisibility = getKotlinVisibility(classNode, sourceCode);
    if (classVisibility !== null) {
      decls.push({
        name: className,
        file: filePath,
        line: classNode.startPosition.row + 1,
        column: classNode.startPosition.column,
        declCategory: 'class',
        visibility: classVisibility,
        enclosingClass: className,
        isAbstract: isAbstractDecl(classNode, sourceCode),
        isOverride: false,
        annotationNames: getAnnotationNamesKotlin(classNode, sourceCode),
        implementedInterfaces: classInterfaces,
        isDataClassMember: false,
        isEnumConstant: false,
        isMainMethod: false,
        node: classNode,
        sourceCode,
        filePackage,
        fileImports,
      });
    }

    // Find class body
    let classBody: Parser.SyntaxNode | null = null;
    for (let i = 0; i < classNode.childCount; i++) {
      const child = classNode.child(i)!;
      if (child.type === 'class_body' || child.type === 'enum_class_body') {
        classBody = child;
        break;
      }
    }

    // Also handle primary constructor parameters with val/var (class properties)
    const primaryConstructor = classNode.childForFieldName('primary_constructor') ??
      classNode.descendantsOfType('primary_constructor')[0];
    if (primaryConstructor) {
      const params = primaryConstructor.descendantsOfType('class_parameter');
      for (const param of params) {
        const paramText = getSourceText(param, sourceCode);
        if (!paramText.includes('val') && !paramText.includes('var')) continue;
        const nameNode = findNameNode(param, config);
        if (!nameNode) continue;
        const name = getSourceText(nameNode, sourceCode);
        const visibility = getKotlinVisibility(param, sourceCode);
        if (visibility === null) continue;
        const isDataMember = isData && isDataClassGeneratedMember(name);
        decls.push({
          name,
          file: filePath,
          line: param.startPosition.row + 1,
          column: param.startPosition.column,
          declCategory: 'field',
          visibility,
          enclosingClass: className,
          isAbstract: false,
          isOverride: hasOverrideModifier(param, sourceCode),
          annotationNames: getAnnotationNamesKotlin(param, sourceCode),
          implementedInterfaces: classInterfaces,
          isDataClassMember: isDataMember,
          isEnumConstant: false,
          isMainMethod: false,
          node: param,
          sourceCode,
          filePackage,
          fileImports,
        });
      }
    }

    if (!classBody) return;

    for (let i = 0; i < classBody.childCount; i++) {
      const child = classBody.child(i)!;

      // Nested classes
      if (child.type === 'class_declaration') {
        processClass(child);
        continue;
      }

      // Companion objects
      if (child.type === 'companion_object') {
        processCompanionObject(child, className, classInterfaces);
        continue;
      }

      // Enum entries
      if (child.type === 'enum_entry') {
        const nameNode = findNameNode(child, config);
        if (nameNode) {
          decls.push({
            name: getSourceText(nameNode, sourceCode),
            file: filePath,
            line: child.startPosition.row + 1,
            column: child.startPosition.column,
            declCategory: 'field',
            visibility: 'public',
            enclosingClass: className,
            isAbstract: false,
            isOverride: false,
            annotationNames: [],
            implementedInterfaces: classInterfaces,
            isDataClassMember: false,
            isEnumConstant: true,
            isMainMethod: false,
            node: child,
            sourceCode,
            filePackage,
            fileImports,
          });
        }
        continue;
      }

      // Functions
      if (child.type === 'function_declaration') {
        const visibility = getKotlinVisibility(child, sourceCode);
        if (visibility === null) continue;
        const nameNode = findNameNode(child, config);
        if (!nameNode) continue;
        const name = getSourceText(nameNode, sourceCode);
        const isOverride = hasOverrideModifier(child, sourceCode);
        const isDataMember = isData && isDataClassGeneratedMember(name);
        decls.push({
          name,
          file: filePath,
          line: child.startPosition.row + 1,
          column: child.startPosition.column,
          declCategory: 'method',
          visibility,
          enclosingClass: className,
          isAbstract: isAbstractDecl(child, sourceCode),
          isOverride,
          annotationNames: getAnnotationNamesKotlin(child, sourceCode),
          implementedInterfaces: classInterfaces,
          isDataClassMember: isDataMember,
          isEnumConstant: false,
          isMainMethod: false,
          node: child,
          sourceCode,
          filePackage,
          fileImports,
        });
        continue;
      }

      // Properties
      if (child.type === 'property_declaration') {
        const visibility = getKotlinVisibility(child, sourceCode);
        if (visibility === null) continue;
        const nameNode = findNameNode(child, config);
        if (!nameNode) continue;
        const name = getSourceText(nameNode, sourceCode);
        const isOverride = hasOverrideModifier(child, sourceCode);
        const isDataMember = isData && isDataClassGeneratedMember(name);
        decls.push({
          name,
          file: filePath,
          line: child.startPosition.row + 1,
          column: child.startPosition.column,
          declCategory: 'field',
          visibility,
          enclosingClass: className,
          isAbstract: isAbstractDecl(child, sourceCode),
          isOverride,
          annotationNames: getAnnotationNamesKotlin(child, sourceCode),
          implementedInterfaces: classInterfaces,
          isDataClassMember: isDataMember,
          isEnumConstant: false,
          isMainMethod: false,
          node: child,
          sourceCode,
          filePackage,
          fileImports,
        });
        continue;
      }
    }
  }

  function processCompanionObject(
    companionNode: Parser.SyntaxNode,
    ownerClassName: string,
    ownerInterfaces: string[],
  ) {
    let classBody: Parser.SyntaxNode | null = null;
    for (let i = 0; i < companionNode.childCount; i++) {
      const child = companionNode.child(i)!;
      if (child.type === 'class_body') { classBody = child; break; }
    }
    if (!classBody) return;

    for (let i = 0; i < classBody.childCount; i++) {
      const child = classBody.child(i)!;

      if (child.type === 'function_declaration') {
        const visibility = getKotlinVisibility(child, sourceCode);
        if (visibility === null) continue;
        const nameNode = findNameNode(child, config);
        if (!nameNode) continue;
        const name = getSourceText(nameNode, sourceCode);
        decls.push({
          name,
          file: filePath,
          line: child.startPosition.row + 1,
          column: child.startPosition.column,
          declCategory: 'method',
          visibility,
          enclosingClass: ownerClassName,
          isAbstract: false,
          isOverride: hasOverrideModifier(child, sourceCode),
          annotationNames: getAnnotationNamesKotlin(child, sourceCode),
          implementedInterfaces: ownerInterfaces,
          isDataClassMember: false,
          isEnumConstant: false,
          isMainMethod: false,
          node: child,
          sourceCode,
          filePackage,
          fileImports,
        });
      }

      if (child.type === 'property_declaration') {
        const visibility = getKotlinVisibility(child, sourceCode);
        if (visibility === null) continue;
        const nameNode = findNameNode(child, config);
        if (!nameNode) continue;
        const name = getSourceText(nameNode, sourceCode);
        decls.push({
          name,
          file: filePath,
          line: child.startPosition.row + 1,
          column: child.startPosition.column,
          declCategory: 'field',
          visibility,
          enclosingClass: ownerClassName,
          isAbstract: false,
          isOverride: hasOverrideModifier(child, sourceCode),
          annotationNames: getAnnotationNamesKotlin(child, sourceCode),
          implementedInterfaces: ownerInterfaces,
          isDataClassMember: false,
          isEnumConstant: false,
          isMainMethod: false,
          node: child,
          sourceCode,
          filePackage,
          fileImports,
        });
      }
    }
  }

  // Top-level functions and properties
  for (let i = 0; i < rootNode.childCount; i++) {
    const child = rootNode.child(i)!;

    if (child.type === 'class_declaration') {
      processClass(child);
      continue;
    }

    if (child.type === 'function_declaration') {
      const visibility = getKotlinVisibility(child, sourceCode);
      if (visibility === null) continue;
      const nameNode = findNameNode(child, config);
      if (!nameNode) continue;
      const name = getSourceText(nameNode, sourceCode);
      decls.push({
        name,
        file: filePath,
        line: child.startPosition.row + 1,
        column: child.startPosition.column,
        declCategory: 'method',
        visibility,
        enclosingClass: '<top-level>',
        isAbstract: false,
        isOverride: false,
        annotationNames: getAnnotationNamesKotlin(child, sourceCode),
        implementedInterfaces: [],
        isDataClassMember: false,
        isEnumConstant: false,
        // Kotlin: any top-level `fun main(...)` is a program entry point regardless
        // of its parameter signature, unlike Java's strict `public static void main(String[])`.
        isMainMethod: name === 'main',
        node: child,
        sourceCode,
        filePackage,
        fileImports,
      });
      continue;
    }

    if (child.type === 'property_declaration') {
      const visibility = getKotlinVisibility(child, sourceCode);
      if (visibility === null) continue;
      const nameNode = findNameNode(child, config);
      if (!nameNode) continue;
      const name = getSourceText(nameNode, sourceCode);
      decls.push({
        name,
        file: filePath,
        line: child.startPosition.row + 1,
        column: child.startPosition.column,
        declCategory: 'field',
        visibility,
        enclosingClass: '<top-level>',
        isAbstract: false,
        isOverride: false,
        annotationNames: getAnnotationNamesKotlin(child, sourceCode),
        implementedInterfaces: [],
        isDataClassMember: false,
        isEnumConstant: false,
        isMainMethod: false,
        node: child,
        sourceCode,
        filePackage,
        fileImports,
      });
      continue;
    }
  }

  return decls;
}

// --- Resolution ---

function buildFindingCategory(
  decl: Declaration,
): PublicDeadCodeCategory {
  if (decl.declCategory === 'class') return 'unused_public_class';
  if (decl.declCategory === 'method') {
    return decl.visibility === 'protected' ? 'unused_protected_method' : 'unused_public_method';
  }
  return decl.visibility === 'protected' ? 'unused_protected_field' : 'unused_public_field';
}

function buildFindingMessage(decl: Declaration): string {
  const kind = decl.declCategory === 'method' ? 'method' : decl.declCategory === 'field' ? 'field' : 'class';
  const scope = decl.enclosingClass === '<top-level>' ? 'top-level' : `class ${decl.enclosingClass}`;
  return `${decl.visibility} ${kind} '${decl.name}' in ${scope} appears to be unused`;
}

// --- Main export ---

export function detectPublicDeadCodeInFiles(
  filePaths: string[],
  language: 'java' | 'kotlin',
  resolvedRules: ResolvedRules,
  sourceRoots: string[],
  activeProfiles: string[],
): PublicDeadCodeResult {
  const config = language === 'java' ? JAVA_CONFIG : KOTLIN_CONFIG;
  const parseFile = language === 'java' ? parseJava : parseKotlin;

  // Service discovery names — load only if any entrypoint uses serviceDiscovery condition
  const hasServiceDiscovery = resolvedRules.entrypoints.some(ep =>
    ep.conditions.some(c => c.type === 'serviceDiscovery')
  );
  const serviceNames = hasServiceDiscovery
    ? loadServiceDiscoveryNames(sourceRoots)
    : new Set<string>();

  // Pass 1: collect all declarations
  const allDeclarations: Declaration[] = [];
  const fileErrors: Map<string, string> = new Map();

  // Pass 2: collect all used identifiers (global)
  const globalUsedNames = new Set<string>();

  // Parse each file
  const parsedFiles: Array<{ path: string; rootNode: Parser.SyntaxNode; sourceCode: string }> = [];
  for (const filePath of filePaths) {
    let sourceCode: string;
    try {
      sourceCode = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      fileErrors.set(filePath, String(err));
      continue;
    }

    let tree: Parser.Tree;
    try {
      tree = parseFile(sourceCode);
    } catch (err) {
      fileErrors.set(filePath, String(err));
      continue;
    }

    if (tree.rootNode.hasError) {
      // Skip files with syntax errors gracefully
      fileErrors.set(filePath, 'Syntax error in file');
      continue;
    }

    parsedFiles.push({ path: filePath, rootNode: tree.rootNode, sourceCode });

    // Collect declarations from this file
    let fileDecls: Declaration[];
    if (language === 'java') {
      fileDecls = collectDeclarationsJava(filePath, tree.rootNode, sourceCode);
    } else {
      fileDecls = collectDeclarationsKotlin(filePath, tree.rootNode, sourceCode);
    }
    allDeclarations.push(...fileDecls);

    // Collect used identifiers from this file
    const ids = collectReferenceIdentifiers(tree.rootNode, sourceCode, config);
    for (const id of ids) globalUsedNames.add(id);
  }

  // Pass 3: for each declaration, determine if it's dead

  // Build class-level cascade: class declarations that match any entrypoint protect all
  // their members (methods, fields) transitively.
  const classProtectedByEntrypoint = new Set<string>();
  for (const decl of allDeclarations) {
    if (decl.declCategory !== 'class') continue;
    if (isAliveByAnyEntrypoint(decl, resolvedRules, serviceNames)) {
      classProtectedByEntrypoint.add(decl.name);
    }
  }

  // Group findings per file
  const findingsPerFile = new Map<string, PublicDeadCodeFinding[]>();
  for (const fp of filePaths) findingsPerFile.set(fp, []);

  for (const decl of allDeclarations) {
    // Hardcoded skips
    if (decl.isEnumConstant) continue;
    if (decl.isMainMethod) continue;
    if (decl.isDataClassMember) continue;

    // 1. Name in global used set -> alive
    if (globalUsedNames.has(decl.name)) continue;

    // 2. Class cascade: enclosing class protected by entrypoint -> member alive
    if (classProtectedByEntrypoint.has(decl.enclosingClass)) continue;

    // 3. Declaration directly matched by any entrypoint -> alive
    if (isAliveByAnyEntrypoint(decl, resolvedRules, serviceNames)) continue;

    // 4. Override handling
    if (decl.isOverride) {
      // Check if any OTHER declaration has the same name (internal override)
      const isInternalOverride = allDeclarations.some(
        d => d !== decl && d.name === decl.name
      );
      if (isInternalOverride) continue; // internal override -> alive
      // External override
      if (resolvedRules.keepExternalOverrides) continue;
      // keepExternalOverrides = false -> fall through to dead
    }

    // 5. Abstract method: if abstract and a concrete impl exists elsewhere
    if (decl.isAbstract) {
      const hasConcreteImpl = allDeclarations.some(
        d => d !== decl && d.name === decl.name && !d.isAbstract
      );
      if (hasConcreteImpl) continue;
    }

    // 6. Concrete implementation of an abstract method -> alive even without @Override
    //    If an abstract declaration with the same name exists in any analyzed file, this
    //    concrete method is its implementation and is kept alive.
    if (!decl.isAbstract && !decl.isOverride) {
      const hasAbstractCounterpart = allDeclarations.some(
        d => d !== decl && d.name === decl.name && d.isAbstract
      );
      if (hasAbstractCounterpart) continue;
    }

    // Dead
    const findings = findingsPerFile.get(decl.file);
    if (!findings) continue;
    findings.push({
      category: buildFindingCategory(decl),
      name: decl.name,
      line: decl.line,
      column: decl.column,
      enclosingScope: decl.enclosingClass,
      message: buildFindingMessage(decl),
    });
  }

  // Build result
  const fileResults: PublicDeadCodeFileResult[] = [];
  for (const fp of filePaths) {
    const findings = findingsPerFile.get(fp) ?? [];
    const error = fileErrors.get(fp);
    if (error !== undefined) {
      fileResults.push({ file: fp, findings: [], error });
    } else {
      fileResults.push({ file: fp, findings });
    }
  }

  const totalFindings = fileResults.reduce((sum, f) => sum + f.findings.length, 0);

  return {
    status: 'OK',
    sourceRoots,
    filesAnalyzed: parsedFiles.length,
    activeProfiles,
    totalFindings,
    files: fileResults,
  };
}
