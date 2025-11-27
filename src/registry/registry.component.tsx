import {
  Button,
  Dropdown,
  InlineLoading,
  RadioButton,
  RadioButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
} from '@carbon/react';
import React, { useState } from 'react';
import styles from './registry.component.scss';
import { type HieClient, IDENTIFIER_TYPES, type IdentifierType, type RequestCustomOtpDto } from './types';
import { fetchClientRegistryData } from './registry.resource';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import OtpVerificationModal from './modal/otp-verification-modal/otp-verification-modal';
import { maskExceptFirstAndLast, maskValue } from './utils/mask-data';
import ClientDetailsModal from './modal/client-details-modal/client-details-modal';
interface RegistryComponentProps {}
const RegistryComponent: React.FC<RegistryComponentProps> = () => {
  const [identifierType, setIdentifierType] = useState<IdentifierType>('National ID');
  const [identifierValue, setIdentifierValue] = useState('');
  const [loading, setLoading] = useState<boolean>(false);
  const [client, setClient] = useState<HieClient>();
  const [selectedPatient, setSelectedPatient] = useState<string>('principal');
  const [displayOtpModal, setDisplayOtpModal] = useState<boolean>(false);
  const [displayClientDetailsModal, setDisplayClientDetailsModal] = useState<boolean>(false);
  const [requestCustomOtpDto, setRequestCustomOtpDto] = useState<RequestCustomOtpDto>();
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;

  const handleSearchPatient = async () => {
    setLoading(true);
    try {
      const payload = {
        identificationNumber: identifierValue,
        identificationType: identifierType,
        locationUuid,
      };

      setRequestCustomOtpDto(payload);

      const result = await fetchClientRegistryData(payload);
      const patients = Array.isArray(result) ? result : [];

      if (patients.length === 0) throw new Error('No matching patient found in Client Registry.');

      const patient = patients[0];
      setClient(patient);
      showAlert('success', 'Client Data Loaded', 'Patient fetched successfully');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch client data';
      showAlert('error', 'Fetch Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };
  const showAlert = (alertType: 'error' | 'success', title: string, subtitle: string) => {
    showSnackbar({
      kind: alertType,
      title: title,
      subtitle: subtitle,
    });
  };
  const handleSelectedPatient = (sp: string) => {
    setSelectedPatient(sp);
  };
  const handleOtpVerification = () => {
    setDisplayOtpModal(true);
  };
  const handleModelClose = () => {
    setDisplayOtpModal(false);
    setDisplayClientDetailsModal(true);
  };
  const onClientDetailsModalClose = () => {
    setDisplayClientDetailsModal(false);
  };
  const handleClientDetailsSubmit = () => {
    return;
  };
  return (
    <>
      <div className={styles.registryLayout}>
        <div className={styles.registryHeader}>
          <h4>Client Registry</h4>
          <p>Please enter identification number to begin</p>
        </div>
        <div className={styles.registryContent}>
          <div className={styles.formRow}>
            <div className={styles.formControl}>
              <Dropdown
                id="identifier-type-dropdown"
                label="Identifier Type"
                titleText="Select Identifier Type"
                items={IDENTIFIER_TYPES}
                selectedItem={identifierType}
                onChange={({ selectedItem }) => setIdentifierType(selectedItem as IdentifierType)}
              />
            </div>

            <div className={styles.formControl}>
              <TextInput
                id="identifier-value"
                labelText={`${identifierType} Value`}
                value={identifierValue}
                onChange={(e) => setIdentifierValue(e.target.value)}
                placeholder={`Enter ${identifierType.toLowerCase()} value`}
              />
            </div>
            <div className={styles.formControl}>
              <Button kind="primary" onClick={handleSearchPatient} disabled={loading}>
                {loading ? <InlineLoading description="Searching..." /> : 'Search'}
              </Button>
            </div>
          </div>
          {client ? (
            <div className={styles.formRow}>
              <div className={styles.hieData}>
                <div className={styles.selectionHeader}>
                  <h5>Please select one patient and request patient to share the OTP sent</h5>
                </div>
                <div className={styles.patientSelect}>
                  <div className={styles.patientSelectRadio}>
                    <RadioButtonGroup
                      defaultSelected="principal"
                      legendText="Patient"
                      onChange={(v) => handleSelectedPatient(v as string)}
                      name="radio-button-default-group"
                    >
                      <RadioButton id="principal" labelText="Principal" value="principal" />
                      <RadioButton id="dependants" labelText="Dependants" value="dependants" />
                    </RadioButtonGroup>
                  </div>
                  <div className={styles.patientConfirmSelection}>
                    <div className={styles.btnContainer}>
                      <Button kind="primary" onClick={handleOtpVerification}>
                        {' '}
                        Confirm
                      </Button>
                    </div>
                    <div className={styles.btnContainer}>
                      <Button kind="secondary">Cancel</Button>
                    </div>
                  </div>
                </div>
                {selectedPatient === 'principal' ? (
                  <>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeader>Name</TableHeader>
                          <TableHeader>CR</TableHeader>
                          <TableHeader>Phone No</TableHeader>
                          <TableHeader>ID No</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>
                            {client.first_name} {maskExceptFirstAndLast(client.middle_name)}{' '}
                            {maskExceptFirstAndLast(client.last_name)}
                          </TableCell>
                          <TableCell>{maskValue(client.id)}</TableCell>
                          <TableCell>{maskValue(client.phone)}</TableCell>
                          <TableCell>{maskValue(client.identification_number)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </>
                ) : (
                  <></>
                )}
                {selectedPatient === 'dependants' ? (
                  <>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeader>Name</TableHeader>
                          <TableHeader>CR</TableHeader>
                          <TableHeader>Relationship</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {client.dependants.map((d) => {
                          const dependant = d.result[0];
                          const relationship = d.relationship;
                          return (
                            <>
                              <TableRow>
                                <TableCell>
                                  {dependant.first_name} {maskExceptFirstAndLast(dependant.middle_name)}{' '}
                                  {maskExceptFirstAndLast(dependant.last_name)}
                                </TableCell>
                                <TableCell>{maskValue(dependant.id)}</TableCell>
                                <TableCell>{relationship}</TableCell>
                              </TableRow>
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </>
                ) : (
                  <></>
                )}

                {displayOtpModal ? (
                  <OtpVerificationModal
                    requestCustomOtpDto={requestCustomOtpDto}
                    phoneNumber={client.phone}
                    open={displayOtpModal}
                    onModalClose={handleModelClose}
                  />
                ) : (
                  <></>
                )}

                {client && displayClientDetailsModal ? (
                  <>
                    <ClientDetailsModal
                      client={client}
                      open={displayClientDetailsModal}
                      onModalClose={onClientDetailsModalClose}
                      onSubmit={handleClientDetailsSubmit}
                    />{' '}
                  </>
                ) : (
                  <></>
                )}
              </div>
            </div>
          ) : (
            <></>
          )}
        </div>
      </div>
    </>
  );
};

export default RegistryComponent;
