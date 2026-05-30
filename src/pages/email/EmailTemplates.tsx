import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Save, Pencil, Search, Layout, FileText, Settings, X, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Maximize, Minimize, Eraser, Type, MousePointer2, Link, Globe, Move, Square, Palette, Code, ChevronDown, ChevronUp } from "lucide-react";
import ThemeEditor, { ThemeStyles, buildThemeCss } from "./ThemeEditor";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Template { id: string; name: string; subject: string; html: string; updated_at: string; category?: string; }

export default function EmailTemplates() {
  const [list, setList] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorSelectionRef = useRef<Range | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editorHtmlDraftRef = useRef("");
  const loadedEditingIdRef = useRef<string | null>(null);
  const [tab, setTab] = useState("all");
  const [themeStyles, setThemeStyles] = useState<ThemeStyles>({});

  // Builds the editable button block HTML used both on insert and on re-hydration
  const buildButtonBlockHtml = (opts?: { text?: string; url?: string; color?: string; size?: string; align?: string }) => {
    const text = opts?.text ?? 'Click me';
    const url = opts?.url ?? '';
    const color = opts?.color ?? '#6366f1';
    const size = opts?.size ?? 'medium';
    const align = opts?.align ?? 'left';
    const btnId = `btn-${Math.random().toString(36).slice(2, 9)}`;
    const wrapId = `wrap-${btnId}`;
    const SZ: Record<string, { p: string; f: string }> = {
      small: { p: '6px 14px', f: '12px' },
      medium: { p: '10px 20px', f: '14px' },
      large: { p: '14px 28px', f: '16px' },
    };
    const sz = SZ[size] || SZ.medium;
    const sizesLit = `{small:{p:'6px 14px',f:'12px'},medium:{p:'10px 20px',f:'14px'},large:{p:'14px 28px',f:'16px'}}`;
    const updFn = `function(){var a=document.getElementById('${btnId}');var w=document.getElementById('${wrapId}');if(!a||!w)return;var t=w.querySelector('[data-c=text]').value;var u=w.querySelector('[data-c=url]').value;var c=w.querySelector('[data-c=color]').value;var s=w.querySelector('[data-c=size]').value;var al=w.querySelector('[data-c=align]').value;var SZ=${sizesLit};var sz=SZ[s]||SZ.medium;a.textContent=t||'Click me';a.setAttribute('href',u||'#');a.style.background=c;a.style.padding=sz.p;a.style.fontSize=sz.f;a.setAttribute('data-btn-text',t);a.setAttribute('data-btn-url',u);a.setAttribute('data-btn-color',c);a.setAttribute('data-btn-size',s);a.setAttribute('data-btn-align',al);w.style.textAlign=al;}`;
    const inputStyle = `padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; background: #f8fafc; color: #475569; outline: none;`;
    const esc = (s: string) => String(s).replace(/"/g, '&quot;');
    const sizeOptions = ['small','medium','large'].map(v => `<option value="${v}"${v===size?' selected':''}>${v==='small'?'P':v==='medium'?'M':'G'}</option>`).join('');
    const alignOptions = ['left','center','right'].map(v => `<option value="${v}"${v===align?' selected':''}>${v==='left'?'◧':v==='center'?'▣':'◨'}</option>`).join('');
    return (
      `<div class="btn-block" id="${wrapId}" draggable="true" contenteditable="false" style="margin: 12px 0; text-align: ${align};">`
      + `<div class="btn-handle" title="Arraste para mover" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; margin-bottom: 6px; background: #e2e8f0; color: #475569; border-radius: 4px; font-size: 11px; cursor: move; user-select: none;">⋮⋮ Arrastar botão</div><div style="height: 0;"></div>`
      + `<div style="margin-bottom: 10px;"><a id="${btnId}" href="${esc(url || '#')}" data-btn="1" data-btn-text="${esc(text)}" data-btn-url="${esc(url)}" data-btn-color="${esc(color)}" data-btn-size="${esc(size)}" data-btn-align="${esc(align)}" style="display: inline-block; background: ${color}; color: #ffffff; padding: ${sz.p}; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: ${sz.f};">${esc(text)}</a></div>`
      + `<div class="btn-controls" style="display: none; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px; background: #f1f5f9; border-radius: 6px;">`
      + `<input data-c="text" type="text" placeholder="Texto do botão" value="${esc(text)}" oninput="(${updFn})()" style="${inputStyle} flex: 1; min-width: 140px;" />`
      + `<input data-c="url" type="url" placeholder="Cole um link" value="${esc(url)}" oninput="(${updFn})()" style="${inputStyle} flex: 1; min-width: 160px;" />`
      + `<input data-c="color" type="color" value="${esc(color)}" oninput="(${updFn})()" title="Cor" style="width: 36px; height: 30px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 2px; background: #ffffff; cursor: pointer;" />`
      + `<select data-c="size" onchange="(${updFn})()" title="Tamanho" style="${inputStyle} cursor: pointer;">${sizeOptions}</select>`
      + `<select data-c="align" onchange="(${updFn})()" title="Alinhamento" style="${inputStyle} cursor: pointer;">${alignOptions}</select>`
      + `</div></div>`
    );
  };

  // Re-hydrate saved button anchors back into editable button blocks
  const rehydrateButtons = (root: HTMLElement) => {
    const anchors = root.querySelectorAll('a[data-btn="1"]');
    anchors.forEach((aEl) => {
      const a = aEl as HTMLAnchorElement;
      // Skip if already inside an editable btn-block
      if (a.closest('.btn-block')) return;
      const wrapper = a.closest('p') as HTMLElement | null;
      const align = (wrapper?.style.textAlign) || a.getAttribute('data-btn-align') || 'left';
      const html = buildButtonBlockHtml({
        text: a.getAttribute('data-btn-text') || a.textContent || 'Click me',
        url: a.getAttribute('data-btn-url') || a.getAttribute('href') || '',
        color: a.getAttribute('data-btn-color') || '#6366f1',
        size: a.getAttribute('data-btn-size') || 'medium',
        align,
      });
      const tmp = document.createElement('div');
      tmp.innerHTML = html + '<p><br/></p>';
      const block = tmp.firstElementChild as HTMLElement;
      const trailing = tmp.lastElementChild as HTMLElement;
      if (!block) return;
      const target = (wrapper && wrapper.parentElement) ? wrapper : a;
      const parent = target.parentElement;
      if (!parent) return;
      parent.insertBefore(block, target);
      if (trailing) parent.insertBefore(trailing, target);
      target.remove();
    });
  };
  const [globalCss, setGlobalCss] = useState("");
  const [pageStyle, setPageStyle] = useState({ backgroundColor: "#f8fafc", width: 600, padding: 20 });

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("user_email_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    setList((data as Template[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Initialize editor content only when opening a different template,
  // to avoid React rewriting innerHTML on every keystroke (which reverses cursor).
  useEffect(() => {
    if (!editing) { loadedEditingIdRef.current = null; return; }
    const key = editing.id || "__new__";
    if (loadedEditingIdRef.current !== key) {
      loadedEditingIdRef.current = key;
      editorHtmlDraftRef.current = editing.html || "";
      if (editorRef.current) {
        editorRef.current.innerHTML = editing.html || "";
        rehydrateButtons(editorRef.current);
        editorHtmlDraftRef.current = editorRef.current.innerHTML;
      } else {
        // Editor not mounted yet; retry on next tick
        requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.innerHTML = editing.html || "";
            rehydrateButtons(editorRef.current);
            editorHtmlDraftRef.current = editorRef.current.innerHTML;
          }
        });
      }
    }
  }, [editing?.id, editing]);

  const openNew = () => setEditing({ id: "", name: "", subject: "", html: "", updated_at: "", category: "Marketing" });

  const save = async () => {
    const sanitizeForEmail = (raw: string) => {
      try {
        const wrap = document.createElement('div');
        wrap.innerHTML = raw;
        // For each button block, remove the input and unwrap the anchor's container div
        wrap.querySelectorAll('.btn-block').forEach((block) => {
          const align = (block as HTMLElement).style.textAlign || 'left';
          block.querySelectorAll('input, select, button').forEach((el) => el.remove());
          const anchor = block.querySelector('a');
          if (anchor) {
            const p = document.createElement('p');
            p.style.margin = '12px 0';
            p.style.textAlign = align;
            p.appendChild(anchor);
            block.replaceWith(p);
          } else {
            block.remove();
          }
        });
        return wrap.innerHTML;
      } catch {
        return raw;
      }
    };
    if (!editing) return;
    if (!editing.name.trim()) { toast.error("Informe o nome do template"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      
      const rawHtml = editorRef.current?.innerHTML ?? editorHtmlDraftRef.current ?? editing.html;
      const currentHtml = sanitizeForEmail(rawHtml || "");
      const payload = { 
        name: editing.name, 
        subject: editing.subject, 
        html: currentHtml,
        category: editing.category || "Marketing"
      };

      if (editing.id) {
        const { error } = await (supabase as any)
          .from("user_email_templates")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("user_email_templates")
          .insert({ user_id: user.id, ...payload });
        if (error) throw error;
      }
      toast.success("Template salvo");
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    await (supabase as any).from("user_email_templates").delete().eq("id", id);
    toast.success("Template excluído");
    load();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('template-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('template-media')
        .getPublicUrl(filePath);

      const editor = document.getElementById('email-editor');
      if (editor) {
        const imgHtml = `
          <div class="img-container" style="display: inline-block; position: relative; margin: 10px; line-height: 0; border: 1px dashed #cbd5e1; padding: 4px; border-radius: 8px;">
            <img src="${publicUrl}" alt="imagem" style="width: 300px; height: auto; border-radius: 4px; cursor: move; display: block;" draggable="true" />
            <div class="img-controls" contenteditable="false" style="position: absolute; top: -12px; right: -12px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; z-index: 10;">
              <button onclick="this.closest('.img-container').remove(); window.dispatchEvent(new CustomEvent('template-change'));" style="background: #ef4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; items-center; justify-content: center; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">✕</button>
            </div>
            <div class="resizer" contenteditable="false" style="position: absolute; bottom: -5px; right: -5px; width: 14px; height: 14px; cursor: nwse-resize; background: #6366f1; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 10;"></div>
          </div>
        `;
        
        // Tenta inserir na posição do cursor se o editor estiver focado
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const div = document.createElement('div');
          div.innerHTML = imgHtml.trim();
          const frag = document.createDocumentFragment();
          let node;
          while (node = div.firstChild) {
            frag.appendChild(node);
          }
          range.insertNode(frag);
        } else {
          // Se não houver seleção ou não estiver no editor, adiciona ao final
          editor.innerHTML += imgHtml;
        }
        
        if (editing) setEditing({ ...editing, html: editor.innerHTML });
      } else if (editing) {
        // Fallback caso o editor não esteja no DOM por algum motivo
        setEditing({ ...editing, html: (editing.html || "") + `
          <div class="img-container" style="display: inline-block; position: relative; margin: 10px; line-height: 0;">
            <img src="${publicUrl}" alt="imagem" style="width: 300px; height: auto; border-radius: 8px; cursor: pointer; display: block;" />
            <div class="img-controls" contenteditable="false" style="position: absolute; top: 5px; right: 5px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; background: rgba(0,0,0,0.5); padding: 4px; border-radius: 4px;">
              <button onclick="this.closest('.img-container').remove(); window.dispatchEvent(new CustomEvent('template-change'));" style="background: #ef4444; color: white; border: none; border-radius: 3px; padding: 2px 6px; cursor: pointer; font-size: 10px;">X</button>
            </div>
            <div class="resizer" contenteditable="false" style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; cursor: nwse-resize; background: #6366f1; border-radius: 50%;"></div>
          </div>
        ` });
      }
      toast.success("Imagem enviada com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro no upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const [imageLibraryOpen, setImageLibraryOpen] = useState(false);
  const [realGalleryOpen, setRealGalleryOpen] = useState(false);
  const [imageLibrary, setImageLibrary] = useState<{name: string, url: string}[]>([]);

  const loadImages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.storage.from('template-media').list(user.id);
      if (error) throw error;
      
      const imagesWithUrls = data.map(file => {
        const { data: { publicUrl } } = supabase.storage.from('template-media').getPublicUrl(`${user.id}/${file.name}`);
        return { name: file.name, url: publicUrl };
      });
      setImageLibrary(imagesWithUrls);
    } catch (err) {
      console.error("Erro ao carregar galeria:", err);
    }
  };

  const insertImageFromUrl = (url: string) => {
    const editor = document.getElementById('email-editor');
    if (editor) {
      const imgHtml = `
        <div class="img-container" style="display: table; position: relative; margin: 10px auto 10px 0; line-height: 0; border: 1px dashed #cbd5e1; padding: 4px; border-radius: 8px;">
          <img src="${url}" alt="imagem" style="width: 300px; height: auto; border-radius: 4px; cursor: move; display: block;" draggable="true" />
          <div class="img-controls" contenteditable="false" style="position: absolute; top: -12px; right: -12px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; z-index: 10;">
            <button onclick="this.closest('.img-container').remove(); window.dispatchEvent(new CustomEvent('template-change'));" style="background: #ef4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; items-center; justify-content: center; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">✕</button>
          </div>
          <div class="resizer" contenteditable="false" style="position: absolute; bottom: -5px; right: -5px; width: 14px; height: 14px; cursor: nwse-resize; background: #6366f1; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 10;"></div>
        </div>
      `;
      
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const div = document.createElement('div');
        div.innerHTML = imgHtml.trim();
        const frag = document.createDocumentFragment();
        let node;
        while (node = div.firstChild) {
          frag.appendChild(node);
        }
        range.insertNode(frag);
      } else {
        editor.innerHTML += imgHtml;
      }
      if (editing) setEditing({ ...editing, html: editor.innerHTML });
      setImageLibraryOpen(false);
    }
  };

  const getEditor = () => document.getElementById('email-editor') as HTMLElement | null;

  const saveEditorSelection = () => {
    const editor = getEditor();
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      editorSelectionRef.current = range.cloneRange();
    }
  };

  const restoreEditorSelection = () => {
    const editor = getEditor();
    if (!editor) return null;

    editor.focus();
    const selection = window.getSelection();
    const savedRange = editorSelectionRef.current;
    let range: Range;

    if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      range = savedRange.cloneRange();
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }

    selection?.removeAllRanges();
    selection?.addRange(range);
    return range;
  };

  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const insertHtmlAtEditorCursor = (html: string) => {
    const editor = getEditor();
    const range = restoreEditorSelection();
    if (!editor || !range) return;

    range.deleteContents();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const fragment = document.createDocumentFragment();
    let lastNode: ChildNode | null = null;
    let node: ChildNode | null;
    while ((node = wrapper.firstChild)) {
      lastNode = fragment.appendChild(node);
    }
    range.insertNode(fragment);

    if (lastNode) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(lastNode);
      nextRange.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(nextRange);
      editorSelectionRef.current = nextRange.cloneRange();
    }

    editorHtmlDraftRef.current = editor.innerHTML;
  };

  const insertTextAtEditorCursor = (text: string) => insertHtmlAtEditorCursor(escapeHtml(text));

  const applyTextBlock = (type: "text" | "title" | "subtitle" | "heading" | "bullet" | "numbered") => {
    const range = restoreEditorSelection();
    if (!range) return;

    const selectedText = range.toString().trim();
    const selectedHtmlContainer = document.createElement('div');
    selectedHtmlContainer.appendChild(range.cloneContents());
    const selectedHtml = selectedHtmlContainer.innerHTML.trim();

    const styleMap = {
      text: { tag: "p", style: "margin: 0 0 12px; font-size: 14px; line-height: 1.6;", fallback: "Text" },
      title: { tag: "h1", style: "margin: 0 0 16px; font-size: 28px; font-weight: 700; line-height: 1.2;", fallback: "Title" },
      subtitle: { tag: "h2", style: "margin: 0 0 12px; font-size: 20px; font-weight: 600; line-height: 1.3;", fallback: "Subtitle" },
      heading: { tag: "h3", style: "margin: 0 0 10px; font-size: 16px; font-weight: 600; line-height: 1.4;", fallback: "Heading" },
    } as const;

    if (type === "bullet" || type === "numbered") {
      const tag = type === "bullet" ? "ul" : "ol";
      const listStyle = type === "bullet" ? "disc" : "decimal";
      const items = (selectedText || "List item")
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => `<li style="margin: 0 0 4px;">${escapeHtml(item)}</li>`)
        .join("");
      insertHtmlAtEditorCursor(`<${tag} style="margin: 0 0 12px; padding-left: 24px; list-style-type: ${listStyle}; list-style-position: outside;">${items}</${tag}><p></p>`);
      return;
    }

    const block = styleMap[type];
    const inner = selectedHtml || escapeHtml(selectedText) || block.fallback;
    insertHtmlAtEditorCursor(`<${block.tag} style="${block.style}">${inner}</${block.tag}><p></p>`);
  };

  const filteredList = list.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                         t.subject.toLowerCase().includes(search.toLowerCase());
    const matchesTab = tab === "all" || (t.category && t.category.toLowerCase() === tab.toLowerCase());
    return matchesSearch && matchesTab;
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto bg-slate-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gerenciador de Templates</h1>
          <p className="text-sm text-slate-500">Crie, edite e organize seus modelos de e-mail profissionais.</p>
        </div>
        <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Criar Novo Modelo</span>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <Tabs value={tab} onValueChange={setTab} className="w-full md:w-auto">
          <TabsList className="bg-transparent h-auto p-0 gap-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 rounded-lg px-4 py-2 text-sm font-medium transition-all border-0 shadow-none">
              Todos
            </TabsTrigger>
            <TabsTrigger value="marketing" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 rounded-lg px-4 py-2 text-sm font-medium transition-all border-0 shadow-none">
              Marketing
            </TabsTrigger>
            <TabsTrigger value="transacional" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 rounded-lg px-4 py-2 text-sm font-medium transition-all border-0 shadow-none">
              Transacional
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Buscar por nome ou assunto..." 
            className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-all rounded-lg"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-500 font-medium">Carregando seus modelos...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
            <Layout className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">Nenhum template encontrado</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              {search ? "Não encontramos nenhum resultado para sua busca." : "Comece criando seu primeiro modelo de e-mail agora mesmo."}
            </p>
          </div>
          {!search && <Button variant="outline" onClick={openNew}>Criar primeiro modelo</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredList.map(t => (
            <Card key={t.id} className="group overflow-hidden border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all duration-300 rounded-2xl flex flex-col">
              <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden flex items-center justify-center group-hover:bg-slate-50 transition-colors">
                <FileText className="w-12 h-12 text-slate-300" />
                <div className="absolute top-3 right-3 flex gap-2">
                  <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm text-slate-600 border-slate-200">
                    {t.category || "Marketing"}
                  </Badge>
                </div>
                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors pointer-events-none" />
              </div>
              
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="mb-4">
                  <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{t.name}</h3>
                  <p className="text-sm text-slate-500 truncate mt-1">{t.subject || "(Sem assunto)"}</p>
                </div>
                
                <div className="mt-auto flex items-center justify-between gap-2 pt-4 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                    Atualizado em {new Date(t.updated_at).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => setEditing(t)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => remove(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden border-0">
          <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <Layout className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">{editing?.id ? "Editar Template" : "Criar Novo Template"}</DialogTitle>
                <p className="text-xs text-slate-500">Configure as informações e o conteúdo do seu e-mail.</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditing(null)} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50/50">
            {/* Sidebar de Configurações Style Imagem */}
            <div className="w-full md:w-80 border-r border-slate-200 bg-slate-50 p-0 overflow-y-auto flex flex-col">
              <div className="p-4 bg-white border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <MousePointer2 className="w-4 h-4" /> Propriedades do Objeto
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {/* Mostra as propriedades apenas se houver uma imagem selecionada */}
                <div id="image-properties" className="p-4 space-y-6 hidden data-[visible=true]:block">
                  {/* Attributes Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <Globe className="w-3 h-3" /> Attributes
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-slate-500">URL do Link</Label>
                        <div className="relative">
                          <Link className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                          <Input 
                            id="img-link-input"
                            placeholder="https://exemplo.com"
                            className="h-8 pl-8 text-xs bg-white border-slate-200"
                            onChange={(e) => {
                              const selected = document.querySelector('.img-container.selected');
                              const img = selected?.querySelector('img');
                              if (selected && img) {
                                let linkWrap = selected.querySelector('a');
                                if (!linkWrap) {
                                  linkWrap = document.createElement('a');
                                  linkWrap.appendChild(img.cloneNode(true));
                                  img.parentNode?.replaceChild(linkWrap, img);
                                }
                                linkWrap.href = e.target.value;
                                if (editing) setEditing({ ...editing, html: document.getElementById('email-editor')?.innerHTML || "" });
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Size Section */}
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <Maximize className="w-3 h-3" /> Size
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-slate-500">Largura (px)</Label>
                        <Input 
                          id="img-width-input"
                          type="number"
                          placeholder="300"
                          className="h-8 text-xs bg-white border-slate-200"
                          onChange={(e) => {
                            const selectedImg = document.querySelector('.img-container.selected img') as HTMLImageElement;
                            if (selectedImg) {
                              selectedImg.style.width = `${e.target.value}px`;
                              if (editing) setEditing({ ...editing, html: document.getElementById('email-editor')?.innerHTML || "" });
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Spacing Section */}
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <Move className="w-3 h-3" /> Spacing
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] text-slate-500">Alinhamento</Label>
                      <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                        <Button variant="ghost" size="sm" className="flex-1 h-7 rounded-md" onClick={() => {
                          const s = document.querySelector('.img-container.selected') as HTMLElement;
                          if (s) { 
                            s.style.display = 'table'; 
                            s.style.margin = '10px auto 10px 0'; 
                            if (editing) setEditing({ ...editing, html: document.getElementById('email-editor')?.innerHTML || "" }); 
                          }
                        }}><AlignLeft className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="sm" className="flex-1 h-7 rounded-md" onClick={() => {
                          const s = document.querySelector('.img-container.selected') as HTMLElement;
                          if (s) { 
                            s.style.display = 'table'; 
                            s.style.margin = '10px auto'; 
                            if (editing) setEditing({ ...editing, html: document.getElementById('email-editor')?.innerHTML || "" }); 
                          }
                        }}><AlignCenter className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="sm" className="flex-1 h-7 rounded-md" onClick={() => {
                          const s = document.querySelector('.img-container.selected') as HTMLElement;
                          if (s) { 
                            s.style.display = 'table'; 
                            s.style.margin = '10px 0 10px auto'; 
                            if (editing) setEditing({ ...editing, html: document.getElementById('email-editor')?.innerHTML || "" }); 
                          }
                        }}><AlignRight className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  </div>

                  {/* Border Section */}
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <Square className="w-3 h-3" /> Border
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-500">Arredondar (px)</Label>
                      <Input 
                        id="img-radius-input"
                        type="number"
                        placeholder="8"
                        className="h-8 text-xs bg-white border-slate-200"
                        onChange={(e) => {
                          const selectedImg = document.querySelector('.img-container.selected img') as HTMLImageElement;
                          if (selectedImg) {
                            selectedImg.style.borderRadius = `${e.target.value}px`;
                            if (editing) setEditing({ ...editing, html: document.getElementById('email-editor')?.innerHTML || "" });
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Action Section */}
                  <div className="pt-6 border-t border-slate-200">
                    <Button variant="destructive" size="sm" className="w-full h-8 text-[11px] shadow-sm" onClick={() => {
                      const selected = document.querySelector('.img-container.selected');
                      if (selected) { 
                        selected.remove(); 
                        document.getElementById('image-properties')?.setAttribute('data-visible', 'false');
                        if (editing) setEditing({ ...editing, html: document.getElementById('email-editor')?.innerHTML || "" }); 
                      }
                    }}>
                      <Trash2 className="w-3 h-3 mr-2" /> Remover Imagem
                    </Button>
                  </div>
                </div>

                {/* Default sidebar view when no image is selected */}
                <div id="default-sidebar-view" className="p-4 space-y-6 data-[visible=false]:hidden" data-visible="true">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Título do Template</Label>
                      <Input 
                        value={editing?.name} 
                        onChange={e => setEditing(editing ? { ...editing, name: e.target.value } : null)} 
                        placeholder="Nome do template" 
                        className="border-slate-200 bg-white shadow-sm h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assunto</Label>
                      <Input 
                        value={editing?.subject} 
                        onChange={e => setEditing(editing ? { ...editing, subject: e.target.value } : null)} 
                        placeholder="Assunto do e-mail" 
                        className="border-slate-200 bg-white shadow-sm h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Sections */}
                <div className="mt-auto bg-white border-t border-slate-200">
                  <div className="border-b border-slate-200">
                    <button 
                      onClick={() => {
                        const panel = document.getElementById('page-style-panel');
                        const isHidden = panel?.classList.contains('hidden');
                        document.querySelectorAll('.footer-panel').forEach(p => p.classList.add('hidden'));
                        if (isHidden) panel?.classList.remove('hidden');
                      }}
                      className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-2 uppercase tracking-wide">
                        <FileText className="w-3 h-3" /> Page style
                      </span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                    
                    <div id="page-style-panel" className="footer-panel hidden p-4 bg-slate-50 border-t border-slate-100 space-y-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Background</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono uppercase">{pageStyle.backgroundColor}</span>
                            <input 
                              type="color" 
                              value={pageStyle.backgroundColor}
                              onChange={(e) => setPageStyle({ ...pageStyle, backgroundColor: e.target.value })}
                              className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer rounded overflow-hidden"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Width (px)</Label>
                            <Input 
                              type="number" 
                              value={pageStyle.width}
                              onChange={(e) => setPageStyle({ ...pageStyle, width: Number(e.target.value) })}
                              className="h-8 text-xs bg-white border-slate-200"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Padding (px)</Label>
                            <Input 
                              type="number" 
                              value={pageStyle.padding}
                              onChange={(e) => setPageStyle({ ...pageStyle, padding: Number(e.target.value) })}
                              className="h-8 text-xs bg-white border-slate-200"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>


                  <div className="border-b border-slate-200">
                    <button 
                      onClick={() => {
                        const themePanel = document.getElementById('theme-panel');
                        const isHidden = themePanel?.classList.contains('hidden');
                        document.querySelectorAll('.footer-panel').forEach(p => p.classList.add('hidden'));
                        if (isHidden) themePanel?.classList.remove('hidden');
                      }}
                      className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-2 uppercase tracking-wide">
                        <Palette className="w-3 h-3" /> Edit theme
                      </span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                    
                    <div id="theme-panel" className="footer-panel hidden p-3 bg-slate-50 border-t border-slate-100 max-h-[400px] overflow-y-auto">
                      <ThemeEditor styles={themeStyles} onChange={setThemeStyles} />
                    </div>
                  </div>

                  <div className="relative">
                    <button 
                      onClick={() => {
                        const cssPanel = document.getElementById('css-panel');
                        cssPanel?.classList.remove('hidden');
                      }}
                      className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-2 uppercase tracking-wide">
                        <Code className="w-3 h-3" /> Global CSS
                      </span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    <div 
                      id="css-panel" 
                      className="footer-panel hidden fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300"
                    >
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Global CSS</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5">Add custom styles to your email using CSS.</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full"
                          onClick={() => document.getElementById('css-panel')?.classList.add('hidden')}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex-1 bg-slate-900 p-0 overflow-hidden">
                        <textarea 
                          value={globalCss}
                          onChange={(e) => setGlobalCss(e.target.value)}
                          className="w-full h-full text-[12px] font-mono p-4 bg-slate-900 text-indigo-300 focus:outline-none resize-none selection:bg-indigo-500/30"
                          placeholder="/* 
  Example:
  p { color: red; }
*/"
                          spellCheck={false}
                        ></textarea>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Editor de Conteúdo */}
            <div className="flex-1 p-4 md:p-8 flex flex-col gap-4 overflow-y-auto">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full min-h-[500px]">
                <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                  <div className="flex items-center gap-1" onMouseDownCapture={saveEditorSelection}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-8 px-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 rounded-md transition-colors"
                          title="Inserir variável"
                        >
                          <Plus className="w-4 h-4" />
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        {[
                          { group: "Contato", items: [
                            { label: "Nome", value: "{{contato.nome}}" },
                            { label: "E-mail", value: "{{contato.email}}" },
                            { label: "Telefone", value: "{{contato.telefone}}" },
                            { label: "Empresa", value: "{{contato.empresa}}" },
                          ]},
                          { group: "Remetente", items: [
                            { label: "Nome do remetente", value: "{{remetente.nome}}" },
                            { label: "E-mail do remetente", value: "{{remetente.email}}" },
                          ]},
                          { group: "Sistema", items: [
                            { label: "Data atual", value: "{{data.hoje}}" },
                            { label: "Link de cancelamento", value: "{{unsubscribe_url}}" },
                          ]},
                        ].map((g) => (
                          <div key={g.group}>
                            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-bold">{g.group}</div>
                            {g.items.map((it) => (
                              <DropdownMenuItem
                                key={it.value}
                                className="cursor-pointer text-[13px] flex flex-col items-start gap-0"
                                onClick={() => insertTextAtEditorCursor(it.value)}
                              >
                                <span>{it.label}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{it.value}</span>
                              </DropdownMenuItem>
                            ))}
                          </div>
                        ))}
                        <div className="border-t border-slate-100 mt-1 pt-1">
                          <DropdownMenuItem
                            className="cursor-pointer text-[13px] text-indigo-600 font-medium"
                            onClick={() => {
                              const name = prompt("Nome da variável personalizada (sem espaços):");
                              if (!name) return;
                              const clean = name.trim().replace(/\s+/g, "_");
                              insertTextAtEditorCursor(`{{${clean}}}`);
                            }}
                          >
                            + Criar variável personalizada
                          </DropdownMenuItem>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-8 px-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 rounded-md transition-colors"
                          title="Estilo de texto"
                        >
                          <Type className="w-4 h-4" />
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-44">
                        {[
                          { label: "Text", type: "text", cls: "text-[14px]" },
                          { label: "Title", type: "title", cls: "text-[20px] font-bold" },
                          { label: "Subtitle", type: "subtitle", cls: "text-[16px] font-semibold" },
                          { label: "Heading", type: "heading", cls: "text-[14px] font-semibold" },
                          { label: "Bullet list", type: "bullet", cls: "text-[13px]" },
                          { label: "Numbered list", type: "numbered", cls: "text-[13px]" },
                        ].map((opt) => (
                          <DropdownMenuItem
                            key={opt.label}
                            onClick={() => applyTextBlock(opt.type as "text" | "title" | "subtitle" | "heading" | "bullet" | "numbered")}
                            className={`cursor-pointer ${opt.cls}`}
                          >
                            {opt.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-8 px-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 rounded-md transition-colors"
                          title="Inserir bloco"
                        >
                          <Square className="w-4 h-4" />
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-52">
                        {(() => {
                          const cols = (n: number) => {
                            const cells = Array.from({ length: n })
                              .map(() => `<td style="vertical-align: top; padding: 8px; width: ${100 / n}%;"><p>Coluna</p></td>`) 
                              .join("");
                            return `<table style="width: 100%; border-collapse: collapse; margin: 12px 0;"><tbody><tr>${cells}</tr></tbody></table><p></p>`;
                          };
                          const blocks: { label: string; html: string }[] = [
                            { label: "Button", html: `__BUTTON_BLOCK__` },
                            { label: "Divider", html: `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />` },
                            { label: "Section", html: `<div style="padding: 24px; background: #f8fafc; border-radius: 8px; margin: 12px 0;"><p>Section content</p></div>` },
                            { label: "2 columns", html: cols(2) },
                            { label: "3 columns", html: cols(3) },
                            { label: "4 columns", html: cols(4) },
                            { label: "Social links", html: `<p style="text-align: center; margin: 16px 0;"><a href="#" style="margin: 0 8px; text-decoration: none;">Facebook</a><a href="#" style="margin: 0 8px; text-decoration: none;">Instagram</a><a href="#" style="margin: 0 8px; text-decoration: none;">X</a><a href="#" style="margin: 0 8px; text-decoration: none;">YouTube</a></p>` },
                            { label: "Unsubscribe footer", html: `<p style="text-align: center; color: #64748b; font-size: 12px; margin-top: 32px;">Você está recebendo este e-mail porque se inscreveu na nossa lista.<br/><a href="{{unsubscribe_url}}" style="color: #64748b; text-decoration: underline;">Cancelar inscrição</a></p>` },
                            { label: "HTML", html: `__PROMPT_HTML__` },
                            { label: "Code", html: `<pre style="background: #0f172a; color: #e2e8f0; padding: 12px 16px; border-radius: 8px; font-family: monospace; font-size: 13px; overflow: auto;"><code>// seu código aqui</code></pre><p></p>` },
                          ];
                          return blocks.map((b) => (
                            <DropdownMenuItem
                              key={b.label}
                              className="cursor-pointer text-[13px]"
                              onClick={() => {
                                const editor = document.getElementById('email-editor');
                                if (!editor) return;
                                let html = b.html;
                                if (html === "__PROMPT_HTML__") {
                                  const raw = prompt("Cole o HTML personalizado:");
                                  if (!raw) return;
                                  html = raw;
                                }
                                if (html === "__BUTTON_BLOCK__") {
                                  html = buildButtonBlockHtml() + `<p></p>`;
                                }
                                insertHtmlAtEditorCursor(html);
                              }}
                            >
                              {b.label}
                            </DropdownMenuItem>
                          ));
                        })()}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => {
                        document.execCommand('justifyLeft', false);
                      }}
                      title="Alinhar à Esquerda"
                    >
                      <AlignLeft className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => {
                        document.execCommand('justifyCenter', false);
                      }}
                      title="Centralizar"
                    >
                      <AlignCenter className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => {
                        document.execCommand('justifyRight', false);
                      }}
                      title="Alinhar à Direita"
                    >
                      <AlignRight className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-4 bg-slate-200 mx-1" />
                    <Dialog open={imageLibraryOpen} onOpenChange={setImageLibraryOpen}>
                      <button 
                        className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center rounded-md transition-colors"
                        onClick={() => {
                          loadImages();
                          setImageLibraryOpen(true);
                        }}
                        disabled={uploading}
                        title="Inserir mídia"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      </button>
                      <DialogContent className="max-w-md overflow-hidden rounded-2xl border-0 shadow-2xl p-0">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                          <DialogTitle className="text-sm font-bold text-slate-900">Select Media Type</DialogTitle>
                          <Button variant="ghost" size="icon" onClick={() => setImageLibraryOpen(false)} className="rounded-full h-8 w-8">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="p-4 grid grid-cols-3 gap-4 bg-slate-50/50">
                          <button 
                            onClick={() => {
                              setImageLibraryOpen(false);
                              // Aqui abriria a galeria que já criamos
                              const galleryBtn = document.getElementById('trigger-gallery');
                              galleryBtn?.click();
                            }}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                          >
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Imagem</span>
                          </button>

                          <button 
                            onClick={() => {
                              const url = prompt("Cole a URL do vídeo do YouTube:");
                              if (url) {
                                const videoId = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
                                if (videoId) {
                                  const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                                  const editor = document.getElementById('email-editor');
                                  if (editor) {
                                    const videoHtml = `
                                      <div class="img-container" style="display: table; position: relative; margin: 10px auto 10px 0; line-height: 0; border: 1px dashed #cbd5e1; padding: 4px; border-radius: 8px;">
                                        <div style="position: relative; line-height: 0;">
                                          <img src="${thumbUrl}" alt="YouTube Video" style="width: 480px; height: auto; border-radius: 4px; cursor: move; display: block;" draggable="true" data-youtube-id="${videoId}" />
                                          <div contenteditable="false" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: none;">
                                            <div style="width: 60px; height: 42px; background: #ff0000; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                                              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                                            </div>
                                          </div>
                                        </div>
                                        <div class="img-controls" contenteditable="false" style="position: absolute; top: -12px; right: -12px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; z-index: 10;">
                                          <button onclick="this.closest('.img-container').remove(); window.dispatchEvent(new CustomEvent('template-change'));" style="background: #ef4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; items-center; justify-content: center; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">✕</button>
                                        </div>
                                        <div class="resizer" contenteditable="false" style="position: absolute; bottom: -5px; right: -5px; width: 14px; height: 14px; cursor: nwse-resize; background: #6366f1; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 10;"></div>
                                      </div>
                                    `;
                                    
                                    const selection = window.getSelection();
                                    if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
                                      const range = selection.getRangeAt(0);
                                      range.deleteContents();
                                      const div = document.createElement('div');
                                      div.innerHTML = videoHtml.trim();
                                      const frag = document.createDocumentFragment();
                                      let node;
                                      while (node = div.firstChild) {
                                        frag.appendChild(node);
                                      }
                                      range.insertNode(frag);
                                    } else {
                                      editor.innerHTML += videoHtml;
                                    }
                                    if (editing) setEditing({ ...editing, html: editor.innerHTML });
                                  }
                                } else {
                                  toast.error("URL do YouTube inválida");
                                }
                              }
                              setImageLibraryOpen(false);
                            }}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-slate-200 hover:border-red-500 hover:bg-red-50 transition-all group"
                          >
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">YouTube</span>
                          </button>

                          <button 
                            onClick={() => {
                              const url = prompt("Cole a URL do post do X (Twitter):");
                              setImageLibraryOpen(false);
                            }}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-slate-200 hover:border-black hover:bg-slate-100 transition-all group"
                          >
                            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">X</span>
                          </button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Botão invisível para triggar a galeria real */}
                    <button id="trigger-gallery" className="hidden" onClick={() => setRealGalleryOpen(true)}></button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleFileUpload} 
                    />
                    <div className="w-px h-4 bg-slate-200 mx-1" />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-500 font-bold hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => {
                        document.execCommand('bold', false);
                        if (editing) setEditing({ ...editing, html: document.getElementById('email-editor')?.innerHTML || "" });
                      }}
                      title="Negrito"
                    >
                      B
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-500 italic font-serif hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => {
                        document.execCommand('italic', false);
                        if (editing) setEditing({ ...editing, html: document.getElementById('email-editor')?.innerHTML || "" });
                      }}
                      title="Itálico"
                    >
                      I
                    </Button>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-slate-400 bg-white">Modo HTML / Texto Rico</Badge>
                </div>
                <div className="flex-1 p-6 bg-slate-200 overflow-y-auto min-h-[500px] border-none relative flex flex-col items-center">
                  <style>{`
                    .img-container:hover .img-controls { opacity: 1 !important; }
                    .img-container.selected .img-controls { opacity: 1 !important; }
                    .img-container.selected { outline: 2px solid #6366f1; border-style: solid !important; }
                    [contenteditable] img { transition: outline 0.2s; }
                    .img-container:hover { border-color: #6366f1 !important; }
                     ${buildThemeCss(themeStyles)}
                     ${globalCss}
                     #email-editor {
                       background-color: ${pageStyle.backgroundColor};
                       width: ${pageStyle.width}px;
                       padding: ${pageStyle.padding}px;
                       margin: 0 auto;
                       box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                       min-height: 100%;
                        direction: ltr;
                        unicode-bidi: plaintext;
                        text-align: left;
                     }
                  `}</style>
                  <div 
                    contentEditable
                    suppressContentEditableWarning
                    ref={editorRef}
                    id="email-editor"
                    dir="ltr"
                    style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
                    className="focus:outline-none prose prose-slate max-w-none"

                    onBlur={saveEditorSelection}
                    onMouseUp={saveEditorSelection}
                    onKeyUp={saveEditorSelection}
                    onInput={(e) => {
                      saveEditorSelection();
                      editorHtmlDraftRef.current = e.currentTarget.innerHTML;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDragStart={(e) => {
                      const target = e.target as HTMLElement;
                      const btnBlock = target.closest('.btn-block') as HTMLElement | null;
                      if (btnBlock) {
                        btnBlock.classList.add('dragging');
                        try { e.dataTransfer?.setData('text/plain', btnBlock.id || 'btn'); } catch {}
                        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                      }
                    }}
                    onDragEnd={() => {
                      document.querySelectorAll('.btn-block.dragging').forEach((el) => el.classList.remove('dragging'));
                    }}
                    onDrop={(e) => {
                      const target = e.target as HTMLElement;
                      const container = document.querySelector('.img-container.dragging, .btn-block.dragging') as HTMLElement;
                      if (container) {
                        e.preventDefault();
                        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                        if (range) {
                          range.insertNode(container);
                          container.classList.remove('dragging');
                          if (editing) setEditing({ ...editing, html: document.getElementById('email-editor')?.innerHTML || "" });
                        }
                      }
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      const container = target.closest('.img-container');
                      const btnBlock = target.closest('.btn-block') as HTMLElement | null;

                      // Hide all button controls, then show the clicked one
                      document.querySelectorAll('.btn-block .btn-controls').forEach((el) => {
                        (el as HTMLElement).style.display = 'none';
                      });
                      if (btnBlock) {
                        const ctrls = btnBlock.querySelector('.btn-controls') as HTMLElement | null;
                        if (ctrls) ctrls.style.display = 'flex';
                      }
                      
                      // Remove selected class from all containers
                      document.querySelectorAll('.img-container').forEach(el => el.classList.remove('selected'));
                      
                      const propsBar = document.getElementById('image-properties');
                      const defaultBar = document.getElementById('default-sidebar-view');

                      if (container) {
                        container.classList.add('selected');
                        propsBar?.setAttribute('data-visible', 'true');
                        defaultBar?.setAttribute('data-visible', 'false');
                        
                        // Populate inputs with current values
                        const img = container.querySelector('img');
                        const link = container.querySelector('a');
                        if (img) {
                          const widthInput = document.getElementById('img-width-input') as HTMLInputElement;
                          const radiusInput = document.getElementById('img-radius-input') as HTMLInputElement;
                          const linkInput = document.getElementById('img-link-input') as HTMLInputElement;
                          
                          if (widthInput) widthInput.value = img.style.width.replace('px', '');
                          if (radiusInput) radiusInput.value = img.style.borderRadius.replace('px', '');
                          if (linkInput) linkInput.value = link?.href || '';
                        }
                      } else {
                        propsBar?.setAttribute('data-visible', 'false');
                        defaultBar?.setAttribute('data-visible', 'true');
                      }
                    }}
                    onMouseDown={(e) => {
                      const target = e.target as HTMLElement;
                      const container = target.closest('.img-container') as HTMLElement;
                      
                      if (target.classList.contains('resizer')) {
                        e.preventDefault();
                        const img = container?.querySelector('img');
                        if (!img) return;
                        const startX = e.clientX;
                        const startWidth = img.offsetWidth;
                        const onMouseMove = (mv: MouseEvent) => {
                          img.style.width = `${startWidth + (mv.clientX - startX)}px`;
                        };
                        const onMouseUp = () => {
                          document.removeEventListener('mousemove', onMouseMove);
                          document.removeEventListener('mouseup', onMouseUp);
                          if (editing) setEditing({ ...editing, html: document.getElementById('email-editor')?.innerHTML || "" });
                        };
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                      } else if (container && !target.closest('.img-controls')) {
                        // Iniciar arraste manual
                        container.classList.add('dragging');
                      } else {
                        const btnBlock = target.closest('.btn-block') as HTMLElement | null;
                        // Only drag when grabbing the wrapper itself, not its inputs/controls
                        if (btnBlock && target === btnBlock) {
                          btnBlock.classList.add('dragging');
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 border-t border-slate-100 bg-white flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditing(null)} className="text-slate-500">Descartar Alterações</Button>
            <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 px-8 shadow-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Galeria de Imagens Real */}
      <Dialog open={realGalleryOpen} onOpenChange={setRealGalleryOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">Selecione uma Imagem</DialogTitle>
                <p className="text-xs text-slate-500">Escolha uma imagem da sua galeria ou faça upload de uma nova.</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setImageLibraryOpen(false)} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {/* Botão de Upload na Galeria */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-indigo-600">Upload</span>
              </button>

              {imageLibrary.map((img, i) => (
                <button 
                  key={i}
                  onClick={() => insertImageFromUrl(img.url)}
                  className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white hover:border-indigo-500 hover:ring-2 hover:ring-indigo-200 transition-all relative group"
                >
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold uppercase tracking-wider">Selecionar</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
