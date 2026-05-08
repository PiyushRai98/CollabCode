import { useEffect, useState } from 'react';
import { History, RotateCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { documentApi } from '../services/api';
import type { VersionInfo } from '../types';

interface Props {
  roomId: string;
  onClose: () => void;
}

export default function VersionPanel({ roomId, onClose }: Props) {
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVersions();
  }, [roomId]);

  async function loadVersions() {
    try {
      const data = await documentApi.getVersions(roomId);
      setVersions(data);
    } catch {
      toast.error('Failed to load versions');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(version: number) {
    try {
      await documentApi.restoreVersion(roomId, version);
      toast.success(`Restored to version ${version}`);
      // Reload the page to get the restored state
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="h-full flex flex-col bg-editor-sidebar">
      <div className="flex items-center justify-between px-4 py-3 border-b border-editor-border">
        <span className="text-sm font-medium text-white flex items-center gap-2">
          <History size={16} />
          Version History
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="text-center text-gray-500 text-sm py-8">Loading...</div>
        ) : versions.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            No versions yet. Click Save to create one.
          </div>
        ) : (
          versions.map((v) => (
            <div
              key={v._id}
              className="bg-editor-bg border border-editor-border rounded-lg p-3 group hover:border-editor-accent transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-white">v{v.version}</span>
                <button
                  onClick={() => handleRestore(v.version)}
                  className="text-gray-500 hover:text-editor-accent opacity-0 group-hover:opacity-100 transition-all"
                  title="Restore this version"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
              {v.label && (
                <p className="text-xs text-gray-400 truncate mb-1">{v.label}</p>
              )}
              <p className="text-xs text-gray-600">
                {new Date(v.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
