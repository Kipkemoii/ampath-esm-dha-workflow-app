import React, { useState } from 'react';
import { type RequestCustomOtpDto } from '../../types';
import { Button, Modal, ModalBody, TextInput } from '@carbon/react';
import styles from './otp-verification-modal.scss';
import { showSnackbar } from '@openmrs/esm-framework';
import { requestCustomOtp, validateCustomOtp } from '../../registry.resource';

interface OtpVerificationModalpProps {
  requestCustomOtpDto: RequestCustomOtpDto;
  phoneNumber: string;
  open: boolean;
  onModalClose: () => void;
}
const OtpVerificationModal: React.FC<OtpVerificationModalpProps> = ({
  requestCustomOtpDto,
  phoneNumber,
  open,
  onModalClose,
}) => {
  const [otp, setOtp] = useState('');
  const [otpStatus, setOtpStatus] = useState<string>('DRAFT');
  const [loading, setLoading] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>('');

  const handleSendOtp = async () => {
    if (!requestCustomOtpDto.identificationNumber) {
      showAlert('error', 'Invalid Identification Value', 'Please enter a valid ID value');
      return;
    }
    setLoading(true);
    try {
      const response = await requestCustomOtp(requestCustomOtpDto);
      setSessionId(response.sessionId);
      setOtpStatus('OTP_SENT');

      showAlert('success', 'OTP sent successfully', `A code was sent to ${response.maskedPhone}`);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send OTP';
      showAlert('error', 'Error sending OTP', errorMessage);
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

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      showAlert('error', 'Please enter the OTP code', '');
      return;
    }

    setLoading(true);

    try {
      const payload = { sessionId, otp, locationUuid: requestCustomOtpDto.locationUuid };
      await validateCustomOtp(payload);

      setOtpStatus('OTP_VERIFIED');

      showSnackbar({
        kind: 'success',
        title: 'OTP Verified',
        subtitle: 'You can now fetch data from Client Registry.',
      });
    } catch (err: any) {
      const errorMessage = err.message || 'OTP verification failed';
      showSnackbar({
        kind: 'error',
        title: 'OTP Verification Failed',
        subtitle: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = () => {};
  return (
    <>
      <Modal
        open={open}
        size="md"
        onSecondarySubmit={onModalClose}
        onRequestClose={onModalClose}
        onRequestSubmit={onSubmit}
        primaryButtonText=""
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.modalVerificationLayout}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>One Time Password (OTP)</h4>
              <h6>Enter one time password to proceed</h6>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.contentHeader}>
                {otpStatus === 'DRAFT' ? (
                  <>
                    <h6>Send Code to Phone {phoneNumber}</h6>
                  </>
                ) : (
                  <></>
                )}

                {otpStatus === 'OTP_SENT' ? (
                  <>
                    <TextInput
                      id="otp-input"
                      labelText="Enter OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter the code sent to your phone"
                    />
                  </>
                ) : (
                  <></>
                )}

                {otpStatus === 'OTP_VERIFIED' ? (
                  <>
                    <h6>OTP Verification Successfull!</h6>
                  </>
                ) : (
                  <></>
                )}
              </div>
            </div>
            <div className={styles.sectionAction}>
              {otpStatus === 'DRAFT' ? (
                <>
                  <Button kind="primary" onClick={handleSendOtp}>
                    Send OTP
                  </Button>
                </>
              ) : (
                <></>
              )}

              {otpStatus === 'OTP_SENT' ? (
                <>
                  <Button kind="primary" onClick={handleVerifyOtp}>
                    Verify
                  </Button>
                </>
              ) : (
                <></>
              )}

              {otpStatus === 'OTP_VERIFIED' ? (
                <>
                  <Button kind="primary" onClick={onModalClose}>
                    Continue
                  </Button>
                </>
              ) : (
                <></>
              )}
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default OtpVerificationModal;
