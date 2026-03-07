'use strict';

module.exports = {
  registerUser: async () => {
    throw new Error('TODO: implement registerUser with PostgreSQL repository');
  },
  authenticateUser: async () => {
    throw new Error('TODO: implement authenticateUser with PostgreSQL + Redis sessions');
  },
  updateProfile: async () => {
    throw new Error('TODO: implement updateProfile with compliance checks');
  },
  submitKyc: async () => {
    throw new Error('TODO: implement KYC submission provider adapter');
  }
};
