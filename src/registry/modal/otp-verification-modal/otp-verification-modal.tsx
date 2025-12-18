import React, { useState } from 'react';
import { OtpStatus, type RequestCustomOtpDto } from '../../types';
import { Button, FormLabel, InlineLoading, Modal, ModalBody } from '@carbon/react';
import styles from './otp-verification-modal.scss';
import { showSnackbar } from '@openmrs/esm-framework';
import { requestCustomOtp, validateCustomOtp } from '../../registry.resource';
import { maskValue } from '../../utils/mask-data';
import OTPInput from '../../../shared/ui/otp-input/otp-input.component';

interface OtpVerificationModalpProps {
  requestCustomOtpDto: RequestCustomOtpDto;
  phoneNumber: string;
  open: boolean;
  onModalClose: () => void;
  onOtpSuccessfullVerification: () => void;
}
const OtpVerificationModal: React.FC<OtpVerificationModalpProps> = ({
  requestCustomOtpDto,
  phoneNumber,
  open,
  onModalClose,
  onOtpSuccessfullVerification,
}) => {
  const [otp, setOtp] = useState('');
  const [otpStatus, setOtpStatus] = useState<string>(OtpStatus.Draft);
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
      setOtpStatus(OtpStatus.Sent);

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

      setOtpStatus(OtpStatus.Verified);

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
  const registerOnAfyaYangu = () => {
    window.open('https://afyayangu.go.ke/', '_blank');
  };

  const onSubmit = () => {};
  return (
    <>
      <Modal
        open={open}
        size="md"
        onSecondarySubmit={onModalClose}
        onRequestClose={onModalClose}
        onRequestSubmit={registerOnAfyaYangu}
        primaryButtonText="Register on Afya Yangu"
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
                {otpStatus === OtpStatus.Draft ? (
                  <>
                    <h6>Send Code to Phone {maskValue(phoneNumber)}</h6>
                  </>
                ) : (
                  <></>
                )}

                {otpStatus === OtpStatus.Verified ? (
                  <>
                    <h6>OTP Verification Successfull!</h6>
                  </>
                ) : (
                  <></>
                )}
              </div>
              <div className={styles.otpSection}>
                {otpStatus === OtpStatus.Sent ? (
                  <>
                    <FormLabel>Enter OTP</FormLabel>
                    <OTPInput otpLength={5} onChange={(value) => setOtp(value)} />
                  </>
                ) : (
                  <></>
                )}
              </div>
            </div>
            <div className={styles.sectionAction}>
              {otpStatus === OtpStatus.Draft ? (
                <>
                  <Button kind="primary" onClick={handleSendOtp}>
                    {loading ? <InlineLoading description="Sending OTP..." /> : 'Send OTP'}
                  </Button>
                </>
              ) : (
                <></>
              )}

              {otpStatus === OtpStatus.Sent ? (
                <>
                  <Button kind="primary" onClick={handleVerifyOtp}>
                    {loading ? <InlineLoading description="Verifying OTP..." /> : 'Verify'}
                  </Button>
                </>
              ) : (
                <></>
              )}

              {otpStatus === OtpStatus.Verified ? (
                <>
                  <Button kind="primary" onClick={onOtpSuccessfullVerification}>
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
