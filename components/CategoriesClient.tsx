'use client'

import { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus, X, Check, ChevronDown, ChevronRight, FolderPlus } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Category {
  id: string
  name: string
  icon: string | null
  color: string | null
  isDefault: boolean
  isFixed: boolean
  parentId: string | null
  children: Category[]
  _count: { transactions: number }
}

function CategoryIcon({ name, size = 14, color }: { name: string | null | undefined; size?: number; color?: string }) {
  if (!name) return null
  const Icon = (LucideIcons as Record<string, unknown>)[name] as React.FC<{ size?: number; color?: string }> | undefined
  return Icon ? <Icon size={size} color={color} /> : <span style={{ fontSize: size }}>{name}</span>
}

const COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#3B82F6', '#6366F1', '#A855F7', '#EC4899', '#6B7280']

// Iconos Lucide sugeridos para categorías
const ICON_OPTIONS = [
  'ShoppingCart','Utensils','Bike','Bus','Fuel','Car','Package','Shirt','Radio','Stethoscope',
  'Dumbbell','Building2','Zap','Signal','Shield','ArrowLeftRight','Banknote','TrendingUp',
  'LineChart','Sofa','HelpCircle','UtensilsCrossed','ShoppingBag','Wifi','HeartPulse','Home',
  'Landmark','Tag','Folder','Star','Heart','Coffee','Music','Book','Plane','Globe',
]

function TypeBadge({ label }: { label: 'Categoría' | 'Subcategoría' }) {
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide font-semibold flex-shrink-0"
      style={{ background: 'var(--card-border)', color: 'var(--muted)' }}
    >
      {label}
    </span>
  )
}

