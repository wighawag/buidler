import { assert } from "chai";

import {
  CacheEntry,
  SolidityFilesCache,
} from "../../../src/builtin-tasks/utils/solidity-files-cache";
import { ResolvedFile } from "../../../src/internal/solidity/resolver";

function mockCachedFile(
  globalName: string,
  other: Partial<CacheEntry> = {}
): CacheEntry {
  return {
    globalName,
    lastModificationDate: new Date().valueOf(),
    solcConfig: { version: "0.6.6" },
    imports: [],
    versionPragmas: [],
    artifacts: [],
    ...other,
  };
}

describe("SolidityFilesCache", function () {
  const now = new Date();
  const oneHourAgo = new Date(now.valueOf() - 3600 * 1000);

  it("should construct an empty cache", async function () {
    const cache = {
      _format: "",
      files: {},
    };

    const solidityFilesCache = new SolidityFilesCache(cache);

    assert.isEmpty(solidityFilesCache.getEntries());
  });

  it("should construct a cache with a file", async function () {
    const cache = {
      _format: "",
      files: {
        "/path/to/contracts/file.sol": mockCachedFile("contracts/file.sol"),
      },
    };

    const solidityFilesCache = new SolidityFilesCache(cache);

    assert.lengthOf(solidityFilesCache.getEntries(), 1);
    assert.isDefined(
      solidityFilesCache.getEntry("/path/to/contracts/file.sol")
    );
  });

  it("should mark a file as not changed if it was not modified", async function () {
    const solcConfig = { version: "0.6.6" };
    const cache = {
      _format: "",
      files: {
        "/path/to/contracts/file.sol": mockCachedFile("contracts/file.sol", {
          lastModificationDate: oneHourAgo.valueOf(),
          solcConfig,
        }),
      },
    };
    const solidityFilesCache = new SolidityFilesCache(cache);

    const hasChanged = solidityFilesCache.hasFileChanged(
      "/path/to/contracts/file.sol",
      oneHourAgo,
      solcConfig
    );

    assert.isFalse(hasChanged);
  });

  it("should mark a file as changed if it was modified", async function () {
    const solcConfig = { version: "0.6.6" };
    const cache = {
      _format: "",
      files: {
        "/path/to/contracts/file.sol": mockCachedFile("contracts/file.sol", {
          lastModificationDate: oneHourAgo.valueOf(),
          solcConfig,
        }),
      },
    };
    const solidityFilesCache = new SolidityFilesCache(cache);

    const hasChanged = solidityFilesCache.hasFileChanged(
      "/path/to/contracts/file.sol",
      now,
      solcConfig
    );

    assert.isTrue(hasChanged);
  });

  it("should mark a file as changed if it doesn't exist in the cache", async function () {
    const solcConfig = { version: "0.6.6" };
    const cache = {
      _format: "",
      files: {
        "/path/to/contracts/file.sol": mockCachedFile("contracts/file.sol", {
          lastModificationDate: oneHourAgo.valueOf(),
          solcConfig,
        }),
      },
    };
    const solidityFilesCache = new SolidityFilesCache(cache);

    const hasChanged = solidityFilesCache.hasFileChanged(
      "/path/to/contracts/anotherFile.sol",
      oneHourAgo,
      solcConfig
    );

    assert.isTrue(hasChanged);
  });

  it("should mark a file as changed if the last solc version used is different", async function () {
    const solcConfig = { version: "0.6.6" };
    const cache = {
      _format: "",
      files: {
        "/path/to/contracts/file.sol": mockCachedFile("contracts/file.sol", {
          lastModificationDate: oneHourAgo.valueOf(),
          solcConfig,
        }),
      },
    };
    const solidityFilesCache = new SolidityFilesCache(cache);

    const hasChanged = solidityFilesCache.hasFileChanged(
      "/path/to/contracts/file.sol",
      oneHourAgo,
      { version: "0.6.7" }
    );

    assert.isTrue(hasChanged);
  });

  it("should mark a file as changed if the last solc optimization setting used is different", async function () {
    const solcConfig = { version: "0.6.6", settings: { optimizer: false } };
    const cache = {
      _format: "",
      files: {
        "/path/to/contracts/file.sol": mockCachedFile("contracts/file.sol", {
          lastModificationDate: oneHourAgo.valueOf(),
          solcConfig,
        }),
      },
    };
    const solidityFilesCache = new SolidityFilesCache(cache);

    const hasChanged = solidityFilesCache.hasFileChanged(
      "/path/to/contracts/file.sol",
      oneHourAgo,
      { version: "0.6.6", settings: { optimizer: true, runs: 200 } }
    );

    assert.isTrue(hasChanged);
  });

  it("should work if the solc config is not the same reference", async function () {
    const solcConfig = { version: "0.6.6" };
    const cache = {
      _format: "",
      files: {
        "/path/to/contracts/file.sol": mockCachedFile("contracts/file.sol", {
          lastModificationDate: oneHourAgo.valueOf(),
          solcConfig,
        }),
      },
    };
    const solidityFilesCache = new SolidityFilesCache(cache);

    const hasChanged = solidityFilesCache.hasFileChanged(
      "/path/to/contracts/file.sol",
      oneHourAgo,
      { version: "0.6.6" }
    );

    assert.isFalse(hasChanged);
  });

  it("should ignore the solc config if it's not passed (unchanged file)", async function () {
    const solcConfig = { version: "0.6.6" };
    const cache = {
      _format: "",
      files: {
        "/path/to/contracts/file.sol": mockCachedFile("contracts/file.sol", {
          lastModificationDate: oneHourAgo.valueOf(),
          solcConfig,
        }),
      },
    };
    const solidityFilesCache = new SolidityFilesCache(cache);

    const hasChanged = solidityFilesCache.hasFileChanged(
      "/path/to/contracts/file.sol",
      oneHourAgo
    );

    assert.isFalse(hasChanged);
  });

  it("should ignore the solc config if it's not passed (changed file)", async function () {
    const solcConfig = { version: "0.6.6" };
    const cache = {
      _format: "",
      files: {
        "/path/to/contracts/file.sol": mockCachedFile("contracts/file.sol", {
          lastModificationDate: oneHourAgo.valueOf(),
          solcConfig,
        }),
      },
    };
    const solidityFilesCache = new SolidityFilesCache(cache);

    const hasChanged = solidityFilesCache.hasFileChanged(
      "/path/to/contracts/file.sol",
      now
    );

    assert.isTrue(hasChanged);
  });
});
