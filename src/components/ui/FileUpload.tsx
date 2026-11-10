import { useEffect, useRef, useState } from 'react';
import { Upload, File, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { listarArquivos, uploadArquivo, type ArquivoCategoria, type ArquivoEnviado } from '@/services/file-storage';

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  label?: string;
  onChange?: (files: File[]) => void;
  onUploaded?: (files: ArquivoEnviado[]) => void;
  value?: File[];
  className?: string;
  categoria?: ArquivoCategoria;
}

export function FileUpload({
  accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx',
  multiple = false,
  maxSizeMb = 10,
  label = 'Arraste arquivos ou clique para enviar',
  onChange,
  className,
  categoria = 'arquivos',
  onUploaded,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savedFiles, setSavedFiles] = useState<ArquivoEnviado[]>([]);

  useEffect(() => {
    let active = true;
    void listarArquivos(categoria)
      .then((items) => { if (active) setSavedFiles(items); })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar seus arquivos.');
      });
    return () => { active = false; };
  }, [categoria]);

  const handleFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError('');
    const arr = Array.from(list);
    const tooBig = arr.find((f) => f.size > maxSizeMb * 1024 * 1024);
    if (tooBig) {
      setError(`Arquivo acima de ${maxSizeMb}MB: ${tooBig.name}`);
      return;
    }
    const next = multiple ? [...files, ...arr] : arr.slice(0, 1);
    setFiles(next);
    onChange?.(next);
    const urls = next.filter((f) => f.type.startsWith('image/')).map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    setUploading(true);
    try {
      const results = await Promise.allSettled(arr.map((file) => uploadArquivo(file, categoria)));
      const uploaded = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      if (uploaded.length) {
        setSavedFiles((current) => {
          const merged = [...uploaded, ...current.filter((item) => !uploaded.some((file) => file.id === item.id))];
          return multiple ? merged : uploaded;
        });
        onUploaded?.(uploaded);
      }
      const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failed) throw failed.reason;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Falha ao salvar arquivo no servidor.');
    } finally {
      setUploading(false);
    }
  };

  const remove = (i: number) => {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    onChange?.(next);
    if (!multiple) setSavedFiles([]);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'border-2 border-dashed border-border-color rounded-xl p-6 text-center cursor-pointer',
          'hover:border-brand/50 hover:bg-brand/5 transition-colors'
        )}
      >
        <Upload className="w-8 h-8 mx-auto text-text-secondary mb-2" />
          <p className="text-sm text-text-primary font-medium">{uploading ? 'Salvando no servidor...' : label}</p>
        <p className="text-xs text-text-secondary mt-1">PDF, imagens, Word, Excel · máx. {maxSizeMb}MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="text-sm text-erro">{error}</p>}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 p-2 rounded-lg bg-bg-secondary border border-border-color">
              {f.type.startsWith('image/') && previews[i] ? (
                <img src={previews[i]} alt="" className="w-10 h-10 rounded object-cover" />
              ) : f.type.startsWith('image/') ? (
                <ImageIcon className="w-5 h-5 text-brand" />
              ) : (
                <File className="w-5 h-5 text-text-secondary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-text-secondary">
                  {(f.size / 1024).toFixed(1)} KB
                  {savedFiles[i] && <> · <a className="text-brand hover:underline" href={savedFiles[i].url} target="_blank" rel="noreferrer">Salvo no servidor</a></>}
                </p>
              </div>
              <button type="button" onClick={() => remove(i)} className="p-1.5 rounded-lg hover:bg-bg-tertiary">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {savedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">Arquivos salvos no servidor</p>
          <ul className="space-y-2">
            {savedFiles.map((file) => (
              <li key={file.id} className="flex items-center gap-3 p-2 rounded-lg bg-bg-secondary border border-border-color">
                {file.tipo.startsWith('image/') ? (
                  <a href={file.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${file.nome}`}>
                    <img src={file.url} alt="" className="w-10 h-10 rounded object-cover" />
                  </a>
                ) : <File className="w-5 h-5 text-text-secondary" />}
                <div className="min-w-0 flex-1">
                  <a className="text-sm font-medium truncate block text-brand hover:underline" href={file.url} target="_blank" rel="noreferrer">
                    {file.nome}
                  </a>
                  <p className="text-xs text-text-secondary">{(file.tamanho / 1024).toFixed(1)} KB · salvo na sua conta</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

