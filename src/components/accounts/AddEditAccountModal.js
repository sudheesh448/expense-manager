import React from 'react';
import AddEditBankModal from './modals/AddEditBankModal';
import AddEditCreditCardModal from './modals/AddEditCreditCardModal';
import AddEditLoanModal from './modals/AddEditLoanModal';
import AddEditEmiModal from './modals/AddEditEmiModal';
import AddEditSipModal from './modals/AddEditSipModal';
import AddEditInvestmentModal from './modals/AddEditInvestmentModal';

/**
 * Main Account Modal that routes to specialized modals based on type.
 */
export default function AddEditAccountModal(props) {
  const { openSection, visible } = props;
  
  if (!visible) return null;

  const key = openSection?.key || props.accountData?.type;

  switch (key) {
    case 'BANK':
      return <AddEditBankModal {...props} />;
    
    case 'CREDIT_CARD':
      return <AddEditCreditCardModal {...props} />;
    
    case 'LOAN':
    case 'BORROWED':
    case 'LENDED':
      return <AddEditLoanModal {...props} />;
    
    case 'EMI':
      return <AddEditEmiModal {...props} />;
    
    case 'SIP':
      return <AddEditSipModal {...props} />;
    
    case 'INVESTMENT':
    case 'SAVINGS':
      return <AddEditInvestmentModal {...props} />;
    
    default:
      // Fallback if type is unknown but we still want to show something
      return null;
  }
}
