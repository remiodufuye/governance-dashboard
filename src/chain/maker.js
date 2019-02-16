import governancePlugin from '@makerdao/dai-plugin-governance';
import trezorPlugin from '@makerdao/dai-plugin-trezor-web';
import ledgerPlugin from '@makerdao/dai-plugin-ledger-web';
import Maker, { ETH, MKR } from '@makerdao/dai';
import configPlugin from '@makerdao/dai-plugin-config';

import { netToUri } from '../utils/ethereum';

export const INFURA_PROJECT_ID = '912c79d091a74c6a8c0938c3bd2319a0';

export default async function createMaker(
  network = 'mainnet',
  testchainConfigId
) {
  let gasPrice = 6 * 10 ** 9; // default to 6 Gwei gas price
  try {
    // check ethgasstation for gas price info
    const res = await fetch('https://ethgasstation.info/json/ethgasAPI.json');
    const gasData = await res.json();
    gasPrice = gasData.average * 10 ** 8;
    gasPrice = gasPrice + 3 * 10 ** 9; // 3 Gwei buffer
  } catch (err) {
    console.error(
      `Gas price fetch failed. Defaulting to ${gasPrice / 10 ** 9} Gwei.`
    );
  }
  // if  we have a teschain id, do NOT allow the gov plugin to load contracts

  let config = {
    plugins: [
      trezorPlugin,
      ledgerPlugin,
      [governancePlugin, { bypassContracts: !!testchainConfigId }]
    ],
    autoAuthenticate: true,
    log: false,
    web3: {
      transactionSettings: {
        gasPrice
      }
    },
    provider: {
      url: network === 'ganache' ? '' : netToUri(network),
      type: 'HTTP'
    }
  };

  // Use the config plugin, if we have a testchainConfigId
  if (testchainConfigId) {
    delete config.provider;
    config.plugins.push([configPlugin, { testchainId: testchainConfigId }]);
  }
  return Maker.create('http', config);
}

export { ETH, MKR };
