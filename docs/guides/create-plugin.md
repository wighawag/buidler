# Creating a plugin

In this guide, we will explore the creation of plugins for Hardhat, which are the key component for integrating other tools and extending the built-in functionality.

### What exactly are plugins in Hardhat?

Plugins in Hardhat are essentially reusable bits of configuration, which are defined programmatically using a DSL. When developing a plugin the main tools available to integrate new functionality are extending the [Hardhat Runtime Environment], extending the Hardhat config, defining new tasks and overriding existing ones, which are all configuration actions achieved through code.

Some examples of things you could achieve by creating a plugin are running a linter when the `check` task runs, using different compiler versions for different files or generating an UML diagram for your contracts.

Let’s go through the process of creating a plugin to inject ethers.js to the [Hardhat Runtime Environment].

The environment is configured through a queue of extension functions that you can add to using the `extendEnvironment()` function. It receives one parameter which is an async function which will be executed after the required initialization is done, in order.

For example, adding the following to `hardhat.config.js`:

```js
extendEnvironment(hre => {
  hre.hi = "Hello, Hardhat!";
});
```

Will make `hi` available everywhere where the environment is accessible.

```js
extendEnvironment(hre => {
  hre.hi = "Hello, Hardhat!";
});

task("envtest", (args, hre) => {
  console.log(hre.hi);
});

module.exports = {};
```

Will yield:

```
$ npx hardhat envtest
Hello, Hardhat!
```

This is literally all it takes to put together a plugin for Hardhat. Injecting an ethers.js instance into the environment would look like this:

```js
extendEnvironment(hre => {
  const wrapper = new EthersProviderWrapper(hre.network.provider);

  hre.ethers = {
    provider: wrapper,

    getContract: async function(name) {
      const artifact = await readArtifact(hre.config.paths.artifacts, name);
      const bytecode = artifact.bytecode;
      const signers = await hre.ethers.signers();

      return new ethers.ContractFactory(artifact.abi, bytecode, signers[0]);
    },

    signers: async function() {
      const accounts = await hre.network.provider.send("eth_accounts");

      return accounts.map(account => wrapper.getSigner(account));
    }
  };
});

module.exports = {};
```

Full functional code [here](https://gist.github.com/fzeoli/9cdd9c1182b9636829bf71bfacb82c43).

And that’s it. Ethers.js is now fully available to be used in the Hardhat console, your tasks, tests and other plugins.

Now, this is just injecting from the config file, which by itself can be useful if that’s all you care about, but this can also be packaged as a reusable plugin that you can publish for others to benefit as well. You only need to wrap everything in a function, and export it in the plugin's main file.

You can use the [plugin boilerplate repository](https://github.com/nomiclabs/hardhat-ts-plugin-boilerplate) as a starting point to create an npm package for your plugin. We highly recommend using TypeScript for your plugins, especially if you’re looking to inject objects into the [Hardhat Runtime Environment]. This way, types can be exported and text editors can autocomplete for your users.

For a fully functional ethers.js plugin written in TypeScript take a look at [nomiclabs/hardhat-ethers](https://github.com/nomiclabs/hardhat-ethers) on Github.

Take a look at the [plugin best practices documentation](../advanced/building-plugins.md) and if you end up publishing a plugin, send us a pull request to add it to our [plugins section](../plugins/README.md).

For any questions or feedback you may have, you can find us in the [Hardhat Discord
server](https://invite.gg/HardhatSupport).

[Hardhat runtime environment]: ../advanced/hardhat-runtime-environment.md
