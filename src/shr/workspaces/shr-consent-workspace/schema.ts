import { z } from 'zod';
import { SHR_REPRESENTATIVE_RELATIONSHIPS } from '../../shr.types';
const createValidationSchema = (isMinor: boolean) =>
  z
    .object({
      visitType: z.enum(['IP', 'OP'], { required_error: 'Select a visit type' }),
      emergency: z.boolean().default(false),
      /**
       * Adults only — a minor's representative requirement is derived from their
       * age, never from a toggle, so this stays off and hidden for them.
       */
      patientUnableToConsent: z.boolean().default(false),
      incapacityReason: z.string().optional(),
      representativeCrId: z.string().optional(),
      representativeRelationship: z.enum(SHR_REPRESENTATIVE_RELATIONSHIPS as [string, ...string[]]).optional(),
    })
    .superRefine((values, ctx) => {
      const needsRelationship = values.emergency || isMinor || values.patientUnableToConsent;
      const needsRepresentativeCrId = !values.emergency && (isMinor || values.patientUnableToConsent);
      // An emergency bypasses the patient's own consent; an incapacitated adult
      // routes it to someone else. Both owe a reason — for different reasons.
      const needsIncapacityReason = values.emergency || (!isMinor && values.patientUnableToConsent);

      if (needsIncapacityReason && !values.incapacityReason?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['incapacityReason'],
          message: 'Enter a reason the patient cannot consent.',
        });
      }

      if (needsRepresentativeCrId && !values.representativeCrId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['representativeCrId'],
          message: "Enter the representative's Client Registry number.",
        });
      }

      if (needsRelationship && !values.representativeRelationship) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['representativeRelationship'],
          message: values.emergency
            ? 'Select the relationship of whoever is authorising this emergency access.'
            : 'Select how the representative relates to the patient.',
        });
      }
    });

export { createValidationSchema };

export type ShrConsentFormSchema = z.infer<ReturnType<typeof createValidationSchema>>;