function IconPicker({ value, onChange, color }: { value: string; onChange: (v: string) => void; color?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="w-9 h-9 rounded flex items-center justify-center border"
        style={{ background: '#0a0a0b', borderColor: 'var(--card-border)' }}
        title="Elegir icono"
      >
        {value ? <CategoryIcon name={value} size={16} color={color} /> : <Plus size={14} style={{ opacity: 0.4 }} />}
      </button>
      {open && (
        <div className="absolute top-10 left-0 z-50 rounded-lg shadow-xl p-2 grid"
          style={{ background: '#121214', border: '1px solid var(--card-border)', gridTemplateColumns: 'repeat(8,1fr)', gap: 2, width: 240 }}>
          {ICON_OPTIONS.map(ic => (
            <button
              key={ic}
              type="button"
              title={ic}
              onClick={(e) => { e.stopPropagation(); onChange(ic); setOpen(false) }}
              className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
              style={{ background: value === ic ? 'var(--accent)' : 'transparent' }}
            >
              <CategoryIcon name={ic} size={14} color={color} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CategoriesClient() {
  const [groups, setGroups] = useState<Category[]>([])
  const [ungrouped, setUngrouped] = useState<Category[]>([])
  const [flat, setFlat] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)

  // Editing
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [editColor, setEditColor] = useState('')

  // Creating
  type CreateMode = 'closed' | 'group' | 'ungrouped' | { parentId: string }
  const [creating, setCreating] = useState<CreateMode>('closed')
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [newColor, setNewColor] = useState('#6366F1')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/categories')
    const d = await res.json()
    setGroups(d.groups ?? [])
    setUngrouped(d.ungrouped ?? [])
    setFlat(d.flat ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startEdit(cat: Category) {
    setEditId(cat.id)
    setEditName(cat.name)
    setEditIcon(cat.icon ?? '')
    setEditColor(cat.color ?? '#6366F1')
  }

  async function saveEdit() {
    await fetch(`/api/categories/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, icon: editIcon, color: editColor }),
    })
    setEditId(null)
    load()
  }

  async function deleteCategory(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"? Las transacciones quedarán sin categoría.`)) return
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    load()
  }

  async function toggleFixed(id: string, current: boolean) {
    await fetch(`/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFixed: !current }),
    })
    load()
  }

  function FixedToggle({ cat }: { cat: Category }) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); toggleFixed(cat.id, cat.isFixed) }}
        className={`text-xs px-2 py-0.5 rounded-full border transition-colors flex-shrink-0 ${
          cat.isFixed
            ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
            : 'border-[var(--card-border)] text-[var(--muted)]'
        }`}
      >
        {cat.isFixed ? '🔒 Fijo' : 'Variable'}
      </button>
    )
  }

  async function createCategory() {
    if (!newName.trim()) return
    const parentId = typeof creating === 'object' ? creating.parentId : null
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, icon: newIcon, color: newColor, parentId }),
    })
    setCreating('closed')
    setNewName('')
    setNewIcon('')
    load()
  }

  function openCreate(mode: CreateMode) {
    setCreating(mode)
    setNewName('')
    setNewIcon('')
    setNewColor('#6366F1')
  }

  function CreateForm({ title }: { title: string }) {
    return (
      <div className="card p-4 space-y-3 mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-wrap">
          <div className="flex items-center gap-3">
            <IconPicker value={newIcon} onChange={setNewIcon} color={newColor} />
            <input
              type="text"
              placeholder="Nombre"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createCategory(); if (e.key === 'Escape') setCreating('closed') }}
              className="flex-1 min-w-[140px] px-3 py-2.5 rounded text-sm outline-none"
              style={{ background: '#0a0a0b', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
              autoFocus
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setNewColor(c)} className="w-5 h-5 rounded-full border-2 transition-all"
                style={{ background: c, borderColor: newColor === c ? '#fff' : 'transparent' }} />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={createCategory} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            <Check size={14} /> Crear
          </button>
          <button onClick={() => setCreating('closed')} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded"
            style={{ background: 'var(--card-border)', color: 'var(--muted)' }}>
            <X size={14} /> Cancelar
          </button>
        </div>
      </div>
    )
  }

  function EditRow({ cat }: { cat: Category }) {
    return (
      <div className="flex items-center gap-3 flex-1">
        <IconPicker value={editIcon} onChange={setEditIcon} color={editColor} />
        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null) }}
          className="flex-1 px-2 py-1 rounded text-sm outline-none"
          style={{ background: '#0a0a0b', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          autoFocus />
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setEditColor(c)} className="w-4 h-4 rounded-full border-2"
              style={{ background: c, borderColor: editColor === c ? '#fff' : 'transparent' }} />
          ))}
        </div>
        <button onClick={saveEdit} className="p-1 rounded text-green-400 hover:bg-white/10"><Check size={14} /></button>
        <button onClick={() => setEditId(null)} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--muted)' }}><X size={14} /></button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Categorías</h1>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => openCreate('group')} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg"
            style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
            <FolderPlus size={14} />
            <span className="hidden sm:inline">Nuevo grupo</span>
            <span className="sm:hidden">Grupo</span>
          </button>
          <button onClick={() => openCreate('ungrouped')} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            <Plus size={14} />
            <span className="hidden sm:inline">Nueva categoría</span>
            <span className="sm:hidden">Categoría</span>
          </button>
        </div>
      </div>

      {creating === 'group' && <CreateForm title="Nuevo grupo de categorías" />}
      {creating === 'ungrouped' && <CreateForm title="Nueva categoría (sin grupo)" />}

      {loading && <div className="py-12 text-center" style={{ color: 'var(--muted)' }}>Cargando...</div>}

      {!loading && (
        <div className="space-y-2">
          {/* ── Grupos ── */}
          {groups.map((group) => {
            const expanded = expandedGroupId === group.id
            const totalTx = group.children.reduce((s, c) => s + c._count.transactions, 0)

            return (
              <div key={group.id} className="card overflow-hidden">
                {/* Cabecera del grupo */}
                <div
                  className="flex items-center px-4 py-3 gap-3 cursor-pointer hover:bg-white/5 transition-colors"
                  style={{ borderBottom: expanded ? '1px solid var(--card-border)' : 'none' }}
                  onClick={() => setExpandedGroupId(expanded ? null : group.id)}
                >
                  {editId === group.id ? (
                    <EditRow cat={group} />
                  ) : (
                    <>
                      <span style={{ color: group.color ?? '#9E9E9E' }}>
                        <CategoryIcon name={group.icon} size={16} />
                      </span>
                      <span className="flex-1 min-w-0 text-sm font-semibold truncate" title={group.name}>{group.name}</span>
                      <TypeBadge label="Categoría" />
                      <span className="text-xs truncate flex-shrink-0" style={{ color: 'var(--muted)' }}>
                        {group.children.length} subcategorías · {totalTx} transacciones
                      </span>
                      <FixedToggle cat={group} />
                      <button onClick={(e) => { e.stopPropagation(); startEdit(group) }}
                        className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--muted)' }}>
                        <Pencil size={13} />
                      </button>
                      {!group.isDefault && (
                        <button onClick={(e) => { e.stopPropagation(); deleteCategory(group.id, group.name) }}
                          className="p-1.5 rounded hover:bg-white/10 transition-colors text-red-400">
                          <Trash2 size={13} />
                        </button>
                      )}
                      {expanded ? <ChevronDown size={13} style={{ color: 'var(--muted)' }} /> : <ChevronRight size={13} style={{ color: 'var(--muted)' }} />}
                    </>
                  )}
                </div>

                {/* Subcategorías */}
                {expanded && (
                  <div>
                    <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                      {group.children.map((cat) => (
                        <div key={cat.id} className="flex items-center gap-3 py-2.5 hover:bg-white/5 transition-colors"
                          style={{ paddingLeft: '2rem', paddingRight: '1rem' }}>
                          {editId === cat.id ? (
                            <EditRow cat={cat} />
                          ) : (
                            <>
                              <span style={{ color: cat.color ?? '#9E9E9E' }}>
                                <CategoryIcon name={cat.icon} size={14} />
                              </span>
                              <span className="flex-1 min-w-0 text-sm truncate" title={cat.name}>{cat.name}</span>
                              <TypeBadge label="Subcategoría" />
                              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                                {cat._count.transactions} tx
                              </span>
                              {cat.isDefault && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#00d97633', color: 'var(--accent)', fontSize: '10px' }}>
                                  predeterminada
                                </span>
                              )}
                              <FixedToggle cat={cat} />
                              <button onClick={() => startEdit(cat)}
                                className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--muted)' }}>
                                <Pencil size={12} />
                              </button>
                              {!cat.isDefault && (
                                <button onClick={() => deleteCategory(cat.id, cat.name)}
                                  className="p-1.5 rounded hover:bg-white/10 transition-colors text-red-400">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Botón añadir subcategoría */}
                    {typeof creating === 'object' && creating.parentId === group.id ? (
                      <div className="p-3" style={{ borderTop: '1px solid var(--card-border)' }}>
                        <CreateForm title={`Nueva subcategoría en ${group.name}`} />
                      </div>
                    ) : (
                      <button
                        onClick={() => openCreate({ parentId: group.id })}
                        className="flex items-center gap-2 text-xs px-4 py-2.5 w-full hover:bg-white/5 transition-colors"
                        style={{ color: 'var(--muted)', borderTop: '1px solid var(--card-border)' }}>
                        <Plus size={12} /> Añadir subcategoría
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Sin grupo ── */}
          {ungrouped.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--card-border)' }}>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Sin grupo</span>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                {ungrouped.map((cat) => {
                  const addingSubHere = typeof creating === 'object' && creating.parentId === cat.id
                  return (
                    <div key={cat.id}>
                      <div className="flex items-center px-4 py-3 gap-3 hover:bg-white/5 transition-colors">
                        {editId === cat.id ? (
                          <EditRow cat={cat} />
                        ) : (
                          <>
                            <span style={{ color: cat.color ?? '#9E9E9E' }}>
                              <CategoryIcon name={cat.icon} size={14} />
                            </span>
                            <span className="flex-1 min-w-0 text-sm truncate" title={cat.name}>{cat.name}</span>
                            <TypeBadge label="Categoría" />
                            <span className="text-xs truncate flex-shrink-0" style={{ color: 'var(--muted)' }}>
                              {cat._count.transactions} transacciones
                            </span>
                            {cat.isDefault && (
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#00d97633', color: 'var(--accent)' }}>
                                predeterminada
                              </span>
                            )}
                            <FixedToggle cat={cat} />
                            <button onClick={() => openCreate({ parentId: cat.id })}
                              className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--muted)' }}
                              title="Añadir subcategoría (convierte esta categoría en un grupo)">
                              <FolderPlus size={13} />
                            </button>
                            <button onClick={() => startEdit(cat)} className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--muted)' }}>
                              <Pencil size={13} />
                            </button>
                            {!cat.isDefault && (
                              <button onClick={() => deleteCategory(cat.id, cat.name)} className="p-1.5 rounded hover:bg-white/10 transition-colors text-red-400">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {addingSubHere && (
                        <div className="px-4 pb-3" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.75rem' }}>
                          <CreateForm title={`Nueva subcategoría en ${cat.name}`} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
