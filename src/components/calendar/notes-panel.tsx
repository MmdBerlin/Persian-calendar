'use client';

import { useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, StickyNote, Search, SquareCheck } from 'lucide-react';
import { toPersianDigits } from '@/lib/jalali';

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string; // hex
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'persian-calendar-notes-v1';

const NOTE_COLORS = [
  '#FEF3C7', // amber-100
  '#FCE7F3', // pink-100
  '#DBEAFE', // blue-100
  '#D1FAE5', // emerald-100
  '#EDE9FE', // violet-100
  '#FEE2E2', // red-100
  '#FFFFFF', // white
];

// --- useSyncExternalStore ---
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedNotes: Note[] = [];

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
  };
}

function handleStorage(e: StorageEvent) {
  if (e.key === STORAGE_KEY) {
    cachedRaw = null;
    notify();
  }
}

const EMPTY_NOTES: Note[] = [];

function getNotesClient(): Note[] {
  if (typeof window === 'undefined') return EMPTY_NOTES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedNotes;
    cachedRaw = raw;
    if (raw) {
      const parsed = JSON.parse(raw) as Note[];
      cachedNotes = Array.isArray(parsed) ? parsed : EMPTY_NOTES;
    } else {
      cachedNotes = EMPTY_NOTES;
    }
  } catch (e) {
    console.error('Failed to load notes:', e);
    cachedNotes = EMPTY_NOTES;
  }
  return cachedNotes;
}

function getNotesServer(): Note[] {
  return EMPTY_NOTES;
}

function setNotesStore(value: Note[]) {
  if (typeof window === 'undefined') return;
  try {
    const str = JSON.stringify(value);
    localStorage.setItem(STORAGE_KEY, str);
    cachedRaw = str;
    cachedNotes = value;
  } catch (e) {
    console.error('Failed to save notes:', e);
  }
  notify();
}

function useNotes() {
  const notes = useSyncExternalStore(subscribe, getNotesClient, getNotesServer);

  const addNote = useCallback((note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const newNote: Note = {
      ...note,
      id: `n-${now}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };
    const current = getNotesClient();
    setNotesStore([newNote, ...current]);
    return newNote;
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    const current = getNotesClient();
    setNotesStore(current.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n)));
  }, []);

  const deleteNote = useCallback((id: string) => {
    const current = getNotesClient();
    setNotesStore(current.filter((n) => n.id !== id));
  }, []);

  const deleteMultipleNotes = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    const current = getNotesClient();
    setNotesStore(current.filter((n) => !idSet.has(n.id)));
  }, []);

  const clearAllNotes = useCallback(() => {
    setNotesStore(EMPTY_NOTES);
  }, []);

  return { notes, addNote, updateNote, deleteNote, deleteMultipleNotes, clearAllNotes };
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'همین الان';
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه پیش`;
  if (hours < 24) return `${toPersianDigits(hours)} ساعت پیش`;
  if (days < 7) return `${toPersianDigits(days)} روز پیش`;
  const date = new Date(timestamp);
  return `${toPersianDigits(date.getDate())}/${toPersianDigits(date.getMonth() + 1)}/${toPersianDigits(date.getFullYear())}`;
}

export function NotesPanel() {
  const { notes, addNote, updateNote, deleteNote, deleteMultipleNotes } = useNotes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredNotes = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter((n) =>
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, search]);

  const openNew = () => {
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    if (selectionMode) {
      toggleSelect(id);
      return;
    }
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setTimeout(() => setEditingId(null), 200);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    deleteMultipleNotes([...selectedIds]);
    exitSelectionMode();
  };

  const editingNote = editingId ? (notes.find((n) => n.id === editingId) ?? null) : null;

  return (
    <Card className="glass-card p-5 border-0 rounded-3xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center">
            <StickyNote className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold">یادداشت‌ها</h3>
            <p className="text-xs text-muted-foreground">
              {selectionMode
                ? `${toPersianDigits(selectedIds.size)} تا انتخاب شده`
                : `${toPersianDigits(notes.length)} یادداشت`}
            </p>
          </div>
        </div>
        {selectionMode ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={exitSelectionMode}
              className="rounded-xl text-xs h-9"
            >
              لغو
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className="rounded-xl text-xs h-9 gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف ({toPersianDigits(selectedIds.size)})
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {notes.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setSelectionMode(true)}
                className="rounded-2xl h-9 w-9 p-0"
                aria-label="انتخاب یادداشت‌ها"
                title="انتخاب یادداشت‌ها"
              >
                <SquareCheck className="h-4.5 w-4.5" />
              </Button>
            )}
            <Button
              onClick={openNew}
              className="rounded-2xl h-9 w-9 p-0"
              aria-label="افزودن یادداشت"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {notes.length > 0 && !selectionMode && (
        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="دنبال یادداشت بگرد..."
            className="rounded-xl pr-9 h-9"
          />
        </div>
      )}

      {selectionMode && (
        <div className="mb-3 p-2 rounded-xl bg-primary/5 text-xs text-muted-foreground text-center">
          برای انتخاب، روی یادداشت‌ها ضربه بزن
        </div>
      )}

      {filteredNotes.length === 0 ? (
        <div className="text-center py-12">
          <div className="h-16 w-16 rounded-3xl bg-muted mx-auto flex items-center justify-center mb-4">
            <StickyNote className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {notes.length === 0 ? 'هنوز یادداشتی نساختی' : 'یادداشتی پیدا نشد'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {notes.length === 0 && 'روی + بزن تا اولین یادداشتت رو بنویسی'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto no-scrollbar">
          {filteredNotes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              onEdit={() => openEdit(note.id)}
              onDelete={() => deleteNote(note.id)}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(note.id)}
            />
          ))}
        </div>
      )}

      <NoteDialog
        key={editingId || 'new'}
        open={dialogOpen}
        onOpenChange={(v) => { if (!v) handleClose(); }}
        editingNote={editingNote}
        onSave={(data) => {
          if (editingId) {
            updateNote(editingId, data);
          } else {
            addNote(data);
          }
          handleClose();
        }}
      />
    </Card>
  );
}

