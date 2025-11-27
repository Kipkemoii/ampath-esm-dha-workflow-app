import { RadioButton, RadioButtonGroup } from '@carbon/react';
import React from 'react';
const PaymentOptionsComponent: React.FC = () => {
  const handleSelectedPatientOption = (p: string) => {};
  return (
    <>
      <RadioButtonGroup
        defaultSelected="sha"
        legendText="Patient"
        onChange={(v) => handleSelectedPatientOption(v as string)}
        name="payment-options-radio-group"
      >
        <RadioButton id="sha" labelText="Social Health Authority" value="sha" />
        <RadioButton id="insurance" labelText="Other Insurance" value="other" />
        <RadioButton id="cash" labelText="Cash" value="cash" />
      </RadioButtonGroup>
    </>
  );
};

export default PaymentOptionsComponent;
