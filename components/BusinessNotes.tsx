import React, { useEffect, useRef, useState } from 'react';
import { ESCAPE_PRIORITY, useEscapeLayer } from './EscapeStack';

export interface BusinessNote {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

interface BusinessNotesProps {
  notes: BusinessNote[];
  onChange: (notes: BusinessNote[]) => void | Promise<void>;
}

type WritingSize = 'small' | 'medium' | 'large';

const NOTEBOOK_ID = 'business-notebook';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const plainTextToHtml = (value: string) =>
  escapeHtml(value).replace(/\n/g, '<br>');

const sanitizeHtml = (value: string) => {
  if (typeof document === 'undefined') return value;
  const template = document.createElement('template');
  template.innerHTML = value;
  template.content
    .querySelectorAll('script, style, iframe, object, embed, link, meta')
    .forEach(element => element.remove());
  template.content.querySelectorAll('*').forEach(element => {
    for (const attribute of Array.from(element.attributes)) {
      const keepFontSize =
        element.tagName === 'FONT' &&
        attribute.name.toLowerCase() === 'size' &&
        /^[1-7]$/.test(attribute.value);
      if (!keepFontSize) element.removeAttribute(attribute.name);
    }
  });
  return template.innerHTML;
};

const getNotebookHtml = (notes: BusinessNote[]) => {
  const notebook = notes.find(note => note.id === NOTEBOOK_ID);
  if (notebook) {
    return notebook.title === 'Rich Notebook'
      ? sanitizeHtml(notebook.body || '')
      : plainTextToHtml(notebook.body || '');
  }

  // Preserve existing notes when upgrading from the old card-based layout.
  const oldText = notes
    .map(note => {
      const title = note.title && note.title !== 'Untitled Note' ? note.title : '';
      return [title, note.body].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
  return plainTextToHtml(oldText);
};

export const BusinessNotes: React.FC<BusinessNotesProps> = ({ notes, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [html, setHtml] = useState(() => getNotebookHtml(notes));
  const [activeWritingSize, setActiveWritingSize] = useState<WritingSize>('medium');
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const hasEditedRef = useRef(false);
  const hasMobileBackEntryRef = useRef(false);
  const mobileBackMarkerRef = useRef(
    `business-notes-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const createdAtRef = useRef(
    notes.find(note => note.id === NOTEBOOK_ID)?.createdAt || Date.now()
  );

  const closeNotes = () => {
    if (
      hasMobileBackEntryRef.current &&
      window.history.state?.businessNotesMarker === mobileBackMarkerRef.current
    ) {
      hasMobileBackEntryRef.current = false;
      window.history.back();
    }
    setIsOpen(false);
  };

  useEscapeLayer('business-notes', closeNotes, isOpen, ESCAPE_PRIORITY.modal);

  useEffect(() => {
    if (!isOpen && !hasEditedRef.current) {
      setHtml(getNotebookHtml(notes));
    }
  }, [isOpen, notes]);

  // Android Back / mobile back gesture closes Notes instead of leaving the app.
  useEffect(() => {
    if (!isOpen) return;

    const onPopState = () => {
      if (!hasMobileBackEntryRef.current) return;
      hasMobileBackEntryRef.current = false;
      setIsOpen(false);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isOpen]);

  // Save automatically shortly after typing stops.
  useEffect(() => {
    if (!hasEditedRef.current) return;

    const timer = window.setTimeout(() => {
      const now = Date.now();
      const safeHtml = sanitizeHtml(html);
      void onChange([
        {
          id: NOTEBOOK_ID,
          title: 'Rich Notebook',
          body: safeHtml,
          pinned: false,
          createdAt: createdAtRef.current,
          updatedAt: now,
        },
      ]);
      hasEditedRef.current = false;
    }, 250);

    return () => window.clearTimeout(timer);
  }, [html, onChange]);

  const openNotes = () => {
    const nextHtml = getNotebookHtml(notes);
    setHtml(nextHtml);
    window.history.pushState(
      {
        ...window.history.state,
        businessNotesMarker: mobileBackMarkerRef.current,
      },
      ''
    );
    hasMobileBackEntryRef.current = true;
    setIsOpen(true);
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.innerHTML = nextHtml;
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      savedSelectionRef.current = range.cloneRange();
      editor.scrollTop = editor.scrollHeight;
    });
  };

  const rememberEditorSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = range.cloneRange();
    }
  };

  const applyWritingSize = (size: WritingSize) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    const savedRange = savedSelectionRef.current;
    if (selection && savedRange) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }

    // Applies only to the selected letters, words, sentences, or lines.
    const browserFontSize = size === 'small' ? '2' : size === 'large' ? '5' : '3';
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

    if (range?.collapsed) {
      // Keep a sized caret so all letters typed next use the selected size.
      const font = document.createElement('font');
      font.setAttribute('size', browserFontSize);
      const caretText = document.createTextNode('\u200B');
      font.appendChild(caretText);
      range.insertNode(font);

      const caretRange = document.createRange();
      caretRange.setStart(caretText, caretText.length);
      caretRange.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(caretRange);
      savedSelectionRef.current = caretRange.cloneRange();
    } else {
      document.execCommand('fontSize', false, browserFontSize);
      rememberEditorSelection();
    }

    setActiveWritingSize(size);
    hasEditedRef.current = true;
    setHtml(editor.innerHTML);
  };

  return (
    <>
      <div className="border-t border-slate-200 bg-white px-2 py-1.5 sm:px-4 sm:py-2">
        <button
          type="button"
          onClick={openNotes}
          className="mx-auto flex w-full max-w-5xl items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-center shadow-sm transition hover:border-slate-300 hover:bg-white"
          aria-label="Open notes"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-amber-300">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4 w-4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 4h6M9 12h6" />
            </svg>
          </span>
          <span className="text-[11px] font-extrabold tracking-[0.14em] text-slate-800">
            NOTES
          </span>
        </button>
      </div>

      {isOpen && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Notes"
          className="fixed inset-0 z-[90] flex flex-col bg-white"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {([
                ['small', 'SMALL'],
                ['medium', 'MEDIUM'],
                ['large', 'LARGE'],
              ] as const).map(([size, label]) => (
                <button
                  key={size}
                  type="button"
                  onMouseDown={event => {
                    rememberEditorSelection();
                    event.preventDefault();
                  }}
                  onClick={() => applyWritingSize(size)}
                  className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition ${
                    activeWritingSize === size
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                  title={`Make selected text ${size}`}
                  aria-pressed={activeWritingSize === size}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={closeNotes}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-xl font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close notes"
            >
              ×
            </button>
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={event => {
              hasEditedRef.current = true;
              setHtml(event.currentTarget.innerHTML);
              rememberEditorSelection();
            }}
            onKeyUp={rememberEditorSelection}
            onMouseUp={rememberEditorSelection}
            onTouchEnd={rememberEditorSelection}
            spellCheck
            data-placeholder="Tap here and start writing..."
            className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5 text-base leading-7 text-slate-900 outline-none empty:before:pointer-events-none empty:before:text-slate-300 empty:before:content-[attr(data-placeholder)]"
          />
        </section>
      )}
    </>
  );
};
