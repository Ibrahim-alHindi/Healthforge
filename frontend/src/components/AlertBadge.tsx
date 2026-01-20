'use client';

import { Alert } from '@/types';
import { AlertTriangle, AlertCircle, Info, CheckCircle, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface AlertBadgeProps {
  alert: Alert;
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
}

const severityConfig = {
  critical: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    icon: AlertCircle,
    badge: 'bg-red-600',
  },
  high: {
    bg: 'bg-orange-50 border-orange-200',
    text: 'text-orange-800',
    icon: AlertTriangle,
    badge: 'bg-orange-600',
  },
  medium: {
    bg: 'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-800',
    icon: AlertTriangle,
    badge: 'bg-yellow-600',
  },
  low: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
    icon: Info,
    badge: 'bg-blue-600',
  },
};

const statusConfig = {
  active: { label: 'Active', color: 'bg-red-100 text-red-800' },
  acknowledged: { label: 'Acknowledged', color: 'bg-yellow-100 text-yellow-800' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800' },
};

export default function AlertBadge({ alert, onAcknowledge, onResolve }: AlertBadgeProps) {
  const config = severityConfig[alert.severity];
  const Icon = config.icon;
  const status = statusConfig[alert.status];

  return (
    <div className={`border rounded-lg p-4 ${config.bg}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className={`p-2 rounded-full ${config.badge}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className={`font-semibold ${config.text}`}>{alert.type}</h4>
              <span className={`text-xs px-2 py-1 rounded-full ${status.color}`}>
                {status.label}
              </span>
            </div>
            <p className={`text-sm ${config.text} mb-2`}>{alert.message}</p>
            <div className="flex items-center space-x-4 text-xs text-gray-600">
              <span>ID: {alert.id}</span>
              <span>{formatDate(alert.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col space-y-2 ml-4">
          {alert.status === 'active' && onAcknowledge && (
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="px-3 py-1 text-xs font-medium text-white bg-yellow-600 rounded hover:bg-yellow-700 transition"
            >
              Acknowledge
            </button>
          )}
          {alert.status !== 'resolved' && onResolve && (
            <button
              onClick={() => onResolve(alert.id)}
              className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition flex items-center space-x-1"
            >
              <CheckCircle className="w-3 h-3" />
              <span>Resolve</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
