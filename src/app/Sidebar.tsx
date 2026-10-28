import { NavLink } from 'react-router'
import { ADD_ITEM, NAV_ITEMS, SETTINGS_ITEM, type NavItem } from './navigation.ts'

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex h-10 items-center gap-3 rounded-control px-3 transition-colors hover:bg-surface-2 ${
          isActive ? 'bg-surface-2 text-accent' : 'text-text-2'
        }`
      }
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      <span>{item.label}</span>
    </NavLink>
  )
}

/** Fixed side bar (1024 px and up): Hoy, Vocabulario, Añadir, Juegos, Progreso, Ajustes. */
export function Sidebar() {
  const AddIcon = ADD_ITEM.icon
  const [today, vocabulary, games, progress] = NAV_ITEMS
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface px-3 py-5 lg:flex">
      <div className="mb-6 px-3">
        <div className="font-serif text-section font-medium text-accent">Vocab</div>
        <div className="text-caption text-text-3">Inglés británico</div>
      </div>
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
        {today ? <SidebarLink item={today} /> : null}
        {vocabulary ? <SidebarLink item={vocabulary} /> : null}
        <NavLink
          to={ADD_ITEM.to}
          className="my-1 flex h-10 items-center gap-3 rounded-control bg-accent px-3 font-semibold text-bg transition-opacity hover:opacity-90"
        >
          <AddIcon size={20} strokeWidth={2.25} aria-hidden="true" />
          <span className="flex-1">{ADD_ITEM.label}</span>
          <kbd className="rounded-chip bg-bg/15 px-1.5 text-caption font-medium">N</kbd>
        </NavLink>
        {games ? <SidebarLink item={games} /> : null}
        {progress ? <SidebarLink item={progress} /> : null}
        <div className="mt-auto">
          <SidebarLink item={SETTINGS_ITEM} />
        </div>
      </nav>
    </aside>
  )
}
