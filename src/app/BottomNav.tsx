import { Plus } from 'lucide-react'
import { NavLink } from 'react-router'
import { ADD_ITEM, NAV_ITEMS, type NavItem } from './navigation.ts'

function Tab({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center justify-center gap-0.5 text-nav ${isActive ? 'text-accent' : 'text-text-3'}`
      }
    >
      <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
      <span>{item.label}</span>
    </NavLink>
  )
}

/** iOS-style tab bar (below 1024 px): Hoy, Vocabulario, [+], Juegos, Progreso. */
export function BottomNav() {
  const [today, vocabulary, games, progress] = NAV_ITEMS
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/80 pb-safe backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex h-[49px] max-w-[560px] items-stretch">
        {today ? <Tab item={today} /> : null}
        {vocabulary ? <Tab item={vocabulary} /> : null}
        <NavLink
          to={ADD_ITEM.to}
          aria-label="Añadir palabra"
          className="flex flex-1 items-center justify-center"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-bg">
            <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
          </span>
        </NavLink>
        {games ? <Tab item={games} /> : null}
        {progress ? <Tab item={progress} /> : null}
      </div>
    </nav>
  )
}
