/**
 * Dead code detection for Java and Kotlin files.
 * Detection only — never modifies source files.
 */

import Parser from "tree-sitter";
import * as fs from "fs";
import { parseJava, parseKotlin } from "./importCleaner.js";

// --- Types ---

export type DeadCodeCategory = 'unused_parameter' | 'unused_local_variable' | 'unused_field' | 'unused_private_method';

export interface DeadCodeFinding {
  category: DeadCodeCategory;
  name: string;
  line: number;    // 1-based
  column: number;  // 0-based
  enclosingScope: string;
  message: string;
}

export interface DeadCodeFileResult {
  file: string;
  findings: DeadCodeFinding[];
  error?: string;
}

// --- Language Config ---

export interface LanguageConfig {
  language: 'java' | 'kotlin';
  methodDeclarationTypes: string[];
  constructorDeclarationType: string;
  formalParameterTypes: string[];
  parameterNameNodeType: string;
  identifierTypes: string[];
  classDeclarationType: string;
  classBodyType: string;
  fieldDeclarationTypes: string[];
  localVariableDeclarationTypes: string[];
  methodBodyType: string;
  overrideAnnotation: string;
  modifierTypes: string[];
  privateKeyword: string;
  methodInvocationTypes: string[];
  methodReferenceTypes: string[];
}

export const JAVA_CONFIG: LanguageConfig = {
  language: 'java',
  methodDeclarationTypes: ['method_declaration'],
  constructorDeclarationType: 'constructor_declaration',
  formalParameterTypes: ['formal_parameter', 'spread_parameter'],
  parameterNameNodeType: 'identifier',
  identifierTypes: ['identifier', 'type_identifier'],
  classDeclarationType: 'class_declaration',
  classBodyType: 'class_body',
  fieldDeclarationTypes: ['field_declaration'],
  localVariableDeclarationTypes: ['local_variable_declaration'],
  methodBodyType: 'block',
  overrideAnnotation: 'Override',
  modifierTypes: ['modifiers'],
  privateKeyword: 'private',
  methodInvocationTypes: ['method_invocation'],
  methodReferenceTypes: ['method_reference'],
};

export const KOTLIN_CONFIG: LanguageConfig = {
  language: 'kotlin',
  methodDeclarationTypes: ['function_declaration'],
  constructorDeclarationType: 'primary_constructor',
  formalParameterTypes: ['parameter', 'class_parameter'],
  parameterNameNodeType: 'identifier',
  identifierTypes: ['identifier'],
  classDeclarationType: 'class_declaration',
  classBodyType: 'class_body',
  fieldDeclarationTypes: ['property_declaration'],
  localVariableDeclarationTypes: ['property_declaration'],
  methodBodyType: 'function_body',
  overrideAnnotation: 'override',
  modifierTypes: ['modifiers'],
  privateKeyword: 'private',
  methodInvocationTypes: ['call_expression'],
  methodReferenceTypes: ['callable_reference'],
};

// --- Helpers ---

/** Compare two tree-sitter nodes by position rather than object identity.
 *  tree-sitter's Node.js bindings may return different JavaScript wrapper objects
 *  for the same underlying C tree node depending on cache state, making `===`
 *  non-deterministic. Position comparison is always reliable within one tree. */
function sameNode(a: Parser.SyntaxNode, b: Parser.SyntaxNode): boolean {
  return a.startIndex === b.startIndex && a.endIndex === b.endIndex;
}

function getSourceText(node: Parser.SyntaxNode, sourceCode: string): string {
  return sourceCode.substring(node.startIndex, node.endIndex);
}

export function findNameNode(node: Parser.SyntaxNode, config: LanguageConfig): Parser.SyntaxNode | null {
  // Try field name 'name' first (works for Java)
  const fieldName = node.childForFieldName('name');
  if (fieldName) return fieldName;
  // Kotlin property_declaration: name is inside variable_declaration -> identifier
  if (config.language === 'kotlin' && node.type === 'property_declaration') {
    const varDecls = node.descendantsOfType('variable_declaration');
    if (varDecls.length > 0) {
      const ids = varDecls[0].descendantsOfType('identifier');
      if (ids.length > 0) return ids[0];
    }
    return null;
  }
  // Fallback for Kotlin: first identifier child
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)!;
    if (child.type === 'identifier') {
      return child;
    }
  }
  return null;
}

