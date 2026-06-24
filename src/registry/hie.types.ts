export type HieAccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type PatientContactResult = {
  id: number;
  contactValue: string;
  contactType: string;
  isConfirmed: boolean;
  active: boolean;
};

export type PatientContactResponse = {
  count: number;
  results: PatientContactResult[];
};
