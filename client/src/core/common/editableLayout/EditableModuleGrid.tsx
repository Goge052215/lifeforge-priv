import { useMemo } from 'react'
import { Responsive as ResponsiveGridLayout } from 'react-grid-layout'

import { type IDashboardLayout, useDivSize } from '@lifeforge/shared'
import { Box, Icon, LoadingScreen, colorWithOpacity } from '@lifeforge/ui'

function getBreakpointFromWidth(width: number) {
  if (width >= 1200) {
    return 'lg'
  } else if (width >= 996) {
    return 'md'
  } else if (width >= 768) {
    return 'sm'
  } else if (width >= 480) {
    return 'xs'
  } else {
    return 'xxs'
  }
}

export interface EditableModuleGridItem {
  id: string
  component: React.FC<{
    dimension: { w: number; h: number }
  }>
}

function EditableModuleGrid({
  wrapperRef,
  canLayoutChange,
  layout,
  onLayoutChange,
  items
}: {
  wrapperRef: React.RefObject<HTMLDivElement | null>
  canLayoutChange: boolean
  layout: IDashboardLayout
  onLayoutChange: (layout: IDashboardLayout) => void
  items: EditableModuleGridItem[]
}) {
  const componentMap = useMemo(
    () => Object.fromEntries(items.map(item => [item.id, item.component])),
    [items]
  )

  const { width } = useDivSize(wrapperRef)

  if (width === 0) {
    return <LoadingScreen message="Loading layout..." />
  }

  return (
    <Box asChild style={canLayoutChange ? { marginBottom: '16em' } : undefined}>
      <ResponsiveGridLayout
        autoSize
        cols={{
          lg: 8,
          md: 8,
          sm: 4,
          xs: 4,
          xxs: 4
        }}
        containerPadding={[0, 0]}
        isDraggable={canLayoutChange}
        isDroppable={canLayoutChange}
        isResizable={canLayoutChange}
        layouts={layout}
        margin={[10, 10]}
        rowHeight={100}
        width={width}
        onLayoutChange={(_, layouts) => {
          onLayoutChange(layouts as IDashboardLayout)
        }}
      >
        {items.map(({ id }) => {
          const Component = componentMap[id]
          const dimension = (layout[getBreakpointFromWidth(width)] || []).find(
            item => item.i === id
          )

          if (!Component) {
            return null
          }

          return (
            <Box
              key={id}
              position="relative"
              style={{
                cursor: canLayoutChange ? 'move' : 'default'
              }}
            >
              <Component
                dimension={{
                  w: dimension?.w ?? 0,
                  h: dimension?.h ?? 0
                }}
              />
              {canLayoutChange && (
                <>
                  <Box
                    bg={colorWithOpacity('bg-900', '30%')}
                    height="100%"
                    left="0"
                    position="absolute"
                    r="lg"
                    top="0"
                    width="100%"
                  />
                  <Box asChild bottom="0" position="absolute" right="0">
                    <Icon icon="clarity:drag-handle-corner-line" size="1.5em" />
                  </Box>
                </>
              )}
            </Box>
          )
        })}
      </ResponsiveGridLayout>
    </Box>
  )
}

export default EditableModuleGrid
