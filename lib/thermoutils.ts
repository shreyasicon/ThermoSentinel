/** Store / compute with at most two decimal places. */
export function roundTemperatureCelsius(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return parseFloat(n.toFixed(2));
}

/** Display °C with two decimal places (avoids long floats from APIs). */
export function formatTemperatureCelsius(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

export const getRiskColor = (risk: number): string => {
  if (risk >= 70) return 'bg-red-600/20 border-red-500/50 text-red-200';
  if (risk >= 40) return 'bg-yellow-600/20 border-yellow-500/50 text-yellow-200';
  return 'bg-green-600/20 border-green-500/50 text-green-200';
};

export const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'critical':
      return 'bg-red-600/30 border-red-500/50 text-red-200';
    case 'warning':
      return 'bg-yellow-600/30 border-yellow-500/50 text-yellow-200';
    default:
      return 'bg-green-600/30 border-green-500/50 text-green-200';
  }
};

export const getTemperatureGauge = (temp: number): { percentage: number; color: string } => {
  const percentage = ((temp - 15) / (35 - 15)) * 100;
  let color = '#10b981';

  if (temp > 26) color = '#ef4444';
  else if (temp > 24) color = '#f59e0b';

  return { percentage: Math.max(0, Math.min(100, percentage)), color };
};

export const calculateSystemHealth = (riskScore: number): string => {
  if (riskScore >= 70) return 'Critical';
  if (riskScore >= 40) return 'Warning';
  if (riskScore >= 20) return 'Caution';
  return 'Optimal';
};
