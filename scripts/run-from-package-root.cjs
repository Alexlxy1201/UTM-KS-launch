const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { execFileSync } = require('node:child_process')

function normalizePath(input) {
  return String(input || '').replace(/^\\\\\?\\/, '')
}

function getProjectRoot() {
  const packageJsonPath = normalizePath(process.env.npm_package_json)
  if (packageJsonPath) {
    return path.dirname(packageJsonPath)
  }

  return normalizePath(process.cwd())
}

async function run(task) {
  const root = getProjectRoot()

  switch (task) {
    case 'dev':
      await import(pathToFileURL(path.join(root, 'scripts', 'dev.mjs')).href)
      return
    case 'build':
      execFileSync(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-b'], {
        cwd: root,
        stdio: 'inherit',
      })
      await import(pathToFileURL(path.join(root, 'scripts', 'build.mjs')).href)
      return
    case 'lint':
      execFileSync(process.execPath, [path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js'), '.'], {
        cwd: root,
        stdio: 'inherit',
      })
      return
    case 'preview':
      await import(pathToFileURL(path.join(root, 'scripts', 'preview.mjs')).href)
      return
    default:
      throw new Error(`Unknown task: ${task}`)
  }
}

module.exports = (task) => {
  void run(task).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

if (require.main === module) {
  module.exports(process.argv[2])
}
