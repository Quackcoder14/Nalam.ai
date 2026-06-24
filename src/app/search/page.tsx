'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, FileText, Microscope, User, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

interface SearchRecord {
  id: string; type: string; diagnosis?: string; notes?: string;
  lab_results?: string; provider?: string; visit_date?: string;
  patient_id?: string; score: number;
  highlights: { diagnosis: string; notes: string; lab_results: string; provider: string; };
}

function HighlightedText({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} style={{ lineHeight: 1.6, wordBreak: 'break-word', overflowWrap: 'anywhere' }} />;
}

function SearchInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [query, setQuery]       = useState(searchParams.get('q') || '');
  const [field, setField]       = useState('all');
  const [results, setResults]   = useState<SearchRecord[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [searched, setSearched] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState(searchParams.get('q') || '');

  const runSearch = useCallback(async (q: string, f: string) => {
    if (q.trim().length < 2) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ q: q.trim(), field: f });
      const patientId = localStorage.getItem('nalamPatientId');
      if (patientId) params.set('patientId', patientId);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/search?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(data.records || []);
      setTotal(data.total || 0);
      setSearchedQuery(q);
      setSearched(true);
    } catch (e: any) {
      setError(e.message || 'Search failed');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setTotal(0); setSearched(false); setSearchedQuery(''); return; }
    const handler = setTimeout(() => runSearch(query, field), 300);
    return () => clearTimeout(handler);
  }, [query, field, runSearch]);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q) { setQuery(q); setSearchedQuery(q); runSearch(q, field); }
  }, [searchParams, runSearch, field]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    runSearch(query, field);
  };

  const typeIcon = (type: string) => {
    if (type?.toLowerCase().includes('lab'))   return <Microscope size={15} color="var(--accent-teal)" />;
    if (type?.toLowerCase().includes('visit')) return <User size={15} color="var(--primary)" />;
    return <FileText size={15} color="var(--accent-purple)" />;
  };

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
          <Search size={22} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--primary)' }} />
          {t('search.title')}
        </h1>
        <p style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem' }}>{t('search.subtitle')}</p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-subtle)' }} />
            <input id="search-input" type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder={t('search.placeholder')} autoFocus
              style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.6rem', borderRadius: 12, border: '2px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: '1rem', outline: 'none' }} />
          </div>
          <select id="field-filter" value={field} onChange={e => setField(e.target.value)}
            style={{ padding: '0.8rem 1rem', borderRadius: 12, border: '2px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: '0.9rem', cursor: 'pointer' }}>
            <option value="all">{t('search.allFields')}</option>
            <option value="diagnosis">{t('search.diagnosis')}</option>
            <option value="notes">{t('search.notes')}</option>
            <option value="labs">{t('search.labResults')}</option>
            <option value="provider">{t('search.provider')}</option>
          </select>
          <button type="submit" id="search-submit" disabled={loading || query.trim().length < 2}
            style={{ padding: '0.8rem 1.5rem', borderRadius: 12, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: loading || query.trim().length < 2 ? 0.6 : 1 }}>
            {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
            {t('search.button')}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: 10, background: 'var(--accent-red-bg)', color: 'var(--accent-red)', marginBottom: '1rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Results count */}
      {searched && !loading && (
        <div style={{ fontSize: '0.88rem', color: 'var(--foreground-muted)', marginBottom: '1rem' }}>
          {total > 0 ? (
            <><strong style={{ color: 'var(--foreground)' }}>{total}</strong> {total !== 1 ? t('search.results') : t('search.result')} &ldquo;<strong style={{ color: 'var(--primary)' }}>{searchedQuery}</strong>&rdquo;</>
          ) : (
            <>{t('search.noResults')} &ldquo;<strong>{searchedQuery}</strong>&rdquo;. {t('search.tryDiff')}</>
          )}
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {results.map((rec, index) => (
            <div key={rec.id ?? index} className="glass-panel" style={{ cursor: 'default', padding: '1.25rem', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {typeIcon(rec.type)}
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)' }}>{rec.type || 'Medical Record'}</span>
                  <span style={{ padding: '0.15rem 0.6rem', borderRadius: 50, fontSize: '0.75rem', fontWeight: 600, background: 'var(--primary-light)', color: 'var(--primary)' }}>
                    {Math.round(rec.score * 100)}{t('search.match')}
                  </span>
                </div>
                {rec.visit_date && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--foreground-subtle)' }}>
                    <Calendar size={13} />
                    {new Date(rec.visit_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
              {rec.highlights.diagnosis && (
                <div style={{ marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('search.diagnosis')}</span>
                  <div style={{ fontSize: '0.9rem', color: 'var(--foreground)', marginTop: '0.15rem' }}><HighlightedText html={rec.highlights.diagnosis} /></div>
                </div>
              )}
              {rec.highlights.notes && (
                <div style={{ marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('search.notes')}</span>
                  <div style={{ fontSize: '0.88rem', color: 'var(--foreground-muted)', marginTop: '0.15rem', lineHeight: 1.5 }}><HighlightedText html={rec.highlights.notes} /></div>
                </div>
              )}
              {rec.highlights.lab_results && (
                <div style={{ marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('search.labResults')}</span>
                  <div style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', marginTop: '0.15rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}><HighlightedText html={rec.highlights.lab_results} /></div>
                </div>
              )}
              {rec.provider && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--foreground-subtle)' }}>
                  <User size={13} />
                  <HighlightedText html={rec.highlights.provider || rec.provider} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {searched && !loading && results.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--foreground-muted)' }}>
          <Search size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{t('search.noMatch')}</p>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>{t('search.tryTips')}</p>
        </div>
      )}

      <style>{`
        mark { background: rgba(245,158,11,0.25); color: inherit; border-radius: 2px; padding: 0 2px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function SearchPage() {
  const { t } = useLanguage();
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('search.loading')}</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <SearchInner />
    </Suspense>
  );
}
