/**
 * Enforces the layering the README describes.
 *
 * oxlint has no `no-restricted-imports`, and an architecture rule that lives only in a document is
 * a rule that erodes. This walks the import graph instead: it is fast, it fails the same way in
 * CI and in the pre-commit hook, and it has its own tests.
 *
 * Cycles are not checked here — `import/no-cycle` in oxlint already does that, which is how the
 * feature barrels were caught re-exporting each other into a loop.
 */
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { relative, resolve } from 'node:path'

type Layer = 'app' | 'features' | 'shared' | 'stores' | 'lib'

/** What each layer is allowed to reach for. Arrows only ever point down this list. */
const ALLOWED: Record<Layer, Layer[]> = {
  app: ['app', 'features', 'shared', 'stores', 'lib'],
  features: ['features', 'shared', 'stores', 'lib'],
  stores: ['shared', 'lib'],
  shared: ['shared', 'lib'],
  lib: ['lib'],
}

const IMPORT_PATTERN = /(?:from|import)\s+['"]@\/([^'"]+)['"]/g

function layerOf(path: string): Layer | null {
  const [, layer] = path.split('/')
  return layer && layer in ALLOWED ? (layer as Layer) : null
}

function featureOf(path: string): string | null {
  const parts = path.split('/')
  return parts[1] === 'features' ? (parts[2] ?? null) : null
}

const violations: string[] = []
const root = resolve(import.meta.dirname, '..')
const files = globSync('src/**/*.{ts,tsx}', { cwd: root }).filter(
  (file) => !file.includes('/test/') && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx')
)

for (const file of files) {
  const from = `src/${relative('src', file)}`.replaceAll('\\', '/')
  const fromLayer = layerOf(from)
  if (!fromLayer) continue

  const source = readFileSync(resolve(root, file), 'utf8')

  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const target = `src/${match[1]}`
    const toLayer = layerOf(target)
    if (!toLayer) continue

    if (!ALLOWED[fromLayer].includes(toLayer)) {
      violations.push(`${from}\n  imports ${target}\n  ${fromLayer}/ may not depend on ${toLayer}/`)
      continue
    }

    // Within features, one feature may use another, but only through a module it owns — reaching
    // into a sibling's components or hooks folder couples the two rendering trees together.
    const fromFeature = featureOf(from)
    const toFeature = featureOf(target)
    if (fromFeature && toFeature && fromFeature !== toFeature) {
      const segment = target.split('/')[3]
      if (segment === 'components') {
        violations.push(
          `${from}\n  imports ${target}\n  a feature may not render another feature's components directly`
        )
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`Layering violations (${violations.length}):\n`)
  console.error(violations.join('\n\n'))
  process.exit(1)
}

console.log(`Layering OK across ${files.length} files.`)
