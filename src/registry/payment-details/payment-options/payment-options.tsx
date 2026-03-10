import React, { useEffect, useMemo, useState } from 'react';
import styles from './payment-options.scss';
import { Button, ComboBox } from '@carbon/react';
import { fetchPaymentModes } from '../../../shared/services/billing.resource';
import { type PaymentMode } from '../../../shared/types';
import { showSnackbar } from '@openmrs/esm-framework';
interface PaymentOptionsComponentProps {
  onSelectPaymentMethod: (paymentMode: PaymentMode) => void;
}
const PaymentOptionsComponent: React.FC<PaymentOptionsComponentProps> = ({ onSelectPaymentMethod }) => {
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const paymentOptions = useMemo(() => generatePaymentTypeOptions(), [paymentModes]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMode>();
  useEffect(() => {
    getPaymentMethods();
  }, []);
  async function getPaymentMethods() {
    const methods = await fetchPaymentModes();
    setPaymentModes(methods);
  }
  function generatePaymentTypeOptions() {
    return paymentModes.map((p: PaymentMode) => {
      return {
        id: p.uuid,
        text: p.name,
      };
    });
  }
  const handleSelectedPatientOption = (selectedPaymentOption: { selectedItem: { id: string; text: string } }) => {
    const selectedMethod = paymentModes.find((p) => {
      return p.uuid === selectedPaymentOption.selectedItem.id;
    });
    if (selectedMethod) {
      setSelectedPaymentMethod(selectedMethod);
    } else {
      showSnackbar({
        kind: 'error',
        title: 'Missing Payment method',
        subtitle: 'Please select a payment method',
      });
    }
  };
  const handleSavePaymentMethod = () => {
    onSelectPaymentMethod(selectedPaymentMethod);
  };
  return (
    <>
      <div className={styles.paymentOptionLayout}>
        <div className={styles.formRow}>
          <ComboBox
            onChange={handleSelectedPatientOption}
            id="payment-method-combobox"
            items={paymentOptions}
            itemToString={(item) => (item ? item.text : '')}
            titleText="Select a Payment Method"
          />
        </div>
        <div className={styles.formRow}>
          <Button kind="primary" onClick={handleSavePaymentMethod}>
            Save
          </Button>
        </div>
      </div>
    </>
  );
};

export default PaymentOptionsComponent;
