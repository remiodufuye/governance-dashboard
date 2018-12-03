import each from 'jest-each';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import reducer, {
  ADD_ACCOUNT,
  FETCHING_ACCOUNT_DATA,
  HARDWARE_ACCOUNT_CONNECTED,
  HARDWARE_ACCOUNT_ERROR,
  HARDWARE_ACCOUNTS_CONNECTING,
  HARDWARE_ACCOUNTS_CONNECTED,
  HARDWARE_ACCOUNTS_ERROR,
  addAccount,
  updateAccount,
  connectHardwareAccounts,
  connectHardwareAccount,
  addHardwareAccount
} from '../../src/reducers/accounts';
import { AccountTypes } from '../../src/utils/constants';
import { MKR } from '../../src/chain/maker';
import {
  SEND_MKR_TO_PROXY_SUCCESS,
  WITHDRAW_MKR_SUCCESS
} from '../../src/reducers/sharedProxyConstants';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const hotAddress = '0xHOT';
const coldAddress = '0xCOLD';
const proxyAddress = '0xPROXY';
const proposalAddress = '0xPROPOSAL';
const defaultBalance = 100.0;
const hasInfMkrApproval = true;
const defaultVotingPower = 50.0;
const hasProxy = true;

const defaults = {
  balance: defaultBalance,
  hasInfMkrApproval,
  votingPower: defaultVotingPower,
  hasProxy,
  proxy: {
    hotAddress,
    coldAddress,
    proxyAddress,
    proposalAddresses: []
  }
};

const setupMocks = (opts = defaults) => {
  const balanceOf = jest.fn().mockReturnValue({
    toNumber: () => opts.balance
  });
  const allowance = jest.fn().mockResolvedValue({
    eq: () => opts.hasInfMkrApproval
  });
  const getToken = jest.fn().mockReturnValue({
    balanceOf,
    allowance
  });

  const getVotedProposalAddresses = jest
    .fn()
    .mockReturnValue(opts.proxy.proposalAddresses);
  const getNumDeposits = jest.fn().mockReturnValue({
    toNumber: () => opts.votingPower
  });
  const getColdAddress = jest.fn().mockReturnValue(opts.proxy.coldAddress);
  const getHotAddress = jest.fn().mockReturnValue(opts.proxy.hotAddress);
  const getProxyAddress = jest.fn().mockReturnValue(opts.proxy.proxyAddress);

  const getVoteProxy = jest.fn().mockResolvedValue({
    hasProxy: opts.hasProxy,
    voteProxy: opts.hasProxy
      ? {
          getVotedProposalAddresses,
          getNumDeposits,
          getColdAddress,
          getHotAddress,
          getProxyAddress
        }
      : {}
  });

  const service = jest.fn().mockReturnValue({
    getVoteProxy
  });

  window.maker = {
    getToken,
    service
  };
};

