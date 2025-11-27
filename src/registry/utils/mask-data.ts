export const maskValue = (value: string): string => {
  let arrValue = value.split('');
  for (let i = 0; i < value.length; i++) {
    if (i % 2 === 0) {
      arrValue[i] = '*';
    }
  }
  const maskedValue = arrValue.join('');
  return maskedValue;
};

export const maskExceptFirstAndLast = (value: string): string => {
  let arrValue = value.split('');
  for (let i = 0; i < value.length; i++) {
    if (!(i == 0 || i === value.length - 1)) {
      arrValue[i] = '*';
    }
  }
  const maskedValue = arrValue.join('');
  return maskedValue;
};
