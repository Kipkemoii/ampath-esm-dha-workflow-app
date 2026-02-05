import { type HieClientEligibility, type EligibilityFilterDto } from '../../registry/types';
import { getHieBaseUrl } from '../utils/get-base-url';

export async function getClientEligibityStatus(
  eligibilityFilterDto: EligibilityFilterDto,
): Promise<HieClientEligibility> {
  const hieBaseUrl = await getHieBaseUrl();
  const url = `${hieBaseUrl}/eligibility`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eligibilityFilterDto),
  });

  const data = response.json();
  return data;
}
