/**
 * AST Utilities — Acorn-based JavaScript parsing helpers for adImporter.js
 *
 * Replaces fragile regex + brace-counting with proper AST parsing for:
 * - GSAP 3 → TweenMax conversion (call expression argument parsing)
 * - ES6 → ES5 conversion (arrow function scoping)
 * - Click tag extraction (call expression walking)
 */
import * as acorn from 'acorn'

/**
 * Safely parse JavaScript source into an AST.
 * Returns null if parsing fails (common with partial/malformed agency code).
 * Uses loose parsing with ecmaVersion 2020 to handle most agency code.
 */
export function tryParse(source) {
  try {
    return acorn.parse(source, {
      ecmaVersion: 2020,
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true,
      allowHashBang: true,
      locations: true,
    })
  } catch (e) {
    // Try as script (non-module)
    try {
      return acorn.parse(source, {
        ecmaVersion: 2020,
        sourceType: 'script',
        allowReturnOutsideFunction: true,
        allowHashBang: true,
        locations: true,
      })
    } catch (e2) {
      return null
    }
  }
}

/**
 * Walk an AST, calling visitor(node, parent) for every node.
 * Simple recursive walker — no dependency on acorn-walk.
 */
export function walk(node, visitor, parent) {
  if (!node || typeof node !== 'object') return
  if (node.type) {
    visitor(node, parent)
  }
  for (var key in node) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue
    var child = node[key]
    if (Array.isArray(child)) {
      for (var i = 0; i < child.length; i++) {
        if (child[i] && typeof child[i] === 'object' && child[i].type) {
          walk(child[i], visitor, node)
        }
      }
    } else if (child && typeof child === 'object' && child.type) {
      walk(child, visitor, node)
    }
  }
}

/**
 * Find all call expressions matching a pattern.
 * pattern can be:
 *   'gsap.to'         — matches gsap.to(...)
 *   'gsap.timeline'   — matches gsap.timeline(...)
 *   'appHost.*'       — matches any appHost method call
 *   '$.addEventListener' — won't work (use findCallsByArgument instead)
 *
 * Returns array of { node, object, method, args, start, end }
 */
export function findCallExpressions(source, pattern) {
  var ast = tryParse(source)
  if (!ast) return []

  var parts = pattern.split('.')
  var objName = parts[0]
  var methodName = parts.length > 1 ? parts[1] : null
  var results = []

  walk(ast, function(node) {
    if (node.type !== 'CallExpression') return

    var callee = node.callee
    if (callee.type === 'MemberExpression') {
      var obj = callee.object
      var prop = callee.property

      // Match object.method() pattern
      var objMatch = false
      if (obj.type === 'Identifier' && obj.name === objName) {
        objMatch = true
      }
      if (!objMatch) return

      var propName = prop.type === 'Identifier' ? prop.name : null
      if (methodName && methodName !== '*' && propName !== methodName) return

      results.push({
        node: node,
        object: objName,
        method: propName,
        args: node.arguments,
        start: node.start,
        end: node.end,
        calleeStart: callee.start,
        calleeEnd: callee.end,
      })
    }
  })

  return results
}

/**
 * Extract the source text of an AST node from the original source.
 */
export function nodeSource(source, node) {
  return source.substring(node.start, node.end)
}

/**
 * Find all arrow function expressions in the source.
 * Returns array of { node, params, body, start, end, isExpression }
 */
export function findArrowFunctions(source) {
  var ast = tryParse(source)
  if (!ast) return []

  var results = []
  walk(ast, function(node) {
    if (node.type !== 'ArrowFunctionExpression') return
    results.push({
      node: node,
      params: node.params,
      body: node.body,
      start: node.start,
      end: node.end,
      isExpression: node.body.type !== 'BlockStatement',
      async: node.async,
    })
  })

  // Sort deepest-first so inner arrows are converted before outer ones
  results.sort(function(a, b) { return b.start - a.start })
  return results
}

/**
 * Convert a single arrow function node to a regular function expression.
 * Returns the replacement string.
 */
export function arrowToFunction(source, arrowNode) {
  // Build params string
  var paramsStr = arrowNode.params.map(function(p) {
    return nodeSource(source, p)
  }).join(', ')

  var bodySource = nodeSource(source, arrowNode.body)

  if (arrowNode.isExpression) {
    // Expression body: (x) => x + 1  →  function(x) { return x + 1; }
    return 'function(' + paramsStr + ') { return ' + bodySource + '; }'
  } else {
    // Block body: (x) => { ... }  →  function(x) { ... }
    return 'function(' + paramsStr + ') ' + bodySource
  }
}