describe('Add Account', () => {
  let store;
  beforeEach(() => {
    store = mockStore({
      allAccounts: []
    });
  });

  test('should add an account enriched with information', async () => {
    setupMocks({
      balance: 200.2,
      hasInfMkrApproval: false,
      votingPower: 3,
      hasProxy: true,
      proxy: {
        coldAddress,
        hotAddress,
        proxyAddress,
        proposalAddresses: [proposalAddress]
      }
    });

    await addAccount({ address: hotAddress })(store.dispatch, store.getState);

    expect(window.maker.getToken).toBeCalledWith(MKR);
    expect(store.getActions().length).toBe(3);
    expect(store.getActions()[0]).toEqual({
      type: FETCHING_ACCOUNT_DATA,
      payload: true
    });
    expect(store.getActions()[1]).toEqual({
      type: ADD_ACCOUNT,
      payload: {
        address: hotAddress,
        hasProxy: true,
        mkrBalance: 200.2,
        proxyRole: 'hot',
        votingFor: proposalAddress,
        proxy: {
          address: proxyAddress,
          hasInfMkrApproval: false,
          votingPower: 3,
          linkedAccount: {
            address: coldAddress,
            mkrBalance: 200.2,
            proxyRole: 'cold'
          }
        }
      }
    });
    expect(store.getActions()[2]).toEqual({
      type: FETCHING_ACCOUNT_DATA,
      payload: false
    });
  });

  test('should return hasProxy false and an empty proxy when there is no proxy', async () => {
    setupMocks({
      ...defaults,
      hasProxy: false
    });

    await addAccount({ address: coldAddress })(store.dispatch, store.getState);

    expect(store.getActions()[1]).toEqual({
      type: ADD_ACCOUNT,
      payload: expect.objectContaining({
        address: coldAddress,
        proxyRole: '',
        hasProxy: false,
        votingFor: '',
        proxy: expect.objectContaining({
          address: '',
          votingPower: 0,
          hasInfMkrApproval: false,
          linkedAccount: {}
        })
      })
    });
  });

  test('should accurately gauge proxy role based on the votingProxys hot and cold addresses', async () => {
    setupMocks(defaults);

    await addAccount({ address: coldAddress })(store.dispatch, store.getState);

    expect(store.getActions()[1]).toEqual({
      type: ADD_ACCOUNT,
      payload: expect.objectContaining({
        address: coldAddress,
        proxyRole: 'cold'
      })
    });
  });

  test('should return an empty string if not voting for any proposals', async () => {
    setupMocks(defaults);

    await addAccount({ address: coldAddress })(store.dispatch, store.getState);

    expect(store.getActions()[1]).toEqual({
      type: ADD_ACCOUNT,
      payload: expect.objectContaining({
        votingFor: ''
      })
    });
  });

  test('should return the proposal if voting for one proposal', async () => {
    setupMocks({
      ...defaults,
      proxy: {
        ...defaults.proxy,
        proposalAddresses: [proposalAddress]
      }
    });

    await addAccount({ address: coldAddress })(store.dispatch, store.getState);

    expect(store.getActions()[1]).toEqual({
      type: ADD_ACCOUNT,
      payload: expect.objectContaining({
        votingFor: proposalAddress
      })
    });
  });

  test('should return the first proposal if voting for many proposals', async () => {
    const anotherProposalAddress = '0xPROPOSAL_2';
    setupMocks({
      ...defaults,
      proxy: {
        ...defaults.proxy,
        proposalAddresses: [proposalAddress, anotherProposalAddress]
      }
    });

    await addAccount({ address: coldAddress })(store.dispatch, store.getState);

    expect(store.getActions()[1]).toEqual({
      type: ADD_ACCOUNT,
      payload: expect.objectContaining({
        votingFor: proposalAddress
      })
    });
  });
});

test('UPDATE_ACCOUNT preserves unchanged values', () => {
  const state = {
    allAccounts: [
      {
        address: '0xf00',
        type: 'TEST',
        balance: 100,
        magic: true
      }
    ]
  };

  const action = updateAccount({
    address: '0xf00',
    type: 'TEST',
    balance: 98
  });

  const newState = reducer(state, action);
  expect(newState.allAccounts[0]).toEqual({
    address: '0xf00',
    type: 'TEST',
    balance: 98,
    magic: true
  });
});

const state = {
  activeAccount: '0xf00',
  allAccounts: [
    {
      address: '0xf00',
      mkrBalance: '3.1',
      proxy: {
        votingPower: '5.7',
        linkedAccount: {
          address: '0xbae'
        }
      }
    },
    {
      address: '0xbae',
      mkrBalance: '4.1',
      proxy: {
        votingPower: '5.7'
      }
    },
    {
      address: '0xdead',
      mkrBalance: '1'
    }
  ]
};

test('locking updates account values', () => {
  const action = { type: SEND_MKR_TO_PROXY_SUCCESS, payload: '1.4' };
  const newState = reducer(state, action);
  expect(newState.allAccounts).toEqual([
    {
      address: '0xf00',
      mkrBalance: '1.7',
      proxy: {
        votingPower: '7.1',
        linkedAccount: {
          address: '0xbae'
        }
      }
    },
    {
      address: '0xbae',
      mkrBalance: '4.1',
      proxy: {
        votingPower: '7.1',
        linkedAccount: {
          mkrBalance: '1.7'
        }
      }
    },
    {
      address: '0xdead',
      mkrBalance: '1'
    }
  ]);
});

