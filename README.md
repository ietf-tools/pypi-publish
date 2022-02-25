<div align="center">
    
<img src="https://raw.githubusercontent.com/ietf-tools/common/main/assets/logos/pypi-publish.svg" alt="PYPI PUBLISH" height="125" />

[![Release](https://img.shields.io/github/release/ietf-tools/pypi-publish.svg?style=flat&maxAge=600)](https://github.com/ietf-tools/pypi-publish/releases)
[![License](https://img.shields.io/github/license/ietf-tools/pypi-publish)](https://github.com/ietf-tools/pypi-publish/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/@ietf-tools/pypi-publish)](https://www.npmjs.com/package/@ietf-tools/pypi-publish)
[![node-current](https://img.shields.io/node/v/@ietf-tools/pypi-publish)](https://github.com/ietf-tools/pypi-publish)
    
##### Tool for publishing a Python package to PyPI from a GitHub Release
    
</div>

- [Changelog](https://github.com/ietf-tools/pypi-publish/blob/main/CHANGELOG.md)
- [Contributing](https://github.com/ietf-tools/.github/blob/main/CONTRIBUTING.md)
- [Requirements](#requirements)
- [Usage](#usage)

---

This tool is a CLI which provides the following automation:

- Fetch the list of available repositories and releases
- Download the latest build of a Python package
- Install Twine *(if not already installed)*
- Sign and publish the package to PyPI (or TestPyPI)

## Requirements

- [Node.js](https://nodejs.org/) **16.x or later**
- [Python](https://www.python.org/) **3.x**

> This tool assumes that you have the signing key used to sign Python packages already configured on your system. It will be used when publishing the package to PyPI.

## Usage

Install the `@ietf-tools/pypi-publish` NPM package globally using:

```sh
npm install -g @ietf-tools/pypi-publish
```

Then run *(from any location)*:

```sh
pypi-publish
```

Enter the necessary info as prompted.

### CLI Arguments *(optional)*

These arguments can also be passed to the CLI to automate values and bypass the questions. All arguments are optional.

| Short         | Long                  | Description                                 |
|---------------|-----------------------|---------------------------------------------|
| `-t TARGET`   | `--target=TARGET`     | Target PyPI repository [`pypi`, `testpypi`] |
| `-u USERNAME` | `--user=USERNAME`     | PyPI username                               |
| `-p PASSWORD` | `--pass=PASSWORD`     | PyPI password                               |
| `-i IDENTITY` | `--identity=IDENTITY` | GPG identity to use for package signing     |
| `-g PROJECT`  | `--project=PROJECT`   | GitHub project (repository) to publish from |
| `-r RELEASE`  | `--release=RELEASE`   | GitHub release to publish                   |
|               | `--python-path=PATH`  | Path to Python executable                   |
| `-h`          | `--help`              | Display usage + help message and exit       |
| `-v`          | `--version`           | Display CLI version and exit                |

## License

BSD-3-Clause
