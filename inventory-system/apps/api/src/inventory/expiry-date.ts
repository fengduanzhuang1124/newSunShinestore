import { BadRequestException } from '@nestjs/common';

export function parseExpiryInput(expiryMonth: string, expiryDay?: number) {
  const [year, month] = expiryMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (expiryDay && expiryDay > lastDay) {
    throw new BadRequestException('到期日不符合所选年月');
  }
  const expiryPrecision = expiryDay ? 'DATE' as const : 'MONTH' as const;
  const day = expiryDay ?? lastDay;
  return {
    expiryDate: new Date(Date.UTC(year, month - 1, day)),
    expiryDisplay: expiryDay
      ? `${expiryMonth}-${String(expiryDay).padStart(2, '0')}`
      : expiryMonth,
    expiryPrecision,
  };
}
