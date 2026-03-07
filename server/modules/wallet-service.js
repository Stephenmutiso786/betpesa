'use strict';

module.exports = {
  getBalance: async () => {
    throw new Error('TODO: implement wallet balance query');
  },
  deposit: async () => {
    throw new Error('TODO: implement deposit + ledger write + idempotency');
  },
  withdraw: async () => {
    throw new Error('TODO: implement withdrawal workflow + approval checks');
  },
  listTransactions: async () => {
    throw new Error('TODO: implement transaction history query');
  }
};
