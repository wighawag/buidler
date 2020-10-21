const plugins = [
  {
    name: "@nomiclabs/hardhat-ethers",
    author: "Nomic Labs",
    authorUrl: "https://twitter.com/nomiclabs",
    version: require("../../packages/hardhat-ethers/package").version,
    url:
      "https://github.com/nomiclabs/buidler/tree/2.0/packages/hardhat-ethers",
    description: "Injects ethers.js into the Buidler Runtime Environment",
    tags: ["Ethers.js", "Testing", "Tasks", "Scripts"],
  },
  {
    name: "@nomiclabs/hardhat-waffle",
    author: "Nomic Labs",
    authorUrl: "https://twitter.com/nomiclabs",
    version: require("../../packages/hardhat-waffle/package").version,
    url:
      "https://github.com/nomiclabs/buidler/tree/2.0/packages/hardhat-waffle",
    description:
      "Adds a Waffle-compatible provider to the Buidler Runtime Environment and automatically initializes the Waffle Chai matchers",
    tags: ["Waffle", "Testing"],
  },
  {
    name: "@nomiclabs/hardhat-truffle4",
    author: "Nomic Labs",
    authorUrl: "https://twitter.com/nomiclabs",
    version: require("../../packages/hardhat-truffle4/package").version,
    url:
      "https://github.com/nomiclabs/buidler/tree/2.0/packages/hardhat-truffle4",
    description: "Integration with TruffleContract from Truffle 4",
    tags: ["Truffle", "Testing"],
  },
  {
    name: "@nomiclabs/hardhat-truffle5",
    author: "Nomic Labs",
    authorUrl: "https://twitter.com/nomiclabs",
    version: require("../../packages/hardhat-truffle5/package").version,
    url:
      "https://github.com/nomiclabs/buidler/tree/2.0/packages/hardhat-truffle5",
    description: "Integration with TruffleContract from Truffle 5",
    tags: ["Truffle", "Testing"],
  },
  {
    name: "@nomiclabs/hardhat-web3",
    author: "Nomic Labs",
    authorUrl: "https://twitter.com/nomiclabs",
    version: require("../../packages/hardhat-web3/package").version,
    url:
      "https://github.com/nomiclabs/buidler/tree/2.0/packages/hardhat-web3",
    description: "Injects Web3 1.x into the Buidler Runtime Environment",
    tags: ["Web3.js", "Testing", "Tasks", "Scripts"],
  },
  {
    name: "@nomiclabs/hardhat-web3-legacy",
    author: "Nomic Labs",
    authorUrl: "https://twitter.com/nomiclabs",
    version: require("../../packages/hardhat-web3-legacy/package").version,
    url:
      "https://github.com/nomiclabs/buidler/tree/2.0/packages/hardhat-web3-legacy",
    description: "Injects Web3 0.20.x into the Buidler Runtime Environment",
    tags: ["Web3.js", "Legacy", "Testing", "Tasks", "Scripts"],
  },
  {
    name: "@nomiclabs/hardhat-etherscan",
    author: "Nomic Labs",
    authorUrl: "https://twitter.com/nomiclabs",
    version: require("../../packages/hardhat-etherscan/package").version,
    url:
      "https://github.com/nomiclabs/buidler/tree/2.0/packages/hardhat-etherscan",
    description: "Automatically verify contracts on Etherscan",
    tags: ["Etherscan", "Verification"],
  },
  {
    name: "@nomiclabs/hardhat-ganache",
    author: "Nomic Labs",
    authorUrl: "https://twitter.com/nomiclabs",
    version: require("../../packages/hardhat-ganache/package").version,
    url:
      "https://github.com/nomiclabs/buidler/tree/2.0/packages/hardhat-ganache",
    description: "Buidler plugin for managing Ganache",
    tags: ["Ganache", "Testing network"],
  },
  {
    name: "@nomiclabs/hardhat-solpp",
    author: "Nomic Labs",
    authorUrl: "https://twitter.com/nomiclabs",
    version: require("../../packages/hardhat-solpp/package").version,
    url:
      "https://github.com/nomiclabs/buidler/tree/2.0/packages/hardhat-solpp",
    description:
      "Automatically run the solpp preprocessor before each compilation",
    tags: ["Solpp", "Preprocessor"],
  },
  {
    name: "@nomiclabs/hardhat-solhint",
    author: "Nomic Labs",
    authorUrl: "https://twitter.com/nomiclabs",
    version: require("../../packages/hardhat-solhint/package").version,
    url:
      "https://github.com/nomiclabs/buidler/tree/2.0/packages/hardhat-solhint",
    description: "Easily run solhint to lint your Solidity code",
    tags: ["Solhint", "Linter"],
  },
  {
    name: "@nomiclabs/hardhat-vyper",
    author: "Nomic Labs",
    authorUrl: "https://twitter.com/nomiclabs",
    version: require("../../packages/hardhat-vyper/package").version,
    url:
      "https://github.com/nomiclabs/buidler/tree/2.0/packages/hardhat-vyper",
    description: "Adds support to compile Vyper smart contracts",
    tags: ["Vyper", "Compiler"],
  },
  {
    name: "buidler-gas-reporter",
    author: "Chris Gewecke",
    authorUrl: "https://github.com/cgewecke",
    version: "0.1.2",
    url: "https://github.com/cgewecke/buidler-gas-reporter/tree/master",
    description:
      "Gas usage per unit test. Average gas usage per method. A mocha reporter.",
    tags: ["Testing", "Gas"],
  },
  {
    name: "buidler-typechain",
    author: "Rahul Sethuram",
    authorUrl: "https://twitter.com/rhlsthrm",
    version: "0.0.5",
    url: "https://github.com/rhlsthrm/buidler-typechain/tree/master",
    description: "Generate TypeChain typedefs for smart contracts.",
    tags: ["Testing", "Tasks"],
  },
  {
    name: "solidity-coverage",
    author: "Chris Gewecke",
    authorUrl: "https://github.com/cgewecke",
    version: "0.7.0",
    url:
      "https://github.com/sc-forks/solidity-coverage/tree/master/BUIDLER_README.md",
    readmeUrl:
      "https://raw.githubusercontent.com/sc-forks/solidity-coverage/master/BUIDLER_README.md",
    description: "Code coverage for Solidity",
    tags: ["Testing", "Coverage"],
  },
  {
    name: "@aragon/buidler-aragon",
    author: "Aragon One",
    authorUrl: "https://twitter.com/aragononeteam",
    version: "0.2.3",
    url: "https://github.com/aragon/buidler-aragon/tree/master",
    description: "Buidler plugin for Aragon App development",
    tags: ["Aragon", "Apps"],
  },
  {
    name: "buidler-spdx-license-identifier",
    author: "Nick Barry",
    authorUrl: "https://github.com/ItsNickBarry",
    version: "1.0.1",
    url:
      "https://github.com/ItsNickBarry/buidler-spdx-license-identifier/tree/master",
    description:
      "Automatically prepend local Solidity source files with an SPDX License Identifier",
    tags: ["License"],
  },
  {
    name: "buidler-deploy",
    author: "Ronan Sandford",
    authorUrl: "https://github.com/wighawag",
    version: "0.4.0",
    url: "https://github.com/wighawag/buidler-deploy/tree/master",
    description: "Buidler plugin for Deployments",
    tags: ["Deployment", "Testing"],
  },
  {
    name: "buidler-ethers-v5",
    author: "Ronan Sandford",
    authorUrl: "https://github.com/wighawag",
    version: "0.2.1",
    url: "https://github.com/wighawag/buidler-ethers-v5/tree/master",
    description:
      "plugin integrationg ethers v5 into buidler and buidler-deploy ",
    tags: ["Ethers.js", "Testing", "buidler-deploy"],
  },
  {
    name: "buidler-source-descriptor",
    author: "Kendrick Tan",
    authorUrl: "https://github.com/kendricktan",
    version: "",
    url: "https://github.com/kendricktan/buidler-source-descriptor/tree/master",
    description:
      "A Buidler plugin to generate a descriptor of your Solidity source code",
    tags: ["Compiling", "Documentation"],
  },
  {
    name: "buidler-abi-exporter",
    author: "Nick Barry",
    authorUrl: "https://github.com/ItsNickBarry",
    version: "1.0.0",
    url:
      "https://github.com/ItsNickBarry/buidler-abi-exporter/tree/master",
    description:
      "Automatically export Solidity contract ABIs on compilation",
    tags: ["Compiling", "ABI"],
  },
  {
    name: "buidler-contract-sizer",
    author: "Nick Barry",
    authorUrl: "https://github.com/ItsNickBarry",
    version: "1.0.0",
    url:
      "https://github.com/ItsNickBarry/buidler-contract-sizer/tree/master",
    description:
      "Calculate compiled contract sizes",
    tags: ["Compiling", "Bytecode"],
  },
];

module.exports = plugins.map(p => ({...p, normalizedName: p.name.replace("/", "-").replace(/^@/, "")}))
