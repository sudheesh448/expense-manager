import React from 'react';
import { StyleSheet, View } from 'react-native';
import EmiAccountCard from './cards/EmiAccountCard';
import LoanAccountCard from './cards/LoanAccountCard';
import BorrowedAccountCard from './cards/BorrowedAccountCard';
import CreditCardCard from './cards/CreditCardCard';
import BaseAccountCard from './cards/BaseAccountCard';
// Removed unused import

import RecurringCard from './cards/RecurringCard';
import SipAccountCard from './cards/SipAccountCard';
export { RecurringCard };

export const AccountCard = (props) => {
  const { item } = props;
  
  switch (item.type) {
    case 'EMI':
      return <EmiAccountCard {...props} />;
    case 'LOAN':
      return <LoanAccountCard {...props} />;
    case 'BORROWED':
      return <BorrowedAccountCard {...props} />;
    case 'LENDED':
      return <LoanAccountCard {...props} />;
    case 'CREDIT_CARD':
      return <CreditCardCard {...props} />;
    case 'SIP':
      return <SipAccountCard {...props} />;
    case 'BANK':
    case 'SAVINGS':
    case 'INVESTMENT':
      return <BaseAccountCard {...props} />;
    default:
      return null;
  }
};

const styles = StyleSheet.create({
  // Shared styles can go here, but individual cards have their own now.
});
