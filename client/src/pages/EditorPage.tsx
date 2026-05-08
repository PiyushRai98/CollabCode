import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Save, Users, History, Sun, Moon, Copy, Check,
  Terminal, X, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useEditorStore, useAuthStore } from '../lib/store';
import { useCollaboration } from '../hooks/useCollaboration';
import { documentApi, executionApi } from '../services/api';
import CodeEditor from '../components/CodeEditor';
import UserPresence from '../components/UserPresence';
import VersionPanel from '../components/VersionPanel';
import OutputPanel from '../components/OutputPanel';
import type { ExecutionResult } from '../types';

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

export default function EditorPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { language, theme, users, setLanguage, setRoomId, toggleTheme } = useEditorStore();
  const { ydoc, sendCursor, saveVersion } = useCollaboration(roomId || null);
  const [title, setTitle] = useState('Untitled');
  const [showOutput, setShowOutput] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [output, setOutput] = useState<ExecutionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (roomId) {
      setRoomId(roomId);
      documentApi.getById(roomId).then((doc) => {
        if (doc) {
          setTitle(doc.title);
          setLanguage(doc.language);
        }
      }).catch(() => {});
    }
    return () => setRoomId(null);
  }, [roomId]);

  const handleRun = useCallback(async () => {
    if (!editorRef.current) return;
    const code = editorRef.current.getValue();
    if (!code.trim()) {
      toast.error('No code to run');
      return;
    }
    setExecuting(true);
    setShowOutput(true);
    try {
      const result = await executionApi.run(code, language);
      setOutput(result);
    } catch (err: any) {
      setOutput({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
        timedOut: false,
        executionTimeMs: 0,
      });
    } finally {
      setExecuting(false);
    }
  }, [language]);

  const handleSaveVersion = useCallback(() => {
    saveVersion(`Manual save - ${new Date().toLocaleString()}`);
    toast.success('Version saved');
  }, [saveVersion]);

  const copyRoomId = useCallback(() => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    toast.success('Room ID copied!');
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  return (
    <div className="h-full flex flex-col bg-editor-bg">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-4 py-2 bg-editor-sidebar border-b border-editor-border shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => roomId && documentApi.update(roomId, { title }).catch(() => {})}
            className="bg-transparent text-white font-medium text-sm border-none outline-none focus:ring-1 focus:ring-editor-accent rounded px-2 py-1"
          />
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              if (roomId) documentApi.update(roomId, { language: e.target.value }).catch(() => {});
            }}
            className="bg-editor-bg border border-editor-border text-gray-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-editor-accent"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Room ID copy */}
          <button
            onClick={copyRoomId}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-editor-bg border border-editor-border rounded px-2 py-1 transition-colors"
            title="Copy Room ID"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            <span className="max-w-[100px] truncate">{roomId}</span>
          </button>

          <UserPresence users={users} />

          <div className="w-px h-6 bg-editor-border mx-1" />

          <button
            onClick={handleRun}
            disabled={executing}
            className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded px-3 py-1.5 font-medium transition-colors disabled:opacity-50"
          >
            {executing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Run
          </button>

          <button
            onClick={handleSaveVersion}
            className="flex items-center gap-1 text-xs bg-editor-bg border border-editor-border text-gray-300 hover:text-white rounded px-3 py-1.5 transition-colors"
          >
            <Save size={14} />
            Save
          </button>

          <button
            onClick={() => setShowVersions(!showVersions)}
            className={`flex items-center gap-1 text-xs rounded px-3 py-1.5 transition-colors border ${
              showVersions
                ? 'bg-editor-accent text-white border-editor-accent'
                : 'bg-editor-bg border-editor-border text-gray-300 hover:text-white'
            }`}
          >
            <History size={14} />
            Versions
          </button>

          <button
            onClick={toggleTheme}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            {theme === 'vs-dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <CodeEditor
            ydoc={ydoc}
            language={language}
            theme={theme}
            onCursorChange={sendCursor}
            editorRef={editorRef}
          />

          {/* Output panel */}
          <AnimatePresence>
            {showOutput && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 200 }}
                exit={{ height: 0 }}
                className="border-t border-editor-border overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-1.5 bg-editor-sidebar">
                  <span className="text-xs text-gray-400 flex items-center gap-1.5">
                    <Terminal size={14} />
                    Output
                    {output && (
                      <span className={`ml-2 ${output.exitCode === 0 ? 'text-green-400' : 'text-red-400'}`}>
                        exit {output.exitCode}
                        {output.timedOut && ' (timed out)'}
                        {output.executionTimeMs > 0 && ` - ${output.executionTimeMs}ms`}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => setShowOutput(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
                <OutputPanel output={output} executing={executing} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Version panel */}
        <AnimatePresence>
          {showVersions && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-editor-border overflow-hidden"
            >
              <VersionPanel
                roomId={roomId || ''}
                onClose={() => setShowVersions(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
