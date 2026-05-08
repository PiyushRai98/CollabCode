import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Code2, Plus, FileCode, LogOut, Clock, Users, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../lib/store';
import { documentApi } from '../services/api';
import type { DocumentInfo } from '../types';

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
];

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [joinId, setJoinId] = useState('');
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      const docs = await documentApi.getMine();
      setDocuments(docs);
    } catch (err: any) {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }

  async function createDocument() {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      const doc = await documentApi.create(title, language);
      toast.success('Document created!');
      navigate(`/editor/${doc._id}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function joinRoom() {
    if (!joinId.trim()) {
      toast.error('Enter a room ID');
      return;
    }
    navigate(`/editor/${joinId.trim()}`);
  }

  return (
    <div className="h-full bg-gradient-to-br from-gray-900 via-editor-bg to-gray-900 overflow-auto">
      {/* Header */}
      <header className="border-b border-editor-border bg-editor-sidebar/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Code2 className="w-8 h-8 text-editor-accent" />
            <h1 className="text-xl font-bold text-white">CollabCode</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Hi, <span className="text-white font-medium">{user?.username}</span>
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-400 transition-colors"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Create */}
          <motion.div
            layout
            className="bg-editor-sidebar border border-editor-border rounded-xl p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Plus size={20} className="text-editor-accent" />
              New Document
            </h2>
            {showCreate ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Document title"
                  className="w-full px-4 py-2 bg-editor-bg border border-editor-border rounded-lg text-white focus:outline-none focus:border-editor-accent"
                />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2 bg-editor-bg border border-editor-border rounded-lg text-white focus:outline-none focus:border-editor-accent"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={createDocument}
                    className="flex-1 py-2 bg-editor-accent hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 bg-editor-bg border border-editor-border text-gray-400 rounded-lg hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full py-3 border-2 border-dashed border-editor-border rounded-lg text-gray-400 hover:text-white hover:border-editor-accent transition-colors"
              >
                + Create new document
              </button>
            )}
          </motion.div>

          {/* Join */}
          <div className="bg-editor-sidebar border border-editor-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users size={20} className="text-green-400" />
              Join Room
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="Paste room ID..."
                className="flex-1 px-4 py-2 bg-editor-bg border border-editor-border rounded-lg text-white focus:outline-none focus:border-editor-accent"
                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              />
              <button
                onClick={joinRoom}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors flex items-center gap-1"
              >
                Join <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Documents List */}
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileCode size={20} className="text-editor-accent" />
          Your Documents
        </h2>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No documents yet. Create one to get started!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc, i) => (
              <motion.div
                key={doc._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/editor/${doc._id}`)}
                className="bg-editor-sidebar border border-editor-border rounded-xl p-5 cursor-pointer hover:border-editor-accent transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-white font-medium group-hover:text-editor-accent transition-colors truncate">
                    {doc.title}
                  </h3>
                  <span className="text-xs bg-editor-bg px-2 py-0.5 rounded text-gray-400 shrink-0 ml-2">
                    {doc.language}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
