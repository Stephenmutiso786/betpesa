'use strict';

module.exports = {
  sendEmail: async () => {
    throw new Error('TODO: implement email provider adapter');
  },
  sendSms: async () => {
    throw new Error('TODO: implement SMS provider adapter');
  },
  sendPush: async () => {
    throw new Error('TODO: implement push notification adapter');
  }
};
