interface UserMessageProps {
  content: string
  modeLabel?: string
}

export function UserMessage({ content, modeLabel }: UserMessageProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {modeLabel ? <p className="mb-1 text-[10px] uppercase tracking-wide opacity-80">{modeLabel}</p> : null}
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
    </div>
  )
}