test('withdrawing updates account values', () => {
  const action = { type: WITHDRAW_MKR_SUCCESS, payload: '1.4' };
  const newState = reducer(state, action);
  expect(newState.allAccounts).toEqual([
    {
      address: '0xf00',
      mkrBalance: '4.5',
      proxy: {
        votingPower: '4.3',
        linkedAccount: {
          address: '0xbae'
        }
      }
    },
    {
      address: '0xbae',
      mkrBalance: '4.1',
      proxy: {
        votingPower: '4.3',
        linkedAccount: {
          mkrBalance: '4.5'
        }
      }
    },
    {
      address: '0xdead',
      mkrBalance: '1'
    }
  ]);
});

describe('Hardware wallets', () => {
  const LEDGER_LIVE_PATH = "44'/60'/0'";
  const LEDGER_LEGACY_PATH = "44'/60'/0'/0";
  const someAddress = '0xdeadbeef';
  const addresses = ['0xdeadbeef', '0xf00dbeef', '0xbeeffeed'];
  let store;

  const initialState = {
    hardwareAccountsAvailable: {
      [AccountTypes.TREZOR]: {
        accounts: [],
        onChosen: jest.fn()
      },
      [AccountTypes.LEDGER]: {
        accounts: [],
        onChosen: jest.fn()
      }
    }
  };

  beforeEach(() => {
    setupMocks();

    window.maker = {
      ...window.maker,
      addAccount: jest.fn()
    };

    store = mockStore({
      accounts: initialState
    });
  });

  test('it fires the appropriate actions when a hardware wallet is connected', async () => {
    const onAccountChosen = () => {};
    window.maker.addAccount.mockImplementation(({ choose }) => {
      choose(addresses, onAccountChosen);
      return Promise.resolve();
    });

    const results = await connectHardwareAccounts(AccountTypes.LEDGER, {
      live: false
    })(store.dispatch, store.getState);

    const addressesWithTypes = addresses.map(a => ({
      address: a,
      type: AccountTypes.LEDGER
    }));
    expect(results).toEqual(addressesWithTypes);
    expect(store.getActions().length).toEqual(2);
    expect(store.getActions()[0]).toEqual({
      type: HARDWARE_ACCOUNTS_CONNECTING
    });
    expect(store.getActions()[1]).toEqual({
      type: HARDWARE_ACCOUNTS_CONNECTED,
      payload: {
        accountType: AccountTypes.LEDGER,
        accounts: addressesWithTypes,
        onAccountChosen: onAccountChosen
      }
    });
  });

  test('it fires an error action when a hardware wallet fails to connect', async () => {
    window.maker.addAccount.mockRejectedValue('some error');

    try {
      await connectHardwareAccounts(AccountTypes.LEDGER, { live: false })(
        store.dispatch,
        store.getState
      );
    } catch (err) {
      expect(store.getActions().length).toEqual(2);
      expect(store.getActions()[0]).toEqual({
        type: HARDWARE_ACCOUNTS_CONNECTING
      });
      expect(store.getActions()[1]).toEqual({
        type: HARDWARE_ACCOUNTS_ERROR
      });
    }
  });

  test('can connect a ledger legacy wallet', async () => {
    window.maker.addAccount.mockImplementation(({ choose }) => {
      choose(addresses, () => {});
      return Promise.resolve();
    });

    await connectHardwareAccounts(AccountTypes.LEDGER, { live: false })(
      store.dispatch,
      store.getState
    );

    expect(window.maker.addAccount).toBeCalledWith({
      type: AccountTypes.LEDGER,
      path: LEDGER_LEGACY_PATH,
      accountsLength: expect.any(Number),
      choose: expect.any(Function)
    });
  });

  test('can connect a ledger live wallet', async () => {
    window.maker.addAccount.mockImplementation(({ choose }) => {
      choose(addresses, () => {});
      return Promise.resolve();
    });

    await connectHardwareAccounts(AccountTypes.LEDGER, { live: true })(
      store.dispatch,
      store.getState
    );

    expect(window.maker.addAccount).toBeCalledWith(
      expect.objectContaining({
        type: AccountTypes.LEDGER,
        path: LEDGER_LIVE_PATH,
        accountsLength: expect.any(Number),
        choose: expect.any(Function)
      })
    );
  });

  test('can connect a trezor wallet', async () => {
    window.maker.addAccount.mockImplementation(({ choose }) => {
      choose(addresses, () => {});
      return Promise.resolve();
    });

    await connectHardwareAccounts(AccountTypes.TREZOR)(
      store.dispatch,
      store.getState
    );

    expect(window.maker.addAccount).toBeCalledWith(
      expect.objectContaining({
        type: AccountTypes.TREZOR,
        accountsLength: expect.any(Number),
        choose: expect.any(Function)
      })
    );
  });

  test('HARDWARE_ACCOUNTS_CONNECTED adds the accounts and callback to that account type', () => {
    const someAddress = '0xdeadbeef';
    const callback = () => {};
    const accounts = [
      {
        type: AccountTypes.TREZOR,
        address: someAddress
      }
    ];
    const action = {
      type: HARDWARE_ACCOUNTS_CONNECTED,
      payload: {
        accounts,
        accountType: AccountTypes.TREZOR,
        onAccountChosen: callback
      }
    };
    const newState = reducer(initialState, action);
    expect(newState.hardwareAccountsAvailable[AccountTypes.TREZOR]).toEqual({
      accounts,
      onChosen: callback
    });
  });

  test('HARDWARE_ACCOUNT_CONNECTED clears the accounts and callback for that account type', () => {
    const action = {
      type: HARDWARE_ACCOUNT_CONNECTED,
      payload: {
        accountType: AccountTypes.TREZOR
      }
    };
    const oldCallback = jest.fn();

    const newState = reducer(
      {
        ...initialState,
        hardwareAccountsAvailable: {
          ...initialState.hardwareAccountsAvailable,
          [AccountTypes.TREZOR]: {
            accounts: [{ type: AccountTypes.TREZOR, address: '0x' }],
            onChosen: oldCallback
          }
        }
      },
      action
    );

    expect(
      newState.hardwareAccountsAvailable[AccountTypes.TREZOR].accounts
    ).toEqual([]);
    expect(
      newState.hardwareAccountsAvailable[AccountTypes.TREZOR].onChosen
    ).not.toBe(oldCallback);
  });

  each([[AccountTypes.TREZOR], [AccountTypes.LEDGER]]).describe(
    'When a hardware wallet is chosen',
    async accountType => {
      test('it is added to the maker object', async () => {
        store
          .getState()
          .accounts.hardwareAccountsAvailable[
            accountType
          ].onChosen.mockResolvedValue();

        await addHardwareAccount(someAddress, accountType)(
          store.dispatch,
          store.getState
        );

        expect(
          store.getState().accounts.hardwareAccountsAvailable[accountType]
            .onChosen
        ).toBeCalledTimes(1);
        expect(
          store.getState().accounts.hardwareAccountsAvailable[accountType]
            .onChosen
        ).toBeCalledWith(null, someAddress);
      });

      test('it fires the appropriate actions', async () => {
        store
          .getState()
          .accounts.hardwareAccountsAvailable[
            accountType
          ].onChosen.mockResolvedValue();

        await addHardwareAccount(someAddress, accountType)(
          store.dispatch,
          store.getState
        );

        expect(store.getActions()).toEqual(
          expect.arrayContaining([
            {
              type: ADD_ACCOUNT,
              payload: expect.objectContaining({
                address: someAddress,
                type: accountType
              })
            },
            {
              type: HARDWARE_ACCOUNT_CONNECTED,
              payload: {
                accountType
              }
            }
          ])
        );
      });

      test('it fires an error when maker callback fails', async () => {
        store
          .getState()
          .accounts.hardwareAccountsAvailable[
            accountType
          ].onChosen.mockRejectedValue('some err');

        await addHardwareAccount(someAddress, accountType)(
          store.dispatch,
          store.getState
        );

        expect(store.getActions()).toEqual(
          expect.arrayContaining([
            {
              type: HARDWARE_ACCOUNT_ERROR
            }
          ])
        );
      });
    }
  );
});
