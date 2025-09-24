/**
 * Network Monitor Page
 * Страница мониторинга сетевых соединений
 */

import NetworkMonitorDashboard from '@/components/network-monitor-dashboard';

export default function NetworkMonitorPage() {
  return (
    <div className="container mx-auto py-6">
      <NetworkMonitorDashboard />
    </div>
  );
}

export const metadata = {
  title: 'Network Monitor - Traffic Router AI',
  description: 'Real-time network connections and traffic monitoring dashboard',
};