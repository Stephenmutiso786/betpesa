'use strict';

module.exports = {
  startDeposit: async () => {
    throw new Error('TODO: initiate payment provider transaction (M-Pesa/Stripe)');
  },
  processWebhook: async () => {
    throw new Error('TODO: verify webhook signature and reconcile transaction state');
  },
  startWithdrawalPayout: async () => {
    throw new Error('TODO: execute payout and update transaction status');
  }
};
