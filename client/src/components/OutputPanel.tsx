import { Loader2 } from 'lucide-react';
import type { ExecutionResult } from '../types';

interface Props {
  output: ExecutionResult | null;
  executing: boolean;
}

export default function OutputPanel({ output, executing }: Props) {
  return (
    <div className="h-full bg-editor-bg overflow-auto p-4 font-mono text-sm">
      {executing ? (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          Running...
        </div>
      ) : output ? (
        <div className="space-y-2">
          {output.stdout && (
            <pre className="text-green-300 whitespace-pre-wrap">{output.stdout}</pre>
          )}
          {output.stderr && (
            <pre className="text-red-400 whitespace-pre-wrap">{output.stderr}</pre>
          )}
          {!output.stdout && !output.stderr && (
            <span className="text-gray-500 italic">No output</span>
          )}
        </div>
      ) : (
        <span className="text-gray-500 italic">Run code to see output here</span>
      )}
    </div>
  );
}
