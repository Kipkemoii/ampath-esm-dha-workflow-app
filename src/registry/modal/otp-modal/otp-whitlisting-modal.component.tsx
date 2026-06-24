import React, { useEffect, useState } from 'react';
import { getOtpWhitelistingStatus, getPatientContacts } from '../../hie.resource';
import { Button, InlineLoading, Select, SelectItem, TextArea, FileUploader } from '@carbon/react';
import { usePatient } from '../../../context/patient-context';
import { useSession } from '@openmrs/esm-framework';

interface OTPWhitlistingModalProps {
  onWhitelistStatusChange: (whitelisted: boolean) => void;
}

const OTPWhitlistingModal: React.FC<OTPWhitlistingModalProps> = ({ onWhitelistStatusChange }) => {
  const [whitelisted, setWhitelisted] = useState<boolean | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [reasonDescription, setReasonDescription] = useState('');
  const { patient } = usePatient();
  const session = useSession();
  const locationUuid = session.sessionLocation!.uuid;

  const REASON_TYPES = [
    'OLD',
    'AMPUTEE',
    'MEDICAL_CONDITION',
    'MENTALLY_UNSTABLE',
    'ONCOLOGY_TREATMENT',
    'DIALYSIS_TREATMENT',
    'CONSTRUCTION_WORKER',
    'OTHER',
    'EXPIRED',
    'BIOMETRIC_FAILURE',
    'CHILD_BELOW_7_YEARS',
    'PRIVACY_CONCERNS',
    'TECHNICAL_ISSUES',
  ];
  useEffect(() => {
    const identifier = patient!.identification_number;
    const identifierType = patient!.identification_type;
    async function fetchData() {
      try {
        const res = await getOtpWhitelistingStatus(identifier, identifierType, locationUuid);

        const isWhitelisted = res?.whitelistedForOTP ?? false;
        // eslint-disable-next-line no-console
        console.log('Whitelisted:', isWhitelisted);
        setWhitelisted(isWhitelisted ?? false);
        onWhitelistStatusChange(isWhitelisted ?? false);
      } catch (error) {
        console.error('Error fetching whitelist status:', error);
        setWhitelisted(false);
        onWhitelistStatusChange(false);
      }
    }

    fetchData();
  }, [onWhitelistStatusChange]);

  useEffect(() => {
    const crId = patient!.id;
    async function fetchData() {
      try {
        const res = await getPatientContacts(crId, locationUuid);

        const phone = res?.results[0]?.contactValue;

        setPhoneNumber(phone ?? '');
      } catch (error) {
        console.error('Error fetching whitelist status:', error);
        setWhitelisted(false);
        onWhitelistStatusChange(false);
      }
    }

    fetchData();
  }, [onWhitelistStatusChange]);

  if (whitelisted === null) {
    return (
      <div>
        <InlineLoading description="Checking whitelist status..." />
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
  };

  const handleWhitelistSubmit = () => {
    if (!file) {
      alert('Please upload a supporting document.');
      return;
    }

    if (!selectedReason) {
      alert('Please select a reason type.');
      return;
    }

    if (!reasonDescription.trim()) {
      alert('Please provide additional description to support reason type.');
      return;
    }

    // TODO: send file to backend (FormData)
    const formData = new FormData();
    formData.append('document', file);
    formData.append('phoneNumber', phoneNumber);
    formData.append('reasonType', selectedReason);
    formData.append('reasonDescription', reasonDescription);

    // eslint-disable-next-line no-console
    console.log('Submitting whitelist request', {
      phoneNumber,
      selectedReason,
      reasonDescription,
      fileName: file.name,
    });
  };

  return (
    <div>
      {whitelisted ? (
        <>
          <h2>OTP Verification</h2>
          <p>
            An OTP will be sent to <strong>{phoneNumber}</strong>.
          </p>
        </>
      ) : (
        <>
          <h2>Phone Number Whitelisting Status</h2>
          <p>
            The phone number <strong>{phoneNumber}</strong> is not whitelisted.
          </p>
          <div style={{ marginTop: '1rem' }}>
            <FileUploader
              labelTitle="Supporting Document"
              buttonLabel="Upload file"
              accept={['.pdf', '.jpg', '.jpeg', '.png']}
              filenameStatus="edit"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0] ?? null;
                setFile(selectedFile);
              }}
            />
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Select
              id="reason-type"
              labelText="Reason Type"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
            >
              <SelectItem value="" text="Select a reason" />
              {REASON_TYPES.map((reason) => (
                <SelectItem key={reason} value={reason} text={reason.replace(/_/g, ' ')} />
              ))}
            </Select>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <TextArea
              id="reason-description"
              labelText="Reason Description"
              placeholder="Provide additional details..."
              value={reasonDescription}
              onChange={(e) => setReasonDescription(e.target.value)}
            />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Button onClick={handleWhitelistSubmit} disabled={!file || !selectedReason || !reasonDescription.trim()}>
              Submit Whitelisting Request
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default OTPWhitlistingModal;