function getEnclosingClassName(node: Parser.SyntaxNode, sourceCode: string, config: LanguageConfig): string {
  let current = node.parent;
  while (current) {
    if (current.type === config.classDeclarationType) {
      const nameNode = findNameNode(current, config);
      if (nameNode) return getSourceText(nameNode, sourceCode);
    }
    current = current.parent;
  }
  return '<unknown>';
}

function getMethodName(methodNode: Parser.SyntaxNode, sourceCode: string, config: LanguageConfig): string {
  const nameNode = findNameNode(methodNode, config);
  if (nameNode) return getSourceText(nameNode, sourceCode);
  // For constructors, use the class name
  if (methodNode.type === config.constructorDeclarationType) {
    return getEnclosingClassName(methodNode, sourceCode, config);
  }
  return '<unknown>';
}

export function hasAnnotation(methodNode: Parser.SyntaxNode, annotationName: string, sourceCode: string, config: LanguageConfig): boolean {
  if (config.language === 'java') {
    // In Java, annotations are in a 'modifiers' node before the method
    for (let i = 0; i < methodNode.childCount; i++) {
      const child = methodNode.child(i)!;
      if (child.type === 'modifiers') {
        const markers = child.descendantsOfType('marker_annotation');
        const annotations = child.descendantsOfType('annotation');
        for (const marker of [...markers, ...annotations]) {
          const nameNode = marker.childForFieldName('name') ?? marker.descendantsOfType('identifier')[0];
          if (nameNode && getSourceText(nameNode, sourceCode) === annotationName) {
            return true;
          }
        }
      }
    }
  } else if (config.language === 'kotlin') {
    // In Kotlin, check for 'override' modifier
    for (let i = 0; i < methodNode.childCount; i++) {
      const child = methodNode.child(i)!;
      if (child.type === 'modifiers') {
        const text = getSourceText(child, sourceCode);
        if (text.includes(annotationName)) {
          return true;
        }
      }
    }
  }
  return false;
}

function isMainMethod(methodNode: Parser.SyntaxNode, sourceCode: string, config: LanguageConfig): boolean {
  if (config.language === 'java') {
    const name = getMethodName(methodNode, sourceCode, config);
    if (name !== 'main') return false;
    const text = getSourceText(methodNode, sourceCode);
    return text.includes('static') && text.includes('String[]');
  }
  return false;
}

function hasBody(methodNode: Parser.SyntaxNode, config: LanguageConfig): boolean {
  for (let i = 0; i < methodNode.childCount; i++) {
    const child = methodNode.child(i)!;
    if (child.type === config.methodBodyType || child.type === 'constructor_body' || child.type === 'block') {
      return true;
    }
  }
  return false;
}

function getMethodBody(methodNode: Parser.SyntaxNode, config: LanguageConfig): Parser.SyntaxNode | null {
  // Try field name 'body' first
  const bodyField = methodNode.childForFieldName('body');
  if (bodyField) return bodyField;
  // Fallback: find by type
  for (let i = 0; i < methodNode.childCount; i++) {
    const child = methodNode.child(i)!;
    if (child.type === config.methodBodyType || child.type === 'constructor_body' || child.type === 'block') {
      return child;
    }
  }
  return null;
}

export function collectIdentifiers(node: Parser.SyntaxNode, sourceCode: string, config: LanguageConfig): Set<string> {
  const ids = new Set<string>();
  for (const idType of config.identifierTypes) {
    const nodes = node.descendantsOfType(idType);
    for (const n of nodes) {
      ids.add(getSourceText(n, sourceCode));
    }
  }
  // Kotlin: also collect $identifier form from string templates (not parsed as AST identifier nodes)
  if (config.language === 'kotlin') {
    for (const id of extractKotlinStringTemplateIds(node, sourceCode)) {
      ids.add(id);
    }
  }
  return ids;
}

