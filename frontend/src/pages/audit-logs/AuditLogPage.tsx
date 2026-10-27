import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { AuditLog } from '../../types';
import { ScrollText, Eye, X, Download } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Pagination } from '../../components/common/Pagination';

export const AuditLogPage: React.FC = () => {
  const { toast } = useToast();
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(1);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      const response = await api.get('/audit-logs/export', {
        params: {
          action: selectedAction || undefined,
        },
        responseType: 'blob',
      });
      const blob = new Blob([response as any], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${selectedAction || 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({
        title: 'CSV Exported',
        message: 'Audit logs exported successfully (RFC 4180 format).',
        type: 'success',
      });
    } catch (err: any) {
      toast({
        title: 'Export Failed',
        message: err.message || 'Failed to export audit logs to CSV.',
        type: 'error',
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  const { data: logsData, isLoading } = useQuery<{ data: AuditLog[]; meta: any }>({
    queryKey: ['audit-logs', selectedAction, page],
    queryFn: () =>
      api.get('/audit-logs', {
        params: {
          action: selectedAction || undefined,
          page,
          limit: 20,
        },
      }),
  });

  const logs = logsData?.data || [];

  const actions = ['INSERT', 'UPDATE', 'DELETE'];

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'UPDATE':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">System Compliance & Audit Trail</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Immutable ledger of security events, administrative mutations, and seat allocations.
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={isExportingCsv}
          className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-sm disabled:opacity-50 shrink-0 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 mr-1.5 text-blue-500 dark:text-blue-400" />
          {isExportingCsv ? 'Exporting...' : 'Export Filtered CSV'}
        </button>
      </div>

      {/* Action Filter Pills */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => {
            setSelectedAction('');
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
            selectedAction === ''
              ? 'bg-blue-600 text-white shadow'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          All Events
        </button>
        {actions.map((act) => (
          <button
            key={act}
            onClick={() => {
              setSelectedAction(act);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition font-mono ${
              selectedAction === act
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {act}
          </button>
        ))}
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <ScrollText className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No audit events found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Timestamp</th>
                  <th className="px-6 py-3.5 font-semibold">Actor</th>
                  <th className="px-6 py-3.5 font-semibold">Action</th>
                  <th className="px-6 py-3.5 font-semibold">Entity Mutated</th>
                  <th className="px-6 py-3.5 font-semibold">Record ID</th>
                  <th className="px-6 py-3.5 font-semibold text-right">State Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(log.performedAt).toLocaleString()}
                    </td>

                    <td className="px-6 py-3.5 font-sans font-medium text-slate-900 dark:text-white">
                      {log.user?.fullName || 'System Trigger'}
                    </td>

                    <td className="px-6 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300 font-sans">
                      <span className="font-semibold text-slate-900 dark:text-white">{log.tableName}</span>
                    </td>

                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                      {log.recordId}
                    </td>

                    <td className="px-6 py-3.5 text-right font-sans">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 rounded-lg text-[11px] font-semibold transition inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {logsData?.meta && logsData.meta.totalPages > 1 && (
          <div className="pt-2">
            <Pagination
              currentPage={page}
              totalPages={logsData.meta.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* JSON Diff Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Audit Event Payload: <span className="text-blue-600 dark:text-blue-400">{selectedLog.tableName}</span> [
              <span className="font-mono text-xs">{selectedLog.action}</span>]
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Recorded at {new Date(selectedLog.performedAt).toUTCString()}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 font-mono text-[11px]">
              {/* Old Values */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                <span className="text-red-500 dark:text-red-400 font-bold block mb-1">◀ Pre-Mutation Snapshot:</span>
                <pre className="text-slate-700 dark:text-slate-400 whitespace-pre-wrap">
                  {selectedLog.oldData
                    ? JSON.stringify(selectedLog.oldData, null, 2)
                    : '// NULL (Creation Event)'}
                </pre>
              </div>

              {/* New Values */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold block mb-1">▶ Post-Mutation Snapshot:</span>
                <pre className="text-slate-800 dark:text-slate-300 whitespace-pre-wrap">
                  {selectedLog.newData
                    ? JSON.stringify(selectedLog.newData, null, 2)
                    : '// NULL (Deletion Event)'}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
