import { ArrowDownToLine, ArrowUpToLine, Check, ChevronDown, ChevronUp, List } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { VerticalControlButton, VerticalControlPanelWithTooltips, verticalControlButtonClassName } from '@/components/ui/vertical-control-panel'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useChatQuestionNav } from '@/hooks/use-chat-question-nav'
import { useChatScrollControlsContainerWide } from '@/hooks/use-chat-scroll-controls-container-wide'
import type { ChatMessage } from '@/lib/chat-types'
import { extractUserQuestions } from '@/lib/chat-question-nav'
import { cn } from '@/lib/utils'

interface ChatScrollControlsProps {
  messages: ChatMessage[]
  scrollContainerRef: RefObject<HTMLDivElement | null>
  isAtBottom: boolean
  isAtTop: boolean
  resetKey?: string | null
  onScrollToBottom: () => void
  onScrollToTop: () => void
  onScrollToMessage: (messageId: string) => void
}

function OutlineControlButton({
  isFirst,
  tooltip,
  ariaLabel,
  open,
  tooltipSide,
  children,
}: {
  isFirst?: boolean
  tooltip: string
  ariaLabel: string
  open: boolean
  tooltipSide: 'left' | 'right'
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            aria-expanded={open}
            className={verticalControlButtonClassName({
              isFirst,
              className: open ? 'bg-accent' : undefined,
            })}
          >
            {children}
          </button>
        </DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function ChatScrollControls({
  messages,
  scrollContainerRef,
  isAtBottom,
  isAtTop,
  resetKey,
  onScrollToBottom,
  onScrollToTop,
  onScrollToMessage,
}: ChatScrollControlsProps) {
  const { t } = useTranslation('chat')
  const [outlineOpen, setOutlineOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const placeOutside = useChatScrollControlsContainerWide(containerRef, resetKey)

  const userQuestions = useMemo(() => extractUserQuestions(messages), [messages])
  const showNavigation = userQuestions.length >= 2
  const showSingleRoundControls = userQuestions.length === 1
  const shouldMount = showNavigation || userQuestions.length >= 1
  const toolbarVisible = showNavigation || (showSingleRoundControls && (!isAtTop || !isAtBottom))

  const { currentIndex, canGoPrev, canGoNext, goToPrev, goToNext, goToQuestion } = useChatQuestionNav({
    scrollContainerRef,
    userQuestions,
    onScrollToMessage,
    resetKey,
  })

  const tooltipSide = 'right'
  const outlineMenuSide = placeOutside ? 'right' : 'left'

  if (!shouldMount) return null

  return (
    <div ref={containerRef} className="@container/chat-scroll-controls pointer-events-none absolute inset-x-0 bottom-4 px-4">
      <div className="relative mx-auto w-full max-w-3xl">
        <div
          className={cn(
            'absolute bottom-0 right-0',
            '@min-[55rem]/chat-scroll-controls:left-full @min-[55rem]/chat-scroll-controls:ml-3 @min-[55rem]/chat-scroll-controls:right-auto',
            toolbarVisible ? 'pointer-events-auto' : 'pointer-events-none invisible',
          )}
        >
          <VerticalControlPanelWithTooltips>
            {showNavigation ? (
              <DropdownMenu modal={false} open={outlineOpen} onOpenChange={setOutlineOpen}>
                <OutlineControlButton isFirst tooltip={t('questionOutline')} ariaLabel={t('questionOutline')} open={outlineOpen} tooltipSide={tooltipSide}>
                  <List className="size-3.5" strokeWidth={2} />
                </OutlineControlButton>
                <DropdownMenuContent side={outlineMenuSide} align="end" className="max-h-64 w-56 overflow-y-auto">
                  {userQuestions.map(question => {
                    const isCurrent = question.index - 1 === currentIndex
                    return (
                      <DropdownMenuItem
                        key={question.id}
                        className={cn('min-w-0', isCurrent && 'bg-accent font-medium')}
                        onClick={() => {
                          goToQuestion(question.id)
                          setOutlineOpen(false)
                        }}
                      >
                        <span className="truncate">{question.preview}</span>
                        {isCurrent ? <Check className="ml-auto size-3.5 shrink-0 text-foreground" strokeWidth={2} /> : null}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {showNavigation ? (
              <>
                <VerticalControlButton
                  isFirst={false}
                  tooltip={t('questionPrev')}
                  tooltipSide={tooltipSide}
                  aria-label={t('questionPrev')}
                  disabled={!canGoPrev}
                  onClick={goToPrev}
                >
                  <ChevronUp className="size-3.5" strokeWidth={2} />
                </VerticalControlButton>
                <VerticalControlButton
                  tooltip={t('questionNext')}
                  tooltipSide={tooltipSide}
                  aria-label={t('questionNext')}
                  disabled={!canGoNext}
                  onClick={goToNext}
                >
                  <ChevronDown className="size-3.5" strokeWidth={2} />
                </VerticalControlButton>
              </>
            ) : null}

            {showSingleRoundControls ? (
              <VerticalControlButton
                isFirst
                tooltip={t('scrollToTop')}
                tooltipSide={tooltipSide}
                aria-label={t('scrollToTop')}
                disabled={isAtTop}
                onClick={onScrollToTop}
              >
                <ArrowUpToLine className="size-3.5" strokeWidth={2} />
              </VerticalControlButton>
            ) : null}

            <VerticalControlButton
              isFirst={!showNavigation && !showSingleRoundControls}
              tooltip={t('scrollToBottom')}
              tooltipSide={tooltipSide}
              aria-label={t('scrollToBottom')}
              disabled={isAtBottom}
              onClick={onScrollToBottom}
            >
              <ArrowDownToLine className="size-3.5" strokeWidth={2} />
            </VerticalControlButton>
          </VerticalControlPanelWithTooltips>
        </div>
      </div>
    </div>
  )
}
