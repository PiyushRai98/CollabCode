import { useEffect, useRef, useCallback, MutableRefObject } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as Y from 'yjs';
import type { CursorData } from '../types';
import { useEditorStore } from '../lib/store';
import { getSocket } from '../services/socket';

interface Props {
  ydoc: MutableRefObject<Y.Doc | null>;
  language: string;
  theme: 'vs-dark' | 'light';
  onCursorChange: (cursor: Omit<CursorData, 'userId' | 'username' | 'color'>) => void;
  editorRef: MutableRefObject<any>;
}

export default function CodeEditor({ ydoc, language, theme, onCursorChange, editorRef }: Props) {
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const isApplyingRemote = useRef(false);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Set up Yjs binding
    if (ydoc.current) {
      const ytext = ydoc.current.getText('monaco');

      // Apply initial content
      const initial = ytext.toJSON();
      if (initial) {
        editor.setValue(initial);
      }

      // Listen for Yjs changes (remote)
      ytext.observe((event) => {
        if (event.transaction.origin === 'local') return;

        isApplyingRemote.current = true;
        const model = editor.getModel();
        if (!model) return;

        let index = 0;
        const edits: any[] = [];

        for (const delta of event.delta) {
          if (delta.retain) {
            index += delta.retain;
          } else if (delta.insert && typeof delta.insert === 'string') {
            const pos = model.getPositionAt(index);
            edits.push({
              range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
              text: delta.insert,
            });
            index += delta.insert.length;
          } else if (delta.delete) {
            const startPos = model.getPositionAt(index);
            const endPos = model.getPositionAt(index + delta.delete);
            edits.push({
              range: new monaco.Range(
                startPos.lineNumber, startPos.column,
                endPos.lineNumber, endPos.column
              ),
              text: '',
            });
          }
        }

        if (edits.length > 0) {
          editor.executeEdits('remote', edits);
        }
        isApplyingRemote.current = false;
      });

      // Listen for local edits
      editor.onDidChangeModelContent((e) => {
        if (isApplyingRemote.current) return;

        ydoc.current?.transact(() => {
          const ytext = ydoc.current!.getText('monaco');
          // Apply changes in reverse order to maintain correct indices
          const changes = [...e.changes].sort((a, b) => b.rangeOffset - a.rangeOffset);
          for (const change of changes) {
            if (change.rangeLength > 0) {
              ytext.delete(change.rangeOffset, change.rangeLength);
            }
            if (change.text) {
              ytext.insert(change.rangeOffset, change.text);
            }
          }
        }, 'local');
      });
    }

    // Cursor tracking
    editor.onDidChangeCursorPosition((e) => {
      onCursorChange({
        position: { lineNumber: e.position.lineNumber, column: e.position.column },
      });
    });

    editor.onDidChangeCursorSelection((e) => {
      const sel = e.selection;
      if (sel.startLineNumber === sel.endLineNumber && sel.startColumn === sel.endColumn) return;
      onCursorChange({
        position: { lineNumber: sel.positionLineNumber, column: sel.positionColumn },
        selection: {
          startLineNumber: sel.startLineNumber,
          startColumn: sel.startColumn,
          endLineNumber: sel.endLineNumber,
          endColumn: sel.endColumn,
        },
      });
    });

    // Remote cursor rendering
    const socket = getSocket();
    socket.on('cursor-update', (cursor: CursorData) => {
      renderRemoteCursor(editor, monaco, cursor);
    });

    editor.focus();
  };

  function renderRemoteCursor(editor: any, monaco: any, cursor: CursorData) {
    const decorations: any[] = [];

    // Cursor line decoration
    decorations.push({
      range: new monaco.Range(
        cursor.position.lineNumber,
        cursor.position.column,
        cursor.position.lineNumber,
        cursor.position.column + 1
      ),
      options: {
        className: `remote-cursor`,
        hoverMessage: { value: cursor.username },
        beforeContentClassName: `remote-cursor-line`,
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        after: {
          content: ' ',
          inlineClassName: 'remote-cursor',
          backgroundColor: cursor.color,
        },
      },
    });

    // Selection highlight
    if (cursor.selection) {
      decorations.push({
        range: new monaco.Range(
          cursor.selection.startLineNumber,
          cursor.selection.startColumn,
          cursor.selection.endLineNumber,
          cursor.selection.endColumn
        ),
        options: {
          className: 'remote-selection',
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          minimap: { color: cursor.color, position: 1 },
        },
      });
    }

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  }

  return (
    <div className="flex-1 overflow-hidden">
      <Editor
        height="100%"
        language={language}
        theme={theme}
        onMount={handleMount}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          fontLigatures: true,
          minimap: { enabled: true, scale: 1 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          padding: { top: 12 },
          lineNumbers: 'on',
          tabSize: 2,
          wordWrap: 'off',
          automaticLayout: true,
        }}
      />
    </div>
  );
}