function NoteItem({
  note,
  onEdit,
  onDelete,
  selectionMode,
  isSelected,
}: {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  selectionMode: boolean;
  isSelected: boolean;
}) {
  return (
    <div
      className={`note-card group relative p-3 rounded-2xl border transition-colors duration-200 hover:shadow-sm cursor-pointer ${
        isSelected ? 'ring-2 ring-primary border-primary' : ''
      }`}
      style={{
        backgroundColor: note.color,
        borderColor: note.color === '#FFFFFF' || isSelected ? undefined : 'transparent',
      }}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-bold text-[13px] truncate">{note.title || 'بدون عنوان'}</h4>
        {/* delete icon only while this note is selected */}
        {selectionMode && isSelected && (
          <button
            type="button"
            className="h-7 w-7 shrink-0 rounded-xl bg-rose-500/90 hover:bg-rose-500 text-white flex items-center justify-center transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="حذف این یادداشت"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground line-clamp-3 whitespace-pre-wrap break-words mt-1">
        {note.content || '—'}
      </p>
      <div className="text-[9px] text-muted-foreground/70 mt-2">
        {formatRelativeTime(note.updatedAt)}
      </div>
    </div>
  );
}

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingNote: Note | null;
  onSave: (data: Pick<Note, 'title' | 'content' | 'color'>) => void;
}

function NoteDialog({ open, onOpenChange, editingNote, onSave }: NoteDialogProps) {
  const [title, setTitle] = useState(editingNote?.title || '');
  const [content, setContent] = useState(editingNote?.content || '');
  const [color, setColor] = useState(editingNote?.color || NOTE_COLORS[0]);

  const handleSave = () => {
    onSave({ title: title.trim(), content: content.trim(), color });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {editingNote ? 'ویرایش یادداشت' : 'یادداشت جدید'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-title">عنوان</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: لیست خرید..."
              className="rounded-xl"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note-content">متن</Label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="هرچی تو ذهنته همین‌جا بنویس..."
              className="rounded-xl resize-none min-h-[140px] no-scrollbar"
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>رنگ</Label>
            <div className="flex flex-wrap gap-2">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-xl border-2 transition-colors duration-200 ${
                    color === c ? 'border-primary scale-110' : 'border-border'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`رنگ ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-2xl">
            انصراف
          </Button>
          <Button onClick={handleSave} className="rounded-2xl">
            {editingNote ? 'ذخیره' : 'افزودن'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
