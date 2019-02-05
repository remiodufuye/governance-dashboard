/////////////////////////////////////////////////
//// Mocked backend w/ the current proposals ////
/////////////////////////////////////////////////

import round from 'lodash.round';

import { createReducer } from '../utils/redux';
import { initApprovalsFetch } from './approvals';
import { div, mul, promiseRetry } from '../utils/misc';

// Constants ----------------------------------------------

const PROPOSALS_REQUEST = 'proposals/REQUEST';
const PROPOSALS_SUCCESS = 'proposals/SUCCESS';
const PROPOSALS_FAILURE = 'proposals/FAILURE';

// Selectors ----------------------------------------------

export function getWinningProp(state, topicKey) {
  const proposals = state.proposals.filter(p => p.topicKey === topicKey);
  // all child proposals of a topic must have the snapshot for this to work
  const hasEndSnapshot = proposals =>
    proposals.every(proposal => proposal.end_approvals !== undefined);
  if (hasEndSnapshot(proposals)) {
    return proposals.sort(
      (a, b) => Number(b.end_approvals) - Number(a.end_approvals)
    )[0];
  } else {
    // the end block hasn't been spashotted, so we look at fetched approvals
    const approvalObj = state.approvals.approvals;
    let mostApprovals = 0;
    let winner = null;
    for (let proposal of proposals) {
      let src = proposal.source.toLowerCase();
      if (approvalObj[src] !== undefined) {
        if (mostApprovals < approvalObj[src]) {
          winner = proposal;
          mostApprovals = approvalObj[src];
        }
      }
    }
    if (winner === null) return winner;
    const approvals = approvalObj[winner.source.toLowerCase()];
    const percentage =
      approvals > 0
        ? round(div(mul(approvals, 100), state.approvals.total), 2)
        : 0;
    return {
      ...winner,
      end_approvals: approvals,
      end_percentage: percentage
    };
  }
}

// Backend ------------------------------------------------

const local = 'http://127.0.0.1:3000';
const prod = 'https://content.makerfoundation.com';
const staging = 'https://elb.content.makerfoundation.com:444';

const path = 'content/governance-dashboard';

// util

const check = async res => {
  if (!res.ok) {
    throw new Error(
      `unable to fetch topics: ${res.status} - ${await res.text()}`
    );
  }
};

// backends

const fetchMock = async () => {
  const mocked = await import('../_mock/topics');
  return mocked.default;
};

const fetchNetwork = async (url, network) => {
  const res = await fetch(`${url}/${path}?network=${network}`);
  await check(res);
  return await res.json();
};

// dispatch

const fetchTopics = async network => {
  console.log('fetch topics network', network);
  // If we're running a testchain, we want the kovan topics, and we'll overwrite the addresses later
  if (network === 'ganache') {
    return await fetchNetwork(staging, 'kovan');
  }
  if (process.env.REACT_APP_GOV_BACKEND === 'mock') {
    console.log('fetch topics mock', network);
    return await fetchMock(network);
  }

  if (process.env.REACT_APP_GOV_BACKEND === 'local') {
    console.log('fetch topics network local', network);
    return await fetchNetwork(local, network);
  }

  if (process.env.REACT_APP_GOV_BACKEND === 'staging') {
    console.log('fetch topics network staging', network);
    return await fetchNetwork(staging, network);
  }

  console.log('fetch topics network prod', network);
  return await fetchNetwork(prod, network);
};

// Actions ------------------------------------------------
const adds = {
  mkr: '0xf6934788cf4c399367e3c9290c27668c90fa42f5',
  iou: '0x1e1bb4ca0c6cbc6ce0c65de0462ccf401182663a',
  chief: '0x28adf417206d1a2a17340d5775c6c6e4127af4b8',
  polling: '0x7e20ada7a16fe0aec104f66aefc109f6abf7247b',
  proxy_factory: '0xcb8e3d967b4b1da397220a31dcab17f1e4414d52',
  'kovan-example-executive-proposal-1':
    '0xBf1182cAE267143C281534364C1f2637420BAf59'
};

//TODO make private func for converting topic key to pascal case

const updateSourceForTestnet = topics => {
  console.log('topics', topics);
  const cInfo = window.maker.service('smartContract')._getAllContractInfo();
  console.log('cInfo', cInfo);
  //cheat:
  const KOVAN_EXAMPLE_EXECUTIVE_PROPOSAL_1 =
    'KOVAN_EXAMPLE_EXECUTIVE_PROPOSAL_1';

  topics.map(topic => {
    topic.proposals.map(proposal => {
      console.log(proposal.key);
      if (proposal.key in cInfo) {
        console.log('cinfoPropKey', cInfo[proposal.key]);
      }
      //more cheat
      if (proposal.key === 'kovan-example-executive-proposal-1') {
        proposal.key = KOVAN_EXAMPLE_EXECUTIVE_PROPOSAL_1;
        const exProp = window.maker
          .service('smartContract')
          .getContractAddressByName(KOVAN_EXAMPLE_EXECUTIVE_PROPOSAL_1); // the source I want

        // this function works, but now do it right
        console.log(proposal.source);

        proposal.source = exProp;
      }
    });
  });

  return topics;
  // TODO: actually use logic here...
  // const contract = window.maker
  //   .service('smartContract')
  //   .getContractByName(KOVAN_EXAMPLE_EXECUTIVE_PROPOSAL_1);
  // console.log('cont is', contract);
};

function extractProposals(topics, network) {
  // if key in config map, overwrite the source (address) with config value
  // make sure connects to staging backend & fetches kovan version
  // update staging cms with upcoming yes/no propsals (disable)
  console.log(topics);
  const newTopics = updateSourceForTestnet(topics);
  console.log('new topics', newTopics);

  return topics.reduce((acc, topic) => {
    const proposals = topic.proposals.map(({ source, ...otherProps }) => ({
      ...otherProps,
      source: source.startsWith('{') ? JSON.parse(source)[network] : source,
      active: topic.active,
      govVote: topic.govVote,
      topicKey: topic.key
    }));
    return acc.concat(proposals);
  }, []);
}

export const proposalsInit = network => async dispatch => {
  dispatch({ type: PROPOSALS_REQUEST, payload: {} });
  try {
    const topics = await promiseRetry({
      fn: fetchTopics,
      args: [network],
      times: 4,
      delay: 1
    });

    dispatch({
      type: PROPOSALS_SUCCESS,
      payload: extractProposals(topics, network)
    });
  } catch (err) {
    dispatch({
      type: PROPOSALS_FAILURE,
      payload: {
        error: err
      }
    });
  }
  dispatch(initApprovalsFetch());
};

// Reducer ------------------------------------------------

export default createReducer([], {
  [PROPOSALS_SUCCESS]: (_, { payload }) => payload || []
});