/** Check if an identifier node is in the same class scope as targetClassBody
 *  (i.e., no nested class_declaration/companion_object boundary between them) */
function isInSameClassScope(idNode: Parser.SyntaxNode, targetClassBody: Parser.SyntaxNode, config: LanguageConfig): boolean {
  let current = idNode.parent;
  while (current) {
    if (sameNode(current, targetClassBody)) return true;
    // If we hit another class body before reaching target, check if it's a companion object
    if (current.type === config.classBodyType && !sameNode(current, targetClassBody)) {
      // For Kotlin: anonymous object literals capture the enclosing scope, so their
      // class_body is transparent for scope traversal.
      if (config.language === 'kotlin' && current.parent?.type === 'object_literal') {
        current = current.parent;
        continue;
      }
      // For Kotlin: check bidirectional companion object transparency
      if (config.language === 'kotlin') {
        // Case 1: current class_body belongs to a companion_object inside targetClassBody
        // (identifier in companion, target is companion)
        if (current.parent?.type === 'companion_object') {
          const companionNode = current.parent;
          if (companionNode.parent && sameNode(companionNode.parent, targetClassBody)) {
            // Continue walking up - companion boundary is transparent
            current = current.parent;
            continue;
          }
        }
        // Case 2: current class_body is a parent class, and target belongs to a companion inside it
        // (identifier in parent class, target is companion)
        if (targetClassBody.parent?.type === 'companion_object') {
          const targetCompanionNode = targetClassBody.parent;
          if (targetCompanionNode.parent && sameNode(targetCompanionNode.parent, current)) {
            // Identifier in parent class, target is companion - they share scope
            return true;
          }
        }
      }
      // Otherwise, it's a nested class - different scope
      return false;
    }
    current = current.parent;
  }
  return false;
}

/** Collect identifiers within a class body, scoped to only the direct class (not nested classes) */
function collectScopedIdentifiers(
  classBody: Parser.SyntaxNode,
  sourceCode: string,
  config: LanguageConfig
): Array<{ name: string; node: Parser.SyntaxNode }> {
  const allIds: Array<{ name: string; node: Parser.SyntaxNode }> = [];

  // For Kotlin companion objects, also include identifiers from the parent class
  // since companion members are accessible from the enclosing class
  const bodiesToScan: Parser.SyntaxNode[] = [classBody];
  if (config.language === 'kotlin' && classBody.parent?.type === 'companion_object') {
    const companionNode = classBody.parent;
    const parentClassBody = companionNode.parent; // parent class's class_body
    if (parentClassBody && parentClassBody.type === config.classBodyType) {
      bodiesToScan.push(parentClassBody);
    }
  }

  for (const bodyToScan of bodiesToScan) {
    for (const idType of config.identifierTypes) {
      for (const idNode of bodyToScan.descendantsOfType(idType)) {
        if (isInSameClassScope(idNode, classBody, config)) {
          allIds.push({ name: getSourceText(idNode, sourceCode), node: idNode });
        }
      }
    }
  }
  return allIds;
}

/** Check if a parameter node is inside a function_type (type annotation) rather than a formal parameter list */
function isInsideFunctionType(paramNode: Parser.SyntaxNode): boolean {
  let current = paramNode.parent;
  while (current) {
    if (current.type === 'function_type') return true;
    // Stop at formal parameter container or method declaration
    if (current.type === 'function_value_parameters' || current.type === 'function_declaration') {
      return false;
    }
    current = current.parent;
  }
  return false;
}

// --- Detection Functions ---

