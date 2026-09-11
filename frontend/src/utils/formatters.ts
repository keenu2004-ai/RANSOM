export const formatDuration = (decimalHours: number | string | null | undefined): string => {
  if (decimalHours === null || decimalHours === undefined) return '00:00';
  const num = typeof decimalHours === 'string' ? parseFloat(decimalHours) : decimalHours;
  if (isNaN(num) || num < 0) return '00:00';
  
  const totalMinutes = Math.round(num * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};
