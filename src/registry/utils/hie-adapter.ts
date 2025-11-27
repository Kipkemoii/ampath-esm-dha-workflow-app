import { type HieIdentifications, type HieClient } from '../types';

const clientDatailsFields = [
  'id',
  'other_identifications',
  'first_name',
  'middle_name',
  'last_name',
  'gender',
  'date_of_birth',
  'is_alive',
  'deceased_datetime',
  'phone',
  'email',
  'civil_status',
  'place_of_birth',
  'citizenship',
  'country',
  'county',
  'sub_county',
  'ward',
  'village_estate',
  'longitude',
  'latitude',
  'identification_type',
];

export function generateHieClientDetails(hieClient: HieClient) {
  let data = {};
  Object.keys(hieClient)
    .filter((key) => {
      return clientDatailsFields.includes(key);
    })
    .forEach((key) => {
      if (key === 'other_identifications') {
        const otherIds = generateOtherIdentifications(hieClient[key]);
        data = {
          ...data,
          ...otherIds,
        };
      } else if (key === 'identification_type') {
        data[hieClient['identification_type']] = hieClient.identification_number;
      } else {
        const value = hieClient[key];
        data[key] = value;
      }
    });
  return data;
}
function generateOtherIdentifications(hieIdentifications: HieIdentifications[]) {
  const other = {};
  hieIdentifications.forEach((id) => {
    other[id.identification_type] = id.identification_number;
  });
  return other;
}
