import { useApi } from '@/hooks/useApi';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { 
  MessageSquare, 
  Users, 
  Database, 
  HardDrive,
  Activity,
  Clock,
  TrendingUp
} from 'lucide-react';
import { formatNumber, formatFileSize, formatUptime } from '@/utils/format';
import type { StatsOverview, BotStatus } from '@/types';

export function DashboardPage() {
  const { data: stats, loading: statsLoading } = useApi<StatsOverview>('/stats/overview');
  const { data: botStatus, loading: statusLoading } = useApi<BotStatus>('/bot/status');

  if (statsLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Messages',
      value: formatNumber(stats?.totalMessages || 0),
      icon: MessageSquare,
      color: 'text-primary-600',
      bgColor: 'bg-primary-100 dark:bg-primary-900',
    },
    {
      title: 'Active Chats',
      value: formatNumber(stats?.activeChats || 0),
      icon: Users,
      color: 'text-success-600',
      bgColor: 'bg-success-100 dark:bg-success-900',
    },
    {
      title: 'Media Files',
      value: formatNumber(stats?.totalMedia || 0),
      icon: Database,
      color: 'text-warning-600',
      bgColor: 'bg-warning-100 dark:bg-warning-900',
    },
    {
      title: 'Storage Used',
      value: formatFileSize(stats?.storageUsed || 0),
      icon: HardDrive,
      color: 'text-danger-600',
      bgColor: 'bg-danger-100 dark:bg-danger-900',
    },
  ];

  const recentStats = [
    {
      label: 'Last 24 hours',
      value: formatNumber(stats?.messagesLast24h || 0),
      change: '+12%',
      trend: 'up',
    },
    {
      label: 'Last 7 days',
      value: formatNumber(stats?.messagesLast7d || 0),
      change: '+8%',
      trend: 'up',
    },
    {
      label: 'Last 30 days',
      value: formatNumber(stats?.messagesLast30d || 0),
      change: '+15%',
      trend: 'up',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Overview of your WhatsApp monitoring activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.title} className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bot Status */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Bot Status
            </h3>
          </div>
          <div className="card-body space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                WhatsApp Connection
              </span>
              <span className={`status-indicator ${
                botStatus?.whatsapp.isConnected ? 'status-connected' : 'status-disconnected'
              }`}>
                {botStatus?.whatsapp.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Database
              </span>
              <span className={`status-indicator ${
                botStatus?.database.connected ? 'status-connected' : 'status-disconnected'
              }`}>
                {botStatus?.database.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Messages Processed
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatNumber(botStatus?.whatsapp.messagesProcessed || 0)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Uptime
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatUptime(botStatus?.system.uptime || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h3>
          </div>
          <div className="card-body space-y-4">
            {recentStats.map((stat) => (
              <div key={stat.label} className="flex items-center justify-between">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {stat.label}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {stat.value}
                  </span>
                  <span className="flex items-center text-xs text-success-600">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {stat.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Quick Actions
          </h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="btn btn-primary">
              <MessageSquare className="h-4 w-4 mr-2" />
              View Recent Messages
            </button>
            <button className="btn btn-secondary">
              <Users className="h-4 w-4 mr-2" />
              Manage Chats
            </button>
            <button className="btn btn-secondary">
              <Activity className="h-4 w-4 mr-2" />
              Export Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
