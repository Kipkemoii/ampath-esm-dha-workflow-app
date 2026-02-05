import { type TagType } from '../../types/types';

export function getTagType(val: number | string): TagType {
  if (val === 1 || val === '1') {
    return 'green';
  } else {
    return 'red';
  }
}
