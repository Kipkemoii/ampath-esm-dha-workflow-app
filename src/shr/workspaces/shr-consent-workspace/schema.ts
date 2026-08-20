import { z } from 'zod';

/**
 * The request step of the SHR consent workspace.
 *
 * `crId`, `locationUuid` and `requestedBy` are all resolved from context (the
 * patient's Client Registry number, the session location, the logged-in user),
 * so they're deliberately not form fields — only the three things a clerk
 * actually chooses are validated here.
 */
const validationSchema = z
  .object({
    visitType: z.enum(['IP', 'OP'], { required_error: 'Select a visit type' }),
    emergency: z.boolean().default(false),
    incapacityReason: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    // An emergency request bypasses the patient's own consent, so the backend
    // requires a reason the patient could not consent directly.
    if (values.emergency && !values.incapacityReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['incapacityReason'],
        message: 'Enter a reason for incapacity.',
      });
    }
  });

export { validationSchema };

export type ShrConsentFormSchema = z.infer<typeof validationSchema>;