export function detectUnusedParameters(
  tree: Parser.Tree,
  sourceCode: string,
  config: LanguageConfig
): DeadCodeFinding[] {
  const findings: DeadCodeFinding[] = [];
  const rootNode = tree.rootNode;

  // Collect all method and constructor declarations
  const methodTypes = [...config.methodDeclarationTypes, config.constructorDeclarationType];
  const methodNodes: Parser.SyntaxNode[] = [];
  for (const type of methodTypes) {
    methodNodes.push(...rootNode.descendantsOfType(type));
  }

  for (const methodNode of methodNodes) {
    // Skip methods without a body (abstract/interface)
    if (!hasBody(methodNode, config)) continue;

    // Skip @Override / override methods
    if (hasAnnotation(methodNode, config.overrideAnnotation, sourceCode, config)) continue;

    // Skip Java main method
    if (isMainMethod(methodNode, sourceCode, config)) continue;

    const methodName = getMethodName(methodNode, sourceCode, config);
    const className = getEnclosingClassName(methodNode, sourceCode, config);
    const enclosingScope = `${className}.${methodName}`;

    // Get method body
    const body = getMethodBody(methodNode, config);
    if (!body) continue;

    // Collect all identifier usages in the body
    const usedIds = collectIdentifiers(body, sourceCode, config);

    // Get parameter list
    const paramTypes = config.formalParameterTypes;
    const params: Parser.SyntaxNode[] = [];
    for (const pt of paramTypes) {
      params.push(...methodNode.descendantsOfType(pt));
    }

    for (const param of params) {
      // Skip parameters that are inside function_type nodes (type annotations, not formal params)
      if (isInsideFunctionType(param)) continue;

      // Get parameter name
      const nameNodes = param.descendantsOfType(config.parameterNameNodeType);
      if (nameNodes.length === 0) continue;

      // The parameter name is typically the last identifier in the parameter node
      // (after the type)
      let paramName: string | null = null;
      if (config.language === 'java') {
        // In Java formal_parameter: type identifier
        const nameField = param.childForFieldName('name');
        if (nameField) {
          paramName = getSourceText(nameField, sourceCode);
        } else {
          // Fallback: last identifier
          paramName = getSourceText(nameNodes[nameNodes.length - 1], sourceCode);
        }
      } else {
        // In Kotlin parameter: simple_identifier ':' type
        paramName = getSourceText(nameNodes[0], sourceCode);
      }

      if (!paramName) continue;

      // Skip Kotlin _ parameter names
      if (config.language === 'kotlin' && paramName === '_') continue;

      // Check if the parameter is used in the body
      if (!usedIds.has(paramName)) {
        findings.push({
          category: 'unused_parameter',
          name: paramName,
          line: param.startPosition.row + 1,
          column: param.startPosition.column,
          enclosingScope,
          message: `Parameter '${paramName}' is never used in method '${methodName}'`,
        });
      }
    }
  }

  return findings;
}

