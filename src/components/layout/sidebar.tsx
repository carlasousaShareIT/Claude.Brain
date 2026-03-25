import { TooltipProvider } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { SidebarHeader } from '@/components/sidebar/sidebar-header'
import { FilterList } from '@/components/sidebar/filter-list'
import { ProfilesPanel } from '@/components/sidebar/profiles-panel'
import { BrainContents } from '@/components/sidebar/brain-contents'
import { SidebarFooter } from '@/components/sidebar/sidebar-footer'

export function Sidebar() {
  return (
    <TooltipProvider>
      <aside className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden border-r border-brain-surface bg-brain-raised">
        <SidebarHeader />
        <Separator className="bg-brain-surface" />
        <FilterList />
        <Separator className="bg-brain-surface" />
        <ProfilesPanel />
        <Separator className="bg-brain-surface" />
        <BrainContents />
        <SidebarFooter />
      </aside>
    </TooltipProvider>
  )
}
