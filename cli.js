#!/usr/bin/env node

const { Octokit } = require('octokit')
const { createOAuthDeviceAuth } = require('@octokit/auth-oauth-device')
const inquirer = require('inquirer')
const open = require('open')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const pipeline = require('stream/promises').pipeline
const spawn = require('child_process').spawn
const org = 'ietf-tools'

inquirer.registerPrompt('search-list', require('inquirer-search-list'))

async function main () {
  const argv = require('yargs')
    .scriptName('pypi-publish')
    .usage('$0 [args]')
    .options({
      't': {
        alias: 'target',
        describe: 'Target PyPI repository',
        choices: ['pypi', 'testpypi'],
        type: 'string'
      },
      'u': {
        alias: 'user',
        describe: 'PyPI username',
        type: 'string'
      },
      'p': {
        alias: 'pass',
        describe: 'PyPI password',
        type: 'string'
      },
      'i': {
        alias: 'identity',
        describe: 'GPG identity to use for package signing',
        type: 'string'
      },
      'g': {
        alias: 'project',
        describe: 'GitHub project (repository) to publish from',
        type: 'string'
      },
      'r': {
        alias: 'release',
        describe: 'GitHub release to publish',
        type: 'string'
      },
      'python-path': {
        describe: 'Path to Python executable',
        type: 'string'
      }
    })
    .help()
    .alias('h', 'help')
    .alias('v', 'version')
    .epilogue('All arguments are optional and will be prompted if not provided.')
    .argv

  console.info('===========================')
  console.info('IETF Python Publishing Tool')
  console.info('===========================\n')

  const ora = (await import('ora')).default
  const clipboardy = (await import('clipboardy')).default
  const got = (await import('got')).default
  const chalk = (await import('chalk')).default

  const optsPrompt = await inquirer.prompt([
    {
      type: 'input',
      name: 'python',
      message: 'Enter path to Python executable:',
      default: process.env.PYTHONHOME || process.env.PYTHON || '',
      validate (v) {
        return (v && v.length > 1) || 'Enter a valid Python path'
      }
    },
    {
      type: 'list',
      name: 'pypi',
      message: 'Select the target PyPI repository:',
      default: 0,
      choices: ['pypi', 'testpypi']
    },
    {
      type: 'input',
      name: 'user',
      message: 'Enter your PyPI username:',
      validate (v) {
        return (v && v.length > 0) || 'Enter a valid PyPI username'
      }
    },
    {
      type: 'password',
      name: 'pass',
      message: 'Enter your PyPI password:',
      validate (v) {
        return (v && v.length > 3) || 'Enter a PyPI password'
      }
    },
    {
      type: 'input',
      name: 'gpgidentity',
      message: 'Enter the GPG identity to use for signing (leave empty for default):'
    }
  ], {
    ...argv.pythonPath && { python: argv.pythonPath },
    ...argv.t && { pypi: argv.t },
    ...argv.u && { user: argv.u },
    ...argv.p && { pass: argv.p },
    ...argv.i && { gpgidentity: argv.i }
  })
  if (!optsPrompt?.python) {
    console.error(chalk.redBright('No Python path entered. Exiting...'))
    process.exit(1)
  }

  const spinnerAuth = ora('Waiting for GitHub authentication to complete...')

  const gh = new Octokit({
    userAgent: 'ietf-pypi-publish',
    authStrategy: createOAuthDeviceAuth,
    auth: {
      clientId: 'e9642b43d2c36ba005b8',
      clientType: 'oauth-app',
      scopes: ['public_repo'],
      onVerification(verif) {
        console.info(`
Open in your browser: ${chalk.underline.green(verif.verification_uri)}
Enter code: ${chalk.bold.yellowBright(verif.user_code)}

${chalk.italic.grey('(The code has already been copied to your clipboard for convenience.)')}
        `)
        spinnerAuth.start()
        try {
          clipboardy.writeSync(verif.user_code)
          open(verif.verification_uri)
        } catch (err) {}
      }
    }
  })

  await gh.auth({ type: 'oauth' })
  spinnerAuth.succeed('Authenticated to GitHub.')

  // -> Fetch GitHub Repos

  const spinnerFetchRepos = ora('Fetching list of GitHub repositories...').start()
  let repos = []
  try {
    const reposRaw = await gh.rest.repos.listForOrg({
      org: org,
      type: 'public',
      sort: 'updated',
      direction: 'desc',
      per_page: 100
    })
    repos = reposRaw?.data?.filter(r => !r.archived && !r.disabled && r.name !== '.github').map(r => r.name).sort() ?? []
  } catch (err) {
    spinnerFetchRepos.fail('Failed to fetch list of GitHub repositories!')
    console.error(chalk.redBright(err.message))
    process.exit(1)
  }
  spinnerFetchRepos.succeed(`Fetched ${repos.length} most recently updated GitHub repositories.`)

  // -> Select GitHub Repo to use

  let repo = null
  if (argv.g) {
    if (repos.includes(argv.g)) {
      repo = argv.g
      ora(`Using GitHub repository: ${repo}`).succeed()
    } else {
      console.warn(chalk.redBright('Invalid GitHub repository provided.'))
    }
  }

  if (!repo) {
    let repoPrompt = await inquirer.prompt([
      {
        type: 'search-list',
        name: 'repo',
        message: 'Select the GitHub repository to use:',
        choices: repos
      }
    ])
    if (!repoPrompt?.repo) {
      console.error(chalk.redBright('Invalid or no repository selected. Exiting...'))
      process.exit(1)
    }
    repo = repoPrompt.repo
  }

  // -> Fetch GitHub releases

  const spinnerFetchReleases = ora('Fetching list of GitHub repositories...').start()
  let releases = []
  try {
    const releasesRaw = await gh.graphql(`
      query lastReleases ($owner: String!, $repo: String!) {
        repository (owner: $owner, name: $repo) {
          releases(first: 10, orderBy: { field: CREATED_AT, direction: DESC }) {
            nodes {
              author {
                login
              }
              createdAt
              id
              name
              releaseAssets (first: 100) {
                nodes {
                  downloadUrl
                  name
                  size
                  id
                  url
                }
              }
              tag {
                name
              }
              url
              isDraft
              isLatest
              isPrerelease
            }
          }
        }
      }
    `, {
      owner: org,
      repo: repo
    })
    releases = releasesRaw?.repository?.releases?.nodes ?? []
  } catch (err) {
    spinnerFetchReleases.fail('Failed to fetch list of releases!')
    console.error(chalk.redBright(err.message))
    process.exit(1)
  }
  if (releases.length > 0) {
    spinnerFetchReleases.succeed(`Fetched ${releases.length} most recent releases.`)
  } else {
    spinnerFetchReleases.fail('This project has no release! Exiting...')
    process.exit(1)
  }

  // -> Select release to use

  let releaseName = null
  if (argv.r) {
    if (releases.map(r => r.name).includes(argv.r)) {
      releaseName = argv.r
      ora(`Using GitHub release: ${releaseName}`).succeed()
    } else {
      console.warn(chalk.redBright('Invalid GitHub release provided.'))
    }
  }

  if (!releaseName) {
    const releasePrompt = await inquirer.prompt([
      {
        type: 'list',
        name: 'release',
        message: 'Select the release to publish:',
        choices: releases.map(r => r.name),
        default: 0
      }
    ])
    if (!releasePrompt?.release) {
      console.error(chalk.redBright('Invalid or no release selected. Exiting...'))
      process.exit(1)
    }
    releaseName = releasePrompt.release
  }
  const release = releases.filter(r => r.name === releaseName)[0]

  // -> Check for python dist packages

  if (release.releaseAssets.nodes.map(a => a.name).filter(a => a.endsWith('.tar.gz')).length < 1) {
    console.error(chalk.redBright('Could not find any Python distribution type asset. Make sure the release has a build attached. Exiting...'))
    process.exit(1)
  }

  // -> Check for existing version on PyPI

  const spinnerCheckExistingVer = ora('Checking for existing version on PyPI...').start()
  const pypiHost = optsPrompt.pypi === 'pypi' ? 'pypi.org' : 'test.pypi.org'
  try {
    await got({
      url: `https://${pypiHost}/pypi/${repo}/${release.name}/json`
    }).json()
    spinnerCheckExistingVer.fail(`Version ${release.name} already exists on ${pypiHost}. Cannot overwrite an existing version! Exiting...`)
    process.exit(1)
  } catch (err) {
    spinnerCheckExistingVer.succeed(`Version ${release.name} does not exist yet on ${pypiHost}.`)
  }

  // -> Create temp dir

  const spinnerCreateDir = ora('Downloading release assets...').start()
  let tempdir = null
  let distdir = null
  try {
    tempdir = path.join(os.tmpdir(), 'ietf-pypi-publish')
    distdir = path.join(tempdir, 'dist')
    await fs.emptyDir(tempdir)
    await fs.ensureDir(distdir)
    spinnerCreateDir.succeed(`Created temp directory: ${distdir}`)
  } catch (err) {
    spinnerCreateDir.fail('Failed to create temp directory.')
    console.error(chalk.redBright(err.message))
    process.exit(1)
  }

  // -> Download release assets

  const spinnerDownloadAssets = ora({ text: 'Downloading release assets...', spinner: 'arrow3' }).start()
  let assetDownloaded = 0
  for (const asset of release.releaseAssets.nodes) {
    spinnerDownloadAssets.text = `Downloading asset ${asset.name}...`
    try {
      await pipeline(
        got.stream(asset.url),
        fs.createWriteStream(path.join(distdir, asset.name))
      )
      assetDownloaded++
    } catch (err) {
      spinnerCreateDir.fail(`Failed to download asset ${asset.name}.`)
      console.error(chalk.redBright(err.message))
      process.exit(1)
    }
  }
  spinnerDownloadAssets.succeed(`Downloaded ${assetDownloaded} assets.`)

  // -> Install Twine

  const spinnerInstallTwine = ora('Installing Twine...').start()
  const errorsInstall = []
  try {
    const proc = spawn(optsPrompt?.python, ['-m', 'pip', 'install', 'twine'], {
      cwd: tempdir,
      windowsHide: true,
      timeout: 1000 * 60 * 5
    })
    proc.stderr.on('data', data => {
      errorsInstall.push(data.toString('utf8'))
    })
    await new Promise((resolve, reject) => {
      proc.on('exit', code => {
        if (code > 0) {
          reject(new Error(errorsInstall.join(', ')))
        } else {
          resolve()
        }
      })
    })
  } catch (err) {
    spinnerInstallTwine.fail('Failed to install Twine.')
    console.error(chalk.redBright(err.message))
    process.exit(1)
  }
  spinnerInstallTwine.succeed('Installed Twine successfully.')

  // -> Last prompt check before publishing...

  const confirmPrompt = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'go',
      message: `Proceed with publishing package ${repo}: ${release.name} to ${optsPrompt.pypi}?`,
      default: false
    }
  ])
  if (!confirmPrompt?.go) {
    console.error(chalk.redBright('Publishing aborted by the user. Exiting...'))
    process.exit(1)
  }

  // -> Run Twine

  const spinnerRunTwine = ora('Publishing package using Twine...').start()
  const errorsRun = []
  try {
    const twineParams = ['-m', 'twine', 'upload', '--verbose', '--sign']
    if (optsPrompt.gpgidentity) {
      twineParams.push('--identity')
      twineParams.push(optsPrompt.gpgidentity)
    }
    twineParams.push('dist/*')
    const proc = spawn(optsPrompt.python, twineParams, {
      cwd: tempdir,
      windowsHide: true,
      timeout: 1000 * 60 * 5,
      env: {
        ...process.env,
        TWINE_USERNAME: optsPrompt.user,
        TWINE_PASSWORD: optsPrompt.pass,
        TWINE_REPOSITORY_URL: optsPrompt.pypi === 'pypi' ? 'https://upload.pypi.org/legacy/' : 'https://test.pypi.org/legacy/'
      }
    })
    proc.stderr.on('data', data => {
      errorsRun.push(data.toString('utf8'))
    })
    await new Promise((resolve, reject) => {
      proc.on('exit', code => {
        if (code > 0) {
          reject(new Error(errorsRun.join(', ')))
        } else {
          resolve()
        }
      })
    })
  } catch (err) {
    spinnerRunTwine.fail('Failed to publish package.')
    console.error(chalk.redBright(err.message))
    process.exit(1)
  }
  spinnerRunTwine.succeed('Published package successfully.')

  // -> Clean up temp directory

  try {
    await fs.emptyDir(tempdir)
  } catch (err) {
    console.error(chalk.yellow(`Unable to clean temp folder ${tempdir}`))
  }

  process.exit(0)
}

main()
