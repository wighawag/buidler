import { assert } from "chai";
import { BN, toBuffer } from "ethereumjs-util";

import { workaroundWindowsCiFailures } from "../../../../../utils/workaround-windows-ci-failures";
import { EXAMPLE_SETTER_CONTRACT } from "../../../helpers/contracts";
import { setCWD } from "../../../helpers/cwd";
import {
  DEFAULT_ACCOUNTS_ADDRESSES,
  PROVIDERS,
} from "../../../helpers/providers";
import { retrieveForkBlockNumber } from "../../../helpers/retrieveForkBlockNumber";
import { deployContract } from "../../../helpers/transactions";

describe("Eth module", function () {
  PROVIDERS.forEach(({ name, useProvider, isFork, isJsonRpc, chainId }) => {
    if (isFork) {
      this.timeout(50000);
    }

    workaroundWindowsCiFailures.call(this, { isFork });

    describe(`${name} provider`, function () {
      setCWD();
      useProvider();

      describe("gas usage", function () {
        it("should use 17100 less gas when writing a non-zero slot", async function () {
          const contractAddress = await deployContract(
            this.provider,
            `0x${EXAMPLE_SETTER_CONTRACT.bytecode.object}`
          );

          const firstTxHash = await this.provider.send("eth_sendTransaction", [
            {
              to: contractAddress,
              from: DEFAULT_ACCOUNTS_ADDRESSES[0],
              data: `${EXAMPLE_SETTER_CONTRACT.selectors.setValue}0000000000000000000000000000000000000000000000000000000000000001`,
            },
          ]);

          const firstReceipt = await this.provider.send(
            "eth_getTransactionReceipt",
            [firstTxHash]
          );

          const gasUsedBefore = new BN(toBuffer(firstReceipt.gasUsed));

          const secondTxHash = await this.provider.send("eth_sendTransaction", [
            {
              to: contractAddress,
              from: DEFAULT_ACCOUNTS_ADDRESSES[0],
              data: `${EXAMPLE_SETTER_CONTRACT.selectors.setValue}0000000000000000000000000000000000000000000000000000000000000002`,
            },
          ]);

          const secondReceipt = await this.provider.send(
            "eth_getTransactionReceipt",
            [secondTxHash]
          );

          const gasUsedAfter = new BN(toBuffer(secondReceipt.gasUsed));

          const gasDifference = gasUsedBefore.sub(gasUsedAfter);

          assert.equal(gasDifference.toString(), "17100");
        });
      });
    });
  });
});
