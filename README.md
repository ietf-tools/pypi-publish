<div align="center">
    
<img src="https://raw.githubusercontent.com/ietf-tools/common/main/assets/logos/ietf-pypi-publish-logo.svg" alt="IETF RFC2HTML" width="600" />
    
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

## Requirements

- Node.js 16.x or later
- Python 2.7 / 3.x (depending on your module to be published)

> This tool assumes that you have the signing key used to sign Python packages already configured on your system. It will be used when publishing the package to PyPI.

## Usage

Install the `@ietf-tools/pypi-publish` NPM package using:

```sh
npm install -g @ietf-tools/pypi-publish
```

Then run:

```sh
pypi-publish
```

Enter the necessary info as prompted.

## License

BSD-3-Clause
