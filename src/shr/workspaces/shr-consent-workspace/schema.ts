import { z } from 'zod';
import { SHR_REPRESENTATIVE_RELATIONSHIPS } from '../../shr.types';

/**
 * The request step of the SHR consent workspace.
 *
 * `crId`, `locationUuid` and `requestedBy` are all resolved from context (the
 * patient's Client Registry number, the session location, the logged-in user),
 * so they're deliberately not form fields — only what a clerk actually chooses
 * is validated here.
 *
 * Three *independent* situations decide which fields are required, and the
 * whole point of building the schema per-patient is to keep them from implying
 * one another:
 *
 * | Situation                         | emergency | patientUnableToConsent | reason | representative |
 * |-----------------------------------|-----------|------------------------|--------|----------------|
 * | Adult, present, capable           | off       | off                    | no     | no             |
 * | Emergency, cannot wait            | **on**    | n/a                    | **yes**| no (no OTP)    |
 * | Incapacitated adult, no emergency | off       | **on**                 | **yes**| **yes**        |
 * | Minor (auto-detected)             | off       | not shown              | no     | **yes**        |
 *
 * A minor always needs a representative and never needs a reason — being a
 * child is not an incapacity. An emergency needs a reason and no
 * representative. They share the `incapacityReason` field and nothing else.
 */
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
      // An emergency sends no OTP to anyone, so naming a representative to
      // route it to would be pointless — the reason is what DHA needs there.
      const needsRepresentative = !values.emergency && (isMinor || values.patientUnableToConsent);
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

      if (needsRepresentative && !values.representativeCrId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['representativeCrId'],
          message: "Enter the representative's Client Registry number.",
        });
      }

      if (needsRepresentative && !values.representativeRelationship) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['representativeRelationship'],
          message: 'Select how the representative relates to the patient.',
        });
      }
    });

export { createValidationSchema };

export type ShrConsentFormSchema = z.infer<ReturnType<typeof createValidationSchema>>;
