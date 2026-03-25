import { Checkbox } from '@/components/ui/checkbox'

interface MissionsToolbarProps {
  showCompleted: boolean
  onToggle: (checked: boolean) => void
}

export function MissionsToolbar({ showCompleted, onToggle }: MissionsToolbarProps) {
  return (
    <div className="flex items-center justify-between px-1 py-2">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={showCompleted}
          onCheckedChange={(checked: boolean) => onToggle(checked)}
          id="show-completed"
        />
        <label
          htmlFor="show-completed"
          className="cursor-pointer text-xs text-muted-foreground select-none"
        >
          Show completed
        </label>
      </div>
    </div>
  )
}
