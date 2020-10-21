# Setting up a project

A Hardhat project is any directory with a valid `hardhat.config.js` file in it. If you run `npx hardhat` in a path without one you will be shown two options to facilitate project creation:
```
$ npx hardhat
888    888                      888 888               888
888    888                      888 888               888
888    888                      888 888               888
8888888888  8888b.  888d888 .d88888 88888b.   8888b.  888888
888    888     "88b 888P"  d88" 888 888 "88b     "88b 888
888    888 .d888888 888    888  888 888  888 .d888888 888
888    888 888  888 888    Y88b 888 888  888 888  888 Y88b.
888    888 "Y888888 888     "Y88888 888  888 "Y888888  "Y888

Welcome to Hardhat v2.0.0

? What do you want to do? …
❯ Create a sample project
  Create an empty hardhat.config.js
  Quit
```

If you select _Create an empty hardhat.config.js_, Hardhat will create a `hardhat.config.js` with the following content:
```js
module.exports = {};
```
And this is enough to run Hardhat using a default project structure. 

### Sample Hardhat project

If you select _Create a sample project_ a simple project creation wizard will ask you some questions and create a project with the following structure:
```
contracts/
scripts/
test/
hardhat.config.js
```

These are the default paths for a Hardhat project. Except for `scripts/`, which is just a normal directory unrelated to your config. 

- `contracts/` is where the source files for your contracts should be.
- `test/` is where your tests should go.

If you need to change these paths, take a look at the [paths configuration section](../config/README.md#path-configuration).

### Testing and Ethereum networks

When it comes to testing your contracts, Hardhat comes with some built-in defaults:
- [Mocha](https://mochajs.org/) as the test runner
- The built-in [Hardhat Network](../hardhat-network/README.md) as the development network to test on

If you need to use an external network, like an Ethereum testnet, mainnet or some other specific node software, you can set it up using the `networks` configuration entries in the exported object in `hardhat.config.js`, which is how Hardhat projects manage settings. Make use of the `--network` CLI parameter to quickly change the network.

Take a look at the [networks configuration section](../config/README.md#networks-configuration) to learn more about setting up different networks.

### Plugins and dependencies

You may have seen this notice when creating the sample project:

```
You need to install these dependencies to run the sample project:
  npm install --save-dev @nomiclabs/hardhat-waffle ethereum-waffle chai @nomiclabs/hardhat-ethers ethers
```

This stems from the fact that **most of Hardhat's functionality comes from plugins**, so check out the [plugins section](../plugins/README.md) for the official list and see if there are any other ones that look interesting.

The sample project uses the `@nomiclabs/hardhat-waffle` plugin, which depends on the `@nomiclabs/hardhat-ethers` plugin. These integrate the Ethers.js and Waffle tools into your project. 

To use a plugin, the first step is always to install it using `npm` or `yarn`, and then requiring it in your config file:

```js
require("@nomiclabs/hardhat-waffle");

module.exports = {};
```

Plugins are **essential** to Hardhat projects, so make sure to check out all the available ones and also build your own ones!

For any help or feedback you may have, you can find us in the [Hardhat Support Discord server](https://invite.gg/HardhatSupport).