/**
 * Find all variable declarations using const or let.
 * Returns array of { node, kind, start, end, kindStart, kindEnd }
 */
export function findConstLet(source) {
  var ast = tryParse(source)
  if (!ast) return []

  var results = []
  walk(ast, function(node) {
    if (node.type !== 'VariableDeclaration') return
    if (node.kind === 'const' || node.kind === 'let') {
      results.push({
        node: node,
        kind: node.kind,
        start: node.start,
        end: node.end,
      })
    }
  })

  return results
}

/**
 * Find all template literals in the source.
 * Returns array of { node, start, end, expressions, quasis }
 */
export function findTemplateLiterals(source) {
  var ast = tryParse(source)
  if (!ast) return []

  var results = []
  walk(ast, function(node) {
    if (node.type !== 'TemplateLiteral') return
    results.push({
      node: node,
      start: node.start,
      end: node.end,
      expressions: node.expressions,
      quasis: node.quasis,
    })
  })

  // Sort deepest-first for safe replacement
  results.sort(function(a, b) { return b.start - a.start })
  return results
}

/**
 * Convert a template literal node to string concatenation.
 * `hello ${name}, you are ${age}` → "hello " + name + ", you are " + age + ""
 */
export function templateLiteralToConcat(source, node) {
  var parts = []
  for (var i = 0; i < node.quasis.length; i++) {
    var raw = node.quasis[i].value.raw
    if (raw) {
      // Escape any double quotes in the raw text
      parts.push('"' + raw.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"')
    }
    if (i < node.expressions.length) {
      var exprSource = nodeSource(source, node.expressions[i])
      if (raw) {
        parts.push(exprSource)
      } else {
        parts.push(exprSource)
      }
    }
  }
  // Filter empty strings and join with +
  var filtered = parts.filter(function(p) { return p !== '""' })
  return filtered.length > 0 ? filtered.join(' + ') : '""'
}

/**
 * Find all .includes() calls and return info for conversion to .indexOf()
 * Returns array of { node, object, argument, start, end }
 */
export function findIncludesCalls(source) {
  var ast = tryParse(source)
  if (!ast) return []

  var results = []
  walk(ast, function(node) {
    if (node.type !== 'CallExpression') return
    var callee = node.callee
    if (callee.type !== 'MemberExpression') return
    if (callee.property.type !== 'Identifier' || callee.property.name !== 'includes') return
    if (node.arguments.length < 1) return

    results.push({
      node: node,
      object: callee.object,
      argument: node.arguments[0],
      start: node.start,
      end: node.end,
    })
  })

  results.sort(function(a, b) { return b.start - a.start })
  return results
}

// ===== GSAP 3 Conversion Helpers =====

/**
 * Parse a GSAP 3 call expression's arguments using AST.
 * Given a call like gsap.to('#el', { duration: 1, opacity: 1 })
 * returns { selector, props, duration, position } with all source text extracted.
 *
 * This replaces the regex + brace-counting in convertGsapFullCall().
 */
export function parseGsapCallArgs(source, callNode) {
  var args = callNode.args || callNode.node?.arguments || callNode.arguments
  if (!args || args.length < 2) return null

  var selectorNode = args[0]
  var selector = nodeSource(source, selectorNode)

  // Check for hybrid format: gsap.to(sel, 0.5, {props}) — already has numeric duration
  var secondArg = args[1]
  if (secondArg.type === 'Literal' && typeof secondArg.value === 'number') {
    // Hybrid format — no conversion needed, just swap prefix
    return {
      format: 'hybrid',
      selector: selector,
      duration: nodeSource(source, secondArg),
      propsSource: args[2] ? nodeSource(source, args[2]) : '{}',
      position: args[3] ? nodeSource(source, args[3]) : null,
    }
  }

  // Standard GSAP 3 format: gsap.to(sel, { duration: 1, ...props })
  if (secondArg.type === 'ObjectExpression') {
    var duration = '0.5' // default
    var otherProps = []

    for (var i = 0; i < secondArg.properties.length; i++) {
      var prop = secondArg.properties[i]
      var keyName = prop.key.type === 'Identifier' ? prop.key.name :
                    prop.key.type === 'Literal' ? String(prop.key.value) : null

      if (keyName === 'duration') {
        duration = nodeSource(source, prop.value)
      } else {
        // Preserve the full property source (handles nested objects perfectly)
        otherProps.push(nodeSource(source, prop))
      }
    }

    return {
      format: 'gsap3',
      selector: selector,
      duration: duration,
      otherPropsSource: otherProps.join(', '),
      position: args[2] ? nodeSource(source, args[2]) : null,
    }
  }

  return null
}

/**
 * Parse a GSAP 3 fromTo call: gsap.fromTo(sel, {from}, {to})
 * The 'to' object contains duration, the 'from' object does not.
 */
export function parseGsapFromToArgs(source, callNode) {
  var args = callNode.args || callNode.node?.arguments || callNode.arguments
  if (!args || args.length < 3) return null

  var selector = nodeSource(source, args[0])
  var fromObj = args[1]
  var toObj = args[2]

  if (fromObj.type !== 'ObjectExpression' || toObj.type !== 'ObjectExpression') return null

  var fromSource = nodeSource(source, fromObj)
  var duration = '0.5'
  var toProps = []

  for (var i = 0; i < toObj.properties.length; i++) {
    var prop = toObj.properties[i]
    var keyName = prop.key.type === 'Identifier' ? prop.key.name :
                  prop.key.type === 'Literal' ? String(prop.key.value) : null

    if (keyName === 'duration') {
      duration = nodeSource(source, prop.value)
    } else {
      toProps.push(nodeSource(source, prop))
    }
  }

  return {
    selector: selector,
    fromSource: fromSource,
    duration: duration,
    toPropsSource: toProps.join(', '),
    position: args[3] ? nodeSource(source, args[3]) : null,
  }
}

/**
 * Build a TweenMax call string from parsed GSAP 3 args.
 */
export function buildTweenMaxCall(prefix, method, parsed) {
  if (!parsed) return null

  if (parsed.format === 'hybrid') {
    return prefix + '.' + method + '(' + parsed.selector + ', ' + parsed.duration + ', ' + parsed.propsSource + (parsed.position ? ', ' + parsed.position : '') + ')'
  }

  if (method === 'fromTo') {
    return prefix + '.' + method + '(' + parsed.selector + ', ' + parsed.duration + ', ' + parsed.fromSource + ', {' + parsed.toPropsSource + '}' + (parsed.position ? ', ' + parsed.position : '') + ')'
  }

  return prefix + '.' + method + '(' + parsed.selector + ', ' + parsed.duration + ', {' + parsed.otherPropsSource + '}' + (parsed.position ? ', ' + parsed.position : '') + ')'
}

// ===== Click Tag Extraction via AST =====

/**
 * Extract clickTag variable declarations from source.
 * Returns map of { clicktag1: 'https://...', clicktag2: '...' }
 */
export function extractClickTagVars(source) {
  var ast = tryParse(source)
  if (!ast) return {}

  var tags = {}
  walk(ast, function(node) {
    if (node.type !== 'VariableDeclarator') return
    if (node.id.type !== 'Identifier') return
    if (!/^clickTag\d*$/i.test(node.id.name)) return
    if (!node.init || node.init.type !== 'Literal') return
    tags[node.id.name.toLowerCase()] = node.init.value
  })

  return tags
}

/**
 * Find all appHost method calls in source.
 * Returns array of { method, args, url, start, end }
 */
export function findAppHostCalls(source) {
  var calls = findCallExpressions(source, 'appHost.*')
  return calls.map(function(c) {
    var url = null
    if (c.args.length > 0 && c.args[0].type === 'Literal') {
      url = c.args[0].value
    }
    return {
      method: c.method,
      args: c.args,
      url: url,
      start: c.start,
      end: c.end,
    }
  })
}

/**
 * Find window.open() calls in source.
 * Returns array of { url, start, end }
 */
export function findWindowOpenCalls(source) {
  var ast = tryParse(source)
  if (!ast) return []

  var results = []
  walk(ast, function(node) {
    if (node.type !== 'CallExpression') return
    var callee = node.callee
    // window.open(...) or just open(...)
    var isWindowOpen = (callee.type === 'MemberExpression' &&
      callee.object.type === 'Identifier' && callee.object.name === 'window' &&
      callee.property.type === 'Identifier' && callee.property.name === 'open')
    if (!isWindowOpen) return
    var url = null
    if (node.arguments.length > 0 && node.arguments[0].type === 'Literal') {
      url = node.arguments[0].value
    }
    results.push({ url: url, start: node.start, end: node.end })
  })

  return results
}
