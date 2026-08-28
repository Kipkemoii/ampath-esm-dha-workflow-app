import React, { useEffect, useState } from 'react';

import styles from './emergency.scss';
import { Dropdown, TextArea } from '@carbon/react';
import EmergencyOtpComponent from './otp-component';
import { type HieClient } from '../types';
import { fetchEmergencyInterventions, fetchProviders, sendEmergencyClaimIdentified } from './emergency.resource';
import { type Intervention } from 'src/claims';
import { useSession } from '@openmrs/esm-framework';
import { generateReferenceNumber, getAbbreviation, type EmergencyFormData, type Provider } from './type';

interface EmergencySlotComponentProps {
  client?: HieClient;
  onFormChange: (data: EmergencyFormData) => void;
  onValidationChange: (isValid: boolean) => void;
  showValidationErrors?: boolean;
}

const EmergencySlotComponent: React.FC<EmergencySlotComponentProps> = ({
  client,
  onFormChange,
  onValidationChange,
}) => {
  const [modeOfArrival, setModeOfArrival] = useState<string>();
  const [broughtBy, setBroughtBy] = useState<string>();
  const [notes, setNotes] = useState<string>('');
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention>();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider>();
  const MODE_OF_ARRIVAL = ['AMBULANCE', 'WALK-IN', 'OTHER'];
  const BROUGHT_BY = ['RELATIVE', 'UNKNOWN', 'SAMARITAN', 'PARAMEDICS'];
  const [otpVerified, setOtpVerified] = useState(false);
  const [errors, setErrors] = useState({
    modeOfArrival: false,
    broughtBy: false,
    intervention: false,
    provider: false,
    notes: false,
  });

  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid;

  const handleModeOfArrivalChange = (item: any) => {
    if (item) {
      setModeOfArrival(item.selectedItem);
    }
  };

  useEffect(() => {
    const isValid = Boolean(
      modeOfArrival &&
      broughtBy &&
      selectedIntervention?.code &&
      selectedProvider?.provider_national_id &&
      notes.trim() &&
      otpVerified,
    );

    onValidationChange(isValid);

    onFormChange({
      modeOfArrival,
      broughtBy,
      interventionCode: selectedIntervention?.code,
      providerNationalId: selectedProvider?.provider_national_id,
      identificationType: 'National ID',
      licensingBody: getAbbreviation(selectedProvider?.licensing_body),
      notes,
    });
  }, [
    modeOfArrival,
    broughtBy,
    selectedIntervention,
    selectedProvider,
    notes,
    onFormChange,
    onValidationChange,
    otpVerified,
  ]);

  const getInterventions = async () => {
    const res = await fetchEmergencyInterventions();

    setInterventions(res?.results ?? []);
  };

  useEffect(() => {
    getInterventions();
    getProviders();
  }, []);

  const handleBroughtByChange = (item: any) => {
    if (item) {
      setBroughtBy(item.selectedItem);
    }
  };

  const handleNotes = (event: any) => {
    if (event) {
      setNotes(event.target.value);
    }
  };

  const initiateEmergencyClaim = async () => {
    const validationErrors = {
      modeOfArrival: !modeOfArrival,
      broughtBy: !broughtBy,
      intervention: !selectedIntervention?.code,
      provider: !selectedProvider,
      notes: !notes.trim(),
    };

    setErrors(validationErrors);

    const hasErrors = Object.values(validationErrors).some(Boolean);

    if (hasErrors) {
      return;
    }

    try {
      const res = await sendEmergencyClaimIdentified(
        modeOfArrival,
        broughtBy,
        locationUuid,
        selectedIntervention?.code,
        generateReferenceNumber(),
        client?.id,
        selectedProvider?.provider_national_id,
        'National ID',
        getAbbreviation(selectedProvider?.licensing_body),
        notes.trim(),
      );
    } catch (error) {
      console.error('Error initiating emergency claim:', error);
    }
  };

  const getProviders = async () => {
    const res = await fetchProviders();
    setProviders(res?.results ?? []);
  };

  const handleInterventionChange = (item: any) => {
    if (item) {
      setSelectedIntervention(item.selectedItem);
    }
  };

  const handleProviderChange = (item: any) => {
    if (item) {
      setSelectedProvider(item.selectedItem);
    }
  };

  return (
    <>
      <div className={styles.dropDownContainer}>
        <div className={styles.dropDown} />
        <Dropdown
          autoAlign
          direction="top"
          id="mode-of-arrival"
          invalidText="Kindly select mode of arrival"
          items={MODE_OF_ARRIVAL}
          label=""
          onChange={handleModeOfArrivalChange}
          size="md"
          titleText="Mode of Arrival"
          type="default"
          invalid={errors.modeOfArrival}
        />
      </div>
      <div className={styles.dropDownContainer}>
        <div className={styles.dropDown} />
        <Dropdown
          autoAlign
          direction="top"
          id="brought-by"
          invalidText="Kindly select brought by"
          items={BROUGHT_BY}
          label=""
          onChange={handleBroughtByChange}
          size="md"
          titleText="Brought By"
          type="default"
          invalid={errors.broughtBy}
        />
      </div>
      {/* <div className={styles.identifier}>
        <div>
          <TextInput
            defaultValue=""
            id="identifier-value"
            labelText="Identifier Value"
            maxCount={10}
            onChange={handleProviderIdentifierChange}
            placeholder="Identifier Value"
            size="md"
            type="text"
          />
        </div>
        <div className={styles.dropDownContainer}>
          <div className={styles.dropDown} />
          <Dropdown
            className={styles.identifierValue}
            autoAlign
            direction="top"
            id="identification-type"
            invalidText="Kindly select identification type"
            items={IDENTIFICATION_TYPES}
            label=""
            onChange={handleProviderIdentifierTypeChange}
            size="md"
            titleText="identification Type"
            type="default"
          />
        </div>
      </div>*/}
      {/* <div className={styles.dropDownContainer}>
        <div className={styles.dropDown} />
        <Dropdown
          autoAlign
          direction="top"
          id="regulatory-body"
          invalidText="Kindly select regulatory body"
          items={REGULATORY_BODIES}
          label=""
          onChange={handleRegulatoryBodyChange}
          size="md"
          titleText="Regulatory Body"
          type="default"
        />
      </div> */}
      <div className={styles.dropDownContainer}>
        <div className={styles.dropDown} />
        <Dropdown
          autoAlign
          direction="top"
          id="interventions"
          invalidText="Kindly select an intervention"
          items={interventions}
          itemToString={(item) => `${item?.name} - ${item?.code}`}
          label=""
          onChange={handleInterventionChange}
          size="md"
          titleText="Interventions"
          type="default"
          invalid={errors.intervention}
        />
      </div>
      <div className={styles.dropDownContainer}>
        <div className={styles.dropDown} />
        <Dropdown
          autoAlign
          direction="top"
          id="provider"
          invalidText="Kindly select a provider"
          items={providers}
          itemToString={(item) => item?.display ?? ''}
          label=""
          onChange={handleProviderChange}
          size="md"
          titleText="Provider"
          type="default"
          invalid={errors.provider}
        />
      </div>
      <TextArea
        enableCounter
        helperText="Notes"
        id="notes"
        labelText=""
        maxCount={500}
        placeholder="notes"
        rows={4}
        value={notes}
        onChange={handleNotes}
      />
      <EmergencyOtpComponent
        client={client}
        interventionCode={selectedIntervention?.code}
        onOtpVerificationStatusChange={setOtpVerified}
      />
    </>
  );
};

export default EmergencySlotComponent;
