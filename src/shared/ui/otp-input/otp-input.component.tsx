import React, { useRef, useState } from 'react';
import { TextInput } from '@carbon/react';
import styles from './otp-input.component.scss';

interface OTPInputProps {
  onChange: (otp: string) => void;
  otpLength: number;
}

const OTPInput: React.FC<OTPInputProps> = ({ onChange, otpLength }) => {
  const [otp, setOtp] = useState(Array(otpLength).fill(''));
  const inputsRef = useRef([]);

  if (!otpLength) {
    return <>OTP Length not defined</>;
  }

  const focusInput = (index) => {
    if (inputsRef.current[index]) {
      inputsRef.current[index].focus();
    }
  };

  const handleChange = (value, index) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < otpLength - 1) {
      focusInput(index + 1);
    }

    onChange?.(newOtp.join(''));
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      focusInput(index - 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, otpLength);

    if (!pasted) return;

    const newOtp = [...otp];
    pasted.split('').forEach((digit, i) => {
      newOtp[i] = digit;
    });

    setOtp(newOtp);
    onChange?.(newOtp.join(''));
    focusInput(pasted.length - 1);
  };

  return (
    <div className={styles.otpInputContainer} onPaste={handlePaste}>
      {otp.map((digit, index) => (
        <div className={styles.otpDataInputContainer}>
          <TextInput
            className={styles.otpDataInput}
            key={index}
            id={`otp-${index}`}
            value={digit}
            labelText=""
            hideLabel
            maxLength={1}
            inputMode="numeric"
            pattern="[0-9]*"
            ref={(el) => (inputsRef.current[index] = el)}
            onChange={(e) => handleChange(e.target.value, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            style={{
              height: '4rem',
              width: '4rem',
              borderStyle: 'solid grey',
              backgroundColor: '#e5ebf7',
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default OTPInput;
