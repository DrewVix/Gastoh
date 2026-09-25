export interface Category {
  id: string
  name: string
  icon: string | null
  color: string | null
  parentId: string | null
  isFixed: boolean
  parent: { id: string; name: string; color: string | null; icon: string | null } | null
  children: { id: string }[]
}

// Solo categorías "hoja" (subcategorías o categorías sin grupo) son asignables:
// los grupos con subcategorías no se pueden usar directamente en una transacción.
function buildCategoryOptions(categories: Category[]) {
  const groups = new Map<string, { label: string; items: Category[] }>()
  const standalone: Category[] = []
  for (const c of categories) {
    if (c.children.length > 0) continue
    if (c.parentId && c.parent) {
      const g = groups.get(c.parentId) ?? { label: c.parent.name, items: [] }
      g.items.push(c)
      groups.set(c.parentId, g)
    } else {
      standalone.push(c)
    }
  }
  return { groups: Array.from(groups.values()), standalone }
}

export default function CategoryOptions({ categories }: { categories: Category[] }) {
  const { groups, standalone } = buildCategoryOptions(categories)
  return (
    <>
      {groups.map(g => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      ))}
      {standalone.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </>
  )
}
