import React, { useEffect, useState } from 'react';

import styles from './emergency.scss';
import { Button, TextInput } from '@carbon/react';
import { Chat, CheckmarkFilled, SendAlt } from '@carbon/react/icons';
import { getPatientContacts, sendClaimsOTP } from '../hie.resource';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { type HieClient } from '../types';

const RESEND_COOLDOWN = 30;

const formatCountdown = (secs: number) => `0:${String(Math.max(0, secs)).padStart(2, '0')}`;

interface EmergencyOtpComponentProps {
  client?: HieClient;
  interventionCode: string;
  onOtpChange?: (otp: string) => void;
  onOtpVerificationStatusChange?: (verified: boolean) => void;
}

const EmergencyOtpComponent: React.FC<EmergencyOtpComponentProps> = ({
  client,
  interventionCode,
  onOtpChange,
  onOtpVerificationStatusChange,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpBusy, setOtpBusy] = useState<'send' | 'verify' | 'resend' | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid;

  const sendClaimsOtp = async (isResend = false) => {
    if (!client?.id || !locationUuid || !interventionCode) {
      showSnackbar({
        kind: 'error',
        title: 'Unable to send OTP',
        subtitle: 'Missing client, location, or intervention information.',
      });

      return;
    }

    try {
      setOtpBusy(isResend ? 'resend' : 'send');

      const response = await sendClaimsOTP(client.id, locationUuid, interventionCode);

      if (response?.message?.includes('OTP')) {
        setOtpSent(true);

        showSnackbar({
          kind: 'success',
          title: isResend ? 'OTP Resent' : 'OTP Sent',
          subtitle: isResend
            ? 'A new OTP has been sent to the registered phone number.'
            : 'An OTP has been sent to the registered phone number.',
        });

        setResendIn(RESEND_COOLDOWN);
      }
    } catch (error) {
      console.error('Error sending OTP:', error);

      showSnackbar({
        kind: 'error',
        title: isResend ? 'Failed to resend OTP' : 'Failed to send OTP',
        subtitle: 'An error occurred while sending the OTP.',
      });
    } finally {
      setOtpBusy(null);
    }
  };

  const handleSendClaimsOtp = async () => {
    await sendClaimsOtp(false);
  };

  const handleResendOtp = async () => {
    if (resendIn > 0 || otpBusy !== null) {
      return;
    }

    await sendClaimsOtp(true);
  };

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendIn((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    if (otpSent) {
      document.getElementById('emergency-otp-0')?.focus();
    }
  }, [otpSent]);

  useEffect(() => {
    const crId = client?.id;

    if (!crId || !locationUuid) {
      return;
    }

    const fetchData = async () => {
      try {
        const res = await getPatientContacts(crId, locationUuid);

        const phone = res?.results?.[0]?.contactValue;

        setPhoneNumber(phone ?? '');
      } catch (error) {
        console.error('Error fetching patient contacts:', error);
      }
    };

    fetchData();
  }, [client, locationUuid]);

  const focusOtp = (index: number) => {
    (document.getElementById(`emergency-otp-${index}`) as HTMLInputElement | null)?.focus();
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    onOtpChange?.(newOtp.join(''));

    onOtpVerificationStatusChange?.(false);

    if (value && index < 5) {
      focusOtp(index + 1);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      e.preventDefault();
      focusOtp(index - 1);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusOtp(index - 1);
    } else if (e.key === 'ArrowRight' && index < 5) {
      focusOtp(index + 1);
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    const newOtp = ['', '', '', '', '', ''];
    for (let i = 0; i < digits.length; i++) newOtp[i] = digits[i];
    setOtp(newOtp);
    onOtpChange?.(newOtp.join(''));
    onOtpVerificationStatusChange?.(false);

    focusOtp(Math.min(digits.length, 5));
  };

  const handleVerifyClaimsOtp = async () => {
    setOtpBusy('verify');
    onOtpChange?.(otp.join(''));
    onOtpVerificationStatusChange?.(true);
    setConsentGiven(true);
    setOtpBusy(null);
  };

  if (consentGiven) {
    return (
      <div className={styles.otpCard}>
        <span className={styles.successIcon}>
          <CheckmarkFilled size={24} />
        </span>
        <h4 className={styles.otpTitle}>Consent successful</h4>
        <p className={styles.otpHint}>
          The client has given consent. Proceed to initiate the SHA claim so the patient can be seen.
        </p>
      </div>
    );
  }

  if (otpSent) {
    return (
      <div className={styles.otpCard}>
        <span className={styles.otpIcon}>
          <Chat size={24} />
        </span>
        <h4 className={styles.otpTitle}>Enter OTP</h4>
        <p className={styles.otpHint}>
          {phoneNumber ? (
            <>
              Enter the 6-digit code sent to <strong>{phoneNumber}</strong>.
            </>
          ) : (
            "Enter the 6-digit code sent to the client's registered phone number."
          )}
        </p>

        <div className={styles.otpInputs}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              id={`emergency-otp-${index}`}
              labelText=""
              hideLabel
              size="lg"
              value={digit}
              maxLength={1}
              inputMode="numeric"
              autoComplete="one-time-code"
              readOnly={otpBusy !== null}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(index, e)}
              onPaste={index === 0 ? handleOtpPaste : undefined}
              className={styles.otpDigit}
            />
          ))}
        </div>

        <div className={styles.otpActions}>
          <Button size="sm" onClick={handleVerifyClaimsOtp} disabled={otp.join('').length !== 6 || otpBusy !== null}>
            {otpBusy === 'verify' ? 'Verifying…' : 'Verify OTP'}
          </Button>

          <Button kind="ghost" size="sm" onClick={handleResendOtp} disabled={otpBusy !== null || resendIn > 0}>
            {otpBusy === 'resend'
              ? 'Resending…'
              : resendIn > 0
                ? `Resend in ${formatCountdown(resendIn)}`
                : 'Resend OTP'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.otpCard}>
      <span className={styles.otpIcon}>
        <Chat size={24} />
      </span>

      <h4 className={styles.otpTitle}>OTP verification</h4>

      <p className={styles.otpHint}>
        {phoneNumber ? (
          <>
            A one-time code will be sent by SMS to <strong>{phoneNumber}</strong>.
          </>
        ) : (
          "A one-time code will be sent by SMS to the client's registered phone number."
        )}
      </p>

      <Button
        className={styles.otpSend}
        size="sm"
        renderIcon={SendAlt}
        onClick={handleSendClaimsOtp}
        disabled={otpBusy !== null}
      >
        {otpBusy === 'send' ? 'Sending…' : 'Send OTP'}
      </Button>
    </div>
  );
};

export default EmergencyOtpComponent;
