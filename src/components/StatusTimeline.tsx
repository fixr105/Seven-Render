/**
 * Module 3: Status Timeline Component
 * 
 * Visual timeline showing status history with dates and actors
 */

import React from 'react';
import { Check, Clock, User } from 'lucide-react';
import { getStatusDisplayName, getStatusColor } from '../lib/statusUtils';

export interface StatusHistoryEntry {
  fromStatus: string;
  toStatus: string;
  changedAt: string;
  changedBy: string;
  reason?: string;
  fileId: string;
}

interface StatusTimelineProps {
  statusHistory: StatusHistoryEntry[];
  currentStatus: string;
}

export const StatusTimeline: React.FC<StatusTimelineProps> = ({
  statusHistory,
  currentStatus,
}) => {
  // Add current status as the latest entry if not in history
  const allEntries = [...statusHistory];
  if (allEntries.length === 0 || allEntries[allEntries.length - 1]?.toStatus !== currentStatus) {
    allEntries.push({
      fromStatus: allEntries.length > 0 ? allEntries[allEntries.length - 1].toStatus : 'unknown',
      toStatus: currentStatus,
      changedAt: new Date().toISOString(),
      changedBy: 'Current',
      fileId: '',
    });
  }

  const getStatusColorClass = (status: string): string => {
    const color = getStatusColor(status);
    const colorMap: Record<string, string> = {
      success: 'text-success border-success bg-success/10',
      error: 'text-error border-error bg-error/10',
      warning: 'text-warning border-warning bg-warning/10',
      info: 'text-info border-info bg-info/10',
      neutral: 'text-neutral-600 border-neutral-300 bg-neutral-50',
    };
    return colorMap[color] || colorMap.neutral;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-neutral-900 mb-4">Status Timeline</h3>
      
      {allEntries.length === 0 ? (
        <p className="text-sm text-neutral-500">No status history available</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-neutral-200" />
          
          {/* Timeline entries */}
          <div className="space-y-6">
            {allEntries.map((entry, index) => {
              const isLast = index === allEntries.length - 1;
              const statusColorClass = getStatusColorClass(entry.toStatus);
              
              return (
                <div key={index} className="relative flex items-start gap-4">
                  {/* Status icon */}
                  <div className={`
                    relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center
                    ${statusColorClass}
                    ${isLast ? 'ring-2 ring-offset-2 ring-brand-primary/20' : ''}
                  `}>
                    {isLast ? (
                      <Clock className="w-5 h-5" />
                    ) : (
                      <Check className="w-5 h-5" />
                    )}
                  </div>
                  
                  {/* Entry content */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-semibold ${statusColorClass.split(' ')[0]}`}>
                        {getStatusDisplayName(entry.toStatus)}
                      </span>
                      {entry.fromStatus !== 'unknown' && (
                        <>
                          <span className="text-neutral-400">←</span>
                          <span className="text-sm text-neutral-600">
                            {getStatusDisplayName(entry.fromStatus)}
                          </span>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
                      <User className="w-3 h-3" />
                      <span>{entry.changedBy}</span>
                      <span>•</span>
                      <span>{formatDate(entry.changedAt)}</span>
                    </div>
                    
                    {entry.reason && (
                      <p className="text-sm text-neutral-600 mt-1">{entry.reason}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};