function isInsideFunctionBody(node: Parser.SyntaxNode, config: LanguageConfig): boolean {
  let current = node.parent;
  while (current) {
    if (current.type === config.methodBodyType || current.type === 'constructor_body' || current.type === 'block') {
      // Check if this block's parent is a method/constructor
      const blockParent = current.parent;
      if (blockParent) {
        const methodTypes = [...config.methodDeclarationTypes, config.constructorDeclarationType];
        if (methodTypes.includes(blockParent.type)) {
          return true;
        }
      }
    }
    // For Kotlin: function_body -> function_declaration
    if (config.language === 'kotlin' && current.type === 'function_body') {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isInsideForLoop(node: Parser.SyntaxNode): boolean {
  let current = node.parent;
  while (current) {
    if (current.type === 'for_statement' || current.type === 'enhanced_for_statement') {
      return true;
    }
    // Stop searching at method body level
    if (current.type === 'block' || current.type === 'function_body') {
      return false;
    }
    current = current.parent;
  }
  return false;
}

function getEnclosingMethod(node: Parser.SyntaxNode, config: LanguageConfig): Parser.SyntaxNode | null {
  let current = node.parent;
  while (current) {
    const methodTypes = [...config.methodDeclarationTypes, config.constructorDeclarationType];
    if (methodTypes.includes(current.type)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function getLocalVarName(node: Parser.SyntaxNode, sourceCode: string, config: LanguageConfig): string | null {
  if (config.language === 'java') {
    // local_variable_declaration -> variable_declarator -> name field
    const declarators = node.descendantsOfType('variable_declarator');
    if (declarators.length > 0) {
      const nameField = declarators[0].childForFieldName('name');
      if (nameField) return getSourceText(nameField, sourceCode);
    }
  } else {
    // Kotlin: property_declaration -> variable_declaration -> identifier
    const varDecls = node.descendantsOfType('variable_declaration');
    if (varDecls.length > 0) {
      const ids = varDecls[0].descendantsOfType('identifier');
      if (ids.length > 0) return getSourceText(ids[0], sourceCode);
    }
  }
  return null;
}

export function detectUnusedLocalVariables(
  tree: Parser.Tree,
  sourceCode: string,
  config: LanguageConfig
): DeadCodeFinding[] {
  const findings: DeadCodeFinding[] = [];
  const rootNode = tree.rootNode;

  const localVarNodes: Parser.SyntaxNode[] = [];
  for (const type of config.localVariableDeclarationTypes) {
    localVarNodes.push(...rootNode.descendantsOfType(type));
  }

  for (const varNode of localVarNodes) {
    // For Kotlin: skip class-level property_declaration (not local)
    if (config.language === 'kotlin') {
      if (!isInsideFunctionBody(varNode, config)) continue;
    }

    // Skip for loop variables
    if (isInsideForLoop(varNode)) continue;

    const varName = getLocalVarName(varNode, sourceCode, config);
    if (!varName) continue;

    // Skip Kotlin override properties (implementing interface contracts in anonymous objects)
    if (config.language === 'kotlin' && hasOverrideModifier(varNode, sourceCode)) continue;

    // Find the enclosing method body and check usage
    const enclosingMethod = getEnclosingMethod(varNode, config);
    if (!enclosingMethod) continue;

    const body = getMethodBody(enclosingMethod, config);
    if (!body) continue;

    // Collect all identifiers in the method body, excluding the declaration itself
    const allIds: Array<{ name: string; node: Parser.SyntaxNode }> = [];
    for (const idType of config.identifierTypes) {
      for (const idNode of body.descendantsOfType(idType)) {
        allIds.push({ name: getSourceText(idNode, sourceCode), node: idNode });
      }
    }

    // Kotlin: also check $identifier usage in string templates
    const stringTemplateIds = config.language === 'kotlin'
      ? extractKotlinStringTemplateIds(body, sourceCode)
      : new Set<string>();

    // Check if the variable name is used anywhere other than its own declaration
    const isUsed = allIds.some(({ name, node: idNode }) => {
      if (name !== varName) return false;
      // Skip identifiers that are part of the variable declaration itself
      let parent = idNode.parent;
      while (parent) {
        if (sameNode(parent, varNode)) return false;
        parent = parent.parent;
      }
      return true;
    }) || stringTemplateIds.has(varName);

    if (!isUsed) {
      const methodName = getMethodName(enclosingMethod, sourceCode, config);
      const className = getEnclosingClassName(enclosingMethod, sourceCode, config);
      const enclosingScope = `${className}.${methodName}`;

      findings.push({
        category: 'unused_local_variable',
        name: varName,
        line: varNode.startPosition.row + 1,
        column: varNode.startPosition.column,
        enclosingScope,
        message: `Local variable '${varName}' is never used in method '${methodName}'`,
      });
    }
  }

  return findings;
}

function isPrivateField(fieldNode: Parser.SyntaxNode, sourceCode: string, config: LanguageConfig): boolean {
  if (config.language === 'java') {
    const mods = fieldNode.descendantsOfType('modifiers');
    for (const mod of mods) {
      const text = getSourceText(mod, sourceCode);
      if (text.includes('private')) return true;
    }
    return false;
  } else {
    for (let i = 0; i < fieldNode.namedChildCount; i++) {
      const child = fieldNode.namedChild(i)!;
      if (child.type === 'modifiers') {
        const text = getSourceText(child, sourceCode);
        if (text.includes('private')) return true;
      }
    }
    return false;
  }
}

function getFieldName(fieldNode: Parser.SyntaxNode, sourceCode: string, config: LanguageConfig): string | null {
  if (config.language === 'java') {
    const declarators = fieldNode.descendantsOfType('variable_declarator');
    if (declarators.length > 0) {
      const nameField = declarators[0].childForFieldName('name');
      if (nameField) return getSourceText(nameField, sourceCode);
    }
  } else {
    const varDecls = fieldNode.descendantsOfType('variable_declaration');
    if (varDecls.length > 0) {
      const ids = varDecls[0].descendantsOfType('identifier');
      if (ids.length > 0) return getSourceText(ids[0], sourceCode);
    }
  }
  return null;
}

function isDataClass(classNode: Parser.SyntaxNode, sourceCode: string): boolean {
  for (let i = 0; i < classNode.namedChildCount; i++) {
    const child = classNode.namedChild(i)!;
    if (child.type === 'modifiers') {
      const text = getSourceText(child, sourceCode);
      if (text.includes('data')) return true;
    }
  }
  return false;
}

function hasDelegation(fieldNode: Parser.SyntaxNode): boolean {
  return fieldNode.descendantsOfType('property_delegate').length > 0;
}

// Note: text.includes('override') also matches custom annotation names that contain
// 'override' as a substring (e.g. @someOverride). This produces false negatives
// (missed dead code) rather than false positives — the safer direction for this tool.
// Consistent with isDataClass() and isPrivateField() patterns in this file.
export function hasOverrideModifier(node: Parser.SyntaxNode, sourceCode: string): boolean {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)!;
    if (child.type === 'modifiers') {
      const text = getSourceText(child, sourceCode);
      if (text.includes('override')) return true;
    }
  }
  return false;
}

/**
 * For Kotlin: extract identifiers from the simple `$identifier` (no-brace) string template form.
 * tree-sitter-kotlin v1.1.0 does NOT create identifier AST nodes for `$name` — it lexes the `$`
 * as a string_content node and folds the identifier text into the next string_content token.
 * Only the `${expr}` form creates an interpolation → identifier AST node (handled via
 * descendantsOfType). This function fills the gap for the `$name` form via regex.
 */
export function extractKotlinStringTemplateIds(node: Parser.SyntaxNode, sourceCode: string): Set<string> {
  const ids = new Set<string>();
  for (const strNode of node.descendantsOfType(['string_literal', 'multiline_string_literal'])) {
    const text = getSourceText(strNode, sourceCode);
    const matches = text.matchAll(/\$([a-zA-Z_]\w*)/g);
    for (const match of matches) {
      ids.add(match[1]);
    }
  }
  return ids;
}

export function detectUnusedFields(
  tree: Parser.Tree,
  sourceCode: string,
  config: LanguageConfig
): DeadCodeFinding[] {
  const findings: DeadCodeFinding[] = [];
  const rootNode = tree.rootNode;

  const scopes = collectClassScopes(rootNode, sourceCode, config);

  for (const { nameStr: classNameStr, classBody, ownerNode } of scopes) {
    if (config.language === 'kotlin' && ownerNode.type === config.classDeclarationType && isDataClass(ownerNode, sourceCode)) continue;

    const fieldNodes: Parser.SyntaxNode[] = [];
    for (const type of config.fieldDeclarationTypes) {
      for (const node of classBody.descendantsOfType(type)) {
        if (node.parent && sameNode(node.parent, classBody)) {
          fieldNodes.push(node);
        }
      }
    }

    // Kotlin: collect string template identifiers from this class scope once per class body.
    // Uses isInSameClassScope guard to exclude strings in nested class bodies.
    const classStringTemplateIds: Set<string> = config.language === 'kotlin'
      ? (() => {
          const ids = new Set<string>();
          for (const strNode of classBody.descendantsOfType(['string_literal', 'multiline_string_literal'])) {
            if (!isInSameClassScope(strNode, classBody, config)) continue;
            const text = getSourceText(strNode, sourceCode);
            const matches = text.matchAll(/\$([a-zA-Z_]\w*)/g);
            for (const match of matches) ids.add(match[1]);
          }
          return ids;
        })()
      : new Set<string>();

    for (const fieldNode of fieldNodes) {
      if (!isPrivateField(fieldNode, sourceCode, config)) continue;

      // Skip Kotlin override fields (implementing interface contracts)
      if (config.language === 'kotlin' && hasOverrideModifier(fieldNode, sourceCode)) continue;

      const fieldName = getFieldName(fieldNode, sourceCode, config);
      if (!fieldName) continue;

      if (config.language === 'java' && fieldName === 'serialVersionUID') continue;
      if (config.language === 'kotlin' && hasDelegation(fieldNode)) continue;

      const allIds = collectScopedIdentifiers(classBody, sourceCode, config);

      const isUsed = allIds.some(({ name, node: idNode }) => {
        if (name !== fieldName) return false;
        let parent = idNode.parent;
        while (parent) {
          if (sameNode(parent, fieldNode)) return false;
          parent = parent.parent;
        }
        return true;
      }) || classStringTemplateIds.has(fieldName);

      if (!isUsed) {
        findings.push({
          category: 'unused_field',
          name: fieldName,
          line: fieldNode.startPosition.row + 1,
          column: fieldNode.startPosition.column,
          enclosingScope: classNameStr,
          message: `Private field '${fieldName}' is never used in class '${classNameStr}'`,
        });
      }
    }
  }

  return findings;
}

function isPrivateMethod(methodNode: Parser.SyntaxNode, sourceCode: string, config: LanguageConfig): boolean {
  if (config.language === 'java') {
    const mods = methodNode.descendantsOfType('modifiers');
    for (const mod of mods) {
      const text = getSourceText(mod, sourceCode);
      if (text.includes('private')) return true;
    }
    return false;
  } else {
    for (let i = 0; i < methodNode.namedChildCount; i++) {
      const child = methodNode.namedChild(i)!;
      if (child.type === 'modifiers') {
        const text = getSourceText(child, sourceCode);
        if (text.includes('private')) return true;
      }
    }
    return false;
  }
}

interface ClassScope {
  nameStr: string;
  classBody: Parser.SyntaxNode;
  ownerNode: Parser.SyntaxNode;
}

function collectClassScopes(rootNode: Parser.SyntaxNode, sourceCode: string, config: LanguageConfig): ClassScope[] {
  const scopes: ClassScope[] = [];

  // Regular class declarations
  for (const classNode of rootNode.descendantsOfType(config.classDeclarationType)) {
    const classNameNode = findNameNode(classNode, config);
    const nameStr = classNameNode ? getSourceText(classNameNode, sourceCode) : '<unknown>';
    // Get direct class body (first one only)
    for (let i = 0; i < classNode.namedChildCount; i++) {
      const child = classNode.namedChild(i)!;
      if (child.type === config.classBodyType) {
        scopes.push({ nameStr, classBody: child, ownerNode: classNode });
        break;
      }
    }
  }

  // Kotlin companion objects
  if (config.language === 'kotlin') {
    for (const compObj of rootNode.descendantsOfType('companion_object')) {
      // Get parent class name
      const parentClass = compObj.parent?.parent; // class_body -> class_declaration
      const parentName = parentClass ? (findNameNode(parentClass, config) ? getSourceText(findNameNode(parentClass, config)!, sourceCode) : '<unknown>') : '<unknown>';
      const nameStr = `${parentName}.Companion`;
      for (let i = 0; i < compObj.namedChildCount; i++) {
        const child = compObj.namedChild(i)!;
        if (child.type === config.classBodyType) {
          scopes.push({ nameStr, classBody: child, ownerNode: compObj });
          break;
        }
      }
    }
  }

  return scopes;
}

export function detectUnusedPrivateMethods(
  tree: Parser.Tree,
  sourceCode: string,
  config: LanguageConfig
): DeadCodeFinding[] {
  const findings: DeadCodeFinding[] = [];
  const rootNode = tree.rootNode;

  const scopes = collectClassScopes(rootNode, sourceCode, config);

  for (const { nameStr: classNameStr, classBody } of scopes) {

    // Find private method declarations
    const methodNodes: Parser.SyntaxNode[] = [];
    for (const type of config.methodDeclarationTypes) {
      for (const node of classBody.descendantsOfType(type)) {
        if (node.parent && sameNode(node.parent, classBody) && isPrivateMethod(node, sourceCode, config)) {
          methodNodes.push(node);
        }
      }
    }

    // Collect method invocation names and method reference names, scoped to this class
    const calledNames = new Set<string>();

    // For Kotlin companion objects, also scan the parent class body
    // since companion members can be called from the enclosing class
    const bodiesToScan: Parser.SyntaxNode[] = [classBody];
    if (config.language === 'kotlin' && classBody.parent?.type === 'companion_object') {
      const companionNode = classBody.parent;
      const parentClassBody = companionNode.parent; // parent class's class_body
      if (parentClassBody && parentClassBody.type === config.classBodyType) {
        bodiesToScan.push(parentClassBody);
      }
    }

    // Method invocations
    for (const bodyToScan of bodiesToScan) {
      for (const invType of config.methodInvocationTypes) {
        for (const inv of bodyToScan.descendantsOfType(invType)) {
          if (!isInSameClassScope(inv, classBody, config)) continue;
          if (config.language === 'java') {
            const nameField = inv.childForFieldName('name');
            if (nameField) calledNames.add(getSourceText(nameField, sourceCode));
          } else {
            const firstChild = inv.namedChild(0);
            if (firstChild && firstChild.type === 'identifier') {
              calledNames.add(getSourceText(firstChild, sourceCode));
            } else if (firstChild && firstChild.type === 'navigation_expression') {
              // Extension function calls: obj.extFun() produces navigation_expression
              // Extract the last identifier (the function name after the dot)
              const ids = firstChild.descendantsOfType('identifier');
              if (ids.length > 0) {
                calledNames.add(getSourceText(ids[ids.length - 1], sourceCode));
              }
            }
          }
        }
      }
    }

    // Method references
    for (const bodyToScan of bodiesToScan) {
      for (const refType of config.methodReferenceTypes) {
        for (const ref of bodyToScan.descendantsOfType(refType)) {
          if (!isInSameClassScope(ref, classBody, config)) continue;
          const ids = ref.descendantsOfType('identifier');
          if (ids.length > 0) {
            calledNames.add(getSourceText(ids[ids.length - 1], sourceCode));
          }
        }
      }
    }

    for (const methodNode of methodNodes) {
      const methodName = getMethodName(methodNode, sourceCode, config);

      if (!calledNames.has(methodName)) {
        findings.push({
          category: 'unused_private_method',
          name: methodName,
          line: methodNode.startPosition.row + 1,
          column: methodNode.startPosition.column,
          enclosingScope: classNameStr,
          message: `Private method '${methodName}' is never called in class '${classNameStr}'`,
        });
      }
    }
  }

  return findings;
}

// --- Top-level API ---

export function detectDeadCodeInFile(
  filePath: string,
  language: 'java' | 'kotlin'
): DeadCodeFileResult {
  try {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const config = language === 'java' ? JAVA_CONFIG : KOTLIN_CONFIG;
    const tree = language === 'java' ? parseJava(sourceCode) : parseKotlin(sourceCode);

    const findings: DeadCodeFinding[] = [
      ...detectUnusedParameters(tree, sourceCode, config),
      ...detectUnusedLocalVariables(tree, sourceCode, config),
      ...detectUnusedFields(tree, sourceCode, config),
      ...detectUnusedPrivateMethods(tree, sourceCode, config),
    ];

    return { file: filePath, findings };
  } catch (error) {
    return {
      file: filePath,
      findings: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
