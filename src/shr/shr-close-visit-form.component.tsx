import React from 'react';
import { Button, Checkbox, InlineLoading, InlineNotification, TextInput } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import styles from './shr.scss';

interface ShrCloseVisitFormProps {
  /**
   * `true` when the patient cannot consent to their own closure.
   *
   * **Polarity warning.** This drives close-visit's `patient_incapable`, where
   * `1` means "cannot consent". The consent *request* uses `patient_capable`,
   * where `1` means the opposite — "can consent". Two similarly named flags on
   * two endpoints, inverted; transposing them silently sends the wrong meaning,
   * so read the field name every time rather than trusting the symmetry.
   */
  patientIncapable: boolean;
  incapacityReason: string;
  isClosing: boolean;
  error?: string;
  onPatientIncapableChange: (patientIncapable: boolean) => void;
  onIncapacityReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The confirmation step in front of "Close visit".
 *
 * Closing is normally OTP-gated — the patient (or their representative) has to
 * approve it, and the visit stays open until they do. That is impossible for a
 * patient who is unconscious or deceased, so this offers the one documented
 * escape: `patient_incapable: 1` with a reason closes the visit immediately,
 * with no password sent or required.
 *
 * Off is the default and leaves today's behaviour untouched.
 */
const ShrCloseVisitForm: React.FC<ShrCloseVisitFormProps> = ({
  patientIncapable,
  incapacityReason,
  isClosing,
  error,
  onPatientIncapableChange,
  onIncapacityReasonChange,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const canConfirm = !isClosing && (!patientIncapable || Boolean(incapacityReason.trim()));

  return (
    <div className={styles.closePanel}>
      <h5 className={styles.closePanelTitle}>{t('closeVisit', 'Close visit')}</h5>
      <p className={styles.closePanelText}>
        {t(
          'shrCloseVisitExplainer',
          'The patient is normally asked to approve the closure with an OTP, and the visit stays open until they do.',
        )}
      </p>

      {error && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('shrCloseVisitFailed', "Couldn't close the visit.")}
          subtitle={error}
        />
      )}

      <Checkbox
        id="shr-patient-incapable"
        labelText={t('shrPatientIncapableOfClosure', 'Patient unable to consent to closure (unconscious/deceased)')}
        helperText={t('shrPatientIncapableHelper', 'Closes the visit immediately, with no OTP sent.')}
        checked={patientIncapable}
        disabled={isClosing}
        onChange={(_event, { checked }) => onPatientIncapableChange(checked)}
      />

      {patientIncapable && (
        <TextInput
          id="shr-close-incapacity-reason"
          labelText={t('incapacityReason', 'Incapacity reason')}
          placeholder={t('shrCloseIncapacityReasonPlaceholder', 'e.g. Unconscious')}
          value={incapacityReason}
          disabled={isClosing}
          onChange={(event) => onIncapacityReasonChange(event.target.value)}
        />
      )}

      <div className={styles.closePanelActions}>
        <Button kind="secondary" size="sm" onClick={onCancel} disabled={isClosing}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="danger" size="sm" onClick={onConfirm} disabled={!canConfirm}>
          {isClosing ? <InlineLoading description={t('closing', 'Closing…')} /> : t('confirmClose', 'Confirm close')}
        </Button>
      </div>
    </div>
  );
};

export default ShrCloseVisitForm;
