'use strict';

module.exports = {
  validateBetSlip: async () => {
    throw new Error('TODO: implement bet validation (market open, stake limits, balance)');
  },
  placeBet: async () => {
    throw new Error('TODO: implement atomic placeBet (wallet debit + bet records)');
  },
  settleBet: async () => {
    throw new Error('TODO: implement settlement + payout/refund accounting');
  }
};
